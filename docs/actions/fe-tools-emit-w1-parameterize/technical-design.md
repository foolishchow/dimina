# Technical Design — fe-tools-emit-w1-parameterize

## §0 设计输入

### §0.1 前身决策

| 决策 | 内容 | 本 Action 约束 |
|---|---|---|
| W1 | emit.ts parameterize 可独立先行（S 级低风险） | 本 Action 实施 W1 |
| W3 | env.ts 不拆（注入 context） | 不改 env.ts，只从 emit.ts 移除依赖 |
| W4 | dependency-graph 不拆（限定 kind API） | 不碰 dependency-graph |
| D-ER-5 | produceEntry 从 emitEntry 提取 | produceEntry 签名不变 |
| D-ER-3 | 结构化 emitBuckets | emit task 调用不变 |

### §0.2 tsconfig 约束

- `noUnusedLocals: true` — emit.ts 删除 import 后不可有残留引用
- `strict: true` — `workPath` 须有类型
- `module: NodeNext` — ESM import 须显式 `.ts` 后缀

### §0.3 行为 0 纪律

- nomap 产物 diff=0
- sourcemap 产物 diff=0（sourcemap rebase 结果必须字节相同）
- 全量 vitest 608/608 绿
- tsc 0 错

## §1 改动设计

### §1.1 `EmitEntryParams` 加 `workPath` 字段

**现状**（emit.ts L55-66）：

```typescript
export interface EmitEntryParams {
	entryId: string
	kind: 'view' | 'logic'
	modules: ModuleCollection
	transform: EmitTransformConfig & { strategy: string }
	sourcemap: boolean
	sourcemapTargetPath: string | null
	filename: string
	relPrefix: string
}
```

**目标**：

```typescript
export interface EmitEntryParams {
	entryId: string
	kind: 'view' | 'logic'
	modules: ModuleCollection
	transform: EmitTransformConfig & { strategy: string }
	sourcemap: boolean
	sourcemapTargetPath: string | null
	filename: string
	relPrefix: string
	workPath: string  // W1: 替代 getWorkPath() 读取
}
```

### §1.2 `bundle` 策略 sourcemap rebase 参数化

**现状**（emit.ts L142）：

```typescript
moduleMap.sources = moduleMap.sources.map((source) => {
    const sourcePath = source.replace(/^[/\\]+/, '')
    return relative(finalOutputDir, resolve(getWorkPath(), sourcePath)).split(sep).join('/')
})
```

**目标**：

```typescript
moduleMap.sources = moduleMap.sources.map((source) => {
    const sourcePath = source.replace(/^[/\\]+/, '')
    return relative(finalOutputDir, resolve(params.workPath, sourcePath)).split(sep).join('/')
})
```

**`bundle` 策略签名**：`bundle.apply` 接收 `EmitBundleCtx`，其中 `EmitBundleCtx extends EmitEntryParams`。`workPath` 通过 `EmitEntryParams` 传入，`bundle.apply` 可从 ctx 解构。

**`EmitBundleCtx` 现状**（emit.ts L37-44）：

```typescript
export interface EmitBundleCtx extends EmitEntryParams {
	// bundle 策略专用字段（如有）
}
```

`EmitBundleCtx extends EmitEntryParams`——`workPath` 自动继承，无需改 `EmitBundleCtx`。

**`bundle.apply` 解构**：现状是 `async apply({ modules, transform: cfg, sourcemap, filename, relPrefix, entryId }: EmitBundleCtx)`。需加 `workPath`：

```typescript
async apply({ modules, transform: cfg, sourcemap, filename, relPrefix, entryId, workPath }: EmitBundleCtx)
```

### §1.3 emit.ts 删除 env.ts import

**现状**（emit.ts L3）：

```typescript
import { getWorkPath } from '../core/env.ts'
```

**目标**：删除此行。`noUnusedLocals: true` 约束——删除后不可有残留引用。L142 改用参数后，`getWorkPath` 不再被 emit.ts 引用，删除安全。

### §1.4 `perModule` 策略不改动

`perModule` 策略（L155-198）不直接调 `getWorkPath()`。L200 注释"perModule 策略会调 getWorkPath()"——实际不调。参数化后 `perModule` 策略的 `EmitPerModuleCtx` 也继承 `workPath`，但 `perModule.apply` 不解构它。`noUnusedLocals` 不检查解构——不解构即不报错。

### §1.5 调用方传入 `workPath`

**view/index.ts**（L78）：

```typescript
// 现状
await emitEntry({
    entryId: page.path,
    kind: 'view',
    modules,
    transform: { ... },
    sourcemap: enableSourcemap,
    sourcemapTargetPath: null,
    filename,
    relPrefix,
})
```

