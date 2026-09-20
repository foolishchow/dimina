# FE Tools Module Convergence（伞）

- Action: `fe-tools-module-convergence`
- Status: `draft`
- Updated: 2026-09-21
- Status authority: [Action Status](../STATUS.md)
- 前身：[`fe-tools-module-centric`](../_archive/complete/fe-tools-module-centric/README.md)（**complete 已归档**；刀 2+3 倒逼出半套 Module 资产）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [roadmap](roadmap.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

module-centric 伞交付了 M1（模块级失效）+ M2（结果缓存），倒逼出半套 Module 资产。但 Packer 的核心形状——「entry → 遍历 graph → 取 module 集 → 取 code → bundle → emit」——仍不完整：

| 资产 | 位置 | 有什么 | 缺什么 |
| --- | --- | --- | --- |
| `GraphNode` | `model/dependency-graph.ts` | `{ id, type, entry, packageRoot, files }` | stale edge/node（无清理 API）；结构不可靠 |
| `ModuleResultCache` | `model/module-result-cache.ts` | `{ compileInfo, logicDependencies }` | 有 code + dep list；但游离于 graph |
| `EmitModule` | `pipeline/emit.ts` | `{ moduleId, code, map }` | 消费契约；无派生路径 |
| `BuildModel` | `model/build-model.ts` | `Map<entryId, { files }>` | 散装 `add`；无从 graph 派生路径 |

**Packer 形状缺两块：** graph 不可靠（stale edge/node）+ 无「entry → graph → modules → code」派生函数。

## Goal

推进 **Packer 形状**——不抽 Packer（packer-research 已否决整包抽取），但创建 Packer 的核心遍历函数：

```text
entry → traverse GraphNode → module 集 → 查 ModuleResult 取 code → [EmitModule]
```

两步：
1. **MC0**：让 GraphNode 可靠（stale 清理 + closure 一致）——Packer 前置
2. **MC3a**：创建 `deriveFromGraph(graph, cache, entryId)` 派生函数——Packer 核心形状

## Non-goals

- 整包 Packer 抽取（packer-research 已否决；重评估条件见 packer-research）
- code 上图（D-MC-0 选 A：graph = 结构权威，code 留 ModuleResultCache；D-MF-2 不推翻）
- 搬 emit/transform/bundle 到主线程（MC3b；deferred；行为 0 风险高）
- view/style 在派生路径中的处理（MC3c；deferred）
- fingerprint 下沉模块级（β；另门）
- HMR patch 产物（另门）
- 改 emit / `modDefine` 字符串（行为 0）
- 改 `fe/packages`
- 改 worker IPC 协议语义

## 边界

```text
module-centric 伞（complete）:  词汇 + D-MF-1 + 刀 2+3（半套资产）
本伞（convergence）:           graph 正确 + Packer 形状（deriveFromGraph）
另门:                           emit 搬主线程 / view·style 派生 / fingerprint / HMR
```

## 子门

| 子门 | 内容 | 风险 | 对 Packer 的价值 |
| --- | --- | --- | --- |
| **MC0** | graph 正确性：补 `removeDependency` / `removeNode` / merge diff；增量 closure 一致 | 低 | Packer 前置：可靠图 |
| **MC3a** | `deriveFromGraph(graph, cache, entryId)` 函数：entry → 遍历 GraphNode → 取 module 集 → 从 ModuleResult 取 code → 返回 `[EmitModule]`（只读，不碰 emit） | 低（纯新增函数） | **Packer 核心形状** |
| ~~MC3b~~ | ~~搬 emit/transform/bundle 到主线程~~ → **deferred**（打破 streaming；行为 0 风险高） | 高 | Packer bundle/emit 步骤；等 MC3a 成熟 |
| ~~MC3c~~ | ~~view/style 在派生路径中的处理~~ → **deferred** | 中 | Packer 多 kind 支持 |
| ~~MC1~~ | ~~GraphNode 加 code~~ → **deferred**（D-MC-0 选 A） | — | — |
| ~~MC2~~ | ~~view 入图~~ → **deferred**（同 MC1） | — | — |

## 产品门

| 门 | 内容 | 验收 |
| --- | --- | --- |
| **MC0** | graph 正确性：stale edge/node 清理 + 增量 closure 一致 | A-MC0 pass |
| **MC3a** | deriveFromGraph 函数：entry → graph → modules → code → [EmitModule] | A-MC3a pass |

## Status / 授权

- 当前 **`draft`**（2026-09-21）。D-MC-* 待 review 冻结。
- **未授权**改 `fe/tools/bundler/src` / `fe/packages`。子门另立另授 `in_progress`。

## 闭合条件

- MC0 + MC3a 全 complete（MC3b/MC3c/MC1/MC2 deferred；或书面降级且伞目标降级成文）
- 持久发现回流 `docs/fe-tools/architecture-notes.md`
- STATUS / 导航一致；伞级 A-* 全 pass

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-21 | 立项 `draft`：从 TODO A formalize；承接 module-centric 伞 complete 后的半套资产收敛 |
| 2026-09-21 | D-MC-0 冻结：选 A（graph = 结构权威，code 不上图）；MC1/MC2 deferred |
| 2026-09-21 | TD §0 加 GraphNode vs ModuleResult 职责边界 + watch 数据流向 |
| 2026-09-21 | MC3 拆为 MC3a（deriveFromGraph 函数，低风险）+ MC3b（搬 emit，deferred）+ MC3c（view/style，deferred）。伞目标调整为「推进 Packer 形状」 |
