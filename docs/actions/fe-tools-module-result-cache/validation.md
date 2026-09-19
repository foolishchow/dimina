# Validation — fe-tools-module-result-cache

Status: **ready（2026-09-20）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-RC00 | D-MF-1/D-MF-2 继承 | 对照伞 TD 与本 TD §1；README Non-goals | A-RC0 | **pass**（2026-09-20） |
| P-RC01 | 决策冻结 | D-RC-1..4 成文；待定节为空 | A-RC1 | **pass**（2026-09-20） |
| P-RC02 | watch 冒烟 | 改 1 JS → 只重编脏模块；clean 命中缓存；产物 diff=0 | A-RC2 | pending |
| P-RC03 | 落点 / 边界 | 缓存宿主 + invalidation 接线；`fe/packages` 空 diff | A-RC3 | pending |
| P-RC04 | 行为 0 | 仅加法 API；既有 vitest 绿 | A-RC4 | pending |

## Uncovered

- fingerprint 下沉模块级：另门。
- HMR patch 产物：另门。

## Actual

| When | What |
| --- | --- |
| 2026-09-20 | 立项 `draft`：承接伞 D-MF-2 / 刀 3；M1 complete 后 formalize。 |
| 2026-09-20 | **冻结** D-RC-1..4 → 升 `ready`：B/α/I/watch-plan；P-RC00 / A-RC0 + P-RC01 / A-RC1 pass。 |
| 2026-09-20 | R1 readiness review（fail→修正）：F1 CompileInfo 7 字段；F2 ephemeral worker cache snapshot IPC；F3 stale「待拍板」；F4 注释归属。全修。 |
| 2026-09-20 | R2 readiness review（fail→修正）：F5 cache 更新路径协议变更（worker 响应含 compileRes；非经 sink/emit）；F6 Goal stale「待定」；F7 类型引用 type-only import。全修。 |
| 2026-09-20 | R3 readiness review（pass-with-findings→修正）：F8 §3.3 bullet 对齐 §3.5（snapshot.has/compileRes.push；非 cache.has/cache.set）；F9 IPC 成本措辞（EmitEntry+compileRes；非「同今日」）。全修。 |
| 2026-09-20 | 二轮 R1 readiness review（fail→修正）：F10 cache hit 依赖发现须改用 graph.getDirectDependencies（skip transform 跳过 AST walk）；F11 main+sub compileRes flat merge；F12 toJSON() 补 class shape。全修。 |
| 2026-09-20 | 二轮 R2 readiness review（pass-with-findings→修正）：F13 §4 接口表 dependency-graph 行补 getDirectDependencies（F10 传播缺口）。全修。 |
| 2026-09-20 | 三轮 R1 readiness review（fail→修正）：F15 graph stale edge——addDependency 只增不删，cache hit 用 getDirectDependencies 会返回已删 require → 多余模块入产物。修正：cache 自带 logicDependencies（transform 时捕获，永远新鲜）；不用 graph 做 dep discovery。全修。 |
| 2026-09-20 | 三轮 R2 readiness review（pass-with-findings→修正）：F16 响应 logicDependencies scope 仅 dirty（cached skip transform 无 dep list）；§3.5 cache.set 加「仅 dirty」限定；删「idempotent 覆写」措辞。全修。 |
