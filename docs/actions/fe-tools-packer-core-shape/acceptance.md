# Acceptance — fe-tools-packer-core-shape

## A-PCS-1 — PackerContext 定义

- [ ] `src/packer/types.ts` 含 `interface PackerContext`
- [ ] PackerContext 含字段：`workPath` / `targetPath` / `readContent` / `resolveAlias` / `resolveNpm` / `fileTypes` / `graph` / `moduleCache` / `invalidatedModules`
- [ ] PackerContext 不含 Dimina 专有字段（`getComponent` / `getAppId` / `isMiniGame` / `getAppConfigInfo`）

## A-PCS-2 — PackerModule 定义

- [ ] `src/packer/types.ts` 含 `interface PackerModule`
- [ ] PackerModule 含字段：`moduleId` / `kind` / `code` / `map` / `dependencies` / `extraInfoCode?` / `metadata`
- [ ] `ModuleKind` type = `'logic' | 'view' | 'style' | 'config'`

## A-PCS-3 — Packer API 定义

- [ ] `src/packer/types.ts` 含 `interface Packer`
- [ ] Packer 含方法：`compileModule(module, ctx)` / `emitEntry(entryId, modules, ctx, options)`
- [ ] Packer API 复用现有 `EmitEntry` 类型（`import type` from `pipeline/emit.ts`）

## A-PCS-4 — 模块生命周期定义

- [ ] `src/packer/types.ts` 含 `interface ModuleResultCache<V>` 泛型
- [ ] ModuleResultCache 含方法：`get` / `set` / `has` / `delete` / `clear` / `size`
- [ ] 文档化 `invalidatedModules: Set<string>` 全 kind（不按 `'logic'` 过滤）

## A-PCS-5 — PackerOrchestrator 定义

- [ ] `src/packer/types.ts` 含 `interface PackerOrchestrator`
- [ ] PackerOrchestrator 含方法：`orchestrate(entries, ctx, api, options)`
- [ ] 编排 5 职责文档化：发现 → 增量过滤 → 排序 → 编译 → 发射

## A-PCS-6 — Packer/Scheme 边界文档

- [ ] `src/packer/README.md` 含 Packer（通用）职责列表
- [ ] `src/packer/README.md` 含 Scheme（Dimina 专有）职责列表
- [ ] `src/packer/README.md` 含边界定义：Scheme 产 PackerEntry[] + PackerContext + metadata；Packer 消费产出 EmitEntry[]

## A-PCS-7 — 现有代码映射表

- [ ] `src/packer/README.md` 含 env.ts 27 exports → PackerContext / SchemeContext / 不迁移 映射表
- [ ] `src/packer/README.md` 含现有 module 类型 → PackerModule 映射表
- [ ] `src/packer/README.md` 含现有 API → Packer API 映射表
- [ ] `src/packer/README.md` 含现有 lifecycle → 模块生命周期映射表
- [ ] `src/packer/README.md` 含现有编排 → PackerOrchestrator 映射表

## A-PCS-8 — 行为 0

- [ ] `git diff --stat` 仅 2 新文件（`src/packer/types.ts` + `src/packer/README.md`），无现有文件改动
- [ ] tsc 0 错（含新文件）
- [ ] vitest 608/608 绿

## A-PCS-9 — 类型约束

- [ ] `src/packer/types.ts` 不含 `: any` / `as any` / `@ts-nocheck`（`grep -c ': any\b\|as any\b\|@ts-nocheck' types.ts` = 0）
- [ ] 新类型用 `import type` 引用现有类型（不复制类型定义）

## A-PCS-10 — 独立编译

- [ ] `src/packer/types.ts` 可独立 `tsc --noEmit` 0 错
