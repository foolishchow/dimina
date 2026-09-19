# Acceptance — fe-tools-sidecar

伞级验收。Closeout 2026-09-20：MUST 全 pass；延后项见 validation Uncovered。

| ID | Requirement | Observable condition | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-002 | `pnpm-workspace.yaml` 含 `tools/*`；`@dimina/bundler` / `@dimina/web-container-sdk` 可 filter | P-SC01；bootstrap P-003 | **pass** |
| A-002 | R-003 | 仓库内无 `packages/*` 依赖 `tools/*` 或 `@dimina/bundler` / `@dimina/web-container-sdk` | P-SC02；bootstrap P-005 | **pass** |
| A-003 | R-005 | `dimina-cli` 可对示例工程拉起预览链路（或记录已知差异） | P-SC03；bootstrap P-006 | **pass** |
| A-004 | R-006 | parse→Document（或等价边界）有隔离测试 | P-SC04；wxml-ir P-WIR01 | **pass** |
| A-005 | R-007 | Document/parser 模块无 `platform ===` 分支依赖（抽检） | P-SC05；wxml-ir P-WIR03 | **pass** |
| A-006 | R-008 / R-012 | 存在 `fe/tools/web-container-sdk` 与 `@dimina/web-container-sdk`；VENDOR 含 copy-source tag | P-SC06 | **pass** |
| A-007 | R-009 / D-TS0-1 | 终态 B：`git diff origin/main...HEAD -- fe/packages` 为空（或 sync-rhythm §5 白名单未过期） | P-SC07；[sync-rhythm](../../../../fe-tools/sync-rhythm.md) | **pass** |
| A-008 | R-001 / R-010 | 闭合说明确认主战场在 tools、且无「必须推 didi」门禁 | P-SC08；README Goal / Non-goals | **pass** |
| A-009 | R-011 | 存在 copy-source 不可变 tag；工作分支基于已对齐的 `origin/main` | P-SC09；bootstrap P-001/P-002 | **pass** |
| A-010 | R-012 | 可 filter `@dimina/bundler`；bin 为 `dimina-cli`；description 含非通用 bundler 释义 | P-SC10 | **pass** |

## Notes

- R-004（依赖优先于复制）由 **D-TS0-5 整包复制启动** 显式覆盖：bootstrap 路径是冻结决策，非临时分叉；VENDOR + sync-rhythm 承担同步责任。
- 消融：子门按 Experience-Review §6；本伞 closeout 为文档门，不另消融。
- TS-3 / PS3 / CI / style 剩余：见 [validation.md](validation.md) Uncovered；不挡 MUST。
