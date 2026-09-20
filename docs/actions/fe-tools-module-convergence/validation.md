# Validation — fe-tools-module-convergence

Status: **ready（2026-09-21）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

本伞以文档门为主。行为 0 = 无子门授权时产品源码零 diff。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-MC00 | graph 正确性 | stale edge/node 清理 + 增量 closure（D-MC-5）；`fe/packages` 空 diff | A-MC0 | pending |
| P-MC01 | 词汇与顺序 | 对照 README / TD：D-MC-0 A；MC0→MC3a；术语；否决双字段上图 | A-MC1 | **pass**（2026-09-20） |
| P-MC3a | MC3a 落点 | `deriveFromGraph`：entry → graph → modules → code → `[EmitModule]`；只读 | A-MC3a | pending |
| P-MC03 | 行为 0 | 每子门 nomap + sourcemap diff=0 + 全量 vitest 绿 | A-MC3 | pending |

## Uncovered

- fingerprint 下沉模块级（β；另门；依赖持久化决策）。
- HMR patch 产物（另门）。
- 搬 emit/transform/bundle 到主线程（MC3b；deferred；行为 0 风险高）。
- view/style 在派生路径中的处理（MC3c；deferred）；含 view `compileResCache` 消费方 source-audit。
- code 上图（D-MC-0 选 A：code 不上图；MC1/MC2 deferred）。**非**双字段上图（已否决）。

## Actual

| When | What |
| --- | --- |
| 2026-09-21 | 立项 `draft`：从 TODO A formalize；承接 module-centric 伞 complete 后的半套资产收敛。D-MC-1..4 待 review 冻结。 |
| 2026-09-21 | 讨论对齐：page = entry（rollup/webpack 语义）；entry 动态变。graph 是小程序维度图（非 fs module）；graph 是 entry 的上级。R-MC0 graph 正确性作为前置子门 MC0 加入。 |
| 2026-09-21 | 讨论对齐：watch 变化触发两类变更——GraphNode 结构变化（app.json/page.json）与 ModuleResult 内容变化（.js/.wxml），且交叉。TD §0 加职责边界。D-MC-0 作为根本议题待冻结。 |
| 2026-09-21 | **D-MC-0 冻结**：选 A（graph = 结构权威，code 不上图）。M2 已用 A 跑通增量；IPC 成本；stale edge 容忍度（A 多编不漏 vs B 多编进产物）；无即时消费者。D-MF-2 不推翻。MC1/MC2 deferred。 |
| 2026-09-21 | 定术语：GraphNode（结构表示，graph 侧）vs ModuleResult（内容表示，cache/fs 侧）。TD 全文替换。 |
| 2026-09-21 | TD §0.6 数据流向审查：emit 是 streaming（onOutput → BuildModel.add，worker 期间）；GraphNode merge + cache update 在 worker 返回后。F-SIM-1..5：三 stage 并发 / worker 做 compile+emit / EmitEntry≠CompileInfo / 只有 logic 返回 compileRes / watch storeInfo 重建+merge 致 stale node 复活。 |
| 2026-09-20 | review findings 修正：验收 ID 统一 A-MC3a；R-MC0 对齐 D-MC-5；A-MC1/P-MC01 pass；`compileResCache` 待查归 MC3c Uncovered。 |
| 2026-09-20 | **确认持 D-MC-0 A**：code 不上图；否决 `logicCode`/`viewCode` 双字段上图（与 D-MC-0 A 撞名澄清）。TD/README/plan/notes 对齐。 |
| 2026-09-21 | **MC3 拆分**：MC3a（deriveFromGraph 函数，只读，低风险，Packer 核心形状）+ MC3b（搬 emit 到主线程，deferred）+ MC3c（view/style 派生，deferred）。伞目标调整为「推进 Packer 形状」。全文档同步重写。 |
