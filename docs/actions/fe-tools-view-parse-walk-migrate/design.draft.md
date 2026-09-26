# Design Draft — fe-tools-view-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

> **状态：ready**——D-VPM-1..6 已 review lock。基于 A0（fe-tools-worker-ctx-direct）worker ctx 直传机制 + 复用 optional + fallback ALS 模式。

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
- **import 变更**（F-R4-2）：view/index.ts 须加 `import { buildPackerContextFromOptions } from '../../packer/graph/config-fixpoint.ts'` + `import type { PackerContext } from '../../packer/types.ts'`
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

### D-VPM-3 — 独立函数加 ctx 透传 + 17 处 getter 改 ctx 读（F-R1-1 修正）

**关键**（F-R1-1）：viewParseWalk 自身（L320-330）无 getter 调用——17 处 getter 全在独立函数。须独立函数加 ctx 参数透传。

**独立函数透传链**（9 函数加 ctx 参数 + 透传深度 4 层——F-R8-1）：

**透传链深度 4 层**（F-R8-1）：
- viewParseWalk → compileViewTree → compileModule → processWxsDependency → processWxsContent（4 层）
- compileModule → transTagWxs/collectAllWxsModules（互调）

**9 函数加 ctx 参数**：
- compileViewTree(module, isComponent, scriptRes, ..., select?, ctx?)——L431/436 getter + 递归 L446
- compileModule(module, isComponent, scriptRes, options, ctx?)——L752 调 processWxsDependency + L1206/1248 调 processWxsContent
- transAsses(document, imageNodes, path, graphOwnerPath, ctx?)——L902/904/908 getter（export，**wxml/load 主线程路径**——F-R8-3，fallback ALS）
- processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath, ctx?)——L784 getter（export）
- processWxsDependency(wxsFilePath, moduleName, scriptModule, workPath, filePath, graphOwnerPath, ctx?)——L830 getter
- processIncludedFileWxsDependencies(componentTags, includePath, scriptModule, components, processedPaths, ctx?)——L868 getter
- scanWxsFiles(dir, workPath, ctx?)——L359 getter（已收 workPath，F-R1-3）
- **transTagWxs**（F-R8-2/R9-1，L1142 export）——L1144 getViewScriptTags + L1156 getWorkPath + L1177 getDependencyGraph + L1191 getContentByPath（4 处 getter）+ **3 处外部调用者**（wxml/load/index.ts L167/209/249——主线程，fallback ALS）
- **collectAllWxsModules**（F-R8-2/R9-2，L1275）——L1277 getWorkPath（1 处 getter）+ **4 处内部调用**（L489 mergeWxsModules + L555 tryModuleCache + L1299/1311 递归——须递归透传 ctx）
- **外部调用者 fallback ALS 兼容**（F-R2-1/R2-2/R8-3）：transAsses（wxml/load/index.ts:262——**主线程路径**，非 worker，fallback ALS）+ processWxsContent（view-compiler.spec.js 9 处测试直调，fallback ALS）+ transTagWxs（export，外部调用者 fallback ALS）
- **compileViewTree 递归透传**（F-R2-3）：L324 viewParseWalk 调 + L446 递归调——2 处须传 ctx

**ctx 读 5 getter**（F-R1-2 等价确认）：
- getWorkPath→ctx?.workPath ?? getWorkPath()（L904/908/1156/1277）
- getTargetPath→ctx?.targetPath ?? getTargetPath()（L908）
- getContentByPath→ctx?.readContent(path) ?? getContentByPath(path)（L830/1191/1242）
- getViewScriptExts→ctx?.fileTypes.viewScriptExts ?? getViewScriptExts()（L359——**F-R1-2 等价确认**：env.ts:146 getCompilerContext().compilerOptions.viewScriptExts = ctx.fileTypes.viewScriptExts 同源 ✓）
- getViewScriptTags→ctx?.fileTypes.viewScriptTags ?? getViewScriptTags()（L1144——同 F-R1-2 等价 ✓）
- **保留 ALS 3 getter**：getDependencyGraph（×4——ctx 无 graph）/ getComponent（×2——ctx 无 component store）/ getAppId（×1——ctx 无 appId）

### D-VPM-4 — view/index.ts viewParseWalk 调用传 ctx（3 层透传——F-R3-2）

- **透传链 3 层**（F-R3-2）：viewCompile L190 建 ctx → compileML L73 透传 → viewParseWalk L126/137 传 ctx
- L126 `viewParseWalk(page, { sourcemap }, { viewCache, dirtySet }, ctx)`
- L137 `viewParseWalk(page, { sourcemap }, undefined, ctx)`

