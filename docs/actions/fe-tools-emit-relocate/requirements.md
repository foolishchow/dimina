# Requirements — fe-tools-emit-relocate

Status: **draft（2026-09-21）**

## R-ER-1（MUST）打破 streaming

- compile-worker 不再调 `writeCompileRes` / `emitEntry`
- worker 只返回 `{ compileRes, logicDependencies }` + `dependencyGraph`（via successPayload）
- emit 发生在 worker 返回后，主线程编排

## R-ER-2（MUST）emit-worker

- 新建 emit-worker，接收 `{ entryId, kind, modules: [EmitModule], transform, sourcemap, ... }`
- emit-worker 调 `produceEntry`（纯函数，返回 `EmitEntry`）
- emit-worker 通过 postMessage 返回 `EmitEntry`
- 主线程收到后 `BuildModel.add(EmitEntry)`
- esbuild transform 在 emit-worker 内跑（不上主线程）

## R-ER-3（MUST）主线程分组

- worker 返回 flat `compileRes`（main + sub 混合）
- 主线程从 storeInfo 取 page 列表（mainPages + subPages with packageRoot）
- 用 `getDependencyClosure(pageId)` 遍历 graph → 收集 module IDs → 分组
- `allCompileRes.filter(m => idSet.has(m.path))` → 保序筛出各组 `CompileInfo[]`
- 逐组发 emit-worker

## R-ER-4（MUST）行为 0

- nomap + sourcemap 产物 diff=0
- 全量 vitest 绿
- `compileRes` 顺序不变（filter 保序）
- `emitEntry` perModule 策略不变（modDefine + sourcemap + esbuild 逻辑不动）

## Non-requirements

- 用 `deriveFromGraph` 替代 `compileRes`（顺序 ≠ 编译顺序 → 行为 0 破坏；deferred）
- view/style emit 搬迁（MC3c deferred）
- HMR patch 产物（另门）
- 改 emit 字符串 / transform 语义 / modDefine 格式
