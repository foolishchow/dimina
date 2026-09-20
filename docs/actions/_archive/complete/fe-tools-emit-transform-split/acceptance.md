# Acceptance — fe-tools-emit-transform-split

## A-ET-1 — parse+walk 抽出

- [x] `logicParseWalk` 在 `compiler/logic/parse-walk.ts`，可独立调用
- [x] `viewParseWalk` 在 `compiler/view/parse-walk.ts`，可独立调用（re-export from index.ts）
- [x] `styleParseWalk` 在 `compiler/style/parse-walk.ts`，可独立调用（re-export from index.ts）
- [x] 三车道 parse+walk 不含 esbuild import

## A-ET-2 — transform 抽出（logic 专有）

- [x] `transformCjs` 在 `compiler/logic/transform.ts`
- [x] `buildJSByPath` 不含 `parseSync` / `walk` / `transform` import
- [x] `buildJSByPath` 不含 esbuild import

## A-ET-3 — view 二次编译消除

- [x] `compileModuleWithAllWxs` 已删（合并进 `compileModule` allScriptModules 参数）
- [x] `compileModule` 接受预收集 wxs 参数（`allScriptModules`）
- [x] `compileModule` 对 page 2nd pass（`allScriptModules` provided）用 `createLineSourcemap`；1st pass + components 条件用 `createOriginsSourcemap`/`createLineSourcemap`
- [x] `collectAllWxsModules` 保留（行为 0：收集缓存泄漏的 wxs 模块）

## A-ET-4 — style emit 统一

- [x] `emitStyle` 在 `compiler/style/emit.ts`
- [x] `buildCompileCss` 不含 esbuild import（`minifyCss` 从 `emit.ts` 导入）
- [x] `compileSS` 不含手搓 EmitEntry（走 `emitStyle` + `sink.write`）
- [x] `EmitEntry.kind` 含 `'style'`
- [x] cssnano 留 parse+walk（在 `index.ts` enhanceCSS 内 postcss pass）

## A-ET-5 — 行为 0

- [x] nomap 产物 diff=0（basic + extended 测试项目）
- [x] sourcemap 产物 diff=0（basic + extended 测试项目）
- [x] 全量 vitest 绿（608/608）
- [x] tsc 0 错

## A-ET-6 — 管线统一

- [x] 三车道均走 `parse+walk → transform（logic only）→ emit` 流程
- [x] esbuild 只出现在 `logic/transform.ts`、`style/emit.ts`、`pipeline/emit.ts`
