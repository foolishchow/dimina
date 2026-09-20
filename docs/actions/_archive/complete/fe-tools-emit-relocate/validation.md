# Validation — fe-tools-emit-relocate

Status: **complete（2026-09-20）**

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-ER01 | emit 不在 compile-worker | `logicCompile` 不调 `writeCompileRes`；grep 确认；返回含 `emitBuckets` | R-ER-1 / A-ER1 | ✅ pass |
| P-ER02 | emit-worker 产出 EmitEntry | emit-worker 接收 params → `resetStoreInfo` + `produceEntry` → postMessage(EmitEntry) | R-ER-2 / A-ER2 | ✅ pass |
| P-ER03 | emit 桶正确 | 主线程按 `emitBuckets` 发（先 sub 再 main）；`subs[].root` = `pages.subPages` key（`transSubDir` 形）；与今日 `writeCompileRes` 输入对拍；含 putMain 进 main；无 path-prefix/closure；未误用 app.json root | R-ER-3 / A-ER3 | ✅ pass |
| P-ER04 | 行为 0 | nomap + sourcemap 产物 diff=0 + 全量 vitest 绿 | R-ER-4 / A-ER4 | ✅ pass |

## Uncovered

- `deriveFromGraph` 接入 production（deferred——module 顺序问题）
- view/style emit 搬迁（MC3c deferred）
- HMR patch 产物（另门）
- emit-worker 生命周期（D-ER-4 已冻结：复用 worker-runtime）

## Actual

| When | What |
| --- | --- |
| 2026-09-21 | 立项 `draft`：MC3b 从 convergence 伞 deferred → 独立立项。D-ER-0..3 已定（新 emit-worker / 打破 streaming / 只 logic / 主线程分组 B）。D-ER-4..6 待讨论。 |
| 2026-09-21 | 讨论冻结 D-ER-4..7：D-ER-4 复用 worker-runtime（defineEngine+runWorker+workerPool，per-task）；D-ER-5 produceEntry 纯函数+emitEntry 兼容 wrapper；D-ER-6 buildConfig 透传 msg；D-ER-7 泛化 executeTask（pages 可选+resolve 透传+ENTRY_PATH 加 emit）。升 **`ready`**。 |
| 2026-09-21 | review F-ER-1..5 修正：F-ER-1/2 produceEntry 非“纯函数”（perModule 调 getWorkPath），emit-worker 须 resetStoreInfo 搭建上下文（§3.5）；F-ER-3 TD 加 emit 步骤在 pipeline 的位置（§1.3，新增 3.5 task）；F-ER-4 §4 重复编号修正（→§5）；F-ER-5 “从 storeInfo 取 page 列表”→“调 getPages()”。 |
| 2026-09-21 | review round 2 F-ER-6..9 修正：F-ER-6 §1.3 重复编号→§1.4；F-ER-7 (CRITICAL) closure 分组≠putMain 分组→改用 path-prefix 分组（D-ER-3 修订，精确匹配 putMain 语义）；F-ER-8 emit params 构造详述（toEmitModule/transform/filename/relPrefix/storeInfo）；F-ER-9 §0.3 代码对齐实际。 |
| 2026-09-21 | review round 3 F-ER-10..14 修正：F-ER-10 stage-channel.ts 列入接口表（存 compileRes 到 ctx）+ (3.5) task ctx 水管（compileConfig/sourcemap/sourcemapTargetPath）；F-ER-11 executeTask guards 保留（isResolved + onOutput mismatch check）；F-ER-12 transSubDir 内联；F-ER-13 script cast 加 'emit'；F-ER-14 buildConfig: () => ({})。 |
| 2026-09-21 | review round 4 F-ER-15..16 修正：F-ER-15 dead code cleanup（writeCompileRes 函数 + sourcemapTargetPath 模块变量 + emitEntry import + logicBuildConfig 简化）；F-ER-16 pseudocode 变量引用 options.* → ctx.*。**pass**。 |
| 2026-09-20 | review readiness fail 修正：F-ER-17 (HIGH) path-prefix 漏 normalize 前导 `/`（与 `putMain` 不对齐）→ TD/R/D-ER-3 伪代码补 `substring(1)`；F-ER-18 P-ER03 仍写 closure 分组 → 改 path-prefix+normalize；F-ER-19 补 `acceptance.md`（A-ER1..4）；F-ER-20 architecture-notes / TODO 挂本 Action。仍 **`ready`**。 |
| 2026-09-20 | review readiness fail 修正：F-ER-21 (HIGH) path-prefix 重归属 ≠ 今日 `writeCompileRes` 编译期桶（跨分包错桶 + 早快照漏 putMain）→ D-ER-3 改为结构化 `emitBuckets`；禁 path-prefix/closure；`compileRes` 循环后拼；F-ER-22 D-ER-5/README 去掉「纯函数」；F-ER-23 STATUS/architecture-notes 对齐 MC3b→本 Action。仍 **`ready`**。 |
| 2026-09-20 | review pass-with-findings 修正：F-ER-24 (MEDIUM) 澄清 `subs[].root` = `pages.subPages` key（`transSubDir` 形，非 app.json root）；F-ER-25 TD §0.3 去掉 strategy.apply「纯函数」；F-ER-26 接口表注明 logic 阶段 onOutput 可留可去（outputCount=0）。仍 **`ready`**。 |
| 2026-09-21 | 授权 `in_progress` → 实施。Step 1-6 完成：emit.ts 拆 produceEntry；emit-engine.ts + emit-worker-entry.ts 新增；executor.ts 泛化（pages 可选+ENTRY_PATH 加 emit+resolve 透传 payload+guards 保留）；logic/index.ts 删 writeCompileRes 返回 emitBuckets+循环后拼 compileRes；stage-channel.ts 存 emitBuckets 到 ctx；build-pipeline.ts (3.5) Logic emit task。tsc 0 errors；vitest 608/608 pass；fe/packages diff=0（行为 0）。(3.5) task 加 try/catch emit STAGE_ERROR（lifecycle 回归修复）。 |
| 2026-09-21 | **closeout `complete`**：8 条 complete gate 全满足。A-ER1..4 done；P-ER01..04 pass；行为 0 diff=0；tsc 0 errors；vitest 608/608；validator 0 errors 0 warnings。归档 `_archive/complete/fe-tools-emit-relocate/`；相对链接修正（STATUS +2 层；Experience-Review +2 层；convergence 同目录）。 |
| 2026-09-20 | review pass 残余修正：F-ER-27 TD §1.1 厘清 `dependencyGraph` 仅 `logicSuccessPayload`（不进 compile return）；F-ER-28 补 `implementation-plan.md`。仍 **`ready`**。 |
