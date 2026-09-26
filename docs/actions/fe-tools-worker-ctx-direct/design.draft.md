# Design Draft — fe-tools-worker-ctx-direct

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——D-WCD-1..7 待 readiness review lock。基于 research（fe-tools-l2-l3-retire-research）拆分方案 A0+A1 合并。

## 1. 合并 A0+A1 理由

research 拆分 A0（worker ctx 直传——建机制）+ A1-A3（parse-walk 迁移——消费者）。A0 单独建机制无消费者（ctx 闲置，行为 0 但代码冗余）。**合并 A0+A1**：建机制 + logic parse-walk 迁移（第一个消费者验证机制工作）。

## 2. 现状（research audit 确认）

### 2.1 worker 透传现状（storeInfo ALS 恢复）

```
orchestrate → runCompileStage → input.storeInfo（buildResetStoreInfoData）
  → worker msg.storeInfo → resetStoreInfo(m.storeInfo) → 写 ALS singleton
  → parse-walk 读 ALS getter（getWorkPath 等）
```

### 2.2 logic getter 调用分布

- **logic/parse-walk.ts**：15 处（getWorkPath ×5 + getDependencyGraph ×5 + getAppId ×1 + getTargetPath ×1 + resolveAppAlias ×1 + getNpmResolver ×1）
- **logic/index.ts**：~15 处（getWorkPath ×2 + getDependencyGraph ×3 + getAppConfigInfo ×2 + getComponent ×2 + getContentByPath ×1 + isMiniGame ×1 + resetStoreInfo ×1 + successPayload getDependencyGraph ×1）
- **logic/registry-impl.ts**：getContentByPath ×1（主线程 Loader.load 路径）

### 2.3 logicParseWalk 调用点

- logic/index.ts:211（worker 引擎内）
- registry-impl.ts:33（主线程 Loader.load 内——_ctx 已在契约未用）
- logic-loader.spec:53（测试 fixture 直调）

## 3. dedup 策略

### D-WCD-1 — worker 引擎 compile 内建 PackerContext（A0 方案 b）

```
// logic/index.ts compile 入口
compile: async (opts: CompileOptions) => {
	const m = msg as { storeInfo: ResetStoreInfoOptions; ... }
	// 方案 b：buildPackerContext 重建 PackerContext（from storeInfo data）
	const ctx = buildPackerContextFromOptions(m.storeInfo.pathInfo.workPath, m.storeInfo.pathInfo.targetPath, m.storeInfo.compilerOptions)
	// ALS compat 保留：resetStoreInfo 仍调（view/style 仍读 ALS）
	resetStoreInfo(m.storeInfo)
	// ctx 透传 logicParseWalk（A1 消费）
	const { emitModule, ... } = await logicParseWalk(source, ..., ctx)
	...
}
```

- worker 引擎 compile 入口建 PackerContext（from storeInfo data——buildPackerContextFromOptions 内核，packer-context-dedup 产出）
- ALS compat 保留（resetStoreInfo 仍调——view/style 仍读 ALS）
- ctx 透传 logicParseWalk（A1 消费）

### D-WCD-2 — logicParseWalk 加 ctx 参数 + 内部 getter 改 ctx 读

```
// logic/parse-walk.ts
export async function logicParseWalk(
	source, modulePath, currentPath, sourceFile, packageName, extraInfoCode, options,
	ctx: PackerContext,  // D-WCD-2: 第 8 参
): Promise<LogicParseWalkResult> {
	// getWorkPath() → ctx.workPath
	// getDependencyGraph() → ??? （ctx 无 graph 字段——须 ctx 读 or 保留 ALS?）
	// getAppId() → ??? （ctx 无 appId）
	// getTargetPath() → ctx.targetPath
	// getNpmResolver() → ??? （ctx.resolveNpm stub）
	// resolveAppAlias(specifier) → ctx.resolveAlias(specifier)
}
```

**问题**（readiness gap）：PackerContext 无 graph/appId/npmResolver 字段——getDependencyGraph/getAppId/getNpmResolver 须保留 ALS 读 or 扩 PackerContext？

### D-WCD-3 — logic/index.ts worker 路径改 ctx

