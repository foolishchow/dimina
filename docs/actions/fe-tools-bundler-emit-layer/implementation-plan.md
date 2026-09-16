# Implementation Plan — fe-tools-bundler-emit-layer

Status: **ready（实施未授权）** — E1→E2；行为 0；禁混。

## 基线与纪律

> **R2-F1/F2**：emitEntry/output.write 接受 **EmitContext** 聚合对象（`{compileConfig, sourcemapTargetPath, relPrefix, collectOutput, outputCount(ref)}`）——不逐个罗列参数；output.write 非纯函数（postMessage 后 `ctx.outputCount++`，声明副作用）。
> **R2-F3**：output.write 参数区分 `writeDir`（写盘 getTargetPath）与 `rebaseDir`（sourcemap rebase 基准 sourcemapTargetPath）。


- 授权时记录 HEAD；`fe/packages` 零触碰；**只搬不优化**（D-E-5）——不统一 transform 粒度、不改产物语义。
- 每步独立验证：产物对拍（view/logic/style 各自 baseline vs 切后）+ 全量 vitest。

## E1 触达序（emit 骨架 + 契约）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `pipeline/emit.js`（新） | 模块集合契约（JSDoc typedef `EmitModule`/`ModuleCollection`）+ `emitEntry` 骨架 + transform 策略表（`bundle` 迁 view 整包+moduleRanges；`perModule` 迁 logic 逐模块） |
| 2 | `pipeline/output.js`（新） | `write({path, content, map, collectOutput})`：collectOutput → postMessage(M1)；否则 mkdir -p + writeFileSync（收口三引擎各自 mkdir 逻辑） |
| 3 | `view/index.js` | compileML 尾部改写：scriptRes → `emitEntry(…strategy:'bundle')` → output.write；**R1-F4 交叉矩阵**：bundle.apply 必须覆盖三象限——sourcemap（mergeSourcemap，跳 minify CF-1）/ minify（整包 transform）/ 无（整包 transform minify:false）；moduleRanges 行定位迁入 bundle.apply 私有 |
| 4 | `logic/index.js` | writeCompileRes 改写：compileRes → `emitEntry(…strategy:'perModule')` → output.write；**R1-F4 交叉矩阵**：perModule.apply 必须覆盖三象限——sourcemap（rebase+mergeSourcemap，跳 minify CF-1）/ minify（逐模块 transform）/ 无（直接拼接）；sourcemap rebase（R1-F3）在 apply 内 |
| 5 | 验证 | view/logic 两链产物对拍 diff=0 + vitest 全量 |

## E2 触达序（出口统一 + style）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 6 | `style/index.js` | buildCompileCss 后：css/map 改经 `output.write`（不收 emitEntry，D-E-8） |
| 7 | 验证 | style 链对拍 diff=0；`grep fs.writeFileSync` 三引擎产物写盘面零直写 |
| 8 | 全量 | 三链 nomap+sourcemap 对拍 + 全量 vitest；collectOutput(false) 与 materialize 两路径产物一致（抽查） |

## 门禁

| 门 | Gate |
| --- | --- |
| E1 | emit.js/output.js 就位；view/logic 接入；两链 diff=0；vitest 绿 |
| E2 | style 接入 output；三引擎零产物直写（grep 锚定）；collectOutput 两路径产物一致 |

## 消融

- 拔 emitEntry（回手写拼接）→ 产物 diff 再现（对照组）；恢复 → 绿。
- 拔 output.write（回 fs 直写）→ materialize 名不副实重现（grep 命中）→ 恢复。