# Acceptance — fe-tools-emit-relocate

Status: **in_progress（2026-09-20）** — A-ER1..4 pending（实施后勾）。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-ER1 | R-ER-1 | `logicCompile` 不再调 `writeCompileRes` / `emitEntry`；返回 `emitBuckets` + 循环后拼的 `compileRes`；emit 在 worker 返回后由主线程编排 | P-ER01 | pending |
| A-ER2 | R-ER-2 | 独立 emit-worker：msg → `resetStoreInfo` + `produceEntry` → postMessage(`EmitEntry`)；主线程 `BuildModel.add`；esbuild 不在主线程 | P-ER02 | pending |
| A-ER3 | R-ER-3 | 主线程按 `emitBuckets` 发 emit（先 sub 再 main）；桶 = 今日 `writeCompileRes` 输入；`subs[].root` = `pages.subPages` key（`transSubDir` 形，非 app.json root）；含 putMain 进 main；**无** path-prefix / closure 重归属 | P-ER03 | pending |
| A-ER4 | R-ER-4 | nomap + sourcemap 产物 diff=0；全量 vitest 绿；`emitEntry` perModule 策略不变 | P-ER04 | pending |

## Non-acceptance

- 用 `getDependencyClosure` / `deriveFromGraph` / path-prefix 对 flat `compileRes` 做 production 分桶或 code 源。
- 把 `emitBuckets.subs[].root`「还原」成 app.json `subPackages.root`（须保持 `transSubDir` / `pages.subPages` key）。
- 沿用循环前 `allCompileRes = [...mainCompileRes]` 早快照作为 emit / cache 源（漏 `putMain`）。
- 搬 view/style emit（MC3c deferred）。
- 未授 `in_progress` 即改 `src`。
