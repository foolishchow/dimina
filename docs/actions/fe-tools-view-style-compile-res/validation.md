# Validation — fe-tools-view-style-compile-res

Status: **ready（2026-10-08）**

> review R1-R3 修正后固化。P-G4-x 映射 A-G4-x。

| ID | Method | Criteria | Result |
|---|---|---|---|
| P-G401 | 代码审阅：① `view/index.ts` `viewCompile` 返回 `{ viewCompileResults: ViewCompiledModule[] }`（仅新字段，D-G4-1 降级 base，dependencies: []，renderBody/wxsBindings undefined）；emit 不变 ② `style/index.ts` `styleCompile` 返回 `{ styleCompileResults: StyleCompiledModule[] }`（D-G4-2 降级 base，dependencies: []，styleScopeId undefined）；styleEngine 用默认 successPayload（不补，review R1 F4）；emit 不变 ③ `git diff` 范围（view/index.ts + style/index.ts + stage-channel.ts + ctx 类型 + tests） | 审阅通过 | ⬜ |
| P-G402 | vitest 单测：① stage-channel 写入——注入 mock `ctx.viewCache`/`ctx.styleCache`（Map），跑 view/style stage，断言 `set(moduleId, ViewCompiledModule)` 被调用且 value shape 正确 ② no-op 路径——`ctx.viewCache` undefined → 无 `set` 调用 + 不 crash ③ view/style worker 返回 `ViewCompiledModule[]`/`StyleCompiledModule[]` shape 断言（field: moduleId/kind/code/map/`dependencies:[]`）；logic 块回归不变 | 全绿 | ⬜ |
| P-G403 | 行为 0 全量：examples/miniprogram 7 项目（air-battle base mpx-demo subpackages taro-todo vant weui）`DIMINA_COMPILER_DIFF_VERIFY=1` baseline vs new `diff -r`（one-shot `ctx.viewCache/styleCache` 未设→写 no-op→无行为变更） | 7/7 diff=0 | ⬜ |
| P-G404 | vitest 全量 + tsc 0 errors | 全绿 + 0 errors | ⬜ |
| P-G405 | V-PC-5 类型约束 grep：新交付物 0；既有文件无新增 `any`/`as any`/`@ts-nocheck`/`[key: string]`（`as { viewCompileResults? }` 结构断言允许，非 `as any`） | 0 新增 | ⬜ |

## 流程

1. baseline：`git stash` → build 7 项目 → `git stash pop`
2. new：build 7 项目
3. `diff -r` 两产物目录 = 0
4. vitest 全量（注意 compile-cli-cache.spec.js 已知 flaky——单独重跑确认非回归）
5. tsc 0 errors
6. stage-channel 单测（mock ctx 注入：① 写入 ② no-op ③ worker 返回 shape）

## Readiness gate 验证（draft→ready 前）

design gate RG4-1/2/3/4 ✅ 已解（review 第 1-5 轮）；RG4-5/6 待 impl 审。证据记入本表附节：

| Gate | 验证方法 | 结果 |
|---|---|---|
| RG4-1 view 字段可达 | **已解**（review R1 F1）：`viewParseWalk` 返 `EmitModule`（`emit.ts:8` = `{moduleId,code,map,extraInfoCode?}`）无 renderBody/wxsBindings/dependencies/kind → 降级（D-G4-1）base，dependencies: []，renderBody/wxsBindings 留 undefined | ✅ |
| RG4-2 style 字段可达 | **已解**（review R1 F2）：`buildCompileCss` 返 `StyleCompileResult`（`{code,map}`）无 dependencies/styleScopeId → 降级（D-G4-2）base，dependencies: []，styleScopeId 留 undefined | ✅ |
| RG4-3 cache value bare vs wrapped | **已解**（review R2 F8）：bare（D-G4-3，反转 D-IU-2 双存，dependencies 已在 CompiledModuleBase） | ✅ |
| RG4-4 dependencies 来源 | **已解**（dependencies: []，第 3 轮 F21/F22/F23 修正）：CompiledModuleBase required 须提供值。**style `[]` 合理**（buildCompileCss concat sub-styles 进单 code，不需 dep traversal）。**view `[]` placeholder**（discovery recursive—compileViewTree:324/368 走 usingComponents；G5 cache-hit 语义未定 A-IU-4，若跳 compileViewTree 须 dep traversal 类比 logic logicDependencies:105 → dependencies 可能被 G5 消费；若需从 graph.getDirectDependencies(id,'component') 查 :369，非 viewParseWalk 重构）。G3 已用 graph 边 invalidation | ✅ |
| RG4-5 ctx plumbing 边界 | 待 impl 审：G4 = ctx TYPE(optional/as) + 写；state 字段 + orchestrator plumbing + 实例 = G5；G4 不在 orchestrator 加 plumbing（D-G4-7/F14） | ⬜ |
| RG4-6 emit 不变 | 待 impl 审：只 push+return，emit 调用点原样；不双 emit / 不改顺序 / 不改字节 | ⬜ |
