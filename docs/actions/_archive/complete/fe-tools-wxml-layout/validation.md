# Validation — fe-tools-wxml-layout

Status: **complete（2026-09-15）** — Close 复验绑定 `4259ebdd`。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WL00 | dist sync | `cd fe/tools/bundler && node scripts/sync-dist-from-src.js` | 前置 | **pass** |
| P-WL01 | 目录与 import | 对照 technical-design §1；`rg "wxml/(parser\|transform\|backends)/"` 于 `src/compiler/view` 生产路径应为 0 | A-WL0/A-WL1 | **pass**（0 hits） |
| P-WL02 | 阶段边界 | grep：`load/` 无 `cheerio` import；`napi\|cheerio` 不 import `renderer` | A-WL1 | **pass** |
| P-WL03 | API 删净 | `rg "getBackend\|registerBackend\|listBackends\|unregisterBackend\|VUE_BACKEND_ID\|STUB_BACKEND_ID\|createStubBackend\|vueBackend\|WxmlBackend"` 于 bundler `src`+`__tests__` 为 0；新 API（含 `createStubWxmlRenderer`/`vueWxmlRenderer`/`WxmlRenderer`）可解析 | A-WL3 | **pass**（0 hits） |
| P-WL04 | packages | `git diff --stat -- fe/packages` 空 | A-WL4 | **pass** |
| P-WL05 | full regression | sync + `npx vitest run --no-file-parallelism` | A-WL2 | **pass**（79/79 · 580/580） |
| P-WL06 | behavior-0 | 相对实施前 HEAD 产物 diff=0（nomap+sm）；并复跑 napi vs cheerio `diff -rq` = 0 | A-WL2 | **pass**（见 Actual） |
| P-WL07 | ablation | ① 生产 import 指回已删旧路径或 load import cheerio → 失败；② 恢复通过 | A-WL5 | **pass**（见 Actual） |

## Diff scope

`fe/tools/bundler/src/compiler/view/wxml/**`、必要 `view/index.js`、相关 `__tests__`、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

预览/真机/视觉、第二 renderer、IR 纯化、跨平台 napi 分发。

## Actual

- **实施起点 HEAD**：`0074396c`（`docs(actions): archive fe-tools-wxml-refactor as complete`；授权 `in_progress` 2026-09-15）
- **文档授权 commit**：`d9fa8b7c`
- **P-WL05**：`79` suites / `580` tests passed（sync 后）
- **P-WL06a**（相对 `0074396c`，同 `examples/miniprogram/base`）：nomap `94`/`94` `diff -rq` exit **0**；sourcemap `185`/`185` exit **0**
- **P-WL06b**（HEAD 默认 napi vs `WXML_PARSER=cheerio`）：nomap + sourcemap `diff -rq` 均为 **0**
- **P-WL07**：`view/index.js` registry import 临时指回 `./wxml/backends/registry.js` → `wxml-ir.spec` 模块找不到失败；恢复后 **25/25** pass；消融补丁未留存
- **L2**：`docs/fe-tools/architecture-notes.md` 已更新目录轴不变量
- **交付 commit**：`4259ebdd`（`feat(bundler): deliver fe-tools-wxml-layout L0–L2`）
- **Close 复验**（同 SHA）：580/580；P-WL01/03 零残留；P-WL04 packages 空；P-WL06a vs `0074396c` nomap/sm diff=0；P-WL06b napi↔cheerio diff=0；`validate_action` 0 error