- logic/index.ts:211 logicParseWalk 调用传 ctx（compile 建的 ctx）
- logic/index.ts 内部 getter 改 ctx 读（getWorkPath→ctx.workPath 等）——但 getDependencyGraph/getAppConfigInfo/getComponent/isMiniGame 须 graph 数据（ctx 无）

**问题**（readiness gap）：logic/index.ts 读 graph 数据（getDependencyGraph/getAppConfigInfo/getComponent/isMiniGame）——ctx 无 graph 字段。须扩 PackerContext 或保留 ALS 读 graph？

### D-WCD-4 — registry-impl 主线程路径改 _ctx

```
// logic/registry-impl.ts
async load(input: LoadInput, ctx: PackerContext): Promise<LoadedModule> {  // _ctx → ctx
	const source = input.source || ctx.readContent(modulePath) || ''  // getContentByPath → ctx.readContent
	const { emitModule, ... } = await logicParseWalk(source, ..., ctx)
}
```

- _ctx → ctx（Loader.load 契约已有）
- getContentByPath → ctx.readContent
- logicParseWalk 传 ctx

### D-WCD-5 — successPayload logic 路径改 ctx

```
// logic/index.ts successPayload
successPayload: (ctx) => ({ dependencyGraph: ctx.??? })  // getDependencyGraph().toJSON() → ctx 读
```

**问题**（readiness gap）：successPayload 读 graph——ctx 无 graph 字段。须 ctx 扩 graph or successPayload 收 graph？

### D-WCD-6 — ALS compat 保留

- resetStoreInfo 保留（logic/index.ts:275 仍调——但 logic 路径迁 ctx 后 ALS 写冗余？或保留 view/style compat）
- view/index.ts:192 + style/index.ts:57 + emit-engine.ts:12 resetStoreInfo 不动（A2/A3 独立 Action）
- ALS singleton 保留（view/style parse-walk 仍读）

### D-WCD-7 — 测试 fixture 改传 ctx

```
// logic-loader.spec:53
const ctx = buildPackerContext(mockWorkPath, '/out')  // 测试 fixture 建 ctx
logicParseWalk(source, modulePath, 'pages/index', null, null, undefined, options, ctx)
```

## 4. 核心关路：PackerContext 无 graph/appId/npmResolver 字段

**问题**：logic getter 读 graph 数据（getDependencyGraph/getAppConfigInfo/getComponent/isMiniGame/getAppId/getNpmResolver）——PackerContext 无这些字段（只有 workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes）。

**方案候选**：
- **a：扩 PackerContext**（加 graph/configInfo/appId 字段）——但 PackerContext 形状改变（Non-scope）
- **b：logic 路径保留 ALS 读 graph**（getDependencyGraph 等仍读 ALS）——只迁 workPath/targetPath/fileTypes/readContent/resolveAlias/resolveNpm（ctx 读）；graph/appId/configInfo 仍 ALS
- **c：ctx 扩可选 graph/configInfo**（PackerContext 加 optional graph?/configInfo?）——形状扩展但 optional 不破

**倾向**：方案 b（部分迁移——ctx 读 workPath/targetPath/fileTypes/readContent/resolveAlias/resolveNpm；graph/appId/configInfo 仍 ALS——A5 singleton 退役时统一迁）。最小改动 + 不破 PackerContext 形状。

## 5. 风险

1. **PackerContext 无 graph 字段**（readiness gap §4）——logic getter 部分迁 ctx + 部分保留 ALS
2. **ALS compat 边界**（D-WCD-6）——logic 迁 ctx 后 ALS 写冗余？或保留 view/style compat
3. **successPayload ctx 来源**——compile 建 ctx 透传 successPayload
4. **测试 fixture**——logic-loader.spec:53 须建 ctx（buildPackerContext）

## 6. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / resolveAlias/resolveNpm stub 不动
- view/style parse-walk 不动（A2/A3）
- compat 写 / singleton / Proxy 不动（A4/A5）
- emit-engine.ts 不动

## 7. 结论

合并 A0+A1（worker ctx 直传 + logic parse-walk 迁移）。核心关路：PackerContext 无 graph/appId 字段——方案 b 部分迁移（ctx 读 workPath/targetPath/fileTypes/readContent/resolveAlias/resolveNpm；graph/appId/configInfo 仍 ALS——A5 统一迁）。
