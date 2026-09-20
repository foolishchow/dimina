# Technical Design — fe-tools-emit-relocate

Status: **draft（2026-09-21）** — D-ER-0..3 已定；D-ER-4..6 待讨论。

权威参考：[Experience-Review.md](../../Experience-Review.md)

## §0 当前架构

### §0.1 emit 在 worker 内（streaming）

```text
worker (logicCompile):
  compileJS(pages) → CompileInfo[]
  writeCompileRes(compileRes, root):
    compileRes.map → EmitModule[]
    emitEntry({ entryId: 'logic' / 'logic:root', modules, transform: { strategy: 'perModule', ... }, ... }):
      strategy.apply → EmitEntry
      sink.write(entry) → postMessage({ type: 'output', entry }) → main: BuildModel.add
  return { compileRes, logicDependencies, dependencyGraph }
```

- `writeCompileRes` 在 `logicCompile` 内调（L676-678）
- `emitEntry` 在 `pipeline/emit.ts`，perModule 策略：sourcemap rebase + mergeSourcemap / esbuild minify / modDefine 拼接
- `emitEntry` 末尾 `sink.write(entry)` = streaming（worker 期间发，返回前）

### §0.2 分组

`logicCompile` 分别调：
- `writeCompileRes(mainCompileRes, null)` → `entryId: 'logic'`, `relPrefix: 'main'`
- `writeCompileRes(subCompileRes, root)` → `entryId: 'logic:'+root`, `relPrefix: root`

返回的 `allCompileRes = [...mainCompileRes, ...allSubCompileRes]` 是 flat 的——分组信息只在 `writeCompileRes` 调用时存在。

### §0.3 emitEntry 结构

```ts
export async function emitEntry(params: EmitEntryParams) {
    const strategy = strategies[params.transform.strategy]  // 'perModule' | 'bundle'
    const { entry } = await strategy.apply(params)           // → EmitEntry
    const { sink } = abilityContext.getStore() ?? {}
    sink?.write(entry)                                        // streaming
}
```

- `strategy.apply` 是纯函数（输入 params → 输出 EmitEntry）
- `sink.write` 是 streaming 出口

## §1 目标架构

### §1.1 worker 只 compile

```text
worker (logicCompile):
  compileJS(pages) → CompileInfo[]
  return { compileRes, logicDependencies, dependencyGraph }  ← 不调 writeCompileRes
```

### §1.2 主线程编排

```text
main (build-pipeline, worker 返回后):
  1. update cache + merge graph                    ← M2 已有
  2. 从 storeInfo 取 page 列表
  3. 分组:
     for each mainPage: graph.getDependencyClosure(pageId) → IDs
     合并 → mainIDSet
     allCompileRes.filter(m => mainIDSet.has(m.path)) → mainCompileRes（保序）
     for each subRoot:
       for each subPage in root: getDependencyClosure → IDs
       合并 → subIDSet[root]
       allCompileRes.filter(m => subIDSet[root].has(m.path)) → subCompileRes[root]
  4. 逐组发 emit-worker:
     emit-worker.send({ entryId: 'logic', modules: mainCompileRes.map(toEmitModule), transform, ... })
     emit-worker.send({ entryId: 'logic:'+root, modules: subCompileRes[root].map(...), ... })
  5. 收 EmitEntry → BuildModel.add
  6. materialize
```

### §1.3 emit-worker

```text
emit-worker:
  receive { entryId, kind, modules: [EmitModule], transform, sourcemap, ... }
  → produceEntry(params) → EmitEntry
  → postMessage(EmitEntry)
  main: BuildModel.add(EmitEntry)
```

## §2 接口表

| 组件 | 变更 |
| --- | --- |
| `compiler/logic/index.ts` | 删 `writeCompileRes` 调用（L676-678）；worker 不再 emit |
| `pipeline/emit.ts` | 拆 `produceEntry(params) → EmitEntry`（纯函数）+ `emitEntry(params)`（produce + sink，兼容 view/style streaming） |
| `pipeline/emit-worker.ts`（新增） | emit-worker 入口：接收 params → `produceEntry` → postMessage(EmitEntry) |
| `pipeline/build-pipeline.ts` | worker 返回后：分组 → 发 emit-worker → 收 EmitEntry → BuildModel.add |
| `compiler/core/env.ts` | `getPages()` 等 API 供主线程取 page 列表 + packageRoot |
| `model/dependency-graph.ts` | 不变（`getDependencyClosure` 已在 MC3a 交付） |
| `model/convergence.ts` | 不变（`deriveFromGraph` 不接入——deferred） |

## §3 行为 0 守卫

- `compileRes` 顺序不变：`filter` 只筛不改序，组内顺序 = 编译顺序
- `emitEntry` perModule 策略不变：modDefine + sourcemap rebase + mergeSourcemap + esbuild minify 逻辑全不动
- `produceEntry` = `strategy.apply` 提取，逻辑不变
- 唯一变化：调用位置从 worker 搬到 emit-worker（同一段代码，不同 worker）

## §4 getDependencyClosure 消费者

MC3a 交付的 `getDependencyClosure(entryId)` 在本 Action 中首次接入 production：
- 主线程分组用它遍历 page closure → 收集 module IDs → 分组 compileRes
- `deriveFromGraph` 仍不接入（code 来自 `compileRes` 不是 cache）

## 待定议题

| ID | 议题 | 状态 |
| --- | --- | --- |
| D-ER-4 | emit-worker 生命周期：per-task 新建 vs 常驻 pool | 待讨论 |
| D-ER-5 | `emitEntry` 拆分方式：`produceEntry` 纯函数 + `emitEntry` 兼容 wrapper | 待定 |
| D-ER-6 | config 传递：`activeCompileConfig`/`enableSourcemap`/`sourcemapTargetPath` 当前在 worker context，搬主线程后怎么传 emit-worker | 待定 |
