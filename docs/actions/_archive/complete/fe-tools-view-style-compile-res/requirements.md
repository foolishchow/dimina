# Requirements — fe-tools-view-style-compile-res

Status: **complete（2026-10-08）**

## Background

`stage-channel.ts` 的 cache 写入块（M2 D-RC-3）已泛化——对 view/logic/style 三车道都读 `result.compileRes` 写 `cacheInstance.set`：

```typescript
const cacheInstance = ctx.cache
const compileRes = result.compileRes
if (cacheInstance && compileRes) {
    for (const info of compileRes) {
        cacheInstance.set(info.path, { compileInfo: info, logicDependencies: deps })
    }
}
```

但只有 logic worker 返回 `compileRes`（`logic/index.ts:62` `return { compileRes, logicDependencies }`）。view/style worker 的 `compile` 返回 `Promise<void>`：

- **view**（`view/index.ts:viewCompile`）：`compileML` 内 `emitEntry({ kind: 'view', modules, ... })` inline emit，不返回结果
- **style**（`style/index.ts:styleCompile`）：`compileSS` 内 `sink.write(entry)` inline emit，不返回结果

`packer/types.ts:118-126`（D-PCS-10）已定义 `ViewCompiledModule` / `StyleCompiledModule`（`CompiledModuleBase { moduleId, kind, code, map, dependencies }` + 各自专属字段），但 view/style worker 未产出它们。

## Problem

G3 让 `getInvalidatedModules` 覆盖全 kind → 失效集现在含 view/style moduleId。消费方（`logic/index.ts:82` cache-hit skip）只对 logic 有效——view/style cache 永远空（无数据源）→ view/style 增量不成立（watch rebuild 仍全量重编译 view/style）。需要 view/style worker 产出模块级结果 + stage-channel 写入 view/style cache，为 G5 cache-hit skip 备数据源。

## Requirements

> **注**：review R1-R3 修正后，RG4-1/2/3/4 已解（降级 + bare + 默认 successPayload，见 TD D-G4-1..3/8）；RG4-5/6 待 impl 审。R-G4-x 已固化。

### R-G4-1（MUST）— view worker 返回 ViewCompiledModule[]（降级，D-G4-1）

`viewCompile` 返回 `{ viewCompileResults: ViewCompiledModule[] }`（**仅新字段**；`dependencyGraph`/`compatibilityWarnings` 由 runtime.ts:30 自动合并默认 successPayload，勿在 compile 返——review R1 F3）。`ViewCompiledModule` 取 `packer/types.ts:118`——**降级**：只填 base `{ moduleId, kind:'view', code, map, dependencies }`；`renderBody?`/`wxsBindings?` 留 `undefined`（optional；`viewParseWalk` 返 `EmitModule` 无此二字段，G5 cache-hit 用最终 code/map 不需它们）。只返回 dirty result（D-IU-5；**G4 期全量返回**——all dirty 无 cache-hit skip；incremental filter = G5）。**emit 路径不变**。

### R-G4-2（MUST）— style worker 返回 StyleCompiledModule[]（降级，D-G4-2）

`styleCompile` 返回 `{ styleCompileResults: StyleCompiledModule[] }`（仅新字段）。`StyleCompiledModule` 取 `packer/types.ts:125`——**降级**：只填 base `{ moduleId, kind:'style', code, map, dependencies }`（`dependencies: []`，G5 不消费；review R2 F16 纠正：style module deps 实为 component sub-modules via graph 'component' 边，非 @import）；`styleScopeId?` 留 `undefined`（无实现源，optional）。**styleEngine 用 `defineEngine` 默认 successPayload**（`define-engine.ts:28` 返 `dependencyGraph`）——**不补 successPayload**（review R1 F4 纠正）。只返回 dirty result（D-IU-5；**G4 期全量返回**——all dirty；incremental filter = G5）。**emit 路径不变**。

### R-G4-3（MUST）— stage-channel 写 view/style cache（guarded）

`stage-channel.ts` 新增 view/style cache 写入块，镜像现有 logic 块：

```typescript
const viewCache = ctx.viewCache
const viewCompileResults = result.viewCompileResults
if (viewCache && viewCompileResults) {
    for (const m of viewCompileResults) { viewCache.set(m.moduleId, m) }
}
// styleCache 同理
```

guarded optional chaining——`ctx.viewCache`/`ctx.styleCache` 为 `undefined` 时 no-op。**logic cache 块不变**（D-IU-3 logic cache 保持）。

### R-G4-4（MUST）— 行为 0

G4 期 `PackerSessionState` 无 `viewCache`/`styleCache` 字段（G5 才加）→ orchestrator 不 plumb → one-shot build `ctx.viewCache/styleCache` 永远 `undefined` → stage-channel 写 no-op → 无行为变更 → 全量 7 项目 diff=0。

worker 返回 `ViewCompiledModule[]`/`StyleCompiledModule[]` 是**额外数据**——emit 路径不变 → 产物字节一致。

watch 路径：G4 后仍无 cache 实例（G5 才建）→ view/style 仍全量编译 → watch 行为不变（直到 G5 接 cache hit skip）。边界：watch 效率不变不在 diff=0 覆盖内（同 G1/G2/G3）。

### R-G4-5（MUST）— 类型约束

无 `any` / `as any` / `@ts-nocheck` / `[key: string]`（新代码）。`as { viewCompileResults?: ... }` 结构断言允许（与 stage-channel 现有 `(result as { compileRes? })` 同模式，非 `as any`）。

## Non-scope

- watch-runner 创建 view/style cache 实例（G5）
- `PackerSessionState` `viewCache`/`styleCache` 字段（G5）
- `orchestrator.ts` state→ctx plumbing for view/style（G5）
- cache hit → skip（G5 = incremental-unify 重激活 A-IU-4）
- ModuleResultCache 泛型化（D-IU-3 明示不泛型化；后续 Packer 接入）
- view/style emit 改 deferred（保留 inline emit）
- logic cache / `CachedModuleResult` / `ModuleResultCache` class 改动（D-IU-3 logic cache 保持）
- `ViewCompiledModule`/`StyleCompiledModule` 类型定义改动（packer/types.ts 已存在，G4 只消费）