### D-VPM-5 — ALS compat 保留

- resetStoreInfo 保留（view/index.ts:192 仍调——style/emit-engine compat）
- style/index.ts:57 + emit-engine.ts:12 resetStoreInfo 不动（A3 独立）
- ALS singleton 保留（style parse-walk 仍读 + view ALS 残留 getter 读）
- **view ALS 残留量**（F-R4-1）：parse-walk 7 处（getDependencyGraph ×4 + getComponent ×2 + getAppId ×1）+ index.ts 1 处（successPayload getDependencyGraph）= 8 处 ALS 残留（A5 singleton 退役统一迁）

### D-VPM-6 — view/index.ts 内部 getter + compileML 透传（F-R3-1）

- **compileML 签名加 ctx 透传**（F-R3-1）：compileML(pages, root, progress, viewCache?, viewOrderList?, invalidated?, ctx?)——L72 getWorkPath→ctx?.workPath ?? getWorkPath()
- **透传链 3 层**（F-R3-2）：viewCompile L190 建 ctx → compileML L73 透传 → viewParseWalk L126/137 传 ctx
- L72 getWorkPath→ctx?.workPath ?? getWorkPath()（compileML 内）
- L216 successPayload getDependencyGraph 保留 ALS（A5 统一迁——A0 F-R2-1 模式）

## 4. getViewScriptExts/getViewScriptTags ctx 读 等价确认（F-R1-2）

**确认**（A0 F-R3-1 模式）：
- getViewScriptExts（env.ts:146）= `getCompilerContext().compilerOptions.viewScriptExts`（ALS）
- ctx.fileTypes.viewScriptExts（buildPackerContextFromOptions）来自 storeInfo.compilerOptions（buildResetStoreInfoData 从 ctx.fileTypes 组装）——**同源** ✓
- ctx.fileTypes.viewScriptExts = ALS getViewScriptExts() 字节等价 ✓
- getViewScriptTags 同理 ✓

## 5. 风险

1. **getViewScriptExts/getViewScriptTags ctx 读**（§4 确认等价 ✓）
2. **独立函数透传链**（F-R1-1）：7+ 独立函数加 ctx 参数——scope 中-大（compileViewTree/transAsses/processWxsContent/processWxsDependency/processIncludedFileWxsDependencies/scanWxsFiles 等）
3. **已收 workPath 函数**（F-R1-3）：scanWxsFiles/processWxsContent/processWxsDependency 已收 workPath——ctx 可加在末尾 or 复用 workPath 位置
3. **resolveAppAlias 行为 0 守护**（A0 R8）：view/parse-walk 若用 resolveAppAlias 须保留 ALS（A5 实体化）——须确认 view 是否用 resolveAppAlias

## 6. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / resolveAlias/resolveNpm stub 不动
- style parse-walk 不动（A3）
- compat 写 / singleton / Proxy 不动（A4/A5）
- emit-engine.ts 不动

## 6b. 跨权威一致性

- **A0（fe-tools-worker-ctx-direct）**：复用 worker ctx 直传机制 + optional + fallback ALS + DRY 提前 + buildPackerContextFromOptions
- **D-PCS-1**：PackerContext 形状不改（workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes）
- **D-SC5**：buildResetStoreInfoData 返 storeInfo data——A2 viewCompile 从 storeInfo 建 ctx
- **D-PC**（packer-context-dedup）：buildPackerContextFromOptions 内核——A2 复用
- **A0 R8**（resolveAppAlias 行为 0 守护）：view 不用 resolveAppAlias ✓（F-R1 确认）

## 6c. 行为 0 等价确认（F-R9）

- **ctx.readContent = getContentByPath**：fs.readFileSync(path, 'utf-8') 字节等价 ✓（A0 F-R9-1）
- **getViewScriptExts/getViewScriptTags**：ctx.fileTypes 同源 ALS getCompilerContext().compilerOptions ✓（R1 F-R1-2）
- **ctx.workPath/targetPath**：storeInfo.pathInfo 同源 ALS ✓（A0 确认）
- **fallback ALS 行为等价**：独立函数不传 ctx 时 `ctx?.x ?? ALSGetter()` = ALSGetter()（原行为）✓

## 7. 结论

A2 复用 A0 模式（optional + fallback ALS + DRY 提前）。viewCompile 建 ctx + viewParseWalk 透传 + view 17 处 getter 改 ctx 读（5 ctx + 3 ALS）。ALS compat 保留（resetStoreInfo + style/emit-engine 不动）。
