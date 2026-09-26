# Design Draft — fe-tools-packer-context-dedup

Status authority: [Action Status](../STATUS.md)

> **状态：ready**——D-PCD-1..6 **已 review lock**（5 轮 readiness review：R1-R4 全 findings 修正 + R5 收敛——F-R1-1 内核放置选项 A / F-R1-2/3 字段名映射 / F-R2-1/2 buildResetStoreInfoData 排除 + CompilerContext 依赖 / F-R4-1/2 as 断言 + npm 独有）。基于三构造点同质性 audit（scratch-internalize + env-l1 backflow）。

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

**注记（F-R2-1）**：`buildResetStoreInfoData`（env-compute:309）组装 `ResetStoreInfoOptions`（pathInfo/configInfo/compilerOptions/dependencyGraph）——非 PackerContext 构造。其 :318 `templateDirectivePrefixes: ctx.fileTypes.directivePrefixes` 是 **反向字段映射**（PackerContext.fileTypes → compilerOptions），非 PackerContext 字面量构造。**不在 dedup scope**（仅 3 处 PackerContext 构造点 dedup）。

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

- 内核收已 normalized compilerOptions（统一入参形态——签名匹配 normalizeFileTypes 返回类型 5 字段）
- readContent/resolveAlias/resolveNpm stub 逐字搬迁（行为 0）
- fileTypes 字段名映射（`templateDirectivePrefixes` → `directivePrefixes`）统一在内核
- **无须 `as PackerFileTypes` 断言**（F-R4-1——字段逐字匹配 PackerFileTypes 形状；buildPackerContext/toPackerContext 现状无断言即证；buildFixpointCtx 现状 `as PackerFileTypes` 是冗余断言，内核去除）
- **compilerOptions 类型 inline 重复**（F-R8-1——normalizeFileTypes 返回类型 inline 5 字段 + buildFixpointCtx 参数 inline 5 字段 + 内核第 3 次 inline；3 处重复属 normalizeFileTypes 重构 non-scope——内核收 inline 保持现状最小改动，不 export `NormalizedFileTypes` type 统一）

### D-PCD-2 — buildPackerContext = normalize + 内核

```
// env-compute.ts——import 加 buildPackerContextFromOptions（F-R8-2：store→graph 单向已存在）
import { resolveAppAlias as resolveAppAliasImpl, buildPackerContextFromOptions } from '../graph/config-fixpoint.ts'

export function buildPackerContext(workPath: string, targetPath: string, fileTypes?: FileTypesInput): PackerContext {
	return buildPackerContextFromOptions(workPath, targetPath, normalizeFileTypes(fileTypes))
}
```

- public 签名不变（收 RAW FileTypesInput）
- normalize 先 + 内核（行为等价——逐字搬迁）
- **import 变更**（F-R8-2）：env-compute L19 加 `buildPackerContextFromOptions`（store→graph 单向已存在，不新增循环）

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
- **npm 独有**（F-R4-2——`new NpmResolver(workPath)` 是 FixpointCtx 契约独有；内核只构造 PackerContext 不收 npm；buildFixpointCtx 自己加 npm）

### D-PCD-5 — 内核放置（F-R1-1 实证已解——选项 A 锁定）

**现状依赖**（R1 实证）：
- `env-compute`(store) → `config-fixpoint`(graph) 单向（resolveAppAliasImpl，env-compute.ts:19）
- `config-fixpoint`(graph) **不 import env-compute**（grep = 0——config-fixpoint imports: fs/path/oxc-parser/oxc-walker/shared/utils + graph 内部 npm-resolver/dependency-graph/graph + types.ts）

**选项评估**：
- **A：内核放 config-fixpoint（graph 层）** ✅ 锁定——env-compute import config-fixpoint 的 `buildPackerContextFromOptions`（store→graph 已存在单向，**不新增循环**）。buildFixpointCtx 同文件就近调内核。语义可接受（buildFixpointCtx 已在 config-fixpoint——PackerContext 构造包装已存在此层）。
- ~~B：内核放 env-compute（store 层）~~ **不可行**——config-fixpoint 须 import env-compute → 新增 graph→store 反向依赖 → 循环。
- ~~C：新建纯工具层~~ 不必要——选项 A 无循环 + 不新增文件。

