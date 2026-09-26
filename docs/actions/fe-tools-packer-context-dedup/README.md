# fe-tools-packer-context-dedup

- Status: `draft`
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-PCD-1..N 待 lock**——三构造点同质性 dedup + 内核放置 + 字段名差异）
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

- **背景**：[`fe-tools-scratch-internalize`](../_archive/complete/fe-tools-scratch-internalize/README.md)（mkdtemp 内化 + backflow 记录 PackerContext dedup）+ [`fe-tools-env-l1-extract`](../_archive/complete/fe-tools-env-l1-extract/README.md)（L1 迁出 + buildPackerContext/toPackerContext export）
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
- D-PCD-5：内核放置（循环依赖 audit——graph 层或新建纯工具层）
- D-PCD-6：字段名差异处理（directivePrefixes vs templateDirectivePrefixes）

## Readiness gaps

**4 项**（design 待 lock）：

1. **内核放置**：env-compute（store）vs config-fixpoint（graph）vs 新建纯工具层——循环依赖（env-compute→config-fixpoint 已存在；config-fixpoint→env-compute 会新增反向循环）
2. **字段名差异**：内核收 normalized compilerOptions（`templateDirectivePrefixes`）还是 PackerFileTypes（`directivePrefixes`）——config-collector 反向解构去除
3. **toPackerContext 从 CompilerContext**：内核收散参（workPath/targetPath/compilerOptions）——toPackerContext 从 ctx 取字段，是否保留 CompilerContext 依赖
4. **caller 签名最小改动**：buildFixpointCtx 签名是否改（收 PackerFileTypes vs compilerOptions）

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-PCD-1..N done——行为 0 三件套）
- implementation deviations 回填 design
