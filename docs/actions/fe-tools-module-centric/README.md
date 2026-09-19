# FE Tools Module-Centric（Umbrella）

- Action: `fe-tools-module-centric`
- Status: `ready`
- Updated: 2026-09-19
- Status authority: [Action Status](../STATUS.md)
- 术语 / 结构真源：[docs/fe-tools/architecture-notes](../../fe-tools/architecture-notes.md)（Packer / Scheme）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md) · [roadmap](roadmap.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：[`fe-tools-sidecar`](../_archive/complete/fe-tools-sidecar/README.md) complete；[`boundaries`](../_archive/complete/fe-tools-bundler-boundaries/README.md)；[`emit-layer`](../_archive/complete/fe-tools-bundler-emit-layer/README.md)；[`packer-research`](../_archive/complete/fe-tools-packer-research/README.md)（不立即抽 Packer）

## 术语

- **Entry / `entryId`**：小程序 path（页 / 组件 / `app`）。属 Scheme；只表示入口与发布范围，**不是**变换单位。
- **Module / `moduleId`**：可变换单位。M1：**logic**；线上 id = 今日 `CompileInfo.path`（页入口可与 `entryId` 字符串重合，属概念债，不进 M1 迁移）。
- **两层**：概念上 `entryId` ≠ `moduleId`。刀 2 返回 Module 集，不冒充 Entry API。
- **Packer / Scheme**：沿用 architecture-notes。本伞推进「往 Packer 靠的半步」（图与缓存围着 Module），**不**整包抽 Packer。

## 问题陈述

今天「一个源模块」是两截，且 **Entry 与 Module 焊在同一张图 node 表**：

- `DependencyGraph` 节点只有归属 / 边 / fileKinds，无 code；node id 混用 page path 与 `/…` logic id
- logic `compileRes` / view `scriptRes` 持有变换结果，图不感知
- 失效粒度停在 **Entry**（`getAffectedEntries`）与车道 kind；emit 已有 `{moduleId, code, map}`，但上游没有模块级失效集与跨 rebuild 的 Module 结果缓存

成熟 Packer 以 **fs Module** 为中心；packer-research 否决整包抽取，推荐先做刀 2+3。

## Goal

冻结 **Module 一等公民** 路线，并规定子门顺序：

1. **词汇**：Entry vs Module；**D-MF-1 已封口**（见 technical-design）
2. **子门**：刀 2 模块级失效 → 刀 3 Module 结果缓存；（可选）emit W1 参数化
3. **纪律**：伞不随子门自动升 `ready` / `complete`；子门另立另授 `in_progress`

本伞主要交付**路线与决策**；产品代码在子门实施。

## Non-goals

- 整包 Packer extraction（已研究否决；重评估条件见 packer-research）
- 一次统一 view / logic / Store 的全部 Module 表示（TODO A 大收敛推迟到刀 2+3 之后）
- 改 view / style 车道业务语义；改 `fe/packages`
- 在本伞直接改 `fe/tools/bundler/src`（无子门授权时）
- 复活或扩大已归档 [`fe-tools-module-cache`](../_archive/complete/fe-tools-module-cache/README.md) 的缩 scope 交付（刀 3 另立新 Action）

## 边界

```text
本伞:     Module 词汇 + 子门顺序 + Non-goals（文档）
子门 M1:  模块级失效查询（刀 2）
子门 M2:  Module 变换结果缓存（刀 3）
可选 M0:  emit modDefine 参数化（W1，S 级）
不做:     整包抽 Packer；一次 Module 大收敛
```

## 产品门（伞级）

| 门 | 内容 | 验收 |
| --- | --- | --- |
| **MF0** | 词汇与子门顺序冻结 | D-MF-1..4 在档且 D-MF-1 已封口；roadmap 一致 |
| **MF1** | 子门 M1 formalize 就绪 | D-MF-1 足够开刀 2；不发明 Packer API |
| **MF2+** | 由子门交付 | 伞只跟踪，不替代子门 acceptance |

## Status / 授权

- 当前 **`ready`**（2026-09-19）。D-MF-1 已封口；A-MF0..3 文档门 pass。
- **仍未授权**改 `fe/tools/bundler/src` / `fe/packages`。未授权子门 `in_progress`。
- 子门 M1：[`fe-tools-module-invalidation`](../fe-tools-module-invalidation/README.md) **`ready`**（2026-09-20 用户授权；6 轮 review 收敛；升 in_progress 另授）。

## 闭合条件

- MF0 交付；子门 M1+M2 complete（或书面 deferred 且伞目标降级成文）
- 持久发现回流 `docs/fe-tools/architecture-notes.md`
- STATUS / 导航一致；伞级 A-\* 全 pass

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-19 | M1 [`fe-tools-module-invalidation`](../fe-tools-module-invalidation/README.md) formalize 为 `draft` |
| 2026-09-19 | 升 **`ready`**（用户授权）；MF0 冻结；下一步 formalize M1 |
| 2026-09-19 | review findings：条款 3 明确 logic 闭包归 M1 TD；修订记录去歧义 |
| 2026-09-19 | **D-MF-1 封口**：方案 A；刀 2 仅 logic；view/style 排除；规范形迁移另门；图不拆表 |
| 2026-09-20 | 立项 `draft`：从 TODO 近端顺序 §1 formalize |
| 2026-09-20 | review M1 R4 修复：roadmap + TD 两处 T1–T5→T1–T7（M1 实际冻结 7 议题 → D-IV-1..9） |
| 2026-09-20 | M1 fe-tools-module-invalidation 升 **`ready`**（用户授权）；6 轮 readiness review 收敛 |
