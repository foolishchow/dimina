# FE Tools Packer Context

- Action: `fe-tools-packer-context`
- Status: `draft`
- Updated: 2026-09-22
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-graph-bootstrap`](../_archive/complete/fe-tools-graph-bootstrap/README.md)（**complete**；Graph 路 1）
- 前置：[`fe-tools-packer-orchestrator`](../_archive/complete/fe-tools-packer-orchestrator/README.md)（**complete**；orch 入口）
- 前置：[`fe-tools-packer-core-shape`](../_archive/complete/fe-tools-packer-core-shape/README.md)（**complete**；`PackerContext` §2）
- 文档集：[README](README.md) · [requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

形状已定义 **PackerContext** 为 Graph/Loader 的 I/O 环境（D-PCS-1/4/6），且 Graph 已有 `build(ctx)` / `reconcile(ctx)`。但今日仍是 **路 1**：

- `toPackerContext` 从 `CompilerContext` 拼出 ctx，`resolveAlias`/`resolveNpm` 为 stub
- `PackerGraph.build(ctx)` **忽略 ctx**，继续经 ALS 委托 `storeProjectConfig` / `storeAppConfig` / …

结果：D-PCS-4「Graph 从 ctx 自举」与 D-GB 终态路 2 未还；orch 虽持 session state，config fixpoint 仍绑 env ALS。

## Goal

把 **PackerContext 变为 Graph 可用的真 I/O**，并完成 **Graph 路 2**：

- `build` / `reconcile` 经 `ctx.readContent`（及 paths/fileTypes）完成 config fixpoint
- 不再依赖「忽略 ctx、只走 ALS Proxy」的路 1 委托
- 行为 0（产物 / vitest / tsc）

## 设计决策（讨论冻结）

| ID | 议题 | 决策 |
| --- | --- | --- |
| D-PC-0 | 本门厚度 | **PackerContext 真 I/O + Graph 路 2** 同门；非仅文档/adapter 薄壳 |
| D-PC-1 | 行为 | **行为 0**；不改三车道 parse-walk / emit 字符串语义 |
| D-PC-2 | 与 orch | orch 继续开车；本门改 Graph/ctx 装配，**不**重开编排/写权（D-OR-* 已冻） |
| D-PC-3 | 非目标债 | **不做** incremental-unify / MC3c / load·compile 拆分 / 真 registry / Session 持久 state / `EmitEntry[]` 返回收敛 |
| D-PC-4 | resolvers | **本门继续 stub**；config fixpoint 内 alias/npm 随 `getModuleId` 逻辑迁入 Graph 私有；PackerContext 真接线另门（load 拆分 / 调度器） |
| D-PC-5 | ctx 装配 | **增强 `toPackerContext`**（可抽至 `packer/context.ts`）；**调用点仍在 `storeInfo`**（steps 1–2 后）；orch **不**直组 |
| D-PC-6 | env config | **迁入 Graph**（或 `packer/` 私有模块），**关路 1**；**不长期双轨主路径**；getter/`storeInfo`/`resetStoreInfo` 签名保持（R-PC-5） |
| D-PC-7 | 存在性 I/O | **本门不扩** PackerContext（不加 `fileExists`）。内容只经 `ctx.readContent`；可选文件存在性由 Graph **直接** `fs.existsSync`（与今日语义一致） |
| D-PC-8 | NpmResolver | config fixpoint 内：`new NpmResolver(ctx.workPath)`（或 Graph 持有等价实例），**不**经 ALS `getCompilerContext().npmResolver` 做组件路径解析。`storePathInfo` 仍可写 ALS npmResolver 供车道消费 |
| D-PC-9 | build 局部性 | `build`/`reconcile` 过程只读写 Graph 局部 `configData`/临时状态；**禁止**经 ALS getter（`isMiniGame`/`getRuntimeType`/`getAppConfigInfo`…）回入未完成的 Graph |
| D-PC-10 | fileTypes | 建图 kind/扩展名判定用 **`ctx.fileTypes`**，不用 `getTemplateExts`/`getStyleExts` 等 ALS getter |
| D-PC-11 | store* 薄壳 | `storeProjectConfig` 等：迁逻辑后 **保留 env 薄 re-export**（委托 Graph 或共享私有模块），使 `__tests__/env.spec.js` 等现有 import **不被迫本门改测**；主路径仍只走 Graph（非双轨） |

## Non-goals

- incremental-unify；MC3c；load/compile 物理分离；真 LoaderRegistry 表驱动
- Packer 整包抽取；改 emit / modDefine / CSS / 模板语义
- Session 级持久 PackerSessionState；`orchestrate` → `EmitEntry[]`
- 大拆 `env.ts` 文件（可迁逻辑；不强制目录重组）
- 本门接线 PackerContext.`resolveAlias` / `resolveNpm` 真实现（D-PC-4）
- 本门扩展 PackerContext 存在性 API（D-PC-7）

## 边界

```text
graph-bootstrap (complete):     PackerGraph 路 1（委托 env）
packer-orchestrator (complete): orch 入口 + 写权
本 Action:                      PackerContext 真 I/O + Graph 路 2
另门:                           IU / load-compile 拆 / registry / resolvers 真接
```

## 行为 0 守卫

- examples 产物 diff=0（全量 7 项目：air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui——Experience-Review §12 全量要求，此门改 env.ts + graph.ts 双全局路径）
- 全量 vitest 绿；tsc 0

## Readiness gaps

- Readiness review findings F1–F5 已收口为 D-PC-7..11（2026-09-22）→ **设计挡点已清**
- 升 `ready` / 授 `in_progress` 须另授
- 未改 `src`（本包仅 draft 文档）
- close 时回流：`packer/README.md` 映射表（`storeProjectConfig` 不再标「纯 Scheme / 不迁移」）

## Closure conditions（预告）

- A-PC* 全 pass + P-PC* 证据
- architecture-notes / STATUS / `packer/README.md` 回流；注明 Graph 路 2
- 升 complete / 归档另授
