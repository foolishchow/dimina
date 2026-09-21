# Implementation Plan — fe-tools-view-parse-walk-cleanup

## 步骤

### Step 1: 拆 `compileResCache` 三用途 + 定义 `CacheEntry` type

- 定义 `ModuleCompileCacheEntry` interface
- 创建 3 个独立 Map：`moduleCompileCache` / `moduleFailureCache` / `wxsContentCache`
- 改写写入端（L340 失败缓存 / L571 编译结果 / L1105 WXS 内容）
- 改写读取端（L436-470 缓存命中分派 / L469 map 读取 / L1082-1083 WXS 内容读取）
- 删除旧格式兼容分支（`typeof cacheData === 'string'`）
- 更新 `clearViewCaches`（clear 3 个 Map）
- **验证**：tsc 0 错 + vitest 608/608 + diff=0
- 对应：R-VC-1 / R-VC-2

### Step 2: 提取 `mergeWxsModules` 公共逻辑

- 定义 `mergeWxsModules(instruction, scriptRes, scriptModuleSeed)` 模块私有函数
- 替换 `compileModule` 内 L472-505（缓存命中路径）内联逻辑
- 替换 `compileModule` 内 L568-577（正常路径）内联逻辑
- **验证**：tsc 0 错 + vitest 608/608 + diff=0
- 对应：R-VC-3
- 前置：Step 1（缓存拆分后 `compileModule` 内部已调整，更容易提取）

### Step 3: 拆 `compileModule`

- 定义 `tryModuleCache(module, scriptRes, instruction, sourceMapRes)` — 缓存命中分派
- 定义 `compileModuleRender(module, compileInstruction, scriptRes, sourceContext)` — Vue compileTemplate 编译
- 定义 `finalizeModule(module, compileInstruction, renderResult, scriptRes, sourceMapRes, templateModule)` — Module({}) 包裹 + 缓存写入
- 重写 `compileModule` 为薄编排（≤30 行）
- **验证**：tsc 0 错 + vitest 608/608 + diff=0
- 对应：R-VC-4
- 前置：Step 1 + Step 2（Step 2 必须先完成——去重后 `compileModule` 函数体变小，Step 3 拆分更容易）

### Step 4: 拆 `processWxsContent`

- 定义 `replaceGetRegExp(node, wxsContent, replacements)` — getRegExp 转换
- 定义 `replaceGetDate(node, wxsContent, replacements)` — getDate 转换
- 定义 `replaceWxsRequire(node, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath, replacements)` — require 路径重写
- 定义 `replaceConstructor(node, wxsContent, replacements)` — constructor 转换
- 重写 `processWxsContent` walk 回调为分派（≤40 行）
- **验证**：tsc 0 错 + vitest 608/608 + diff=0
- 对应：R-VC-5
- 前置：无（独立于 Step 1-3）

### Step 5: 拆 `insertWxsToRenderResult`

- 定义 `buildWxsDeclarations(scriptModule, scriptRes)` — 声明构建
- 定义 `buildWxsReplacements(code, filename, wxsBindings, declarations)` — walk 替换 + 声明注入
- 定义 `applyWxsReplacements(code, codeReplacements, filename, inputMap)` — applyCodeReplacements + sourcemap
- 重写 `insertWxsToRenderResult` 为薄编排（≤20 行）
- **验证**：tsc 0 错 + vitest 608/608 + diff=0
- 对应：R-VC-6
- 前置：无（独立于 Step 1-4）

### Step 6: 最终验证 + closure review

- 全量 tsc 0 错
- 全量 vitest 608/608
- 产物 diff=0（nomap + sourcemap）
- grep 验证：
  - `compileResCache` 不存在（已拆为 3 Map）
  - `unknown` 在缓存条目中不出现（类型安全）
  - 跨车道 import = 0
  - `any` / `@ts-nocheck` / `as any` = 0
  - 15 个 W1 shim binding export 不变
  - 无新文件
- **对应**：R-VC-7 / R-VC-8 / R-VC-9 / R-VC-10

## 依赖图

```
Step 1 (缓存拆分 + type) ──→ Step 2 (mergeWxsModules 去重) ──→ Step 3 (compileModule 拆分)
                                                                          │
                                                                          ↓
                                                               Step 6 (最终验证)
                                                                          ↑
Step 4 (processWxsContent 拆分) ──────────────────────────────────────────┘
                                                                          ↑
Step 5 (insertWxsToRenderResult 拆分) ────────────────────────────────────┘
```

Step 4 和 Step 5 独立于 Step 1-3，可并行。

## 每步验证

每步完成后执行：
1. `cd fe/tools/bundler && npx tsc --noEmit --pretty` — 0 错
2. `cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test` — 608/608
3. 产物 diff=0（basic test project，nomap + sourcemap）
