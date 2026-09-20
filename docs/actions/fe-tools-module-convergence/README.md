# FE Tools Module Convergence（伞）

- Action: `fe-tools-module-convergence`
- Status: `draft`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前身：[`fe-tools-module-centric`](../_archive/complete/fe-tools-module-centric/README.md)（**complete 已归档**；刀 2+3 倒逼出半套 Module 资产）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [roadmap](roadmap.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

module-centric 伞交付了 M1（模块级失效）+ M2（结果缓存），倒逼出半套 Module 资产。但「一个源模块」仍是分散割裂的：

| 表示 | 位置 | 有什么 | 缺什么 |
| --- | --- | --- | --- |
| `GraphNode` | `model/dependency-graph.ts` | `{ id, type, entry, packageRoot, files }` | **无 code**；空壳 |
| `CompileInfo` | `compiler/logic/index.ts` | `{ path, code, map, ... }` | logic-only；游离于图 |
| `scriptRes` | `compiler/view/index.ts` | `Map<modulePath, code>` | view-only；游离于图 |
| `ModuleResultCache` | `model/module-result-cache.ts` | `{ compileInfo, logicDependencies }` | logic-only；session-only |
| `EmitModule` | `pipeline/emit.ts` | `{ moduleId, code, map }` | 消费契约，不持有 |
| `BuildModel` | `model/build-model.ts` | `Map<entryId, { files }>` | entry 级，非 module 级 |

**同一逻辑实体（一个源模块）在 4+ 处有不相关表示。** 图节点有归属/边但无编译负载；worker 有编译负载但图不感知；cache 有结果但与图分离。

## Goal

收敛成**统一的 Module 对象**，贯穿图 → 编译 → 缓存 → 产物 → 失效：

```text
DependencyGraph.node = Module { id, kind, code?, deps, files, packageRoot, sourcemap? }
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   worker 回填 code         cache = node.code      emit 从图取 Module
   (IPC snapshot)           (session-only α)       (EmitModule 不变)
```

**不是新造层** — 是把已有半套资产（图空壳 node + worker 游离编译结果 + cache + BuildModel end-state）收敛成同一对象。

## Non-goals

- fingerprint 下沉模块级（β；依赖 Module 大对象统一 + 持久化决策；**另门**）
- HMR patch 产物（热更最小单位；另门）
- 整包 Packer 抽取（packer-research 已否决；不重开）
- 一次统一 view / logic / Store 的全部 Module 表示字段（**本伞分刀渐进**）
- 改 emit / `modDefine` 字符串（行为 0）
- 改 `fe/packages`
- 改 worker IPC 协议语义（仅扩字段，不改协议骨架）

## 边界

```text
module-centric 伞（complete）:  词汇 + D-MF-1 + 刀 2+3（半套资产）
本伞（convergence）:           半套 → 全套收敛（GraphNode 加 code → view 统一 → BuildModel 派生）
另门:                           fingerprint 模块级 / HMR / 持久化 β
```

## 子门

| 子门 | 内容 | 行为 0 |
| --- | --- | --- |
| **MC0** | graph 正确性：删 stale edge/node；增量 closure 一致（cache hit 不跳过 dep 发现）；graph 成为可靠的结构权威 | ✅（输出不变；图修正仅影响内部一致性） |
| ~~MC1~~ | ~~GraphNode 加 code~~ → **deferred**（D-MC-0 选 A：code 不上图，沿用 M2；等 HMR 或另一消费者出现时再评估） | — |
| ~~MC2~~ | ~~view 入图~~ → **deferred**（同 MC1） | — |
| **MC3** | BuildModel 从图派生（entry → graph 取 module 集 → cache 取 code → emit）；`BuildModel.add` 散装 entries 退居兼容 | ✅（输出不变；派生路径替代散装） |

## 产品门

| 门 | 内容 | 验收 |
| --- | --- | --- |
| **MC0** | graph 正确性：stale edge/node 清理 + 增量 closure 一致 | A-MC0 pass |
| ~~MC1~~ | ~~GraphNode code~~ → deferred（D-MC-0 选 A） | — |
| ~~MC2~~ | ~~view Module 入图~~ → deferred | — |
| **MC3** | BuildModel 从图派生 | A-MC3 pass |

## Status / 授权

- 当前 **`draft`**（2026-09-21）。D-MC-* 待定（需 review 冻结）。
- **未授权**改 `fe/tools/bundler/src` / `fe/packages`。子门另立另授 `in_progress`。

## 闭合条件

- MC0 + MC3 全 complete（MC1/MC2 deferred；或书面降级且伞目标降级成文）
- 持久发现回流 `docs/fe-tools/architecture-notes.md`
- STATUS / 导航一致；伞级 A-* 全 pass

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-21 | 立项 `draft`：从 TODO A formalize；承接 module-centric 伞 complete 后的半套资产收敛 |
