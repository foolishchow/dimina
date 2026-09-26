# Design Draft — fe-tools-style-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

> **状态：ready**——D-SPM-1..6 已 review lock。基于 A0/A2（worker ctx 直传机制）+ 复用 optional + fallback ALS 模式。

## 1. 复用 A0/A2 模式

A0（fe-tools-worker-ctx-direct）+ A2（fe-tools-view-parse-walk-migrate）已建 worker ctx 直传机制：
- compile 入口建 ctx（buildPackerContextFromOptions from storeInfo data）
- parse-walk 透传 ctx（optional + fallback ALS）
- ctx 读 getter + 保留 ALS getter

A3 复用——styleCompile 建 ctx + buildCompileCss 透传 + style getter 改 ctx 读。

## 2. 现状（audit 确认）

### 2.1 style/parse-walk getter 调用分布（16 处）

| getter | count | ctx 读? | 说明 |
| --- | --- | --- | --- |
| getWorkPath | ×8 | ✓ ctx.workPath | L191/344/360/480/484/489 + L505/511 default param |
| getDependencyGraph | ×3 | ✗ 保留 ALS | L90/319/478——ctx 无 graph |
| getContentByPath | ×1 | ✓ ctx.readContent | L323 |
| getTargetPath | ×1 | ✓ ctx.targetPath | L484 |
| getAppId | ×1 | ✗ 保留 ALS | L484——ctx 无 appId |
| getComponent | ×1 | ✗ 保留 ALS | L95——ctx 无 component store |
| getStyleExts | ×1 | ✓ ctx.fileTypes.styleExts | L492 |

- **ctx 读 4 getter**（PackerContext 有 + fileTypes 等价）：getWorkPath/getTargetPath/getContentByPath/getStyleExts
- **保留 ALS 3 getter**（ctx 无 or stub 不等价）：getDependencyGraph/getComponent/getAppId

### 2.2 style/index.ts getter + 调用点

- L30 buildCompileCss 调用（compileSS 内——worker 路径）
- L57 resetStoreInfo（保留——ALS compat）
- compileSS 函数（L13）调 buildCompileCss（L30）

### 2.3 buildCompileCss 签名 + 调用点

```
export async function buildCompileCss(module: StyleModule, compiledPaths: Set<string> = new Set(), options: StyleOptions = {}): Promise<StyleCompileResult>
```

3 参 → 加 ctx 第 4 参（optional + fallback ALS）。

**调用点**：
- style/index.ts:30（compileSS 内——worker 路径）
- style/parse-walk.ts:270（递归——buildCompileCss 内调 buildCompileCss）

### 2.4 resolveStyleImportPath/normalizeRootStyleImports（export default param）

```
export function resolveStyleImportPath(absolutePath: string, importPath: string, workPath: string = getWorkPath()): string
export function normalizeRootStyleImports(source: string, workPath: string = getWorkPath()): string
```

default param `workPath = getWorkPath()`——export 独立函数。加 ctx 后 default param 处理（readiness gap 3）。

## 3. dedup 策略

### D-SPM-1 — styleCompile 建 ctx（A0/A2 复用）

```
// style/index.ts styleCompile 入口
async function styleCompile({ msg, progress, config }: CompileOptions): Promise<...> {
	const m = msg as { storeInfo: ...; ... }
	resetStoreInfo(m.storeInfo)  // ALS compat 保留
	const ctx = buildPackerContextFromOptions(m.storeInfo.pathInfo.workPath!, m.storeInfo.pathInfo.targetPath!, m.storeInfo.compilerOptions!)
	// ctx 透传 compileSS/buildCompileCss
	...
}
```

- 复用 A0 D-WCD-1/A2 D-VPM-1 模式（buildPackerContextFromOptions from storeInfo data）
- **import 变更**（F-R4-2）：style/index.ts 须加 `import { buildPackerContextFromOptions } from '../../packer/graph/config-fixpoint.ts'` + `import type { PackerContext } from '../../packer/types.ts'`
- ALS compat 保留（resetStoreInfo 仍调——logic/view 已迁 + emit-engine 仍读）
- storeInfo compilerOptions 形状匹配 ✓（A0 F-R3-1 确认）

### D-SPM-2 — buildCompileCss 加 ctx 第 4 参

```
export async function buildCompileCss(
	module: StyleModule,
	compiledPaths: Set<string> = new Set(),
	options: StyleOptions = {},
	ctx?: PackerContext,  // D-SPM-2: 第 4 参（optional + fallback ALS，复用 A0 dev1/A2）
): Promise<StyleCompileResult> {
	const workPath = ctx?.workPath ?? getWorkPath()  // DRY 提前（复用 A0 dev3/A2）
	const targetPath = ctx?.targetPath ?? getTargetPath()
	...
}
```

