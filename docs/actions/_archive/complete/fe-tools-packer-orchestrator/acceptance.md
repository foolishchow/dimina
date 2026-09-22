# Acceptance — fe-tools-packer-orchestrator

Status: **complete（2026-09-22）** — A-OR1..9 全 pass。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-OR1 | R-OR-1 | 存在 orch 实现且导出 `orchestrate`；过程体在 orch（非 pipeline 双脑） | P-OR01 | **pass** |
| A-OR2 | R-OR-2 | CLI/`runOnce` 与 watch rebuild 均只经 `orchestrate`（无长期双轨） | P-OR02 | **pass** |
| A-OR2a | R-OR-2a | 单次默认短命 `new PackerSessionState()`；公开 `build` 认 `options.state?`；无 Session 跨 `.build()` 复用 | P-OR02a | **pass** |
| A-OR3 | R-OR-3 | graph 触发、stage 派发、mergeDelta/cache 写由 orch 发起；cache 只经 `state.moduleCache` | P-OR03 | **pass** |
| A-OR4 | R-OR-4 | 无 view/style ModuleResultCache 新路径；无全 kind invalidation 泛化 | P-OR04 | **pass** |
| A-OR5 | R-OR-5 | 单次 + watch + `.dev`/skipMaterialize 行为 0；buildResult 可消费；vitest 绿 | P-OR05 | **pass** |
| A-OR6 | R-OR-6 | `build-pipeline` 无编排脑；公开 `build` 至多入口适配 | P-OR06 | **pass** |
| A-OR7 | R-OR-7 | `OrchestrateOptions` 含 D-OR-6 字段（含 `skipMaterialize`）；无 dependencyGraph/cache 常规入 options | P-OR07 | **pass** |
| A-OR8 | R-OR-8 | `orchestrate` / 公开入口返回 buildResult（非强制 `EmitEntry[]`） | P-OR08 | **pass** |
| A-OR9 | R-OR-9 | ALS 在 orch 内；适配器不持 Listr/写权；store/lifecycle/useAppIdDir 不进 OrchestrateOptions | P-OR09 | **pass** |

## Non-acceptance

- 以「包一层 pipeline」宣称 complete 但 watch 仍旁路直接 `run`（违反 D-OR-1）
- 保留 `build-pipeline` 为真编排而 orch 只转发（违反 D-OR-5 P2）
- 用 legacy 第二袋绕过 options 扩展、或继续经 options 传 dependencyGraph/cache 当权威（违反 D-OR-6/8）
- 为贴形状改返回 `EmitEntry[]` 导致 `appId`/`buildModel` 消费方破坏且无适配（违反 D-OR-7）
- 本门实施 `incremental-unify` 或单次持久 state（违反 D-OR-3 / D-OR-4）
- 未授 `in_progress` 即改 `src`
