# Implementation Plan — fe-tools-packer-core-shape

## 步骤

### Step 1: 创建 `src/packer/types.ts`

- 定义 `ModuleKind` type
- 定义 `PackerFileTypes` interface
- 定义 `PackerContext` interface
- 定义 `PackerModuleMetadata` interface
- 定义 `PackerModule` interface
- 定义 `EmitOptions` interface
- 定义 `Packer` API interface
- 定义 `ModuleResultCache<V>` 泛型 interface（形状，不实施）
- 定义 `PackerEntry` interface
- 定义 `OrchestrateOptions` interface
- 定义 `PackerOrchestrator` interface
- 用 `import type` 引用现有类型：`EmitEntry` / `EmitTransformConfig`（from `pipeline/emit.ts`）/ `DependencyGraph`（from `model/dependency-graph.ts`）
- **验证**：`tsc --noEmit` 0 错（types.ts 独立编译通过）
- 对应：R-PCS-1 / R-PCS-2 / R-PCS-3 / R-PCS-4 / R-PCS-5

### Step 2: 创建 `src/packer/README.md`

- Packer/Scheme 边界文档（§6 边界定义）
- env.ts 27 exports → PackerContext / SchemeContext / 不迁移 映射表
- 现有 module 类型 → PackerModule 映射表
- 现有 API → Packer API 映射表
- 现有 lifecycle → 模块生命周期映射表
- 现有编排 → PackerOrchestrator 映射表
- **验证**：文档链接有效
- 对应：R-PCS-6 / R-PCS-7

### Step 3: 验证

- `tsc --noEmit` 0 错（含新文件）
- `vitest` 608/608 绿（行为 0——新文件不影响现有测试）
- `git diff --stat` 仅 2 新文件（types.ts + README.md），无现有文件改动
- grep 验证无 `any` / `@ts-nocheck` / `as any`
- **对应**：R-PCS-8 / R-PCS-9 / R-PCS-10

## 依赖图

```
Step 1 (types.ts) → Step 2 (README.md 引用 types.ts) → Step 3 (验证)
```

单线依赖，无并行。

## 每步验证

每步完成后执行：
1. `cd fe/tools/bundler && npx tsc --noEmit --pretty` — 0 错
2. `cd fe/tools/bundler && node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs test` — 608/608
3. `git diff --stat` — 仅新增文件
