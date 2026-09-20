# FE Tools Emit Relocate

- Action: `fe-tools-emit-relocate`
- Status: `ready`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前身：[`fe-tools-module-convergence`](../_archive/complete/fe-tools-module-convergence/README.md)（**complete 已归档**；MC3b deferred → 本 Action 独立立项）
- 文档集：[README](README.md) · [requirements](requirements.md) · [technical-design](technical-design.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

当前 emit（transform + bundle + sourcemap merge）在 **compile-worker 内**跑（`logicCompile` → `writeCompileRes` → `emitEntry` → sink → streaming → `BuildModel.add`）。emit 发生在编译期间，worker 返回之前。

这导致：
- emit 与 compile 耦合在同一个 worker——无法不重编译就重建产物（HMR / config-only change 的前置条件缺失）
- 主线程无法在 emit 前介入（graph merge 在 worker 返回后——emit 已完成）
- Packer 的 bundle/emit 步骤无法在主线程编排

## Goal

将 emit 从 compile-worker 搬到**独立 emit-worker**，打破 streaming：

```text
当前:
  worker: compile + emit（streaming）→ return
  main:   merge graph + update cache → materialize

目标:
  worker: compile only → return { compileRes }
  main:   merge graph + update cache
  main:   分组 compileRes → 发 emit-worker
  emit-worker: produceEntry → return EmitEntry
  main:   BuildModel.add(EmitEntry) → materialize
```

## 设计决策（已定）

| ID | 议题 | 决策 |
| --- | --- | --- |
| D-ER-0 | esbuild 放哪 | **新 emit-worker**（不上主线程，不阻塞 dev server） |
| D-ER-1 | streaming | **打破**（CLI 无所谓；dev server 延迟后续优化） |
| D-ER-2 | scope | **先只做 logic**（view/style 仍走 streaming；MC3c deferred） |
| D-ER-3 | 分组方式 | **B：主线程从 graph 推导**（不依赖 worker 返回分组） |
| D-ER-4 | emit-worker 生命周期 | **复用 worker-runtime**（`defineEngine` + `runWorker` + `workerPool`）；per-task 新建+销毁；emit-engine 的 compile 调 `produceEntry` 返回 entry |
| D-ER-5 | emitEntry 拆分 | `produceEntry(params) → EmitEntry` 纯函数（`strategy.apply` 提取）+ `emitEntry(params)`（produce + sink，兼容 view/style streaming） |
| D-ER-6 | config 传递 | emit-engine 的 buildConfig 透传 msg；主线程把 transform/sourcemap 等参数直接放在 msg里 |
| D-ER-7 | executeTask 泛化 | **A：泛化 `executeTask`**——`pages` 变可选；resolve 透传 payload（strip protocol fields）；`ENTRY_PATH` 加 'emit'。向后兼容。 |

## 待定议题

无。D-ER-0..7 全冻结。

## Non-goals

- 用 `deriveFromGraph` 替代 `compileRes` 作为 code 源（module 顺序 ≠ 编译顺序 → 行为 0 破坏；deferred 到 HMR / config-only rebuild 场景）
- view/style emit 搬迁（MC3c deferred）
- HMR patch 产物（另门）
- 改 emit 字符串 / transform 语义 / `modDefine` 格式（行为 0）

## 边界

```text
convergence 伞（complete 归档）:  MC0 graph 正确 + MC3a deriveFromGraph（getDependencyClosure 已交付）
本 Action:                     emit 从 compile-worker 搬到 emit-worker；主线程编排
另门:                           view/style emit / HMR / deriveFromGraph 接入 production
```

## 行为 0 守卫

- nomap + sourcemap 产物 diff=0
- 全量 vitest 绿
- `compileRes` 顺序不变（filter 只筛不改序）
- `emitEntry` perModule 策略不变
