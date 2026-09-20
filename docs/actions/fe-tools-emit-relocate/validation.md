# Validation — fe-tools-emit-relocate

Status: **ready（2026-09-21）**

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-ER01 | emit 不在 compile-worker | `logicCompile` 不调 `writeCompileRes`；grep 确认 | R-ER-1 | pending |
| P-ER02 | emit-worker 产出 EmitEntry | emit-worker 接收 params → `produceEntry` → postMessage(EmitEntry) | R-ER-2 | pending |
| P-ER03 | 主线程分组正确 | `getDependencyClosure` 分组 + filter 保序；main/sub 分组与当前一致 | R-ER-3 | pending |
| P-ER04 | 行为 0 | nomap + sourcemap 产物 diff=0 + 全量 vitest 绿 | R-ER-4 | pending |

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
