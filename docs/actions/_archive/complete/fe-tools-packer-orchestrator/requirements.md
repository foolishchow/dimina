# Requirements — fe-tools-packer-orchestrator

Status: **complete（2026-09-22）**

权威决策：D-OR-0..8（见 README）；形状 D-PCS-5/8/9（返回值见 D-OR-7）。

## R-OR-1（MUST）PackerOrchestrator 实现类

- 新增实现（建议 `src/packer/orchestrator.ts`，可拆 steps），提供 `orchestrate(...)`
- **迁入**今日 `build-pipeline` 过程体（init → concurrent stages → publish）；本门结束时编排脑不在 `build-pipeline.ts`
- registry 字段可为 stub；**不要求** `implements PackerOrchestrator`（若与 D-OR-7 返回值冲突）
- 不引入 `any` / `as any` / `@ts-nocheck`

依据：D-OR-0 B, D-OR-2, D-OR-5 P2, D-OR-7, D-PCS-5/9。

## R-OR-2（MUST）双端唯一入口

- 单次 build（CLI / session `runOnce` 等现有公开编译入口）最终只经 `orchestrate`
- watch rebuild 最终只经同一 `orchestrate`
- 禁止 CLI 走 orch、watch 仍直接拼 `build-pipeline.run` 的长期双轨

依据：D-OR-1。

## R-OR-2a（MUST）单次 state 短命（D-OR-4）

- 单次入口：默认 `new PackerSessionState()`；公开 `build` **认** `options.state?` 注入
- **不得**把同一 state 挂到 Bundler Session 以跨多次 `.build()` 复用
- watch 路径继续长活 sessionState

依据：D-OR-4；修订 D-OS-1「单次不传」。

## R-OR-3（MUST）写权 / 触发归位

`orchestrate` 内（或由其独占调用的私有步骤）负责：

- 按 options 触发 `state.graph.build` 或 `reconcile`（语义对齐今日 storeInfo / watch）
- 派发三车道 stage（可复用现有 executeTask / stage）
- worker 返回后：graph delta 合并 + logic moduleCache 更新（今日 stage-channel 职责归 orch 发起）
- moduleCache **只**读写 `state.moduleCache`（无独立 `options.cache` 旁路）

依据：D-OR-0 B；D-OR-8；lifecycle-audit F-2。

## R-OR-4（MUST）增量语义不升级

- 可继续消费今日 `watch-plan` 产出的 affectedEntries / logic invalidatedModules
- **不得**泛化 `computeInvalidatedModules` 至 view/style，不得为 view/style 新建 ModuleResultCache 路径

依据：D-OR-3；deferred `incremental-unify`。

## R-OR-5（MUST）行为 0

- 单次 build 产物 diff=0（仓库惯例 examples）
- watch rebuild 产物语义与实施前一致
- `.dev` / `skipMaterialize` 语义与实施前一致
- 公开 API 返回可消费的 buildResult（至少既有 `appId` 等消费字段可用）
- 全量 vitest 绿

依据：行为 0；D-OR-7。

## R-OR-6（MUST）无双脑（D-OR-5）

- 公开 `build`/`runBuild` 若保留：仅入口适配（D-OR-8），不含 Listr 编排与 graph/cache 写权
- `build-pipeline.ts`：删除，或过渡期 re-export 且 **零**编排逻辑

依据：D-OR-5 P2。

## R-OR-7（MUST）OrchestrateOptions 扩展（D-OR-6）

- 扩展 `OrchestrateOptions`：`parallel`（默认 true）/ `incremental` / `configChanged` + `affectedEntries?` / `stages?` / `invalidatedModules?` / `seedPath?` / `prepareConfig?` / `prepareNpm?` / `skipMaterialize?`
- **不得**把 `dependencyGraph` toJSON 或独立 `cache` 列为 options 常规字段
- watch-plan 产出映射进上述字段；单次 build 走全量默认；`.dev` 填 `skipMaterialize`

依据：D-OR-6 M1。

## R-OR-8（MUST）返回 buildResult（D-OR-7）

- `orchestrate` 本门返回今日 buildResult（字段等价即可）
- 公开入口透传；**不**以「只返回 `EmitEntry[]`」破坏 `appId`/`buildModel` 等消费方
- `EmitEntry[]` 形状字面收敛 **非**本门 MUST

依据：D-OR-7。

## R-OR-9（MUST）装配边界（D-OR-8）

- `runWithCompilerContext` 在 orch 内；适配器不包
- 适配器负责 state/store/lifecycle/paths/`useAppIdDir`；orch 负责过程体与写权
- cache 唯一来自 `state.moduleCache`
- `store` / `lifecycle` / `useAppIdDir` **不进** `OrchestrateOptions`；经 orch 内部调用面（实例字段或扩参）传递；禁止 M2 第二袋
- 单次全量：`configChanged:false`（与 D-OR-6 映射表一致）

依据：D-OR-8。

## Non-requirements

- 真 registry 表驱动 / 通用 worker 按 kind 重写
- load/compile 物理分离
- MC3c；Packer 整包抽取；改产物字符串语义
- 单次 / Bundler Session 级持久 PackerSessionState（D-OR-4）
- M2 双袋 legacy hints；M3 把 affected/stages 硬塞 state
- `orchestrate` 返回值收敛为 `EmitEntry[]`（另门）
