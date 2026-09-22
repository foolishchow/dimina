# Requirements — fe-tools-incremental-unify

## 问题

M1 + M2 实现了 logic 的模块级增量，但 view/style 没有。

### 根因 1: computeInvalidatedModules 只走 logic 边

```typescript
// model/dependency-graph.ts
getInvalidatedModules(filePath: string): string[] {
  // ...
  for (const [owner, kinds] of ownerKinds) {
    if (kinds.has('logic')) pending.push(owner)  // ← 只推 logic owner
  }
  // ...
  for (const dependent of this.getDirectDependents(id, 'logic')) {  // ← 只走 logic 边
    pending.push(dependent)
  }
}
```

`getDirectDependents(id, 'logic')` 硬编码 kind='logic'。view/style 的依赖边不走闭包。

### 根因 2: view/style 无 ModuleResultCache

```
logic worker 返回: { compileRes, logicDependencies, dependencyGraph, emitBuckets }
stage-channel: cache.set(info.path, { compileInfo, logicDependencies })  // ← 写 cache

view/style worker 返回: { dependencyGraph, entries (via onOutput) }
stage-channel: 无 cache 写  // ← 不写 cache
```

view/style worker 不返回 compile result（直接 emit via onOutput）。stage-channel 不写 cache。watch rebuild 时无 cache hit → 全量重编。

### 根因 3: view/style parse-walk 交织

view parse-walk 内部：parse WXML → walk → Vue compile → wxs replacement → emitEntry。load + compile + emit 在一个函数中。compile result（render code + map）没有独立提取——直接进 emitEntry。

## 核心概念

### 模块级增量闭环

```
watch file change
  → computeInvalidatedModules(graph, changedFiles)  // 全 kind module IDs
  → worker 收 invalidatedModules
  → cache hit? → 跳过 compile
  → cache miss? → compile → 返回 result → stage-channel 写 cache
```

### cache value 形状

| 车道 | cache value | key |
|---|---|---|
| logic | { compileInfo: CompileInfo, logicDependencies: string[] } | moduleId（path） |
| view | { ???, dependencies: string[] } | moduleId |
| style | { ???, dependencies: string[] } | moduleId |

view/style 的 compile result 形状见 D-IU-2。

## 决策输入

| 决策 | 内容 | 约束 |
|---|---|---|
| D-IV-1 | computeInvalidatedModules 批量；返回排序去重 string[] | 泛化后仍返回 string[] |
| D-IV-6 | 闭包只沿 kind=logic 的 dependents | **泛化**——不再只沿 logic |
| D-RC-1 | 独立 ModuleResultCache | view/style 也用独立 cache |
| D-RC-2 | session-only（α） | view/style cache 也 session-only |
| D-RC-3 | IPC 快照传入 ephemeral worker | view/style cache 快照也传入 |
| D-RC-4 | watch-plan 触发 | 不变 |
| D-PCS-10 | CompiledModule discriminated union | cache value 可以用 CompiledModule variant |

## 本 Action 决策

| 决策 | 内容 |
|---|---|
| D-IU-1 | getInvalidatedModules 泛化：删 `kind=logic` 硬编码，调无 kind 版 |
| D-IU-2 | view compile result 形状：ViewCompiledModule（from Packer 形状）|
| D-IU-3 | cache 不泛型化：view/style 各建独立 cache（不同 value 类型）|
| D-IU-4 | intra-build + cross-rebuild 两层共存 |
| D-IU-5 | 只返回 dirty result（和 logic 现有模式一致）|

## MUST 需求

### R-IU-1 getInvalidatedModules 泛化（D-IU-1）

MUST `getInvalidatedModules(filePath)` 遍历全 kind 边——不按 kind=logic 过滤。
MUST 返回受影响的全 kind module IDs（不只 logic）。

### R-IU-2 computeInvalidatedModules 泛化（D-IU-1）

MUST `computeInvalidatedModules(graph, changedFiles)` 返回全 kind module IDs。
MUST 现有调用方（watch-plan）不改签名。

### R-IU-3 view/style ModuleResultCache 接入（D-IU-2, D-IU-3）

MUST view/style worker 返回 compile result + dependencies。
MUST stage-channel 写 view/style cache。
MUST watch-runner 创建 view/style cache 实例。

### R-IU-4 cache hit 跳过（D-IU-4, D-IU-5）

MUST view/style worker 收 cache 快照 + invalidatedModules。
MUST cache hit 时跳过 compile（只返回 cached result）。
SHOULD 测试验证 cache hit 路径被触发（两次 build 同模块 → 第二次 cache hit 跳过 compile）——behavior 0 diff=0 无法检测 cache 永远 miss，需显式测试。

### R-IU-5 行为 0

MUST diff=0。
MUST vitest 全绿。
MUST tsc 0 错。

### R-IU-6 类型约束

MUST 不引入 `any` / `as any` / `@ts-nocheck`。
MUST 不用 `[key: string]: unknown` 索引签名。

## SHOULD

- R-IU-7 SHOULD ModuleResultCache 泛型化（`ModuleResultCache<V>`），view/style 各自实例化（D-IU-3: 本 Action 不泛型化，留给后续）
- R-IU-8 SHOULD view/style cache value 用 Packer 形状的 CompiledModule variant（ViewCompiledModule / StyleCompiledModule）（D-IU-2）

## 约束

- tsconfig: `noUnusedLocals` / `strict` / `module: NodeNext` / `allowImportingTsExtensions`
- 现有 DependencyGraph 类不改名
- logic 的模块级增量不变（只加 view/style）
- 三车道 parse-walk 不拆（load/compile 分离另开 Action）

## 非范围

- Packer 形状全量 wire
- Loader / Compiler / Emitter 实现
- parse-walk 拆分
- emit 逻辑改动
- env.ts / dependency-graph.ts 数据结构改动

## TODO

- Q-1..Q-5 待讨论（见 README Readiness gaps）
