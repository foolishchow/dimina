# Implementation Plan — fe-tools-packer-core-shape

## 步骤

### Step 1: 创建 `src/packer/types.ts`

基于 draft.md 的 D-PCS-1..10 决策，定义全部形状 interface：

**基础类型**：
- `ModuleKind` type（`'logic' | 'view' | 'style' | 'config'`）
- `PackerFileTypes` interface
- `PackerModuleMetadata` interface（`{ sourcePath: string }`，不含索引签名）

**PackerContext（D-PCS-1, D-PCS-6）**：
- `PackerContext` interface（workPath / targetPath / readContent / resolveAlias / resolveNpm / fileTypes）
- 不含 graph / moduleCache / invalidatedModules

**LoadedModule + CompiledModule（D-PCS-10）**：
- `LoadedModule` interface（moduleId / kind / source / dependencies / metadata）
- `CompiledModuleBase` interface（moduleId / kind / code / map / dependencies）
- `LogicCompiledModule` / `ViewCompiledModule` / `StyleCompiledModule`（extends CompiledModuleBase）
- `type CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule`

**LoadInput + EmitOptions + EmitBucket（D-PCS-7）**：
- `LoadInput` interface（moduleId + kind + source + optional lane-specific）
- `EmitOptions` interface
- `EmitBucket` interface（kind + entryId + modules + emitOptions）
- `type EmitStrategy = 'inline' | 'delayed'`

**3 个 per-kind 契约（D-PCS-5, D-PCS-7）**：
- `Loader` interface（load）
- `Compiler` interface（compile）
- `Emitter` interface（strategy + emit + produceBuckets?）

**3 个 registry（D-PCS-5）**：
- `LoaderRegistry` / `CompileRegistry` / `EmitRegistry`

**Graph（D-PCS-2/3/4）**：
- `Graph` interface（build / reconcile / mergeDelta / toJSON / 查询方法）
- `GraphSnapshot` type（序列化类型，引用现有 DependencyGraph.toJSON() 返回类型）

**OrchestratorState（D-PCS-6, D-PCS-9）**：
- `OrchestratorState` interface（graph / moduleCache / invalidatedModules）
- `ModuleResultCache<V>` 泛型 interface

**PackerOrchestrator（D-PCS-5/8/9）**：
- `OrchestrateOptions` interface（parallel / incremental / configChanged）
- `PackerEntry` interface
- `PackerOrchestrator` interface（loaderRegistry / compileRegistry / emitRegistry / orchestrate）

**import type**：
- `EmitEntry` / `EmitTransformConfig`（from `pipeline/emit.ts`）
- `DependencyGraph`（from `model/dependency-graph.ts`）——如需引用

**验证**：`tsc --noEmit` 0 错
对应：R-PCS-1 / R-PCS-2 / R-PCS-3 / R-PCS-4 / R-PCS-5

### Step 2: 创建 `src/packer/README.md`

- load → compile → emit 管线说明（3 环节 + graph build 前置）
- 两个 fixpoint 说明（config fixpoint + source fixpoint）
- Packer/Scheme 边界文档
- env.ts exports → PackerContext / Graph / OrchestratorState / 不迁移 映射表
- 现有 module 类型 → CompiledModule（discriminated union）映射表
- 现有 parse-walk → Loader 映射表
- 现有 transform → Compiler 映射表
- 现有 emit → Emitter 映射表
- 现有 lifecycle → OrchestratorState 映射表
- 现有编排 → PackerOrchestrator 映射表
- D-PCS-1..10 决策摘要
- TODO 清单（泛型 CompiledModule / 模块级增量 / NpmResolver）

**验证**：文档链接有效
对应：R-PCS-6 / R-PCS-7

### Step 3: 验证

- `tsc --noEmit` 0 错（含新文件）
- vitest 全绿（行为 0——新文件不影响现有测试）
- `git diff --stat` 仅 2 新文件
- grep 验证无 `any` / `@ts-nocheck` / `as any`
- grep 验证无 `[key: string]: unknown`
- 对应：R-PCS-8 / R-PCS-9 / R-PCS-10

## 依赖图

```
Step 1 (types.ts) → Step 2 (README.md 引用 types.ts) → Step 3 (验证)
```

单线依赖，无并行。

## 每步验证

每步完成后执行：
1. `cd fe/tools/bundler && npx tsc --noEmit --pretty` — 0 错
2. `cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test` — 全绿
3. `git diff --stat` — 仅新增文件