- 复用 A0 dev1/A2（ctx?: PackerContext + fallback ALS）
- getWorkPath/getTargetPath DRY 提前到函数顶部（复用 A0 dev3/A2）

### D-SPM-3 — 独立函数加 ctx 透传 + 16 处 getter 改 ctx 读（F-R1-1 修正）

**关键**（F-R1-1）：buildCompileCss 自身（L134-138）无 getter 调用——只调 styleLoad/styleCompile/styleEmit。16 处 getter 全在独立函数。须独立函数加 ctx 参数透传。

**独立函数透传链**（6 函数加 ctx 参数 + 透传深度 2 层——F-R2-1）：

**透传链深度 2 层**（F-R2-1）：buildCompileCss → styleCompile → createStyleTransformPlugin/getAbsolutePath/getStyleSourcePath/normalizeCssUrlValue

- **styleCompile**(loadedModules, options, ctx?)——L108（中间层透传——buildCompileCss L136 调，须透传 ctx 到 createStyleTransformPlugin/getAbsolutePath/getStyleSourcePath/normalizeCssUrlValue）
- styleLoad(module, compiledPaths, ctx?)——L90 getDependencyGraph + L95 getComponent（保留 ALS）
- getStyleSourcePath(absolutePath, ctx?)——L191 getWorkPath→ctx?.workPath ?? getWorkPath()
- createStyleTransformPlugin(module, absolutePath, importResults, options, ctx?)——L319 getDependencyGraph（保留 ALS）+ L323 getContentByPath→ctx?.readContent ?? getContentByPath + L344/360 getWorkPath→ctx?.workPath ?? getWorkPath() + **内部调用关系**（F-R8-2：L302 normalizeCssUrlValue + L312 getAbsolutePath + L335/388 getStyleSourcePath——须透传 ctx 到这些子调用）
- normalizeCssUrlValue(value, absolutePath, graphOwnerPath, ctx?)——L478 getDependencyGraph（保留 ALS）+ L480/484 getWorkPath→ctx?.workPath ?? getWorkPath() + L484 getTargetPath→ctx?.targetPath ?? getTargetPath() + getAppId（保留 ALS）+ **2 处测试外部调用者**（F-R8-1：style-compiler.spec.js L112/117 传 2 参不传 ctx——fallback ALS 兼容 ✓）
- getAbsolutePath(modulePath, ctx?)——L489 getWorkPath→ctx?.workPath ?? getWorkPath() + L492 getStyleExts→ctx?.fileTypes.styleExts ?? getStyleExts()
- resolveStyleImportPath/normalizeRootStyleImports（export，default param——D-SPM-6）

**ctx 读 4 getter**（F-R1-2 等价确认）：
- getWorkPath→ctx?.workPath ?? getWorkPath()（L191/344/360/480/484/489 + L505/511 default param 保留）
- getTargetPath→ctx?.targetPath ?? getTargetPath()（L484）
- getContentByPath→ctx?.readContent(path) ?? getContentByPath(path)（L323）
- getStyleExts→ctx?.fileTypes.styleExts ?? getStyleExts()（L492——**F-R1-2 等价确认**：env.ts:142 getCompilerContext().compilerOptions.styleExts = ctx.fileTypes.styleExts 同源 ✓）
- **保留 ALS 3 getter**：getDependencyGraph（×3——ctx 无 graph）/ getComponent（×1——ctx 无 component store）/ getAppId（×1——ctx 无 appId）

### D-SPM-4 — style/index.ts compileSS/buildCompileCss 调用传 ctx（3 层透传——F-R3-1/R3-2）

- **透传链 3 层**（F-R3-2）：styleCompile L55 建 ctx → compileSS L64/67 透传 → buildCompileCss L31 传 ctx
- **compileSS 签名加 ctx 透传**（F-R3-1）：compileSS(pages, root, progress, options, styleCache?, invalidated?, ctx?)——L31 `buildCompileCss(page, new Set(), options, ctx)`
- styleCompile L57 后建 ctx + 透传 compileSS L64/67

### D-SPM-5b — buildCompileCss 递归（L270）+ resolveStyleImportPath default param（F-R8-3）

- **buildCompileCss 递归**（L270）：`buildCompileCss({...}, new Set(), options, ctx)`——递归须传 ctx
- **L268 resolveStyleImportPath default param**（F-R8-3）：`resolveStyleImportPath(absolutePath, importPath)`——不传 workPath（default getWorkPath fallback ALS）

