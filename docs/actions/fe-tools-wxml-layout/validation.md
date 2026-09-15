# Validation — fe-tools-wxml-layout

Status: **冻结（随 Action `ready`）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WL00 | dist sync | `cd fe/tools/bundler && node scripts/sync-dist-from-src.js` | 前置 | pending |
| P-WL01 | 目录与 import | 对照 technical-design §1；`rg "wxml/(parser|transform|backends)/"` 于 `src/compiler/view` 生产路径应为 0 | A-WL0/A-WL1 | pending |
| P-WL02 | 阶段边界 | grep：`load/` 无 `cheerio` import；`napi|cheerio` 不 import `renderer` | A-WL1 | pending |
| P-WL03 | API 删净 | `rg "getBackend|registerBackend|listBackends|unregisterBackend|VUE_BACKEND_ID|STUB_BACKEND_ID|createStubBackend|vueBackend|WxmlBackend"` 于 bundler `src`+`__tests__` 为 0；新 API（含 `createStubWxmlRenderer`/`vueWxmlRenderer`/`WxmlRenderer`）可解析 | A-WL3 | pending |
| P-WL04 | packages | `git diff --stat -- fe/packages` 空 | A-WL4 | pending |
| P-WL05 | full regression | sync + `npx vitest run --no-file-parallelism` | A-WL2 | pending |
| P-WL06 | behavior-0 | 相对实施前 HEAD 产物 diff=0（nomap+sm）；并复跑 napi vs cheerio `diff -rq` = 0 | A-WL2 | pending |
| P-WL07 | ablation | ① 生产 import 指回已删旧路径或 load import cheerio → 失败；② 恢复通过 | A-WL5 | pending |

## Diff scope

`fe/tools/bundler/src/compiler/view/wxml/**`、必要 `view/index.js`、相关 `__tests__`、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

预览/真机/视觉、第二 renderer、IR 纯化、跨平台 napi 分发。

## Actual

- **实施起点 HEAD**：`0074396c`（`docs(actions): archive fe-tools-wxml-refactor as complete`；授权 `in_progress` 2026-09-15）
- 证据回填：（L0–L2 完成后填写；绑定交付 commit SHA）
