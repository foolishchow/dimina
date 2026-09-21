# Acceptance — fe-tools-packer-core-shape

## A-PCS-1 — PackerContext 定义（D-PCS-1, D-PCS-6）

- [ ] `src/packer/types.ts` 含 `interface PackerContext`
- [ ] PackerContext 含字段：`workPath` / `targetPath` / `readContent` / `resolveAlias` / `resolveNpm` / `fileTypes`
- [ ] PackerContext **不含** graph / moduleCache / invalidatedModules（D-PCS-6: 这些在 OrchestratorState）
- [ ] PackerContext 不含 Dimina 专有字段（getComponent / getAppId / isMiniGame / getAppConfigInfo）

## A-PCS-2 — LoadedModule + CompiledModule 定义（D-PCS-10）

- [ ] `src/packer/types.ts` 含 `interface LoadedModule`
- [ ] LoadedModule 含字段：`moduleId` / `kind` / `source` / `dependencies` / `metadata`
- [ ] `src/packer/types.ts` 含 `CompiledModuleBase` + `LogicCompiledModule` + `ViewCompiledModule` + `StyleCompiledModule`
- [ ] `type CompiledModule = LogicCompiledModule | ViewCompiledModule | StyleCompiledModule`（discriminated union）
- [ ] 每个 variant 只有自己需要的字段（LogicCompiledModule 有 extraInfoCode；ViewCompiledModule 有 renderBody/wxsBindings；StyleCompiledModule 有 styleScopeId）
- [ ] `PackerModuleMetadata` = `{ sourcePath: string }`（不含 `[key: string]: unknown`）
- [ ] `ModuleKind` type = `'logic' | 'view' | 'style' | 'config'`

## A-PCS-3 — 3 registry 定义（D-PCS-5, D-PCS-7）

- [ ] `src/packer/types.ts` 含 `interface Loader` / `interface Compiler` / `interface Emitter`
- [ ] Loader 含方法：`load(input, ctx)`
- [ ] Compiler 含方法：`compile(module, ctx)`
- [ ] Emitter 含属性：`readonly strategy: EmitStrategy` + 方法 `emit(...)` + 可选 `produceBuckets?(...)`
- [ ] `type EmitStrategy = 'inline' | 'delayed'`
- [ ] `interface EmitBucket` 含 `kind` / `entryId` / `modules` / `emitOptions`
- [ ] `src/packer/types.ts` 含 `LoaderRegistry` / `CompileRegistry` / `EmitRegistry`
- [ ] LoaderRegistry 含 `kinds(): ModuleKind[]`
- [ ] 复用现有 `EmitEntry` 类型（`import type` from `pipeline/emit.ts`）
- [ ] `LoadInput` 含 `moduleId` + `kind` + `source`

## A-PCS-4 — Graph + OrchestratorState 定义（D-PCS-2/3/4/6/9）

- [ ] `src/packer/types.ts` 含 `interface Graph`
- [ ] Graph 含方法：`build(ctx)` / `reconcile(ctx)` / `mergeDelta(delta)` / `toJSON()`
- [ ] Graph 含查询：`getEntries()` / `getFileOwners(moduleId)` / `getAffectedEntries(file)` / `getInvalidatedModules(file)` / `hasFile(file)` / `getFileKinds(file)`
- [ ] `src/packer/types.ts` 含 `interface OrchestratorState`
- [ ] OrchestratorState 含字段：`graph: Graph` / `moduleCache: ModuleResultCache` / `invalidatedModules: Set<string>`
- [ ] `ModuleResultCache<V>` 泛型化

## A-PCS-5 — PackerOrchestrator 定义（D-PCS-5/8/9）

- [ ] `src/packer/types.ts` 含 `interface PackerOrchestrator`
- [ ] PackerOrchestrator 含属性：`loaderRegistry` / `compileRegistry` / `emitRegistry`
- [ ] PackerOrchestrator 含方法：`orchestrate(ctx, state, options)`
- [ ] `OrchestrateOptions` 含 `parallel` / `incremental` / `configChanged`
- [ ] 编排职责文档化：graph build/reconcile → load fixpoint → mergeDelta → compile → emit

## A-PCS-6 — Packer/Scheme 边界文档

- [ ] `src/packer/README.md` 含 load → compile → emit 管线说明
- [ ] `src/packer/README.md` 含 Packer（通用）职责列表
- [ ] `src/packer/README.md` 含 Scheme（Dimina 专有）职责列表
- [ ] `src/packer/README.md` 含边界定义

## A-PCS-7 — 现有代码映射表

- [ ] `src/packer/README.md` 含 env.ts exports → PackerContext / Graph / OrchestratorState / 不迁移 映射表
- [ ] `src/packer/README.md` 含现有 module 类型 → CompiledModule（discriminated union）映射表
- [ ] `src/packer/README.md` 含现有 parse-walk → Loader 映射表
- [ ] `src/packer/README.md` 含现有 transform → Compiler 映射表
- [ ] `src/packer/README.md` 含现有 emit → Emitter 映射表
- [ ] `src/packer/README.md` 含现有 lifecycle → OrchestratorState 映射表
- [ ] `src/packer/README.md` 含现有编排 → PackerOrchestrator 映射表

## A-PCS-8 — 行为 0

- [ ] `git diff --stat` 仅 2 新文件（`src/packer/types.ts` + `src/packer/README.md`），无现有文件改动
- [ ] tsc 0 错（含新文件）
- [ ] vitest 全绿

## A-PCS-9 — 类型约束

- [ ] `src/packer/types.ts` 不含 `: any` / `as any` / `@ts-nocheck`（`grep -c ': any\b\|as any\b\|@ts-nocheck' types.ts` = 0）
- [ ] 不含 `[key: string]: unknown` 索引签名（D-PCS-10: 用 discriminated union）
- [ ] 新类型用 `import type` 引用现有类型（不复制类型定义）

## A-PCS-10 — 独立编译

- [ ] `src/packer/types.ts` 可独立 `tsc --noEmit` 0 错