### D-SPM-5 — ALS compat 保留

- resetStoreInfo 保留（style/index.ts:57 仍调——logic/view 已迁 + emit-engine compat）
- emit-engine.ts:12 resetStoreInfo 不动
- ALS singleton 保留（emit-engine 仍读 + style ALS 残留 getter 读）
- **style ALS 残留量**（F-R4-1）：parse-walk 5 处（getDependencyGraph ×3 + getComponent ×1 + getAppId ×1）——A5 singleton 退役统一迁（logic 7 + view 8 + style 5 = 20 处 ALS 残留）

### D-SPM-6 — resolveStyleImportPath/normalizeRootStyleImports default param

**已 resolve**（R2/D-SPM-6）：export 独立函数 default param `workPath = getWorkPath()`——保留 default fallback ALS（不须加 ctx 参数——只读 workPath）。

**方案**：保留 default param `workPath = getWorkPath()`（fallback ALS）。caller 传 workPath 时不调 default；不传时 fallback ALS。不须加 ctx 参数（这两个函数只读 workPath，不读其他 getter——workPath 参数已够）。

**测试调用者**（F-R2-2）：style-compiler.spec.js:97/103 2 处直调——传 workPath 参数（不调 default getWorkPath）——fallback ALS 兼容 ✓

## 4. getStyleExts ctx 读 等价确认（F-R1-2）

**确认**（A0 F-R3-1/A2 F-R1-2 模式）：
- getStyleExts（env.ts:142）= `getCompilerContext().compilerOptions.styleExts`（ALS）
- ctx.fileTypes.styleExts（buildPackerContextFromOptions）来自 storeInfo.compilerOptions（buildResetStoreInfoData 从 ctx.fileTypes 组装）——**同源** ✓
- ctx.fileTypes.styleExts = ALS getStyleExts() 字节等价 ✓

## 5. 风险

1. **getStyleExts ctx 读**（§4 确认等价 ✓）
2. **buildCompileCss 内部函数透传**：16 处 getter 分布——ctx 须透传内部函数 or 顶部建 local（DRY 提前——复用 A0 dev3/A2）
3. **resolveStyleImportPath/normalizeRootStyleImports default param**（D-SPM-6——保留 default getWorkPath fallback ALS）
4. **resolveAppAlias 行为 0 守护**（A0 R8——**F-R1-3 确认 style 不用 resolveAppAlias** ✓）：style/parse-walk 无 resolveAppAlias 调用——A0 R8 行为 0 守护不适用 style

## 6. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / resolveAlias/resolveNpm stub 不动
- logic/view parse-walk 不动（A1/A2 已迁）
- compat 写 / singleton / Proxy 不动（A4/A5）
- emit-engine.ts 不动

## 6b. 跨权威一致性

- **A0（fe-tools-worker-ctx-direct）**：复用 worker ctx 直传机制 + optional + fallback ALS + DRY 提前 + buildPackerContextFromOptions
- **A2（fe-tools-view-parse-walk-migrate）**：复用独立函数透传链模式（4 层 view vs A3 2 层 style）+ ctx optional + fallback ALS
- **D-PCS-1**：PackerContext 形状不改（workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes）
- **D-SC5**：buildResetStoreInfoData 返 storeInfo data——A3 styleCompile 从 storeInfo 建 ctx
- **D-PC**（packer-context-dedup）：buildPackerContextFromOptions 内核——A3 复用
- **A0 R8**（resolveAppAlias 行为 0 守护）：style 不用 resolveAppAlias ✓（F-R1-3 确认）

## 6c. 行为 0 等价确认（F-R9）

- **ctx.readContent = getContentByPath**：fs.readFileSync(path, 'utf-8') 字节等价 ✓（A0/A2 F-R9-1）
- **getStyleExts**：ctx.fileTypes.styleExts 同源 ALS getCompilerContext().compilerOptions ✓（R1 F-R1-2）
- **ctx.workPath/targetPath**：storeInfo.pathInfo 同源 ALS ✓（A0 确认）
- **fallback ALS 行为等价**：独立函数不传 ctx 时 `ctx?.x ?? ALSGetter()` = ALSGetter()（原行为）✓
- **resolveStyleImportPath/normalizeRootStyleImports default param**：测试传 workPath（不调 default）✓ + 不传时 fallback ALS ✓

## 7. 结论

A3 复用 A0/A2 模式（optional + fallback ALS + DRY 提前）。styleCompile 建 ctx + buildCompileCss 透传 + style 16 处 getter 改 ctx 读（4 ctx + 3 ALS）。ALS compat 保留（resetStoreInfo + logic/view/emit-engine 已迁/不动）。
