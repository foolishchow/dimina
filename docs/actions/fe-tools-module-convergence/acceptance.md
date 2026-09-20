# Acceptance — fe-tools-module-convergence

Status: **draft（2026-09-21）** — 伞级文档门；子门各有 A-*。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MC0 | R-MC0 | graph stale edge/node 清理 + 增量 closure 一致；graph 成为可靠结构权威 | P-MC00 | pending |
| A-MC1 | R-MC1 | D-MC-0 已冻结（A）；子门顺序 MC0→MC3a；继承 D-MF-1 方案 A；D-MF-2 不推翻；GraphNode vs ModuleResult 术语统一 | P-MC01 | pending |
| A-MC2 | R-MC2 | deriveFromGraph 函数：entry → graph → modules → code → [EmitModule]；只读，不碰 emit | P-MC02 | pending |
| A-MC3 | R-MC3 | 行为 0：每子门 nomap + sourcemap diff=0；全量 vitest 绿 | P-MC03 | pending |

## Non-acceptance

- 用 M2 `ModuleResultCache` 的半步资产冒充 MC0/MC3a 交付。
- 在本伞直接实施子门代码却无子门授权。
- 改 emit 字符串 / transform 语义 / runtime id（行为 0 禁线）。
- 跳过 MC0（graph 正确性）直接做 MC3a。

## Deferred

- MC3b 搬 emit/transform/bundle 到主线程（打破 streaming；行为 0 风险高）
- MC3c view/style 在派生路径中的处理（Packer 多 kind；等 MC3a 成熟）
- MC1 GraphNode code（D-MC-0 选 A：code 不上图）
- MC2 view 入图（同 MC1）
