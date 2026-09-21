# Requirements — fe-tools-view-parse-walk-cleanup

## 问题

`view/parse-walk.ts`（1,368 行 / 40 函数）在 `fe-tools-parse-walk-extract` 真抽出后暴露出 7 个内部质量问题。这些问题不影响正确性（行为 0 已验证），但影响可读性、可维护性和类型安全。

### 1. `compileResCache` 三用途混用

同一个 `Map<string, unknown>` 同时缓存三种不同语义的数据：

- **模块编译结果**（key = `module.path`，value = `{ code, instruction, map }`）
- **WXS 内容**（key = `wxsFilePath` 或 `cacheKey`，value = `string`）
- **失败缓存**（key = `module.path`，value = `{ failed: true, errorShape }`）

读取端（L436-470）用 `typeof cacheData === 'string'` 和 `cacheData.failed` 做类型分支——弱类型分派，不同语义混在同一 Map，靠运行时 typeof 判别。

### 2. `collectAllWxsModules` 重复调用

`compileModule` 内调用 `collectAllWxsModules` 两次：
- 缓存命中路径（L476）——收集 wxs 模块合并到 instruction
- 正常路径（L546）——完全相同的逻辑再执行一次

两处代码几乎完全一致（合并 + 去重 + 赋值），属于代码重复。

### 3. `compileModule` 167 行过长

函数内含三段不同职责：
- 缓存命中分派（L436-505）
- Vue compileTemplate 编译（L507-548）
- Module({}) 包裹 + 缓存写入（L550-582）

### 4. `processWxsContent` 121 行过长

walk 循环内处理四种不同转换：
- `getRegExp` → 正则字面量 / `new RegExp()`
- `getDate` → `new Date()`
- `constructor` → `Object.prototype.toString.call()`
- `require` → 路径重写 + 递归处理

### 5. `insertWxsToRenderResult` 99 行过长

函数含三段不同职责：
- wxs 声明注入（构建 declarations + 插入 render body）
- walk 替换（_ctx.xxx → __wxs_N）
- sourcemap 生成 + remap

### 6. `compileResCache` 类型 `unknown`

所有缓存条目类型为 `unknown`，读取端靠 `as` 断言转型。无编译期类型安全。

## MUST 需求

- R-VC-1 MUST `compileResCache` 拆分为 3 个独立 Map：
  - `moduleCompileCache: Map<string, ModuleCompileCacheEntry>`
  - `wxsContentCache: Map<string, string>`
  - `moduleFailureCache: Map<string, ErrorShape>`
- R-VC-2 MUST 定义 union type 替代 `unknown`：
  - `ModuleCompileCacheEntry = { code: string; instruction: CompileInstruction; map: string | null }`
  - `ErrorShape` 已存在（复用）
- R-VC-3 MUST `collectAllWxsModules` 重复调用提取为公共函数（`mergeWxsModules(instruction, scriptRes, scriptModule)` 或等效）
- R-VC-4 MUST `compileModule` 拆分后每段 ≤80 行
- R-VC-5 MUST `processWxsContent` 按转换类型拆分，每个子函数 ≤40 行
- R-VC-6 MUST `insertWxsToRenderResult` 拆分后每段 ≤50 行
- R-VC-7 MUST 行为 0（nomap + sourcemap diff=0；全量 vitest 608/608；tsc 0 错）
- R-VC-8 MUST 不引入跨车道 import（`view/parse-walk.ts` 不 import from `../logic/` 或 `../style/`）
- R-VC-9 MUST 不引入 `any` / `@ts-nocheck` / `as any`
- R-VC-10 SHOULD 不新增文件（单文件内重构）

## 约束

- tsconfig: `noUnusedLocals: true` / `noUnusedParameters: true` / `strict: true` / `noUncheckedIndexedAccess: true`
- 模块: `NodeNext`（ESM import 须显式 `.ts` 后缀）
- W1 shim binding 不变——15 个 export 函数签名不变（`bindVueToolsLive` / `bindTransformOrchestrator` 消费方依赖）
- `compileResCache.clear()` → `clearViewCaches()` 内调用——拆分后需分别 clear 3 个 Map
- `wxsScannedWorkPath`（let 变量）不可从 index.ts 赋值——`ensureWxsScan` / `resetWxsScan` / `clearViewCaches` 封装不变
- D-PW-3 `collectAllWxsModules` 缓存泄漏保留——不修逻辑，只去重
- D-PW-4 page sourcemap 条件用不变
- D-PW-5 view 二次编译不变

## SHOULD

- R-VC-10 SHOULD 不新增文件

## MAY

- 函数拆分后可提取为模块私有函数（不 export，不增加 W1 binding 表面）

## 非范围

- 跨车道 AST 工具共享（logic/view 概念重叠非代码重复）
- `collectAllWxsModules` 缓存泄漏修复（D-PW-3 保留决策）
- view 二次编译消除（D-PW-5 接受决策）
- page sourcemap 条件用变更（D-PW-4 接受决策）
- env.ts 拆分
- W1 shim 机制变更
- view/style 增量接入
- HMR
