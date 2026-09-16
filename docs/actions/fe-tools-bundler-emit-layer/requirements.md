# Requirements — fe-tools-bundler-emit-layer

Status: **draft（R15 review 中 · 2026-09-15）** — D-E-1..12 已拍板。

## R-E0（MUST）模块集合契约

- `pipeline/emit.js` 定义并导出模块集合接口：`iterable<{ moduleId, code, map }>`。
- contract **不含** range/sourceFile（D-E-6）——错误定位是产物布局（bundle 策略私有）；source 信息在 map 内。
- 契约先立（D-E-1）；不含 deps（D-E-4——依赖留图维度 1）：供未来 ModuleCache（TODO C 刀 3）以同形状提供——emit 不绑定具体容器。

## R-E1（MUST）emitEntry 骨架

- `emitEntry({ entryId, kind, modules, transform: {strategy, minify, target, platform}, sourcemap, sourcemapTargetPath, filename, relPrefix }, outputEnv = { collectOutput, writeDir })`（D-E-10 纯参数+outputEnv + D-E-9 方案 A：内部调 output.write；返回 number 供调用方累加 outputCount）。
- transform 策略**函数注入**（D-E-2）：`'bundle'`（view 整包 + moduleRanges 行定位，布局私有）与 `'perModule'`（logic 逐模块）各自实现 apply + 错误定位；非标志位 if。
- target/platform 参数化（esTarget.view/browser vs logic/neutral）；filename/entryId/relPrefix 规则；sourcemap rebase 可选参数（logic 的 sources rebase）。
- **filename 语义**（D-E-3 统一出口的参数约定）：filename = 不含扩展名的 basename（view/style 从 `page.path.replace(/\//g,'_')` 派生；logic 固定 `'logic'`）；扩展名由 strategy 内部加（`.js`/`.css`）。sourcemapFileName = `${filename}.js.map`（logic 恒 `logic.js.map`）。
- **output.write 路径组合**（D-E-12 rebase 留策略，output.write 只含 writeDir）：`writeDir` = 绝对写盘目录（`getTargetPath()/main` 或 `/root`）；`entry.files[].path` = 相对发布根的物化路径（含 `relPrefix`，如 `main/pages_X.js`）；直写路径 = `path.join(writeDir, path.basename(entry.files[].path))`；postMessage 路径 = `entry.files[].path` 原样（BuildModel.add 直写）。

## R-E2（MUST）output 唯一写盘出口

- `pipeline/output.js` 独立（D-E-3 统一出口 + D-E-7 独立）：`write({ entry, collectOutput, writeDir })`（D-E-11 不管 count + D-E-12 不管 rebase：entry={entryId,kind,files[],sourcemaps?[]}）——collectOutput ? postMessage(M1) : mkdir(writeDir)+write。
- 三引擎（view/logic/style）写盘统一经 output.write；**修复 materialize 名不副实**（9 处直接 writeFileSync 收进 output）。

## R-E3（MUST）style 边界

- style **只收 output**（D-E-8）：compileSS 后 css/map 经 output.write；**不进 emitEntry**（无模块集合/无 modDefine/无 transform，硬套=伪抽象）。

## R-E4（MUST）行为 0 与范围

- 三引擎接入后产物字节不变（同参同产）——view/logic/style 三链 diff=0。
- **只搬不优化**（D-E-5）：不统一 transform 粒度、不改产物语义、不 tree-shaking/共享 chunk。
- 不动模块收集（scriptRes/compileRes 维持，作为提供者 A0）；`fe/packages` 零触碰。

## R-E5（MUST）证据与回流

- 行为 0 对拍（三链 code + sourcemap diff=0）+ 全量 vitest。
- 契约接口（模块集合形状）+ output 落盘口回流 architecture-notes（供刀 3 ModuleCache 守约、刀 2 失效查询衔接）。
- Grep 锚定：三引擎零直接 `fs.writeFileSync`（产物写盘面）。