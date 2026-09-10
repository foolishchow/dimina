# Requirements — fe-tools-bundler-session

Status: `draft` — aligned with session/facade positioning (2026-09-10 rename).  
IDs keep `R-BC*` temporarily for continuity; rename later if desired.

## R-BC1（MUST）可编程 Bundler 会话

提供 `createBundler(resolved)`（或等价），返回会话对象，至少暴露：`build(overrides?)`、`watch(watchOpts)`、`dev(devOpts)`。会话持有 `workPath` / `targetPath` / `useAppIdDir`、编译选项基座，以及本会话唯一的 lifecycle 实例，并以**只读属性 `session.lifecycle`** 暴露该实例（承接 Background 缺口③「lifecycle 非经会话暴露」）：供 API 用户挂监听（`on`，如 `bundle:published` / `build:error`）；`emit` **不在承诺面**（A1 内部契约）。  
`createBundler` 与 `resolveBundlerConfig` 须经**子路径** `@dimina/bundler/session` 公开（`exports["./session"] → dist/session/index.js`；`import { createBundler, resolveBundlerConfig } from '@dimina/bundler/session'` 可用）——**不**在主入口 re-export（M-K1/B，2026-09-10 拍板：主入口 re-export 会与 session→`import default build` 委托路径成 ESM 循环；子路径与既有 `./watch` 先例同构，`exports["."]` 面零变化）；`check-package-exports` 增加第 5 entry。  
`.dev()` 必须定义启动失败回滚（R7）：内部任一步失败时 stop watcher、close adapter、清 `activeLoop` 并 rethrow，会话在 **`activeLoop`/资源层面**保持可复用。  
**已知限制（已接受）**：lifecycle 无 `off()`（A1 v1 契约），dev 注册的 3 个监听在回滚/close 后不卸载——无害（dev-server 已关守卫兑底，空转不崩）但跨 dev 循环累积；若 A1 后续增加 `off()`，dev 应只卸载自己注册的监听（不动用户监听）。  
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

保留 `import build from '@dimina/bundler'` 与 `import { createBuildWatcher } from '@dimina/bundler/watch'`（或等价既有路径）。内部可委托 session；外部签名与可观察行为不变。`createBuildWatcher` 保留为低层/兼容导出，但 **CLI 须经 `session.watch`**（见 R-BC2），不得直接调用。

## R-BC5（MUST）回归

- `pnpm --filter @dimina/bundler test` 通过；
- `dimina-cli build` 与 `dimina-cli dev` 冒烟（或 validation 成文等价）通过。

## R-BC6（SHOULD）Builtin 阶段清单

维护 [stages.draft.md](./stages.draft.md)：命名阶段 ↔ 今日函数/模块对照。本门**不**要求抽出可执行阶段图，也**不**要求 plugin API。

## R-BC7（MUST）不重复编译语义解析

`resolveBundlerConfig` 不得重复 `resolveCompileConfig`（CF-1）的 C1 语义归一职责。本门只做**层合并 + 优先级选取**（P1–P3：CLI > API > presets），把 C1 raw 值交给现有 `resolveCompileConfig`，由后者统一完成 mode/platform 合法性、minify mode preset、sourcemap 默认、esTarget 补默认与校验。

边界约束（防漂移，对应 C7）：
- **允许**：探针 `normalizeCompileDraft` 等作为设计期的形状演示；实施时**删除或退化为传递**，不得在 `resolveBundlerConfig` 内做 minify/esTarget 的默认填充或语义校验。
- **禁止**：在 `resolveBundlerConfig` 内形成第二套 C1 语义模型（如自建 minify mode preset、自建 esTarget 默认、自建 mode/platform 合法性校验，与 `resolveCompileConfig` 并存）。
- **保留**：D-R2 的 dev mode/platform seed + hard-fail 属于**命令→编译层**的约束，不是 C1 语义归一，不视为重复。

实施形状（复用现有函数，零第二模型）：
- `resolveBundlerConfig` 内部调用 `resolveCompileConfig({ cli: cliCompile, apiOptions: apiCompile, mode: seedMode?, platform: seedPlatform? })` 产出 `Resolved.compile`（归一形状）。D-R2 的 command seed 映射到 `input.mode` / `input.platform`——现有函数的第三入口，天然最低层，**无需手拼 spread 合并**。
- D-R2 hard-fail 在归一结果上检查（mode/platform 是否漂移）。
- `session.build` / `session.watch` 把 `Resolved.compile` 传入 options 后，`runBuild` 内部会再次调用 `resolveCompileConfig({ apiOptions: options })`——已归一值过同一函数**幂等**，无害。

## Non-requirements

- 阶段图抽出；管道插件（app/page loader 插件化、`transform` / `replaceStage`）；
- 以 `api.on` 为必达「主 plugin」交付 / G3 dogfood 插件包；
- `createBundler` 暴露 `use()`：本门不暴露；`api.plugins` 字段 reserved，resolve 不加载（plugin API = 另 Action）；
- 磁盘 config file / file 层：本门**不引入**。今天 bundler 无工具配置文件层（`project.config.json` 是小程序工程文件，由 `env.storeInfo` 读，非 bundler 工具配置）；`resolveBundlerConfig` 仅处理 `cli` + `api` 两层。file 层留给后续 config-loader Action；
- 独立 npm 包；模板 IR；TypeScript 迁移；改 `packages/*`；推 didi。
