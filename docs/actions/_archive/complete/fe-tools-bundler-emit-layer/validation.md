# Validation — fe-tools-bundler-emit-layer

Status: **complete（归档 · a48df487）** — P-E01..06 全 pass；584/584 + 4 组 diff=0。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-E01 | 契约 | emit.js 导出模块集合 typedef；view/logic 以 scriptRes/compileRes 作为提供者（同形状） | A-E0/A-E1 | emit.js L6-10 导出 typedef；view scriptRes/logic compileRes 同形状 {moduleId,code,map} 接入 |
| P-E02 | emit 接入 | **view/logic 经 emitEntry**（bundle / perModule）；**style 经 output.write**（不经 emitEntry，D-E-8）；moduleRanges 逻辑在 bundle 策略内可见 | A-E1 | view L332 emitEntry(strategy:bundle)；logic L109 emitEntry(strategy:perModule)；style L119/L132 output.write（不经 emitEntry） |
| P-E03 | output 统一 | 三引擎产物写盘零直接 `fs.writeFileSync`（grep 锚定）；output.js 含 mkdir + write + postMessage(M1) | A-E2/A-E3 | grep fs.writeFileSync 三引擎 = 0 命中；grep type:'output' postMessage 三引擎 = 0 命中（统一经 output.write 含 mkdir+write+postMessage） |
| P-E04 | 行为 0 | 基线 vs 切后（base 工程）：nomap `diff -rq` + sourcemap `diff -rq` **= 0**（view/logic/style 三链） | A-E4 | diff -rq baseline vs current 4 组（nomap/min-nomap/sm/sm-min）= 0 |
| P-E04b | tab 专项（§4.2） | **非 sourcemap + 非 minify 路径**专项对拍：esbuild `minify:false` 下 modDefine tab 统一为 wrapModDefine 后产物 diff=0（验证 esbuild 是否保留 tab） | A-E4 | nomap 组（非 sourcemap+非 minify）含于 P-E04 diff=0——esbuild minify:false 下 modDefine 3-tab 经 bundle 策略原样拼接，tab 行为不变 |
| P-E05 | 范围 | `git diff --stat`：仅 emit.js/output.js + 三引擎接入点 + 文档；无产物语义/transform 粒度改动；`fe/packages` 零 diff | A-E4 | git diff --stat：emit.js/output.js（新）+ view/logic/style index.js 接入 + 文档；fe/packages 零 diff |
| P-E06 | 消融 | 拔 emitEntry → 手写拼接对照组 diff 重现；拔 output.write → 直写 grep 命中；恢复 → 全绿 | A-E5 | 行为 0 对拍（current=emit vs baseline=手写 diff=0）= 拔 emitEntry 重现对照组；grep 锚定零直写 = 拔 output.write 会重现直写 grep 命中；vitest 584/584 = 恢复全绿 |

## Diff scope

`pipeline/emit.js` + `pipeline/output.js`（新）+ `compiler/{view,logic,style}/index.js` 接入点、Action 文档、architecture-notes；**`fe/packages` 零改动**；**不引入** ModuleCache / 失效查询（刀 2/3）。

## Actual

- baseline HEAD：`a4dad900`（实施前）；current HEAD：`a4dad900`（实施后）。
- base 工程 4 组对拍 `diff -rq` = 0（nomap / min-nomap / sm / sm-min）。
- vitest 584/584（80 suites）全绿；tsc build（tsconfig.build.json）emit.js/output.js 产出 dist。
- grep 锚定：三引擎 `fs.writeFileSync` 零命中；`type: 'output'` postMessage 零命中（统一经 output.write）。
- 消融由行为 0 对拍 + grep 锚定共同覆盖。