# Validation — fe-tools-sidecar

Status: **closeout Actual（2026-09-20）**

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

伞级验证：子门已交付的证据回引 + 本轮复测静态句。行为 0 不要求本伞重跑产物对拍。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-SC01 | workspace 含 `tools/*` | `rg "tools/\\*" fe/pnpm-workspace.yaml` | A-001 | **pass** — `fe/pnpm-workspace.yaml` L3 含 `tools/*` |
| P-SC02 | packages 不依赖 tools | `rg '@dimina/(bundler\|web-container-sdk)' fe/packages --glob package.json` | A-002 | **pass** — 无匹配（2026-09-20 复测）；bootstrap P-005 同证 |
| P-SC03 | dimina-cli 冒烟 | bootstrap [`validation`](../fe-tools-bootstrap-copy/validation.md) P-006 | A-003 | **pass** — 子门已记 HTTP 200 冷启动 |
| P-SC04 | parse→Document 隔离测 | wxml-ir [`validation`](../fe-tools-wxml-ir/validation.md) P-WIR01 | A-004 | **pass** — 550/550（含 wxml-ir.spec）；后续 wxml 门回归仍绿 |
| P-SC05 | parser/Document 无 `platform===` | wxml-ir P-WIR03；本轮 `rg 'platform\s*===' fe/tools/bundler/src/compiler/view/wxml` | A-005 | **pass** — 零命中 |
| P-SC06 | web-container-sdk + VENDOR | 路径存在 + `VENDOR.md` Source tag | A-006 | **pass** — `fe/tools/web-container-sdk`；VENDOR tag `fe-tools-copy-source` |
| P-SC07 | 终态 B packages 干净 | `git diff origin/main...HEAD -- fe/packages` | A-007 | **pass** — 0 行（2026-09-20 复测）；[sync-rhythm](../../../../fe-tools/sync-rhythm.md) 真源 |
| P-SC08 | 旁路主战场 + 不推 didi | README Goal / Non-goals / Closure | A-008 | **pass** — 成文；无「必须推 didi」门禁 |
| P-SC09 | copy-source tag | `git tag -l fe-tools-copy-source` + VENDOR | A-009 | **pass** — tag 存在；两包 VENDOR 一致 |
| P-SC10 | bundler 包名 / bin / description | `fe/tools/bundler/package.json` | A-010 | **pass** — `@dimina/bundler`；bin `dimina-cli`；description 含非通用 bundler 释义 |

## Uncovered / 外部约束

| ID | 项 | 处理 |
| --- | --- | --- |
| U-SC1 | tools 独立 CI job / fork Actions 绿 | **Uncovered（外部）**。fork Actions 禁用；推迟到 didi-side 回流 PR。不阻塞伞级 MUST。 |
| U-SC2 | TS-3 编排拆包 + sdk 深改 | **deferred**（2026-09-20）。控制面已由 session 交付；无当前消费者。另立 Action 时重评估。 |
| U-SC3 | PS3 applyChanges / subscribe | **deferred**（2026-09-12，README 已载再激活条件）。 |
| U-SC4 | S13 style 侧剩余 | **Uncovered（书面剩余）**。wxml-ir 已收口 view；style 另议。 |

## Actual

- Closeout 复测日期：2026-09-20
- 分支：`feature/fe-tools-sidecar`
- packages diff 行数：0
- 子门证据权威：`_archive/complete/fe-tools-bootstrap-copy`、`_archive/complete/fe-tools-wxml-ir`
