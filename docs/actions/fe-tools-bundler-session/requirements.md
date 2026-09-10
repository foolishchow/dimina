# Requirements — fe-tools-bundler-session

Status: `draft` — aligned with session/facade positioning (2026-09-10 rename).  
IDs keep `R-BC*` temporarily for continuity; rename later if desired.

## R-BC1（MUST）可编程 Bundler 会话

提供 `createBundler(resolved)`（或等价），返回会话对象，至少暴露：`build(overrides?)`、`watch(watchOpts)`、`dev(devOpts)`。会话持有 `workPath` / `targetPath` / `useAppIdDir`、编译选项基座，以及本会话唯一的 lifecycle 实例。  
**不要求**本门交付 `use(plugin)` / 管道插件 API。

## R-BC2（MUST）CLI ⊆ session

`dimina-cli build`（含 `-w`）与 `dimina-cli dev` 必须通过同一会话 API 完成编排；不得在 bin 内再手写一套与 session 平行的 lifecycle + watcher + server 串联（允许 argv 解析与日志文案留在 bin）。

## R-BC3（MUST）行为语义不变

相对改造前，下列契约保持等价：

- `build()` 公开返回值与错误契约（含 lifecycle 事件序）；
- `createBuildWatcher` / watch-scheduler 语义；
- `dimina-cli dev` 的 CF-4 D1a 时序；
- 小程序编译产物语义（本门不改 view/logic/style / `storeInfo` 算法）。

## R-BC4（MUST）兼容导出

保留 `import build from '@dimina/bundler'` 与 `import { createBuildWatcher } from '@dimina/bundler/watch'`（或等价既有路径）。内部可委托 session；外部签名与可观察行为不变。

## R-BC5（MUST）回归

- `pnpm --filter @dimina/bundler test` 通过；
- `dimina-cli build` 与 `dimina-cli dev` 冒烟（或 validation 成文等价）通过。

## R-BC6（SHOULD）Builtin 阶段清单

维护 [stages.draft.md](./stages.draft.md)：命名阶段 ↔ 今日函数/模块对照。本门**不**要求抽出可执行阶段图，也**不**要求 plugin API。

## Non-requirements

- 阶段图抽出；管道插件（app/page loader 插件化、`transform` / `replaceStage`）；
- 以 `api.on` 为必达「主 plugin」交付 / G3 dogfood 插件包；
- 独立 npm 包；模板 IR；TypeScript 迁移；改 `packages/*`；推 didi。
