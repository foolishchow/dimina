# Acceptance — fe-tools-project-store

Status: `ready`（Acceptance Review Round 2 · FR 齐；未实施）

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-PS01 | R-PS1 | 存在 `src/model/project-store.js`；`createProjectStore` + `load` / `snapshot` / `getDependencyGraph`（及按需 `merge`）可用；`load` 薄包今日 `storeInfo`+ALS；**P2**：对外 getters 语义不变 | P-PS01 相关测例 + 源码 | pending |
| A-PS02 | R-PS2 / R1 | **R1 接线**：`session/index.js` 在 `createBundler` 即持有 store 并注入 build/watch；`watch/watch-runner.js` 收可选 `store`；`index.js`/`build()` 可注入 + M-A 挂 ctx。**无**公开 `session.store`（R3）。两次 `createBundler` → **两个** store 实例（非进程单例） | P-PS03 / P-PS06 + 源码审查 | pending |
| A-PS03 | R-PS3 | **M-A**：编译路径上 `Object.is(ctx.dependencyGraph, store.getDependencyGraph())`；`stage-channel.merge` 写入该同一引用；结束后与 `buildResult` 所见图为同一权威实例（非仅内容碰巧相等） | P-PS03 | pending |
| A-PS04 | R-PS4 | **刀 A（W1–W3）**：session.watch/dev 注入 store；无 store 直调 watcher 可临时 store（W2）；闭包 graph 镜像**仍在**（W3 双持）。**W4**：`beforeBuild` ctx **不必**含 store（不强制附加） | P-PS04 + 源码 | pending |
| A-PS05 | R-PS5 | vitest 全绿；nomap 相对基线 diff=0；**L1** 可观察为每次 session `.build` 仍全量 load（对齐今日每次 `storeInfo`）。CLI build/watch/dev 冒烟 **SHOULD** | P-PS01 / P-PS02（+ CLI 若做） | pending |
| A-PS06 | R-PS6 | diff 符合 R1 清单；**无**阶段表抽取、**无**删闭包权威（PS2）、**无** compile-cache 算法改、**无**新 package exports | P-PS05 / P-PS06 | pending |

## Non-acceptance（本门不验）

| 项 | 说明 |
| --- | --- |
| **L4** | `watch.stop` / `dev.close` 后保留 Store 实例与图 — **PS1 不强制新测**；实现按调度稿；PS2+ 再 harden |
| **PS2 / PS3+** | 删闭包、subscribe、applyChanges |
| **BP1** | 不要求 `build-pipeline.js` 存在 |
| **compile-cache** | R4 |

## Notes

- **消融（AR7 · SHOULD）**：若 M-A 挂接可拔，宜有一测证明「非同引用会漂」；做不到则 validation 写明原因，不以全绿代替。  
- Evidence 列以 `P-PS*` 为主；源码审查补 R1/R3/非单例。  
- **RR4**：M-A 测例经 `build({ store })` / `createProjectStore`，**不**依赖 `session.store`。  
- **RR6**：禁止 `new DependencyGraph` 挂 ctx（审查）。  
- **FR2**：`build:start` 序列化选项须剥 `store`（与 graph/lifecycle 同列）。  
- 设计已冻结 v1；Action **`ready`**；实施须升 `in_progress`。