**结论**：选项 A 锁定（内核放 config-fixpoint——避免循环 + buildFixpointCtx 就近 + 不新增文件）。

### D-PCD-6 — 字段名差异（F-R1-2/R1-3 实证已解——内核映射统一）

**现状**（R1 实证）：
- `types.ts:46` PackerFileTypes.`directivePrefixes`
- `env-compute.ts:149` normalized compilerOptions.`templateDirectivePrefixes`
- **正向映射 3 处**（compilerOptions → PackerContext.fileTypes）：
  - env-compute.ts:201（toPackerContext）`directivePrefixes: ctx.compilerOptions.templateDirectivePrefixes`
  - env-compute.ts:224（buildPackerContext）`directivePrefixes: compilerOptions.templateDirectivePrefixes`
  - config-fixpoint.ts:67（buildFixpointCtx 内部）`directivePrefixes: compilerOptions.templateDirectivePrefixes`
- **反向映射 1 处**（PackerContext.fileTypes → compilerOptions）：
  - env-compute.ts:318（buildResetStoreInfoData）`templateDirectivePrefixes: ctx.fileTypes.directivePrefixes`
- **config-collector.ts:51-58 反向解构**：从 `ctx.fileTypes.directivePrefixes` → `compilerOptions.templateDirectivePrefixes` 传 buildFixpointCtx（F-R1-3 实证）

**方案（锁定）**：
- 内核收 normalized compilerOptions（`templateDirectivePrefixes`）→ 内核内映射到 `directivePrefixes`（D-PCD-1 已含——统一正向映射）
- config-collector 反向解构**保留**（最小改动——ctx.fileTypes → compilerOptions 形态传 buildFixpointCtx；buildFixpointCtx 签名不改收 compilerOptions）

## 3. dedup 路径

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | 抽内核 `buildPackerContextFromOptions`（放置 D-PCD-5 lock） | 单一构造逻辑 |
| 2 | buildPackerContext = normalize + 内核 | dedup（env-compute） |
| 3 | toPackerContext = 取字段 + 内核 | dedup（env-compute） |
| 4 | buildFixpointCtx = 内核 + 包 FixpointCtx | dedup（config-fixpoint） |
| 5 | 行为 0 全量验证 | 7-diff=0 |

## 4. 风险（R1-R2 全解）

1. ~~内核放置~~（D-PCD-5——**F-R1-1 实证已解**）：选项 A 锁定（内核放 config-fixpoint——无循环，store→graph 单向已存在）
2. ~~字段名差异~~（D-PCD-6——**F-R1-2/R1-3 实证已解**）：内核统一正向映射（templateDirectivePrefixes → directivePrefixes）；config-collector 反向解构保留（最小改动）
3. ~~toPackerContext CompilerContext 依赖~~（**F-R2-2 实证已解**）：toPackerContext 仍收 CompilerContext（env-compute type），从 ctx 取 pathInfo + compilerOptions 调内核（散参）；CompilerContext 依赖保留（不破）
4. ~~caller 签名~~（**已解**）：buildFixpointCtx 签名不改（收 compilerOptions——测试 fixture 依赖 + 最小改动）；config-collector/dispatch caller 不变

## 5. Non-scope 守

- PackerContext 形状不改 / normalizeFileTypes 不动 / CompilerContext 不动 / FixpointCtx 包装保留
- resolveAlias/resolveNpm stub 不动（D-PCS-1 deferred）
- compiler/* 不动 / L2/L3 不动 / compat 写不动

## 6. scope 取舍

PackerContext 构造逻辑 dedup（三处逐字重复 → 单一内核）。**不碰形状**（PackerContext 字段不变）+ **不碰 stub**（D-PCS-1 deferred）+ **不碰 L2/L3**（阶段 3）。最小改动 caller 签名。