```typescript
// 目标
await emitEntry({
    entryId: page.path,
    kind: 'view',
    modules,
    transform: { ... },
    sourcemap: enableSourcemap,
    sourcemapTargetPath: null,
    filename,
    relPrefix,
    workPath: getWorkPath(),  // W1: 显式传入
})
```

view/index.ts 已 import `getWorkPath` from `../core/env.ts`（L4）——无需新增 import。

**build-pipeline.ts**（L225-232）：

```typescript
// 现状（subs）
const { entry } = await executeTask({ engine: emitEngine, input: {
    entryId: 'logic:' + root, kind: 'logic' as const, modules: modules.map(toEmitModule),
    transform, sourcemap, sourcemapTargetPath, filename: 'logic', relPrefix: root, storeInfo,
} })

// 现状（main）
const { entry } = await executeTask({ engine: emitEngine, input: {
    entryId: 'logic', kind: 'logic' as const, modules: emitBuckets.main.map(toEmitModule),
    transform, sourcemap, sourcemapTargetPath, filename: 'logic', relPrefix: 'main', storeInfo,
} })
```

```typescript
// 目标（subs + main）
const { entry } = await executeTask({ engine: emitEngine, input: {
    entryId: ..., kind: ..., modules: ..., transform, sourcemap, sourcemapTargetPath, filename: ..., relPrefix: ..., storeInfo,
    workPath: getWorkPath(),  // W1: 显式传入
} })
```

build-pipeline.ts 已 import `getWorkPath` from `../core/env.ts`（L72: `import { ..., getWorkPath, ... } from '../core/env.ts'`）——无需新增 import。

### §1.6 emit-engine.ts 不改动

emit-engine.ts 现状：

```typescript
compile: async ({ msg }) => {
    const params = msg as EmitEntryParams & { storeInfo: ... }
    resetStoreInfo(params.storeInfo)
    const { storeInfo: _, ...emitParams } = params
    const entry = await produceEntry(emitParams as EmitEntryParams)
    return { entry }
},
```

`params` 已含 `workPath`（从 `EmitEntryParams` 继承）。`resetStoreInfo` 保留——emit-worker 仍需 `storeInfo` 搭建其他上下文（如 `getDependencyGraph`）。`storeInfo` 从 `emitParams` 中剔除后，`workPath` 保留在 `emitParams` 中传入 `produceEntry`。

**注意**：`emitParams` 是 `const { storeInfo: _, ...emitParams } = params`——`storeInfo` 被剔除，`workPath` 保留。`produceEntry(emitParams)` 接收含 `workPath` 的 `EmitEntryParams`。

## §2 数据流

无变化。参数化只改 `getWorkPath()` 的调用方式（从全局函数读取 → 从参数接收），值不变。

```
调用方（view/index.ts / build-pipeline.ts）
  → getWorkPath() 读取 workPath 值
  → 传入 EmitEntryParams.workPath
  → emitEntry / produceEntry
  → strategy.apply(ctx)
  → bundle 策略 L142: resolve(params.workPath, sourcePath)  // 替代 getWorkPath()
```

## §3 风险表

| 风险 | 影响 | 缓解 |
|---|---|---|
| `workPath` 值不一致 | sourcemap rebase 路径错误 = diff≠0 | 调用方传入 `getWorkPath()` 值，参数化不改变值 |
| `noUnusedLocals` | emit.ts 删除 import 后残留引用 | L142 改参数后 `getWorkPath` 不再引用，删除安全 |
| `perModule` 策略不需要 workPath | `EmitEntryParams` 加必填字段后 perModule 调用方也须传 | build-pipeline.ts 的 perModule 调用也加 `workPath: getWorkPath()`（值不被使用但须传） |
| emit-engine.ts `storeInfo` 剔除 | `workPath` 须在 `emitParams` 中保留 | `const { storeInfo: _, ...emitParams }` 只剔 `storeInfo`，`workPath` 保留 |

## §4 替代方案

### §4.1 workPath 可选参数（否决）

`workPath?: string`，bundle 策略 fallback 到 `getWorkPath()`。

**否决理由**：emit.ts 仍有 env.ts 依赖——R-W1-1 不满足。参数化的目标是纯化 emit.ts，可选参数不达成目标。

### §4.2 workPath 从 EmitBundleCtx 传入（否决）

只在 `EmitBundleCtx` 加 `workPath`，不改 `EmitEntryParams`。

**否决理由**：`EmitBundleCtx extends EmitEntryParams`，若 `workPath` 只在 `EmitBundleCtx` 则 `produceEntry` 传参时类型不匹配。且 `perModule` 调用方也须传 workPath（即使不用），统一在 `EmitEntryParams` 更一致。
