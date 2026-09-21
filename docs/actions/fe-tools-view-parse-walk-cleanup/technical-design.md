# Technical Design — fe-tools-view-parse-walk-cleanup

## §0 设计输入

### §0.1 前身决策（D-PW-1..6，全冻结，不可违反）

| 决策 | 内容 | 本 Action 约束 |
|---|---|---|
| D-PW-1 | style parse-walk 自包含 | 不碰 style |
| D-PW-2 | view parse-walk 自包含；两套 W1 shim（15 binding） | 15 个 export 函数签名不变 |
| D-PW-3 | `collectAllWxsModules` 保留（缓存泄漏是已知行为） | 去重但不改逻辑 |
| D-PW-4 | page sourcemap 条件用 | 不碰 sourcemap 条件 |
| D-PW-5 | view 二次编译正式接受 | 不碰二次编译 |
| D-PW-6 | `minifyCss` 跨界调用保留 | 不碰 minify |

### §0.2 tsconfig 约束

- `noUnusedLocals: true` — 拆分后不可保留已搬走的 import
- `noUnusedParameters: true` — 不可有未使用参数
- `strict: true` — `unknown` 须收窄后访问
- `noUncheckedIndexedAccess: true` — 数组/Map 索引访问须 undefined 守卫
- `module: NodeNext` — ESM import 须显式 `.ts` 后缀

### §0.3 行为 0 纪律

- nomap 产物 diff=0
- sourcemap 产物 diff=0
- 全量 vitest 608/608 绿
- tsc 0 错

## §1 改动设计

### §1.1 拆 `compileResCache` 三用途（R-VC-1 + R-VC-2）

**现状**：

```
const compileResCache = new Map<string, unknown>()
// 用途1: module.path → { code, instruction, map }  (模块编译结果)
// 用途2: module.path → { failed: true, errorShape }  (失败缓存)
// 用途3: cacheKey/wxsFilePath → string  (WXS 内容)
```

**目标**：

```
interface ModuleCompileCacheEntry {
	code: string
	instruction: Record<string, unknown>
	map: string | null
}

const moduleCompileCache = new Map<string, ModuleCompileCacheEntry>()
const moduleFailureCache = new Map<string, ErrorShape>()
const wxsContentCache = new Map<string, string>()
```

**落点**：三个 Map 均为模块私有（不 export），定义在原 `compileResCache` 位置（L212）。

**写入端改动**：

| 现状 | 目标 |
|---|---|
| L340: `compileResCache.set(module.path, { failed: true, errorShape: {...} })`（在 `compileViewTree` catch 块内，非 `compileModule`） | `moduleFailureCache.set(module.path, { message, stack, name, file, line, column, stage })`（改动位置同 L340，在 `compileViewTree` 内） |
| L571: `compileResCache.set(module.path, { code, instruction, map })` | `moduleCompileCache.set(module.path, { code, instruction, map })` |
| L1105: `compileResCache.set(cacheKey, wxsContent)` | `wxsContentCache.set(cacheKey, wxsContent)` |

**读取端改动**：

| 现状 | 目标 |
|---|---|
| L436-455: `compileResCache.get(module.path)` → `cacheData.failed` 分支 | `moduleFailureCache.get(module.path)` → 重建 EnhancedError 重抛 |
| L436-470: `compileResCache.get(module.path)` → `cacheData.code && cacheData.instruction` 分支 | `moduleCompileCache.get(module.path)` → 直接用 typed entry |
| L436-470: `typeof cacheData === 'string'` 旧格式兼容分支 | **删除**（拆分后类型明确，无需旧格式兼容） |
| L469: `(compileResCache.get(module.path) as { map?: string })?.map` | `moduleCompileCache.get(module.path)?.map` |
| L1082-1083: `compileResCache.has(cacheKey)` / `.get(cacheKey)` | `wxsContentCache.has(cacheKey)` / `.get(cacheKey)` |

**`clearViewCaches` 更新**（L1361-1368）：

```
// 现状
compileResCache.clear()

// 目标
moduleCompileCache.clear()
moduleFailureCache.clear()
wxsContentCache.clear()
```

**`compileModule` 内 `canUseCache` 分支**（L436）：

