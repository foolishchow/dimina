# Implementation Plan — fe-tools-bundler-emit-layer

Status: **draft（R12 review 中 · 2026-09-15）** — E1→E2；行为 0；禁混。

## 基线与纪律

> **D-E-9..12（拍板）**：emitEntry 吃纯参数 + outputEnv 小聚合（不引入 EmitContext）；**方案 A**——emitEntry 内部调 output.write，返回 number（调用方 `outputCount += result`）；output.write 不管 count；rebase 留 emitEntry 策略（output.write 只含 writeDir）。详见 design §7 签名 + §8 决策表。


- 授权时记录 HEAD；`fe/packages` 零触碰；**只搬不优化**（D-E-5）——不统一 transform 粒度、不改产物语义。
- 每步独立验证：产物对拍（view/logic/style 各自 baseline vs 切后）+ 全量 vitest。

## E1 触达序（emit 骨架 + 契约）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `pipeline/emit.js`（新） | 模块集合契约（JSDoc typedef `EmitModule`/`ModuleCollection`）+ `emitEntry` 骨架 + transform 策略表（`bundle` 迁 view 整包+moduleRanges；`perModule` 迁 logic 逐模块） |
| 2 | `pipeline/output.js`（新） | `write({entry, collectOutput, writeDir})`：entry={entryId,kind,files[],sourcemaps?[]}（D-E-11 不管 count + D-E-12 不管 rebase）；collectOutput → postMessage(M1)；否则 mkdir -p(writeDir) + writeFileSync。**不管 count**（D-E-11）、**不管 rebase**（D-E-12） |
| 3 | `view/index.js` | compileML 尾部改写：scriptRes → `emitEntry(…strategy:'bundle')`（内部调 output.write）；`outputCount += result`（方案 A D-E-9）；**交叉矩阵（§4.1）**：bundle.apply 必须覆盖三象限——sourcemap（mergeSourcemap，跳 minify CF-1）/ minify（整包 transform）/ 无（整包 transform minify:false）；moduleRanges 行定位迁入 bundle.apply 私有 |
| 4 | `logic/index.js` | writeCompileRes 改写：compileRes → `emitEntry(…strategy:'perModule')`（内部调 output.write）；`outputCount += result`（方案 A D-E-9）；**交叉矩阵（§4.1）**：perModule.apply 必须覆盖三象限——sourcemap（rebase+mergeSourcemap，跳 minify CF-1）/ minify（逐模块 transform）/ 无（直接拼接）；sourcemap rebase（D-E-12）在 apply 内 |
| 5 | 验证 | view/logic 两链产物对拍 diff=0 + vitest 全量 |

## E2 触达序（出口统一 + style）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 6 | `style/index.js` | buildCompileCss 后：css/map 改经 `output.write`（不收 emitEntry，D-E-8）；**entry 由 compileSS 内部组装**（`{entryId: page.path, kind: 'style', files: [{path, code}], sourcemaps?: [{path, map}]}`）；collectOutput 从 worker 全局；writeDir = `getTargetPath()/main` 或 `/root` |
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

> tab diff 验证（非 sourcemap+非 minify 路径）不是消融——已移至 validation P-E04b。