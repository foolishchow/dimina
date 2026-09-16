# Acceptance — fe-tools-bundler-emit-layer

Status: **in_progress（实施完成 · 1e5b55c3）** — 行为 0 + vitest 全绿；待 Close 审查。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-E0 | R-E0 | 模块集合契约成文（`{moduleId, code, map}`）；emit 不绑容器；提供者 A0（scriptRes/compileRes）接入 | emit.js L8-10 JSDoc typedef `EmitModule`/`ModuleCollection`；view 以 scriptRes、logic 以 compileRes 作提供者 A0 接入 | ✅ pass |
| A-E1 | R-E1 | emitEntry 骨架 + transform 策略函数注入（bundle/perModule）；moduleRanges 迁入 bundle 策略；**style 不经 emitEntry**（D-E-8，只收 output） | emitEntry（emit.js L167）+ bundle/perModule 策略函数注入；moduleRanges 迁入 bundle.apply 私有；style 不经 emitEntry（D-E-8） | ✅ pass |
| A-E2 | R-E2 | output.js 独立唯一写盘出口；三引擎写盘统一；materialize 名不副实修复 | output.js `write({entry,collectOutput,writeDir})` 唯一出口；三引擎经 emitEntry/output.write；grep 三引擎零直接 writeFileSync | ✅ pass |
| A-E3 | R-E3 | style 只收 output（不进 emitEntry） | style compileSS 内组装 entry → output.write（不收 emitEntry，D-E-8） | ✅ pass |
| A-E4 | R-E4 | 三链产物 diff=0（行为 0）；**含非 sourcemap+非 minify 路径**（D-E-5 只搬不优化 + §4.2 tab 风险）；只搬不优化；packages 零触碰 | base 工程 4 组对拍 diff=0（nomap/min-nomap/sm/sm-min，含非 sourcemap+非 minify tab 路径 P-E04b）；fe/packages 零 diff | ✅ pass |
| A-E5 | R-E5 | 消融有效；契约/output 回流 architecture-notes | 消融由行为 0 对拍（current=emit vs baseline=手写 diff=0）+ grep 锚定共同覆盖；契约/output 已回流 architecture-notes §Emit 层（fe-tools-sidecar/architecture-notes.md） | ✅ pass |

## Non-acceptance

- ModuleCache（刀 3）/ 失效查询（刀 2）——后续另立。
- transform 粒度统一 / 产物优化（tree-shaking/共享 chunk）——非本门。
- style 建立 emitEntry / 模块体系化——非本刀（D-E-8）。