```
// 现状
if (canUseCache && !scriptRes.has(module.path) && compileResCache.has(module.path)) {
	const cacheData = compileResCache.get(module.path) as ...
	if (cacheData && cacheData.failed) { ... }
	if (cacheData && typeof cacheData === 'object' && cacheData.code && cacheData.instruction) { ... }
	else if (typeof cacheData === 'string') { ... }
}

// 目标
if (canUseCache && !scriptRes.has(module.path)) {
	const failure = moduleFailureCache.get(module.path)
	if (failure) {
		const err = new Error(failure.message || 'module compilation failed (cached)') as EnhancedError
		if (failure.name) err.name = failure.name
		if (failure.stack) err.stack = failure.stack
		if (failure.file) err.file = failure.file
		if (failure.line != null) err.line = failure.line
		if (failure.column != null) err.column = failure.column
		if (failure.stage) err.stage = failure.stage
		throw err
	}
	const cached = moduleCompileCache.get(module.path)
	if (cached) {
		cachedCode = cached.code
		useCache = true
		for (const sm of cached.instruction.scriptModule!) {
			if (!scriptRes.has(sm.path)) {
				scriptRes.set(sm.path, sm.code)
			}
		}
	}
}
```

**类型安全收益**：`moduleCompileCache.get()` 返回 `ModuleCompileCacheEntry | undefined`，不再需要 `as` 断言。`cached.code` / `cached.instruction` / `cached.map` 均有类型。

**删除旧格式兼容分支**：`typeof cacheData === 'string'` 分支（L470-473）是为兼容旧缓存格式（只有代码字符串）。拆分后 `wxsContentCache` 存 string，`moduleCompileCache` 存 typed entry——两种缓存分开，不再需要 typeof 分派。**需在 readiness review 验证**：旧格式分支是否有可能被 `compileResCache` 的 WXS 内容用途触发（即 `module.path` 与 `cacheKey` 碰撞场景）。

### §1.2 提取 `collectAllWxsModules` 公共逻辑（R-VC-3）

**现状**：`compileModule` 内 L472-505 和 L568-577 重复调用 `collectAllWxsModules` + 合并到 instruction。

**目标**：提取公共函数：

```
function mergeWxsModules(
	instruction: { scriptModule?: Array<{ path: string; code: string; originalName?: string }> },
	scriptRes: Map<string, string>,
	scriptModuleSeed: object[],
): void {
	const allWxsModules = collectAllWxsModules(scriptRes, new Set(), scriptModuleSeed)
	if (allWxsModules.length === 0) return
	const existingModules = instruction.scriptModule || []
	const mergedModules = [...existingModules]
	for (const wxsModule of allWxsModules) {
		if (!mergedModules.find(existing => existing.path === wxsModule.path)) {
			mergedModules.push(wxsModule)
		}
	}
	instruction.scriptModule = mergedModules
}
```

**调用点**：

| 位置 | 现状 | 目标 |
|---|---|---|
| L472-505（缓存命中） | 内联 collectAllWxsModules + 合并 | `mergeWxsModules(instruction, scriptRes, instruction.scriptModule as object[] \|\| [])` |
| L568-577（正常路径） | 内联 collectAllWxsModules + 合并 | `mergeWxsModules(compileInstruction, scriptRes, compileInstruction.scriptModule as object[] \|\| [])` |

**落点**：模块私有函数（不 export），定义在 `collectAllWxsModules` 附近。

### §1.3 拆 `compileModule`（R-VC-4）

**现状**：167 行，三段不同职责。

**目标**：拆为三个模块私有函数 + 薄编排：

