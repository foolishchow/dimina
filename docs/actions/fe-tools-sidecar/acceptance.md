# Acceptance — fe-tools-sidecar

伞级验收；子门 A-* 在各自 Action 细化。状态随子门推进更新。

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-002 | `pnpm-workspace.yaml` 含 `tools/*`；`@dimina/bundler` / `@dimina/web-container-sdk` 可 filter | workspace 文件 + filter 日志 | pending |
| A-002 | R-003 | 仓库内无 `packages/*` 依赖 `tools/*` 或 `@dimina/bundler` / `@dimina/web-container-sdk` | rg / CI 脚本 | pending |
| A-003 | R-005 | `dimina-cli` 可对示例工程拉起预览链路（或记录已知差异） | 冒烟步骤 + 日志 | pending |
| A-004 | R-006 | parse→IR（或等价边界）有隔离测试 | vitest 路径 | **deferred**（随 TS-2；2026-09-12） |
| A-005 | R-007 | IR/parser 模块无 `platform ===` 分支依赖（抽检） | 代码审查记录 | **deferred**（随 TS-2；2026-09-12） |
| A-006 | R-008 / R-012 | 存在 `fe/tools/web-container-sdk` 与 `@dimina/web-container-sdk`；VENDOR 含 copy-source tag | package.json + VENDOR.md | pending |
| A-007 | R-009 / D-TS0-1 | 终态 B：`git diff origin/main...HEAD -- fe/packages` 为空（或成文白名单）；`dimina-cli` 冒烟仍通过 | diff + 冒烟日志 | pending |
| A-008 | R-001/R-010 | 闭合说明确认主战场在 tools、且无「必须推 didi」门禁 | closure decision | pending |
| A-009 | R-011 | 存在 copy-source 不可变 tag；工作分支基于已对齐的 `origin/main` | git tag + 分支说明 | pending |
| A-010 | R-012 | 可 filter `@dimina/bundler`；bin 为 `dimina-cli`；description 含非通用 bundler 释义 | package.json + filter 日志 | pending |

## Notes

- 消融：子门对「修复机制」类交付按 Experience-Review §6 执行；纯搬迁/文档门可不消融但须说明。
- 视觉/真机：编排冒烟以 Web 预览为准；不强制三端。
- **TS-1 前置已由** [`fe-tools-bootstrap-copy`](../_archive/complete/fe-tools-bootstrap-copy/README.md) **交付**：A-001 / A-003 / A-006 / A-007（packages diff）/ A-009 / A-010 的证据见该 Action validation；伞表仍 `pending` 直至 TS-4/伞闭合时统一勾选。**A-004 / A-005 属 TS-2，随门 deferred（2026-09-12）**，再激活见 README。A-002 须持续保持（根 `fe` 对 `@dimina/bundler` 的 workspace 依赖不算 `packages/*` 反向依赖）。
- 「子门」措辞：TS-1 不立子门；TS-2+ 可为独立 Action（TS-2 近端不 formalize）。
