# Validation — fe-tools-module-convergence

Status: **draft（2026-09-21）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

本伞以文档门为主。行为 0 = 无子门授权时产品源码零 diff。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-MC00 | graph 正确性 | stale edge/node 清理 + 增量 closure 一致；`fe/packages` 空 diff | A-MC0 | pending |
| P-MC01 | 词汇与顺序 | 对照 README / technical-design：D-MC-0..5 在档；MC0→MC1→MC2→MC3 | A-MC1 | pending |
| P-MC02 | MC1 落点 | GraphNode 扩字段 + logic 回填 + cache 退化 | A-MC2 | pending |
| P-MC03 | MC2 落点 | view scriptRes → graph node；compileResCache 退化 | A-MC3 | pending |
| P-MC04 | MC3 落点 | BuildModel 从图派生；散装退居 | A-MC4 | pending |
| P-MC05 | 行为 0 | 每子门 nomap + sourcemap diff=0 + 全量 vitest 绿 | A-MC5 | pending |

## Uncovered

- fingerprint 下沉模块级（β；另门；依赖持久化决策）。
- HMR patch 产物（另门）。
- Module.code 序列化持久（session-only α 沿用 M2）。

## Actual

| When | What |
| --- | --- |
| 2026-09-21 | 立项 `draft`：从 TODO A formalize；承接 module-centric 伞 complete 后的半套资产收敛。D-MC-1..4 待 review 冻结。 |
| 2026-09-21 | 讨论对齐：page = entry（rollup/webpack 语义）；entry 动态变。graph 是小程序维度图（非 fs module）；graph 是 entry 的上级。R-MC0 graph 正确性作为前置子门 MC0 加入（stale edge/node + closure 一致）。 |
