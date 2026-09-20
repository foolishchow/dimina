# Requirements — fe-tools-emit-relocate

Status: **complete（2026-09-20）**

## R-ER-1（MUST）打破 streaming

- compile-worker 不再调 `writeCompileRes` / `emitEntry`
- worker 返回 `{ emitBuckets, compileRes, logicDependencies }`；`dependencyGraph` 仍经 `successPayload`（与今日一致）
- emit 发生在 worker 返回后，主线程编排

## R-ER-2（MUST）emit-worker

- 新建 emit-worker，接收 `{ entryId, kind, modules: [EmitModule], transform, sourcemap, ... }`
- emit-worker 调 `produceEntry`（无 sink；须先 `resetStoreInfo`）→ `EmitEntry`
- emit-worker 通过 postMessage 返回 `EmitEntry`
- 主线程收到后 `BuildModel.add(EmitEntry)`
- esbuild transform 在 emit-worker 内跑（不上主线程）

## R-ER-3（MUST）结构化 emit 桶（非 path-prefix 重归属）

- 今日 emit 分桶来自 compile DFS 推进的数组 + `writeCompileRes(arr, root)`，**不是**对 flat 列表按 path 再分
- worker 在全部 `compileJS` 结束后返回与今日相同的桶：
  - `emitBuckets.main` = **最终** `mainCompileRes`（含 sub 编译中经 `putMain` 追加的模块）
  - `emitBuckets.subs` = 各 `{ root, modules }`，与 `Object.entries(pages.subPages)` 一一对应
  - **`root` = `pages.subPages` 的 key**（`env.transSubDir` 形，如 `sub_pkgA`），**不是** app.json `subPackages.root`（如 `pkgA`）；与今日 `writeCompileRes(subCompileRes, root)` 第二参同形——决定 `entryId: 'logic:'+root` 与 `relPrefix: root`
- 主线程按桶发 emit-worker：main → `entryId:'logic'`, `relPrefix:'main'`；sub → `entryId:'logic:'+root`, `relPrefix:root`
- 发射顺序：先各 sub（与今日循环序），再 main
- **禁止**对 flat `compileRes` 做 path-prefix / closure 重归属；**禁止**把 `root`「还原」成 app.json root
- 顺带：`compileRes`（供 M2 cache）须在循环**结束后**由最终桶拼成 `[...main, ...subs…]`，不得沿用循环前对 `mainCompileRes` 的早快照

## R-ER-4（MUST）行为 0

- nomap + sourcemap 产物 diff=0
- 全量 vitest 绿
- 桶内容与桶内顺序 = 今日 `writeCompileRes` 输入
- `emitEntry` perModule 策略不变（modDefine + sourcemap + esbuild 逻辑不动）

## Non-requirements

- 用 `deriveFromGraph` 替代 `compileRes` / emit 桶（顺序 ≠ 编译顺序 → 行为 0 破坏；deferred）
- path-prefix / closure 重归属 flat 列表
- 把 `subs[].root` 改成 app.json `subPackages.root`（须保持 `transSubDir` / `pages.subPages` key）
- view/style emit 搬迁（MC3c deferred）
- HMR patch 产物（另门）
- 改 emit 字符串 / transform 语义 / modDefine 格式
