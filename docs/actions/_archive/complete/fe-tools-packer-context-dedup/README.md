# fe-tools-packer-context-dedup

- Status: `complete`
- Status authority: [Action Status](../../../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-PCD-1..6 已 review lock**——5 轮 readiness review 收敛；三构造点同质性 dedup + 内核放置选项 A + 字段名映射统一）
- 需求门：[requirements.md](requirements.md)
- 实施门：[implementation-plan.md](implementation-plan.md)
- 验收门：[acceptance.md](acceptance.md)
- 验证门：[validation.md](validation.md)

## Background

PackerContext 构造逻辑当前在**三处逐字重复**（audit 确认同质）：

1. `buildPackerContext`(env-compute.ts:211)——收 RAW `FileTypesInput` → `normalizeFileTypes` → 建 PackerContext
2. `toPackerContext`(env-compute.ts:188)——收 `CompilerContext`（pathInfo + compilerOptions）→ 建 PackerContext
3. `buildFixpointCtx` 内部 ctx 构造（config-fixpoint.ts:62）——收已 normalized `compilerOptions` → 建 PackerContext（再包 `FixpointCtx`）

三者构造的 PackerContext 形状**逐字同质**：
- `readContent: (p) => fs.readFileSync(p, { encoding: 'utf-8' })` —— 三者全同
- `resolveAlias: (_src) => null` —— 三者全同（D-PCS-1 deferred stub）
- `resolveNpm: (src) => src` —— 三者全同（D-PCS-1 deferred stub）
- `fileTypes` 字段映射全同（templateExts/styleExts/viewScriptExts/viewScriptTags/directivePrefixes ← compilerOptions）

唯一差异：入参形态（RAW FileTypesInput vs CompilerContext vs 已 normalized compilerOptions）。

## Goal

dedup 收敛 PackerContext 构造逻辑到单一内核函数，消除三处逐字重复。backflow 承接 scratch-internalize + env-l1 backflow（PackerContext 构造同质化）。

## Non-goals

- PackerContext 形状不改（字段不变——workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes）
- `normalizeFileTypes` 不动（L1 纯函数保留）
- `CompilerContext` type 不动（env-compute L1 形状层保留）
- `FixpointCtx` 包装保留（`getPagesImpl` 收 FixpointCtx 契约不变）
- `resolveAlias`/`resolveNpm` stub 不动（D-PCS-1 deferred——讨论调度器时定）
- caller 调用签名最小改动（public API 不破）
- compiler/* 不动
- L2/L3 不动（getters/resetStoreInfo/singleton/Proxy 保留）

## Design inputs

- **背景**：[`fe-tools-scratch-internalize`](../fe-tools-scratch-internalize/README.md)（mkdtemp 内化 + backflow 记录 PackerContext dedup）+ [`fe-tools-env-l1-extract`](../fe-tools-env-l1-extract/README.md)（L1 迁出 + buildPackerContext/toPackerContext export）
- **前置 audit**：三构造点同质性确认（readContent/resolveAlias/resolveNpm stub 全同 + fileTypes 映射全同）
- **循环依赖现状**：`env-compute`(store) → `config-fixpoint`(graph) 单向依赖（resolveAppAlias）；`config-fixpoint` 不 import env-compute
- **字段名差异**：normalized compilerOptions 有 `templateDirectivePrefixes`；PackerFileTypes 有 `directivePrefixes`——dedup 须统一
- **caller**：buildPackerContext（index.ts:61 + 测试）/ toPackerContext（env-compute computeStoreInfo + env.ts getPages）/ buildFixpointCtx（config-collector:59 + dispatch:104）

## Proposed design

详见 [design.draft.md](design.draft.md)。核心：

- D-PCD-1：抽 `buildPackerContextFromOptions(workPath, targetPath, compilerOptions) → PackerContext` 内核（收已 normalized compilerOptions）
- D-PCD-2：`buildPackerContext` = `normalizeFileTypes + 内核`
- D-PCD-3：`toPackerContext` = 从 CompilerContext 取字段 + 内核
- D-PCD-4：`buildFixpointCtx` = 内核 + 包 FixpointCtx
- D-PCD-5：内核放置（选项 A 锁定——config-fixpoint graph 层，无循环；F-R1-1 实证）
- D-PCD-6：字段名差异处理（directivePrefixes vs templateDirectivePrefixes）

## Readiness gaps

**原 4 项经 readiness review（R1-R2）全解**：

1. ~~内核放置~~ **已解（F-R1-1）**：选项 A 锁定——内核放 config-fixpoint（graph 层，无循环——store→graph 单向已存在；buildFixpointCtx 同文件就近）。
2. ~~字段名差异~~ **已解（F-R1-2/R1-3）**：内核统一正向映射（`templateDirectivePrefixes` → `directivePrefixes`）；config-collector 反向解构保留（最小改动）。
3. ~~toPackerContext CompilerContext 依赖~~ **已解（F-R2-2）**：toPackerContext 仍收 CompilerContext，从 ctx 取字段调内核（散参）——依赖保留。
4. ~~caller 签名最小改动~~ **已解**：buildFixpointCtx 签名不改（收 compilerOptions——测试 fixture 依赖 + 最小改动）。

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-PCD-1..N done——行为 0 三件套）
- implementation deviations 回填 design
