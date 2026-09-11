# FE Tools Bundler Unvite

- Action: `fe-tools-bundler-unvite`
- Status: `complete`
- Updated: 2026-09-10
- Authorized: 2026-09-10
- Archived: 2026-09-10
- Status authority: [Action Status](../../../STATUS.md)
- 关系：独立卫生 Action（**不是** umbrella 子门）。背景见 [`fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)；闭合不依赖伞 `ready`。
- 工作分支：[`feature/fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)
- 设计权威：本目录；冻结项见 **D-UV-***。

- Draft review：2026-09-10 → 冻结升 `ready` → 授权实施 → **`complete`**（A-UV01..09 / P-001..008）。

## Background

`@dimina/bundler`（`fe/tools/bundler`）自发布此前走 **`vite build` 库模式**。源码已是 Node ESM，自发布只需 **ESM 目录树**，无需通用前端 bundler。

本门是工具链卫生，**不**解决编排器 / plugin / 模板 IR。

## Goal（已交付）

1. 下线 `@dimina/bundler` 的 **`vite build` 自打包**；
2. **无 bundler** 的 ESM 发布形态（D-UV-1..6）；
3. 保持 `dimina-cli`、vitest、sdk 资产、公开 `exports`；
4. 未改 view/logic/style 编译算法。

## 冻结决策（落地）

| ID | 内容 | 落地 |
| --- | --- | --- |
| D-UV-1 | 自发布不打包 | `scripts/sync-dist-from-src.js` |
| D-UV-2 | 镜像 `src` → `dist`；顺序 sync → copy-sdk → check-exports | `package.json` build/postbuild |
| D-UV-3 | `src/watch.js` → re-export `./common/watch-runner.js` | 已加 |
| D-UV-4 | Worker 相对 `import.meta.url` | 镜像后 `dist/core/*` 仍在旁 |
| D-UV-5 | 删除 `vite.config.mjs`；build 不再 `vite build` | 已删 |
| D-UV-6 | 改写 `build-output.spec.js`（无 Vite） | 断言 dist/src view-compiler |

## Deliverables

- `fe/tools/bundler`：sync 自发布 + `src/watch.js` + 测例改写 + README 说明；
- acceptance / validation 全 passed。

## Closure

- A-UV01..A-UV09 **passed**；P-001..P-008 **pass**；
- 终局：`complete`，归档本目录。

## Documents

| 文档 | 作用 |
| --- | --- |
| [requirements](requirements.md) | MUST |
| [acceptance](acceptance.md) | 验收表（全 passed） |
| [validation](validation.md) | 验证证据 |
