# FE Tools Parse-Walk Extract

- Action: `fe-tools-parse-walk-extract`
- Status: `draft`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前身：[`fe-tools-emit-transform-split`](../_archive/complete/fe-tools-emit-transform-split/README.md)（**complete 已归档**；三段管线文件结构成立，但 view/style `parse-walk.ts` 是 re-export 壳；3 条 TD 假设走 fallback）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`fe-tools-emit-transform-split`（complete 归档）交付了三车道 `parse+walk → transform → emit` 文件结构，但 validation.md 记录了 3 条实施偏差：

1. **view/style `parse-walk.ts` 是 8 行 re-export 壳**——`enhanceCSS`/`buildCompileCss`/`compileModule`/`compileViewTree`/`viewParseWalk` 全部留在 `index.ts`。文件结构显示"三段"了，但代码没真搬。
2. **3 条 TD 假设失败走 fallback**：
   - `collectAllWxsModules` 保留（TD 原设计删除——但它收集跨页面缓存泄漏的 wxs，删了 diff≠0）
   - page sourcemap 条件用（TD 原设计总是 `createLineSourcemap`——但 pages with `<include>` but no `<wxs>` 不触发 2nd pass）
   - `minifyCss` per-module（TD 原设计在 `emitStyle` 聚合 minify——但 per-module + join 保留模块间 `\n`，aggregated 删 `\n`）
3. **view 二次编译结构仍在**——TD 北星"一次编译"走 fallback，`compileViewTree` 仍是 first pass → 递归组件 → second pass。

## 目标

把"行为 0 通过但名不副实"升级为"真抽出 + 设计假设修正"：

1. **style parse-walk 真抽出**：`enhanceCSS` + `buildCompileCss` + helpers 搬到 `style/parse-walk.ts`；`index.ts` 只留编排（`compileSS` + `emitStyle` 调用 + `styleEngine`）
2. **view parse-walk 真抽出**：`compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + 表达式 helpers 搬到 `view/parse-walk.ts`；`index.ts` 只留编排（`compileML` + `bindVueToolsLive` + `viewEngine`）
3. **3 条 fallback → 正式决策**：在 TD 中明确标注为设计决策（非临时 fallback）
4. **`collectAllWxsModules` 缓存泄漏定性**：记录为已知行为（behavior 0 约束下保留），标记为后续正确性修复候选

## 非目标

- logic 车道（已真抽出，`parse-walk.ts` 406 行 + `transform.ts` 72 行）
- 产物语义变更（真抽出是纯机械搬代码，行为 0 diff=0）
- emit 搬迁（MC3c deferred）
- HMR / watch 增量（另门）
- 修 `collectAllWxsModules` 缓存泄漏（定性 + 记录，不在本门修——修它是行为变化）

## 设计输入

- 前身 validation.md 3 条偏差：[`fe-tools-emit-transform-split/validation.md`](../_archive/complete/fe-tools-emit-transform-split/validation.md) V-ET-5/V-ET-7
- logic 真抽出模板：`logic/parse-walk.ts`（406 行，自包含，无循环依赖）
- W1 cycle-break 机制（两套 shim）：`view/wxml/renderer/vue/live.ts`（`export let` + `bindVueToolsLive` 注入，12 binding）+ `view/wxml/load/orchestrator-live.ts`（`export let` + `bindTransformOrchestrator` 注入，3 binding）
- 行为 0 纪律：nomap + sourcemap 产物 diff=0；全量 vitest 绿

## 交付物

- `style/parse-walk.ts`：从 8 行 re-export → 真抽出（`enhanceCSS` + `buildCompileCss` + helpers）
- `view/parse-walk.ts`：从 8 行 re-export → 真抽出（`compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + 表达式 helpers）
- `style/index.ts`：变薄（`compileSS` + `emitStyle` 调用 + `styleEngine`）
- `view/index.ts`：变薄（`compileML` + `bindVueToolsLive` + `viewEngine`）
- TD 修正：3 条 fallback → 正式决策

## Requirements

- R-PW-1 MUST `style/parse-walk.ts` 含 `enhanceCSS` + `buildCompileCss` + 所有 helpers（非 re-export）
- R-PW-2 MUST `view/parse-walk.ts` 含 `compileViewTree` + `compileModule` + `viewParseWalk` + `insertWxsToRenderResult` + `transTagWxs` + 表达式 helpers（非 re-export）
- R-PW-3 MUST `style/index.ts` 不含 `enhanceCSS` / `buildCompileCss` 定义（只 import + 编排）
- R-PW-4 MUST `view/index.ts` 不含 `compileViewTree` / `compileModule` / `viewParseWalk` / `insertWxsToRenderResult` / `transTagWxs` 定义（只 import + 编排 + `bindVueToolsLive` + `bindTransformOrchestrator` 注入 + re-export from `tools.ts`/`include.ts`）
- R-PW-5 MUST 无循环依赖（ESM import 单向：index.ts → parse-walk.ts）
- R-PW-6 MUST 3 条 fallback 在 TD 中标注为正式决策
- R-PW-7 MUST `collectAllWxsModules` 缓存泄漏在 TD 中定性记录
- R-PW-8 MUST 行为 0（nomap + sourcemap diff=0；全量 vitest 绿；tsc 0 错）

## Readiness gaps

- 循环依赖解法已验证（logic 模板 + W1 live.ts 机制），无硬阻塞
- 待 readiness review 确认落点表 + 行号精度

## Closure conditions

- R-PW-1..8 全 passed
- architecture-notes 回流（真抽出 + 3 条决策定性）
- 行为 0 守卫通过
