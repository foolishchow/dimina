# Design Draft — fe-tools-worker-ctx-direct

Status authority: [Action Status](../../../STATUS.md)

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
- **形状匹配确认**（F-R3-1）：ResetStoreInfoOptions.compilerOptions = `{ templateExts, templateDirectivePrefixes, styleExts, viewScriptExts, viewScriptTags }`（env-compute）= buildPackerContextFromOptions compilerOptions 参数（config-fixpoint）形状一致 ✓——`buildPackerContextFromOptions(storeInfo.pathInfo.workPath, storeInfo.pathInfo.targetPath, storeInfo.compilerOptions)` 可行
- ALS compat 保留（resetStoreInfo 仍调——view/style 仍读 ALS）
- ctx 透传 logicParseWalk（A1 消费）

### D-WCD-2 — logicParseWalk 加 ctx 参数 + 内部 getter 改 ctx 读

```
// logic/parse-walk.ts
export async function logicParseWalk(
	source, modulePath, currentPath, sourceFile, packageName, extraInfoCode, options,
	ctx: PackerContext,  // D-WCD-2: 第 8 参
): Promise<LogicParseWalkResult> {
	// 方案 b 部分迁移（F-R1-1/R1-2 精确归类）：
	// ctx 读 3 getter（F-R8-2 修正）：getWorkPath→ctx.workPath（×7）/ getTargetPath→ctx.targetPath（×1）
	//   getContentByPath（registry-impl 路径，非 parse-walk）→ctx.readContent
	// 保留 ALS 7 getter：getDependencyGraph（×5——ctx 无 graph）/ getAppId（×1——ctx 无 appId）/ getNpmResolver（×1——F-R1-1 返回 NpmResolver 实例非 function）/ resolveAppAlias（×1——**F-R8-2 ctx.resolveAlias stub 返 null ≠ ALS 实际解析，行为 0 破坏**）
	//   getContentByPath（registry-impl 路径，非 parse-walk）→ctx.readContent
	// 保留 ALS 7 getter（F-R8-2 +resolveAppAlias）：getDependencyGraph（×5——ctx 无 graph）/ getAppId（×1——ctx 无 appId）/ getNpmResolver（×1——F-R1-1 返回 NpmResolver 实例非 function）/ resolveAppAlias（×1——F-R8-2 ctx.resolveAlias stub 返 null ≠ ALS 实际解析）
}
```

- **getter 调用点 count**（F-R1-3）：16 处（getWorkPath ×7 + getDependencyGraph ×5 + getAppId ×1 + getTargetPath ×1 + resolveAppAlias ×1 + getNpmResolver ×1）——非 15
- **ctx 读 3 getter**（F-R1-2 + F-R8-2 修正）：getWorkPath→ctx.workPath / getTargetPath→ctx.targetPath / getContentByPath→ctx.readContent（registry-impl 路径）
- **保留 ALS 7 getter**（F-R1-1/R1-2 + F-R8-2）：getDependencyGraph（ctx 无 graph）/ getAppId（ctx 无 appId）/ getNpmResolver（返回 NpmResolver 实例——ctx.resolveNpm function 签名不匹配）/ **resolveAppAlias（F-R8-2：ctx.resolveAlias stub 返 null ≠ ALS resolveAppAliasImpl 实际解析——行为 0 破坏点）**/ getAppConfigInfo / getComponent / isMiniGame（logic/index.ts 路径——ctx 无 configInfo/component）
- **fileTypes 不读**：logic/parse-walk 无 fileTypes getter 调用（fileTypes 在 normalize/compile-config 层，非 parse-walk）
- **调用点 ctx 来源差异**（F-R2-3）：logic/index:211（worker——compile 建 ctx）+ registry-impl:33（主线程——orchestrate 传 ctx）——见 D-WCD-4 ctx 来源双路径

### D-WCD-3 — logic/index.ts worker 路径改 ctx

- logic/index.ts:211 logicParseWalk 调用传 ctx（compile 建的 ctx）
- **compileJS/buildJSByPath 透传链**（F-R4-1）：logicCompile:274 建 ctx → compileJS(pages, root, ..., ctx, options) → buildJSByPath(packageName, module, ..., ctx, options) → logicParseWalk(..., ctx)——ctx 须透传两层
- **8 处调用点 count**（F-R8-1）：compileJS 2 处（L286 mainPages + L289 subPages）+ buildJSByPath 6 处（L55/L59 from compileJS + L100/L108/L190/L228 递归）= 8 处改签名传 ctx；registry-impl 直调 logicParseWalk（非经 compileJS——1 处）
- **ctx 透传方式 lock**（F-R4-2）：ctx 加为 compileJS/buildJSByPath 必传参数（options 前末尾——CompileJSOptions 内嵌不合适，ctx 非可选 PackerContext）
- logic/index.ts 内部 getter 改 ctx 读：getWorkPath→ctx.workPath（×2）/ getContentByPath→ctx.readContent（×1）
- **保留 ALS**（F-R1-2）：getDependencyGraph（×3——ctx 无 graph）/ getAppConfigInfo（×2——ctx 无 configInfo）/ getComponent（×2——ctx 无 component store）/ isMiniGame（×1——ctx 无 isMiniGame）
- resetStoreInfo 保留（ALS compat——view/style 仍读）

