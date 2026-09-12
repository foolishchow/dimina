# Implementation plan — fe-tools-project-store（PS1）

Status: **冻结（FR1 · 2026-09-12）** — 升 `in_progress` 后按序执行；**未**授权实施直至 Action=`in_progress`

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

- `build-pipeline.js` / 阶段表抽取（BP1）  
- 删闭包（PS2）  
- compile-cache；新 exports  

## 验证

升 `in_progress` 时记基线 SHA（RR3）→ [validation.md](./validation.md) P-PS01..08。

## 顺序相对 BP1

**略先**（RR7）；**禁同 PR**（P5）。
