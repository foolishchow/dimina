# Acceptance — fe-tools-bundler-emit-layer

Status: **draft（R15 review 中 · 2026-09-15）** — 实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-E0 | R-E0 | 模块集合契约成文（`{moduleId, code, map}`）；emit 不绑容器；提供者 A0（scriptRes/compileRes）接入 | P-E01 | pending |
| A-E1 | R-E1 | emitEntry 骨架 + transform 策略函数注入（bundle/perModule）；moduleRanges 迁入 bundle 策略；**style 不经 emitEntry**（D-E-8，只收 output） | P-E02 | pending |
| A-E2 | R-E2 | output.js 独立唯一写盘出口；三引擎写盘统一；materialize 名不副实修复 | P-E03/P-E04 | pending |
| A-E3 | R-E3 | style 只收 output（不进 emitEntry） | P-E03 | pending |
| A-E4 | R-E4 | 三链产物 diff=0（行为 0）；**含非 sourcemap+非 minify 路径**（D-E-5 只搬不优化 + §4.2 tab 风险）；只搬不优化；packages 零触碰 | P-E04/P-E05 | pending |
| A-E5 | R-E5 | 消融有效；契约/output 回流 architecture-notes | P-E06 | pending |

## Non-acceptance

- ModuleCache（刀 3）/ 失效查询（刀 2）——后续另立。
- transform 粒度统一 / 产物优化（tree-shaking/共享 chunk）——非本门。
- style 建立 emitEntry / 模块体系化——非本刀（D-E-8）。