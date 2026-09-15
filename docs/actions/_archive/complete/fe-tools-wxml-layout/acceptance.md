# Acceptance — fe-tools-wxml-layout

Status: **complete（2026-09-15）** — Close 复验 `4259ebdd`。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-WL0 | R-WL0 | 目录树符合 technical-design §1；`parser/` `transform/` `backends/` 不再被生产 import | P-WL01 | **pass** |
| A-WL1 | R-WL1 | parse/load/renderer/`compile.js` 职责可指认；vue 工具在 `renderer/vue/`；load 工具在 `load/` | P-WL01/P-WL02 | **pass** |
| A-WL2 | R-WL2 | 全量 vitest 绿；相对基线产物+sourcemap diff=0；napi↔cheerio diff=0 | P-WL05/P-WL06 | **pass** |
| A-WL3 | R-WL3 | `getWxmlRenderer`/`vueWxmlRenderer`/`createStubWxmlRenderer` 等可用；**零**旧 Backend 符号残留（含 `createStubBackend`/`vueBackend`/`WxmlBackend`；生产+测例） | P-WL03 | **pass** |
| A-WL4 | R-WL4 | `fe/packages` 零 diff；无 wxs 目录归位 / 无第二 renderer 逻辑 | P-WL04 | **pass** |
| A-WL5 | R-WL5 | 消融有效（若适用）；architecture-notes 回流 | P-WL07 | **pass** |

## Non-acceptance

- IR 纯化、第二 renderer 实现、napi 内大重构、微信真源重标定。
