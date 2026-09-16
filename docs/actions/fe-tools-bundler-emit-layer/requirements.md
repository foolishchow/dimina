# Requirements — fe-tools-bundler-emit-layer

Status: **冻结（2026-09-15）** — D-E-1..8 已拍板；随 Action `ready`。

## R-E0（MUST）模块集合契约

- `pipeline/emit.js` 定义并导出模块集合接口：`iterable<{ moduleId, code, map }>`。
- contract **不含** range/sourceFile（D-E-6）——错误定位是产物布局（bundle 策略私有）；source 信息在 map 内。
- 契约先立（D-E-1）：供未来 ModuleCache（TODO C 刀 3）以同形状提供——emit 不绑定具体容器。

## R-E1（MUST）emitEntry 骨架

- `emitEntry({ entryId, kind, modules, transform: {strategy, minify, target, platform}, sourcemap, sourcemapTargetPath, filename, relPrefix }, outputEnv = { collectOutput, writeDir })`（R2-C1：纯参数 + outputEnv 小聚合，不引入 EmitContext）。
- transform 策略**函数注入**（D-E-2）：`'bundle'`（view 整包 + moduleRanges 行定位，布局私有）与 `'perModule'`（logic 逐模块）各自实现 apply + 错误定位；非标志位 if。
- target/platform 参数化（esTarget.view/browser vs logic/neutral）；filename/entryId/relPrefix 规则；sourcemap rebase 可选参数（logic 的 sources rebase）。

## R-E2（MUST）output 唯一写盘出口

- `pipeline/output.js` 独立（D-E-7）：`write({ entry, collectOutput, writeDir })`（R2-C2/C3 + R4-F2：entry={entryId,kind,files[],sourcemaps?[]}；不管 count/rebase）——collectOutput ? postMessage(M1) : mkdir(writeDir)+write。
- 三引擎（view/logic/style）写盘统一经 output.write；**修复 materialize 名不副实**（9 处直接 writeFileSync 收进 output）。

## R-E3（MUST）style 边界

- style **只收 output**（D-E-8）：bundle 后 css/map 经 output.write；**不进 emitEntry**（无模块集合/无 modDefine/无 transform，硬套=伪抽象）。

## R-E4（MUST）行为 0 与范围

- 三引擎接入后产物字节不变（同参同产）——view/logic/style 三链 diff=0。
- **只搬不优化**（D-E-5）：不统一 transform 粒度、不改产物语义、不 tree-shaking/共享 chunk。
- 不动模块收集（scriptRes/compileRes 维持，作为提供者 A0）；`fe/packages` 零触碰。

## R-E5（MUST）证据与回流

- 行为 0 对拍（三链 code + sourcemap diff=0）+ 全量 vitest。
- 契约接口（模块集合形状）+ output 落盘口回流 architecture-notes（供刀 3 ModuleCache 守约、刀 2 失效查询衔接）。
- Grep 锚定：三引擎零直接 `fs.writeFileSync`（产物写盘面）。