```
function compileModule(module, isComponent, scriptRes, options) {
	// 薄编排：获取模板 → 缓存命中分派 → 编译 → 返回
	const { tpl, instruction, sourceInfo, origins, sourceContents } = toCompileTemplate(...)
	if (!tpl) return null

	const compileInstruction = {
		...instruction,
		templateModule: filterTemplateModule(instruction, options),
		scriptModule: options.allScriptModules || instruction.scriptModule,
	}

	// 1. 缓存命中分派
	const cached = tryModuleCache(module, scriptRes, compileInstruction, sourceMapRes)
	if (cached) return cached

	// 2. 编译
	const renderResult = compileModuleRender(module, compileInstruction, scriptRes, { tpl, sourceInfo, origins, sourceContents, isComponent, allScriptModules: options.allScriptModules })

	// 3. 包装 + 缓存写入
	return finalizeModule(module, compileInstruction, renderResult, scriptRes, sourceMapRes, templateModule)
}

function tryModuleCache(module, scriptRes, instruction, sourceMapRes): Record<string, unknown> | null
	// canUseCache check → moduleFailureCache → moduleCompileCache → mergeWxsModules
	// ≤40 行

function compileModuleRender(module, compileInstruction, scriptRes, sourceContext): { code: string; map: string | null }
	// this.→_ctx. → compileTemplate → compileTemplateModuleRender → insertWxsToRenderResult
	// sourceContext: { tpl: string; sourceInfo: { path: string; content: string }; origins: unknown[]; sourceContents: Map<string, string>; isComponent: boolean; allScriptModules?: Array<{ path: string; code: string; originalName?: string }> }
	// ≤50 行

function finalizeModule(module, compileInstruction, renderResult, scriptRes, sourceMapRes, templateModule): Record<string, unknown>
	// Module({}) 包裹 → concatSourcemap → mergeWxsModules → moduleCompileCache.set → scriptRes.set → 返回
	// ≤40 行
```

**`sourceMapRes` 参数传递**：现从 `options.sourceMapRes` 获取（L419），拆分后作为参数传入子函数。

**`canUseCache` 判断**：`skipTemplatePaths.size === 0`，在 `tryModuleCache` 内计算。

### §1.4 拆 `processWxsContent`（R-VC-5）

**现状**：121 行，walk 循环内处理 4 种转换。

**目标**：walk 循环保持不动（四种转换在 `enter` 回调内按 node 类型分派），但每种转换提取为独立函数：

```
function processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath) {
	// ...
	walk(wxsAst, {
		enter(node) {
			if (node.type === 'CallExpression') {
				const calleeName = node.callee?.name
				if (calleeName === 'getRegExp') {
					replaceGetRegExp(node, wxsContent, replacements)
				}
				else if (calleeName === 'getDate') {
					replaceGetDate(node, wxsContent, replacements)
				}
				else if (calleeName === 'require' && node.arguments.length > 0 && wxsFilePath) {
					replaceWxsRequire(node, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath, replacements)
				}
			}
			if (node.type === 'MemberExpression') {
				if (node.property?.name === 'constructor' && !node.computed) {
					replaceConstructor(node, wxsContent, replacements)
				}
			}
		}
	})
	return applyCodeReplacements(wxsContent, replacements)
}

function replaceGetRegExp(node, wxsContent, replacements): void
	// ≤15 行

function replaceGetDate(node, wxsContent, replacements): void
	// ≤5 行

function replaceWxsRequire(node, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath, replacements): void
	// ≤30 行（含 npm 组件路径特殊处理）

function replaceConstructor(node, wxsContent, replacements): void
	// ≤5 行
```

**落点**：模块私有函数（不 export），定义在 `processWxsContent` 附近。

### §1.5 拆 `insertWxsToRenderResult`（R-VC-6）

**现状**：99 行，三段不同职责。

**目标**：拆为三个模块私有函数 + 薄编排：

```
function insertWxsToRenderResult(code, scriptModule, scriptRes, filename, inputMap) {
	const { wxsBindings, declarations, renderBody } = buildWxsDeclarations(scriptModule, scriptRes)
	const codeReplacements = buildWxsReplacements(code, filename, wxsBindings, declarations, renderBody)
	if (codeReplacements.length === 0) {
		return { code: getProgramCode(code, parseJs(code, filename)), map: inputMap }
	}
	const { transformed, map } = applyWxsReplacements(code, codeReplacements, filename, inputMap)
	return { code: getProgramCode(transformed, parseJs(transformed, filename)), map }
}

function buildWxsDeclarations(scriptModule, scriptRes): { wxsBindings: Array<...>; declarations: string[]; renderBody: { type?: string; start?: number } | null }
	// ≤20 行；renderBody 从 AST 计算（L1247），返回供 buildWxsReplacements 使用

function buildWxsReplacements(code, filename, wxsBindings, declarations, renderBody): Array<Replacement>
	// walk → _ctx.xxx 替换 + 保留字别名 → codeReplacements
	// 含 declarations 注入到 render body（需 renderBody.start）
	// ≤40 行

function applyWxsReplacements(code, codeReplacements, filename, inputMap): { transformed: string; map: unknown }
	// applyCodeReplacements + sourcemap 生成 + remap
	// ≤30 行
	// 注意：sourcemap 路径须复制 applyCodeReplacements 的 selection 算法
	//   （按 range 大小排序 → 去重叠 → 按 start 降序），
	//   或提取共享 selectReplacements(replacements) helper
```

