# Validation — fe-tools-module-convergence

Status: **draft（2026-09-21）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

本伞以文档门为主。行为 0 = 无子门授权时产品源码零 diff。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-MC00 | graph 正确性 | stale edge/node 清理 + 增量 closure 一致；`fe/packages` 空 diff | A-MC0 | pending |
| P-MC01 | 词汇与顺序 | 对照 README / technical-design：D-MC-0..5 在档且 D-MC-0 已冻结（A）；MC0→MC3 | A-MC1 | pending |
| P-MC04 | MC3 落点 | BuildModel 从图派生；散装退居 | A-MC3 | pending |
| P-MC05 | 行为 0 | 每子门 nomap + sourcemap diff=0 + 全量 vitest 绿 | A-MC2 | pending |

## Uncovered

- fingerprint 下沉模块级（β；另门；依赖持久化决策）。
- HMR patch 产物（另门）。
- Module.code 上图（D-MC-0 选 A：code 不上图；MC1/MC2 deferred）。

## Actual

| When | What |
| --- | --- |
| 2026-09-21 | 立项 `draft`：从 TODO A formalize；承接 module-centric 伞 complete 后的半套资产收敛。D-MC-1..4 待 review 冻结。 |
| 2026-09-21 | 讨论对齐：page = entry（rollup/webpack 语义）；entry 动态变。graph 是小程序维度图（非 fs module）；graph 是 entry 的上级。R-MC0 graph 正确性作为前置子门 MC0 加入（stale edge/node + closure 一致）。 |
| 2026-09-21 | 讨论对齐：watch 变化触发两类变更——graph 结构变化（app.json/page.json）与 fs module 内容变化（.js/.wxml），且交叉（require 变 → graph 边变）。TD §0 加「graph 与 fs module 职责边界」。D-MC-0 作为根本议题待冻结。D-MC-3 修正：view compileResCache 是 within-build cache，保留不动。 |
| 2026-09-21 | **D-MC-0 冻结**：选 A（graph = 结构权威，code 不上图）。理由：M2 已用 A 跑通增量；IPC 成本（worker ephemeral）；stale edge 容忍度（A 多编不漏 vs B 多编进产物）；无即时消费者需要 code 在图上。D-MF-2 不推翻。MC1/MC2 deferred；MC0 + MC3 保留为核心子门。 |
