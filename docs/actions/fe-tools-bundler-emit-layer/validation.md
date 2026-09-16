# Validation — fe-tools-bundler-emit-layer

Status: **冻结（随 Action `ready`）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-E01 | 契约 | emit.js 导出模块集合 typedef；view/logic 以 scriptRes/compileRes 作为提供者（同形状） | A-E0/A-E1 | pending |
| P-E02 | emit 接入 | 三引擎经 emitEntry（view bundle / logic perModule）；moduleRanges 逻辑在 bundle 策略内可见 | A-E1 | pending |
| P-E03 | output 统一 | 三引擎产物写盘零直接 `fs.writeFileSync`（grep 锚定）；output.js 含 mkdir + write + postMessage(M1) | A-E2/A-E3 | pending |
| P-E04 | 行为 0 | 基线 vs 切后（base 工程）：nomap `diff -rq` + sourcemap `diff -rq` **= 0**（view/logic/style 三链） | A-E4 | pending |
| P-E05 | 范围 | `git diff --stat`：仅 emit.js/output.js + 三引擎接入点 + 文档；无产物语义/transform 粒度改动；`fe/packages` 零 diff | A-E4 | pending |
| P-E06 | 消融 | 拔 emitEntry → 手写拼接对照组 diff 重现；拔 output.write → 直写 grep 命中；恢复 → 全绿 | A-E5 | pending |

## Diff scope

`pipeline/emit.js` + `pipeline/output.js`（新）+ `compiler/{view,logic,style}/index.js` 接入点、Action 文档、architecture-notes；**`fe/packages` 零改动**；**不引入** ModuleCache / 失效查询（刀 2/3）。

## Actual

（实施后填写；绑定 commit SHA + 三链对拍基线）