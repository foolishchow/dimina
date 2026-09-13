# Implementation plan — fe-tools-project-store（PS1）

Status: **PS1 已交付（`aa6b6508`）+ PS2 已交付（审查后修订）** — PS1/PS2 触达序已执行；PS3 待实施

## 目标门

**PS1**：壳 + 接线 + 刀 A + M-A；行为 0；不含 PS2 / 阶段表 / `session.store` / cache。

## 触达序

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/model/project-store.js` | **新建**：`createProjectStore`；`load`（薄包 `storeInfo`+ALS）；`snapshot` / `getDependencyGraph` / `merge` |
| 2 | `src/index.js`（`build` / `runBuild`） | 收 **`options.store`（RR4）**；无则 L3 临时 create；`load` 后 **`ctx.dependencyGraph = store.getDependencyGraph()`（RR6）**；**禁止**再 `new` 挂 ctx；**`build:start` 序列化剥 `store`（FR2）**（同剥 graph/lifecycle） |
| 3 | `src/session/index.js` | `createBundler` → **`state.store = createProjectStore()`（RR5）**；`.build` / `.watch` / `.dev` 注入 `options.store` 或 watcher `store`；**不**挂公开 `session.store` |
| 4 | `src/watch/watch-runner.js` | 可选 `store`；缺省临时 store（W2）；编译路径传同一 store；**保留**闭包 graph 镜像（W3） |
| 5 | 测例 | `build({ store })` 验 `Object.is`；双 `createBundler` 两实例；既有 watch/dev 仍绿；可选 M-A 消融（SHOULD） |

## 不做（本 PR）

- `build-pipeline.js` / 阶段表抽取（BP1）（兄弟门已 complete）
- PS3 订阅 / applyChanges
- compile-cache；新 exports

## PS2 触达序（已执行 2026-09-12）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/watch/watch-runner.js` | 删闭包 `dependencyGraph` 变量 + `new DependencyGraph(buildResult.dependencyGraph)`（start/rebuild 两处）；无 store 注入时临时 `createProjectStore()` 并持有（W2）；`createWatchBuildPlan` 改用 `activeStore.getDependencyGraph()`（plan 只读 Store 活图，M-A 同引用） |
| 2 | `src/session/index.js` | `.watch()` 创建 watcher 时补传 `store: state.store`（补 PS1 缺口；watch 与 build 共用同一 Store 实例） |
| 3 | 测例 | watch-runner.spec：+2 PS2 用例（注入 store 同一引用传 build；无 store 临时 create 复用）；既有 watch/dev 全绿 |
| 4 | 消融 | PS2-store：移除 store 持有 → 2 用例失败（store undefined）→ 恢复 6/6 绿 |
| 5 | 验证 | 487 tests / 73 suites 全绿；字节等价 nomap 0 / sourcemap 0 diff（对照 0556f320） |

**结果**：活图唯一权威 = Store；watch 闭包镜像（W3）已删；`createWatchBuildPlan` 读 `store.getDependencyGraph()`。

## 验证

升 `in_progress` 时记基线 SHA（RR3）→ [validation.md](./validation.md) P-PS01..08。

## 顺序相对 BP1

**略先**（RR7）；**禁同 PR**（P5）。
