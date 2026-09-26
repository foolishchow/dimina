# Design Draft — fe-tools-view-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——D-VPM-1..6 待 readiness review lock。基于 A0（fe-tools-worker-ctx-direct）worker ctx 直传机制 + 复用 optional + fallback ALS 模式。

## 1. 复用 A0 模式

A0（fe-tools-worker-ctx-direct）已建 worker ctx 直传机制：
- compile 入口建 ctx（buildPackerContextFromOptions from storeInfo data）
- compileJS/buildJSByPath/logicParseWalk 透传 ctx（optional + fallback ALS）
- ctx 读 3 getter + 保留 ALS 7 getter

A2 复用——viewCompile 建 ctx + viewParseWalk 透传 + view getter 改 ctx 读。

## 2. 现状（audit 确认）

### 2.1 view/parse-walk getter 调用分布（17 处）

| getter | count | ctx 读? | 说明 |
| --- | --- | --- | --- |
| getWorkPath | ×4 | ✓ ctx.workPath | L904/908/1156/1277 |
| getDependencyGraph | ×4 | ✗ 保留 ALS | L431/784/902/1177——ctx 无 graph |
| getComponent | ×2 | ✗ 保留 ALS | L436/868——ctx 无 component store |
| getContentByPath | ×3 | ✓ ctx.readContent | L830/1191/1242 |
| getTargetPath | ×1 | ✓ ctx.targetPath | L908 |
| getAppId | ×1 | ✗ 保留 ALS | L908——ctx 无 appId |
| getViewScriptExts | ×1 | ✓ ctx.fileTypes.viewScriptExts | L359 |
| getViewScriptTags | ×1 | ✓ ctx.fileTypes.viewScriptTags | L1144 |

- **ctx 读 5 getter**（PackerContext 有 + fileTypes 等价）：getWorkPath/getTargetPath/getContentByPath/getViewScriptExts/getViewScriptTags
- **保留 ALS 3 getter**（ctx 无 or stub 不等价）：getDependencyGraph/getComponent/getAppId

### 2.2 view/index.ts getter + 调用点

- L72 getWorkPath→ctx.workPath（viewCompile 建 ctx 后改）
- L126/137 viewParseWalk 调用（须传 ctx）
- L192 resetStoreInfo（保留——ALS compat）
- L216 successPayload getDependencyGraph（保留 ALS——A5 统一迁）

### 2.3 viewParseWalk 签名

```
export function viewParseWalk(pageModule: ViewModule, options: ViewParseWalkOptions, select?: ViewSelectContext): EmitModule[]
```

3 参 → 加 ctx 第 4 参（optional + fallback ALS）。

## 3. dedup 策略

### D-VPM-1 — viewCompile 建 ctx（A0 复用）

```
// view/index.ts viewCompile 入口
async function viewCompile({ msg, progress, config }: CompileOptions): Promise<...> {
	const m = msg as { storeInfo: ...; ... }
	resetStoreInfo(m.storeInfo)  // ALS compat 保留
	const ctx = buildPackerContextFromOptions(m.storeInfo.pathInfo.workPath!, m.storeInfo.pathInfo.targetPath!, m.storeInfo.compilerOptions!)
	// ctx 透传 viewParseWalk
	...
}
```

- 复用 A0 D-WCD-1 模式（buildPackerContextFromOptions from storeInfo data）
- ALS compat 保留（resetStoreInfo 仍调——style/emit-engine 仍读）
- storeInfo compilerOptions 形状匹配 ✓（A0 F-R3-1 确认）

### D-VPM-2 — viewParseWalk 加 ctx 第 4 参

```
export function viewParseWalk(
	pageModule: ViewModule,
	options: ViewParseWalkOptions,
	select?: ViewSelectContext,
	ctx?: PackerContext,  // D-VPM-2: 第 4 参（optional + fallback ALS，复用 A0 dev1）
): EmitModule[] {
	const workPath = ctx?.workPath ?? getWorkPath()  // DRY 提前（复用 A0 dev3）
	const targetPath = ctx?.targetPath ?? getTargetPath()
	...
}
```

- 复用 A0 dev1（ctx?: PackerContext + fallback ALS）
- getWorkPath/getTargetPath DRY 提前到函数顶部（复用 A0 dev3）

### D-VPM-3 — view/parse-walk 17 处 getter 改 ctx 读

- **ctx 读 5 getter**：
  - getWorkPath→workPath（DRY 顶部 local，L904/908/1156/1277）
  - getTargetPath→targetPath（DRY 顶部 local，L908）
  - getContentByPath→ctx?.readContent(path) ?? getContentByPath(path)（L830/1191/1242）
  - getViewScriptExts→ctx?.fileTypes.viewScriptExts ?? getViewScriptExts()（L359）
  - getViewScriptTags→ctx?.fileTypes.viewScriptTags ?? getViewScriptTags()（L1144）
- **保留 ALS 3 getter**：getDependencyGraph（×4——ctx 无 graph）/ getComponent（×2——ctx 无 component store）/ getAppId（×1——ctx 无 appId）

### D-VPM-4 — view/index.ts viewParseWalk 调用传 ctx

- L126 `viewParseWalk(page, { sourcemap }, { viewCache, dirtySet }, ctx)`
- L137 `viewParseWalk(page, { sourcemap }, undefined, ctx)`

### D-VPM-5 — ALS compat 保留

- resetStoreInfo 保留（view/index.ts:192 仍调——style/emit-engine compat）
- style/index.ts:57 + emit-engine.ts:12 resetStoreInfo 不动（A3 独立）
- ALS singleton 保留（style parse-walk 仍读 + view ALS 残留 getter 读）

### D-VPM-6 — view/index.ts 内部 getter

- L72 getWorkPath→ctx?.workPath ?? getWorkPath()（viewCompile 建 ctx 后改）
- L216 successPayload getDependencyGraph 保留 ALS（A5 统一迁——A0 F-R2-1 模式）

## 4. getViewScriptExts/getViewScriptTags ctx 读 等价确认

**问题**（readiness gap 1）：getViewScriptExts/getViewScriptTags 从 ALS store 读 fileTypes——ctx.fileTypes.viewScriptExts/viewScriptTags 是否等价？

**确认**（A0 F-R3-1 模式）：buildPackerContextFromOptions 的 fileTypes 来自 storeInfo.compilerOptions（buildResetStoreInfoData 从 ctx.fileTypes 组装）——同源。ctx.fileTypes.viewScriptExts = ALS getViewScriptExts() 字节等价 ✓。

## 5. 风险

1. **getViewScriptExts/getViewScriptTags ctx 读**（§4 确认等价 ✓）
2. **viewParseWalk 内部函数透传**：compileViewTree 等内部函数 17 处 getter 分布——ctx 须透传内部函数 or 顶部建 local（DRY 提前——复用 A0 dev3）
3. **resolveAppAlias 行为 0 守护**（A0 R8）：view/parse-walk 若用 resolveAppAlias 须保留 ALS（A5 实体化）——须确认 view 是否用 resolveAppAlias

## 6. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / resolveAlias/resolveNpm stub 不动
- style parse-walk 不动（A3）
- compat 写 / singleton / Proxy 不动（A4/A5）
- emit-engine.ts 不动

## 7. 结论

A2 复用 A0 模式（optional + fallback ALS + DRY 提前）。viewCompile 建 ctx + viewParseWalk 透传 + view 17 处 getter 改 ctx 读（5 ctx + 3 ALS）。ALS compat 保留（resetStoreInfo + style/emit-engine 不动）。