### 跨权威一致性（F-R3-2/R4）

- **D-PCS-1**：PackerContext 形状不改（workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes）——A0 复用现有形状
- **D-SC5**：buildResetStoreInfoData 返 storeInfo data（pathInfo/configInfo/compilerOptions/dependencyGraph）——A0 worker compile 从 storeInfo data 建 ctx
- **D-PC**（packer-context-dedup）：buildPackerContextFromOptions 内核（config-fixpoint）——A0 复用（storeInfo compilerOptions 形状匹配 ✓ F-R3-1）
- **D-LR**（l2-l3-retire-research）：A0+A1 合并（worker ctx 直传 + logic parse-walk 迁移）——research 拆分方案 b 锁定

### D-WCD-4 — registry-impl 主线程路径改 _ctx

```
// logic/registry-impl.ts
async load(input: LoadInput, ctx: PackerContext): Promise<LoadedModule> {  // _ctx → ctx
	const source = input.source || ctx.readContent(modulePath) || ''  // getContentByPath → ctx.readContent
	const { emitModule, ... } = await logicParseWalk(source, ..., ctx)
}
```

- _ctx → ctx（Loader.load 契约已有——F-R2-2 主线程 ctx 来源）
- **ctx 来源**（F-R2-2）：主线程路径 ctx = orchestrate 传 ctx（buildPackerContext from env-compute，env-compute:211）；worker 路径 ctx = compile 入口建（buildPackerContextFromOptions from storeInfo data，D-WCD-1）
- getContentByPath → ctx.readContent
- **行为等价确认**（F-R9-1）：getContentByPath(env-compute:319) = `fs.readFileSync(path, 'utf-8')` = ctx.readContent(config-fixpoint)——字节等价 ✓
- logicParseWalk 传 ctx

### ctx 来源双路径（F-R2-2/R2-3）

| 路径 | 调用点 | ctx 来源 |
| --- | --- | --- |
| worker | logic/index.ts:211（compileJS 内） | compile 入口建（D-WCD-1——buildPackerContextFromOptions from storeInfo data） |
| 主线程 | registry-impl.ts:33（Loader.load 内） | orchestrate 传 ctx（buildPackerContext from env-compute:211） |

### D-WCD-5 — successPayload 保留 ALS（不改）

- **F-R2-1**：defineEngine `successPayload: (ctx: { logger }) => Record`——ctx 只收 logger 不收 graph/PackerContext
- logicSuccessPayload 读 `getDependencyGraph().toJSON()`（ALS）——R1 方案 b 锁 getDependencyGraph 保留 ALS
- **A0 不改 successPayload**（getDependencyGraph 仍 ALS——A5 singleton 退役时统一迁）

### D-WCD-6 — ALS compat 保留

- resetStoreInfo 保留（logic/index.ts:275 仍调——view/style compat + logic ALS 残留 getter 读）
- **4 处 resetStoreInfo caller**（F-R3-2）：logic/index.ts:275（A0 scope——保留）+ view/index.ts:192（A2 不动）+ style/index.ts:57（A3 不动）+ emit-engine.ts:12（**emit worker——A0 不动，非 logic 路径**）
- **emit-engine scope 确认**（F-R3-2）：emit-engine.ts:12 是 emit worker 引擎（非 logic/view/style）——A0 不动（emit worker 独立，A2/A3 同类暂不动）
- ALS singleton 保留（view/style parse-walk 仍读 + logic 残留 getter 读）
- **logic ALS 残留量**（F-R3-3）：parse-walk 8 处（getDependencyGraph ×5 + getAppId ×1 + getNpmResolver ×1 + ？）+ index.ts 11 处 = 19 处 ALS 残留（A5 singleton 退役统一迁）

### D-WCD-7 — 测试 fixture 改传 ctx

```
// logic-loader.spec:53
const ctx = buildPackerContext(mockWorkPath, '/out')  // 测试 fixture 建 ctx
logicParseWalk(source, modulePath, 'pages/index', null, null, undefined, options, ctx)
```

## 4. 核心关路：PackerContext 无 graph/appId/npmResolver 字段