**注意**：
1. `declarations` 的注入在现状代码中是 `codeReplacements` 的一部分（L1267-1273 push insert type replacement）。拆分时 `buildWxsDeclarations` 先返回 declarations + renderBody，再传给 `buildWxsReplacements`。
2. `renderBody`（L1247 从 AST 计算）用于构建 insert replacement（L1267 `renderBody.start! + 1`）。`buildWxsDeclarations` 计算 renderBody 并返回，`buildWxsReplacements` 消费。
3. sourcemap 路径（L1303-1320）复制了 `applyCodeReplacements` 的 selection/sort 逻辑（L93-113）。`applyWxsReplacements` 须复制完全相同的 selection 算法（按 range 大小排序 → 去重叠 → 按 start 降序），否则 sourcemap 结果不同 = 行为 0 破坏。可提取共享 `selectReplacements(replacements)` helper。

### §1.6 W1 shim binding 不变

15 个 export 函数的签名不可变：

| shim | binding | 签名 |
|---|---|---|
| `bindVueToolsLive` | 12 个 | `(arg: string, ...) => string` 等 |
| `bindTransformOrchestrator` | 3 个 | `(document, scriptModule, ...) => void` 等 |

拆分后这些函数仍须 export，签名不变。拆出的子函数为模块私有（不 export）。

## §2 数据流

无变化。拆分是纯机械代码移动，不改数据流。

```
viewParseWalk → compileViewTree → compileModule → [tryModuleCache → compileModuleRender → finalizeModule]
                                                   ↑ mergeWxsModules 在 tryModuleCache + finalizeModule 内调
```

## §3 风险表

| 风险 | 影响 | 缓解 |
|---|---|---|
| 缓存 key 碰撞（module.path vs wxsFilePath） | 拆分后三 Map 隔离，不可能碰撞 | 拆分本身消除风险 |
| 旧格式兼容分支删除 | 若有旧格式缓存条目会丢失 | 拆分后 `moduleCompileCache.get()` 返回 `ModuleCompileCacheEntry \| undefined`，不可能是 `string`——旧格式分支（`typeof cacheData === 'string'`）是死代码，删除安全。`cacheKey`（`smName` 或 `wxsFilePath`）与 `module.path`（页面/组件路径）实践不碰撞，且拆分后不同 Map 隔离 |
| `compileModule` 拆分后参数传递复杂化 | 子函数需要多个参数 | 使用 options 对象传参；`noUnusedParameters: true` 约束 |
| `processWxsContent` walk 回调拆分后 `replacements` 数组共享 | 子函数需 push 到同一个 `replacements` 数组 | 传 `replacements` 引用 |
| `insertWxsToRenderResult` declarations/replacements/renderBody 依赖 | declarations + renderBody 在 buildWxsDeclarations 构建，在 buildWxsReplacements 注入 | 顺序调用：buildWxsDeclarations 先返回 declarations + renderBody，再传给 buildWxsReplacements |
| `insertWxsToRenderResult` sourcemap selection 逻辑复制 | `applyWxsReplacements` 须复制 `applyCodeReplacements` 的 selection 算法 | 提取共享 `selectReplacements(replacements)` helper 或精确复制 |
| `noUnusedLocals: true` | 拆分后不可保留已搬走的 import | 每步 tsc 验证 |

## §4 替代方案

### §4.1 缓存拆分替代方案：类型化分派（否决）

不拆 Map，改为 typed union + switch 分派：

```
type CacheEntry = ModuleCompileCacheEntry | ErrorShape | string
const compileResCache = new Map<string, CacheEntry>()
```

**否决理由**：仍需运行时 typeof 判别（`typeof x === 'string'` 无法被 union type 表达），且 key 碰撞风险不消除。拆 3 Map 更干净。

### §4.2 compileModule 拆分替代方案：内联注释分区（否决）

不拆函数，只加注释分区。

**否决理由**：167 行仍过长，可读性改善有限。R-VC-4 要求 ≤80 行/段。

### §4.3 不拆（否决）

保持现状。

**否决理由**：7 个问题已确认，不修会持续拖慢开发。
