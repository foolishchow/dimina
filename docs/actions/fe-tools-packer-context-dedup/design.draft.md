# Design Draft — fe-tools-packer-context-dedup

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——D-PCD-1..6 待 readiness review lock。基于三构造点同质性 audit（scratch-internalize + env-l1 backflow）。

## 1. 三构造点现状（audit 确认同质）

| 构造点 | 位置 | 入参 | 输出 | dedup 决策 |
|---|---|---|---|---|
| `buildPackerContext` | env-compute.ts:211 | workPath + targetPath + RAW `FileTypesInput` | PackerContext | normalize + 内核 |
| `toPackerContext` | env-compute.ts:188 | `CompilerContext`（pathInfo + compilerOptions） | PackerContext | 取字段 + 内核 |
| `buildFixpointCtx` 内部 ctx | config-fixpoint.ts:62 | workPath + targetPath + 已 normalized `compilerOptions` | FixpointCtx（包 PackerContext） | 内核 + 包 FixpointCtx |

**同质性（逐字相同）**：
- `readContent: (p) => fs.readFileSync(p, { encoding: 'utf-8' })` —— 三者全同
- `resolveAlias: (_src) => null` —— 三者全同（D-PCS-1 deferred stub）
- `resolveNpm: (src) => src` —— 三者全同（D-PCS-1 deferred stub）
- `fileTypes` 字段映射全同（templateExts/styleExts/viewScriptExts/viewScriptTags/directivePrefixes ← compilerOptions）

**唯一差异**：入参形态（RAW FileTypesInput vs CompilerContext vs 已 normalized compilerOptions）。

## 2. dedup 策略（内核 + 三构造点调内核）

### D-PCD-1 — 抽 buildPackerContextFromOptions 内核

```
// 内核（放置待 D-PCD-5 lock）
function buildPackerContextFromOptions(
	workPath: string,
	targetPath: string,
	compilerOptions: { templateExts: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[]; templateDirectivePrefixes: string[] },
): PackerContext {
	return {
		workPath,
		targetPath,
		readContent: (p: string) => fs.readFileSync(p, { encoding: 'utf-8' }),
		resolveAlias: (_src: string) => null,
		resolveNpm: (src: string) => src,
		fileTypes: {
			templateExts: compilerOptions.templateExts,
			styleExts: compilerOptions.styleExts,
			viewScriptExts: compilerOptions.viewScriptExts,
			viewScriptTags: compilerOptions.viewScriptTags,
			directivePrefixes: compilerOptions.templateDirectivePrefixes,  // 字段名映射
		},
	}
}
```

- 内核收已 normalized compilerOptions（统一入参形态）
- readContent/resolveAlias/resolveNpm stub 逐字搬迁（行为 0）
- fileTypes 字段名映射（`templateDirectivePrefixes` → `directivePrefixes`）统一在内核

### D-PCD-2 — buildPackerContext = normalize + 内核

```
// env-compute.ts
export function buildPackerContext(workPath: string, targetPath: string, fileTypes?: FileTypesInput): PackerContext {
	return buildPackerContextFromOptions(workPath, targetPath, normalizeFileTypes(fileTypes))
}
```

- public 签名不变（收 RAW FileTypesInput）
- normalize 先 + 内核（行为等价——逐字搬迁）

### D-PCD-3 — toPackerContext = 取字段 + 内核

```
// env-compute.ts
export function toPackerContext(ctx: CompilerContext): PackerContext {
	return buildPackerContextFromOptions(ctx.pathInfo.workPath!, ctx.pathInfo.targetPath!, ctx.compilerOptions)
}
```

- 从 CompilerContext 取 workPath/targetPath/compilerOptions + 内核
- `!` 窄断言保留（pathInfo.workPath/targetPath optional——现状同）

### D-PCD-4 — buildFixpointCtx = 内核 + 包 FixpointCtx