**PackerContext 形状**（types.ts）：workPath / targetPath / readContent / resolveAlias / resolveNpm(function) / fileTypes。无 graph / appId / configInfo / component / isMiniGame / NpmResolver。

**方案 b 部分迁移锁定**（F-R1-1/R1-2 精确归类）：
- **ctx 读 3 getter**（F-R8-2 修正）：getWorkPath→ctx.workPath / getTargetPath→ctx.targetPath / getContentByPath→ctx.readContent
- **保留 ALS 7 getter**（F-R8-2 修正 +resolveAppAlias）：getDependencyGraph（ctx 无 graph）/ getAppId（ctx 无 appId）/ getNpmResolver（**F-R1-1**：返回 NpmResolver 实例，ctx.resolveNpm 是 function 签名不匹配）/ **resolveAppAlias（F-R8-2：ctx.resolveAlias stub `(_src) => null` ≠ ALS resolveAppAliasImpl 实际解析——行为 0 破坏点，须保留 ALS）**/ getAppConfigInfo（ctx 无 configInfo）/ getComponent（ctx 无 component store）/ isMiniGame（ctx 无 isMiniGame）
- **A5 统一迁**：保留 ALS 的 7 getter 在 A5 singleton/Proxy 退役时统一迁（须扩 PackerContext 或 ctx 加 graph/configInfo optional）
- **resolveAppAlias A5 实体化路径**（F-R9-2）：env-compute:310 `resolveAppAliasImpl(src, appInfo)`——双参，appInfo 从 ALS singleton 读。A5 退役须实体化 ctx.resolveAlias 为 `resolveAppAliasImpl(src, appInfo)`——appInfo 须加入 ctx（ctx 加 `appInfo?: Record<string, unknown>` optional）or ctx.resolveAlias 闭包 appInfo
- **fileTypes 不读**：logic/parse-walk + logic/index 无 fileTypes getter（fileTypes 在 normalize/compile-config 层）

## 5. 风险

1. **PackerContext 无 graph 字段**（§4 lock——方案 b 部分迁移：ctx 读 3 getter + 保留 ALS 7 getter）
5. **resolveAppAlias 行为 0 破坏点**（F-R8-2）：ctx.resolveAlias stub `(_src) => null` ≠ ALS resolveAppAliasImpl 实际解析——**resolveAppAlias 保留 ALS**（A5 统一迁须实体化 ctx.resolveAlias）
2. **ALS compat 边界**（D-WCD-6）——logic 迁 ctx 后 ALS 写冗余？或保留 view/style compat
3. **successPayload ctx 来源**——compile 建 ctx 透传 successPayload
4. **测试 fixture**——logic-loader.spec:53 须建 ctx（buildPackerContext）

## 5b. Implementation deviations（P-WCD-1..3 atomic 后回填）

- **D-WCD-dev1**：ctx 参数改为 **optional + fallback ALS**（非 design lock 的「必传」）。原因：34 处测试直调 compileJS（传 options 作为第 5 参）——ctx 必传破坏测试调用签名。方案：`ctx?: PackerContext` + 内部 `ctx?.workPath ?? getWorkPath()` fallback ALS。worker 路径传 ctx（新，buildPackerContextFromOptions），测试路径不传（fallback ALS）。行为等价（ctx 读 = ALS 读）。
- **D-WCD-dev2**：ctx 参数位置调整为 **末尾**（options 后，非 options 前）。原因：测试传 options 作为第 5 参——ctx 占第 5 参位置破坏。签名 `compileJS(pages, root, mainCompileRes, progress, options?, ctx?)` + `buildJSByPath(..., options?, ctx?)`。
- **D-WCD-dev3**：logicParseWalk 内 getWorkPath/getTargetPath 提前到函数顶部（`const workPath = ctx?.workPath ?? getWorkPath()`）——原散落 4 处合并为 1 处（DRY）。
- **D-WCD-dev4**：registry-impl.ts:83 测试传 `{}` 作为 ctx——改为不传 ctx（fallback ALS）。orchestrator 调 logicLoader.load 传真 ctx（buildPackerContext）。

## 6. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / resolveAlias/resolveNpm stub 不动
- view/style parse-walk 不动（A2/A3）
- compat 写 / singleton / Proxy 不动（A4/A5）
- emit-engine.ts 不动

## 7. 结论

合并 A0+A1（worker ctx 直传 + logic parse-walk 迁移）。核心关路：PackerContext 无 graph/appId 字段——方案 b 部分迁移（ctx 读 workPath/targetPath/fileTypes/readContent/resolveAlias/resolveNpm；graph/appId/configInfo 仍 ALS——A5 统一迁）。
