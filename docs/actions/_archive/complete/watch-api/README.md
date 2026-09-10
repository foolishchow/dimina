# Watch API（CF-4：watch 从 CLI-only 提升为 API 能力）

- Action: `watch-api`
- Status: `complete`
- Updated: 2026-09-10
- Promoted: 2026-09-10（Readiness Review pass；R1–R4 选 (a)，B 组默认全采纳，C/D 无异议）
- Authorized: 2026-09-10（明确授权实施）
- Archived: 2026-09-10
- Status authority: [Action Status](../../../STATUS.md)
- 父 Action：[compiler-configuration](../../compiler-configuration/README.md)（umbrella，gate CF-4）
- 前置：无（独立；实施顺序先于 CF-1）
- 设计权威：[technical-design](technical-design.md)（已冻结 v1）

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | 需求与非范围 |
| [technical-design](technical-design.md) | API / D1–D6+D1a / 编排环 / 导出（**已冻结 v1**） |
| [acceptance](acceptance.md) | MUST 验收表（A-001..A-009） |
| [validation](validation.md) | 验证证据（P-001..P-003，含消融） |

## Background

改造前 `-w, --watch` 的**编排环**是 CLI 侧重复实现，违反 **CLI ⊆ API**：plan/scheduler 虽已抽出，但 `bin/index.js` 与 `bin/dev.js` 仍各自内联 chokidar 环，且无公开 watch 导出。

## Goal

将 watch 编排提升为可编程 API，`build -w` 与 `dmcc dev` 都通过该 API 使用 watch；消除 CLI-only 与 bin 重复，并稳定 bin 入口供 CF-1 接入。

## Non-goals

- 不改 watch 行为语义（调度/合并/增量策略不变）
- 不改 A2/A3 dev server/HMR/ws 协议
- 不改编译配置框架（CF-1 `compiler-configurable` 范围）
- 不做性能优化

## Scope（已交付）

- `fe/packages/compiler/src/common/watch-runner.js`
- `fe/packages/compiler/src/common/watch-plan.js`
- `fe/packages/compiler/src/bin/index.js` / `dev.js`
- `package.json` + `vite.config.mjs`（`@dimina/compiler/watch`）
- `__tests__/watch-runner.spec.js` / `watch-api-bin-contract.spec.js`

## API 设计（已冻结 v1）

以 [technical-design](technical-design.md) §2–§3 为准。公开：`createBuildWatcher`（`start` / `listen` / `stop`；`onRebuild` / `beforeBuild` / `onError`；`autoListen`）。

## Readiness gaps

无。

## Closure conditions

- [acceptance](acceptance.md) 全部 MUST 通过并有证据 — 已满足
- build -w / dev 行为等价 — 已满足（D1a 严格等价）
- 代码重复消除 — 已满足
- STATUS、导航、归档一致 — 本闭合完成

## Closure decision（2026-09-10）

- **终局决策**：`complete`，归档至 `docs/actions/_archive/complete/watch-api/`。
- **验收**：A-001~A-009 全部 `passed`，证据见 [validation](validation.md)（P-001..P-003；P-002 为 A-005 消融）。
- **实现提交**：`60ed6114`（feat createBuildWatcher）；闭合含 bin-contract 规格、validation、RFC §4.6、归档。
- **持久发现回写**：RFC 新增 §4.6 watch API 契约；§2.2 watch 行更新；revision v1.8。
- **残余风险**：
  - 完整 `pnpm --filter compiler build` postbuild 依赖 `container-sdk/dist`；本门 A-006 以 `vite build` + `check-package-exports` 验证（与 A2 资产分发环境前提一致）。
  - A-003 冒烟覆盖 `build -w` 改文件触发「重新编译」日志；未做多端/长时间 soak。
  - A-004 以 D1a 源码序 + 既有 A2 vitest 覆盖协议；未重复完整浏览器 relaunch 视觉验证（沿用 A2 残余边界）。