```
// config-fixpoint.ts
export function buildFixpointCtx(workPath, targetPath, compilerOptions, configData): FixpointCtx {
	const ctx = buildPackerContextFromOptions(workPath, targetPath, compilerOptions)
	return { ctx, configData, npm: new NpmResolver(workPath) }
}
```

- 内部 ctx 构造去重（调内核）+ FixpointCtx 包装保留
- npm: new NpmResolver(workPath) 保留（buildFixpointCtx 独有）

### D-PCD-5 — 内核放置（readiness gap 1——循环依赖 audit）

**现状依赖**：
- `env-compute`(store) → `config-fixpoint`(graph) 单向（resolveAppAliasImpl）
- `config-fixpoint`(graph) 不 import env-compute

**选项**：
- **A：内核放 config-fixpoint（graph 层）**——env-compute import config-fixpoint 的内核（store→graph 已存在，不新增循环）。但 PackerContext 构造语义放 graph 层不契合（config-fixpoint 是配置定点）。
- **B：内核放 env-compute（store 层）**——config-fixpoint 须 import env-compute 的内核 → **新增 graph→store 反向依赖** → 循环（env-compute→config-fixpoint + config-fixpoint→env-compute）。**不可行**。
- **C：新建纯工具层**（如 `packer/context.ts`）——env-compute + config-fixpoint 都 import。无循环。但新增文件 + 目录结构须遵循 boundaries。

**倾向**：选项 A（graph 层 config-fixpoint——避免循环 + 不新增文件）或选项 C（纯工具层——语义清晰）。readiness review lock。

### D-PCD-6 — 字段名差异（readiness gap 2）

**现状**：
- normalized compilerOptions：`templateDirectivePrefixes`
- PackerFileTypes：`directivePrefixes`
- config-collector.ts:51-58 反向解构（`ctx.fileTypes.directivePrefixes` → `compilerOptions.templateDirectivePrefixes`）传 buildFixpointCtx

**方案**：
- 内核收 normalized compilerOptions（`templateDirectivePrefixes`）→ 内核内映射到 `directivePrefixes`（D-PCD-1 已含）
- config-collector 反向解构保留（ctx.fileTypes → compilerOptions 形态传 buildFixpointCtx）——或 buildFixpointCtx 改收 PackerFileTypes？

**倾向**：内核收 normalized compilerOptions + config-collector 反向解构保留（最小改动）。readiness review lock。

## 3. dedup 路径

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | 抽内核 `buildPackerContextFromOptions`（放置 D-PCD-5 lock） | 单一构造逻辑 |
| 2 | buildPackerContext = normalize + 内核 | dedup（env-compute） |
| 3 | toPackerContext = 取字段 + 内核 | dedup（env-compute） |
| 4 | buildFixpointCtx = 内核 + 包 FixpointCtx | dedup（config-fixpoint） |
| 5 | 行为 0 全量验证 | 7-diff=0 |

## 4. 风险（readiness gaps）

1. **内核放置**（D-PCD-5）：循环依赖（env-compute↔config-fixpoint）——选项 A/C 待 lock
2. **字段名差异**（D-PCD-6）：config-collector 反向解构去留——最小改动倾向保留
3. **toPackerContext CompilerContext 依赖**：内核收散参——toPackerContext 从 ctx 取字段，CompilerContext 依赖保留（不破）
4. **caller 签名**：buildFixpointCtx 签名是否改（收 PackerFileTypes vs compilerOptions）——最小改动倾向不改

## 5. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / CompilerContext 不动 / FixpointCtx 包装保留
- resolveAlias/resolveNpm stub 不动（D-PCS-1 deferred）
- compiler/* 不动 / L2/L3 不动 / compat 写不动

## 6. scope 取舍

PackerContext 构造逻辑 dedup（三处逐字重复 → 单一内核）。**不碰形状**（PackerContext 字段不变）+ **不碰 stub**（D-PCS-1 deferred）+ **不碰 L2/L3**（阶段 3）。最小改动 caller 签名。
