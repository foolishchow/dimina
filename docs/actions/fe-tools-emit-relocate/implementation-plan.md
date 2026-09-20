# Implementation Plan — fe-tools-emit-relocate

Status: **in_progress（2026-09-20）** — 实施完成，待 close。

## 纪律

- 行为 0：nomap + sourcemap 产物 diff=0；全量 vitest 绿。
- 遵守 D-ER-0..7：结构化 `emitBuckets`；`subs[].root` = `pages.subPages` key（`transSubDir`）；禁 path-prefix/closure；禁还原 app.json root。
- 未授 `in_progress` 不改 `src`。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | 立项 + 讨论冻结 D-ER-0..7；多轮 review 收敛（含 F-ER-21 桶语义、F-ER-24 `transSubDir`） | **done** |
| 1 | `pipeline/emit.ts`：拆 `produceEntry`（无 sink）+ `emitEntry` wrapper（view/style 仍用） | **done** |
| 2 | 新增 `emit-engine.ts` + `emit-worker-entry.ts`（`resetStoreInfo` + `produceEntry` → `{ entry }`） | **done** |
| 3 | `executor.ts`：`pages` 可选；`ENTRY_PATH`/`script` 加 `'emit'`；resolve 透传 payload | **done** |
| 4 | `logic/index.ts`：删 `writeCompileRes` 及调用；返回 `emitBuckets` + 循环后拼 `compileRes`；简化 `logicBuildConfig` | **done** |
| 5 | `stage-channel.ts`：存 `emitBuckets` 到 `ctx`；M2 cache 仍用 `compileRes` | **done** |
| 6 | `build-pipeline.ts`：新增 (3.5) 按桶发 emit-worker → `BuildModel.add`；compile 侧存 transform/sourcemap 水管；logic `BuildModel.add` 改由 3.5 | **done** |
| 7 | P-ER01..04 / A-ER1..4：grep + 行为 0 diff + vitest；勾 acceptance；回流 architecture-notes；close 另授 | **done** |

## 依赖

```text
fe-tools-module-convergence (complete; MC3a deriveFromGraph 已交付，本门不接入)
        │
        ▼
本 Action ready → in_progress（另授）→ complete
```

## 实施注意

- 发射序：先 `emitBuckets.subs`（`Object.entries` 序），再 `main`。
- emit-worker msg 须带 `storeInfo`（perModule `getWorkPath`）。
- `dependencyGraph` 继续走 `logicSuccessPayload`，勿塞进 `logicCompile` return。
