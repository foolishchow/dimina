# Design Draft — fe-tools-env-l1-extract

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——D-EL1-1..N 待 review lock。基于 env.ts 现状 source-audit + storeinfo-collapse backflow。

## 1. env.ts 三层现状（source-audit）

| 层 | 函数 | 性质 | 迁出决策 |
|---|---|---|---|
| **L1 纯函数** | `normalizeExt`/`normalizeTag`/`mergeUnique`/`normalizeFileTypes` + 常量 | 纯（无 ALS） | 迁 env-compute |
| **L1 纯函数** | `computePathInfo` | 纯（mkdtemp 副作用） | 迁 env-compute |
| **L1 纯函数** | `buildPackerContext` | 纯（index.ts:61 caller） | 迁 env-compute + env.ts re-export |
| **L1 纯函数** | `buildResetStoreInfoData` | 纯（logic-emitter/stage-channel caller） | 迁 env-compute + env.ts re-export |
| **L1 纯函数** | `getAppStyleScopeId`/`getContentByPath` | 纯（dispatch/registry caller） | 迁 env-compute + env.ts re-export |
| **L1+L2 混合** | `storeInfo` | 计算 + compat 写（backflow 保留） | 拆 computeStoreInfo（L1）+ wrapper（env.ts L2 compat 写） |
| **L1+L2 混合** | `storeInfoCtx` | 调 storeInfo（compat 写） | 迁 env-compute 调 computeStoreInfo（无 compat 写） |
| **L1+L2 混合** | `toPackerContext` | 收 CompilerContext shape，仅内部用 | 内部化（computeStoreInfo 内）或迁 env-compute（不 export） |
| **L1+L2 混合** | `resolveAppAlias` | 读 ALS configInfo.appInfo | 迁 env-compute 收 appInfo 参数 + env.ts re-export |
| **死代码** | `storeProjectConfig`/`storeAppConfig`/`storePageConfig` | 薄壳委托，src/ 0 caller | 删（env.spec 改测 config-fixpoint） |
| **死代码** | `getPages` | 薄壳委托，src/ 0 caller（config-collector 用显式 FixpointCtx） | 删 |
| **死代码** | `createInitialDependencyGraph` | 薄壳委托，src/ 0 caller（graph.build 取代） | 删 |
| **L2 ALS 门面** | `defaultCompilerContext`/`createCompilerContext`/`getCompilerContext` + Proxy + getters | singleton + ALS 路由 | env.ts 保留 |
| **L3 worker** | `resetStoreInfo` | 写 defaultCompilerContext | env.ts 保留 |

## 2. 迁出策略（方案 A：re-export 最小改动）

**env-compute.ts**（新）承载 L1 纯函数 + 常量 + type。
**env.ts**（瘦身）= L2/L3 + storeInfo wrapper + re-export L1。

**消费方 import 不变**：~20 文件 `from '../store/env.ts'` 不改（env.ts re-export L1）。行为 0 友好。

### D-EL1-1 — env-compute.ts 模块边界

```
src/packer/store/env-compute.ts
├── 常量: DEFAULT_TEMPLATE_EXTS, DEFAULT_TEMPLATE_DIRECTIVE_PREFIXES,
│         DEFAULT_STYLE_EXTS, DEFAULT_VIEW_SCRIPT_EXTS, DEFAULT_VIEW_SCRIPT_TAGS,
│         MINI_PROGRAM_RUNTIME_TYPE, MINI_GAME_RUNTIME_TYPE, RESERVED_EXTS
├── type: FileTypesInput (export)
├── normalizeExt / normalizeTag / mergeUnique (内部)
├── normalizeFileTypes (export)
├── computePathInfo (export)
├── buildPackerContext (export)
├── computeStoreInfo (export) — storeInfo 纯计算
├── storeInfoCtx (export) — 调 computeStoreInfo，设 state.scratch
├── buildResetStoreInfoData (export)
├── resolveAppAlias (export) — 收 appInfo 参数
├── getAppStyleScopeId (export)
└── getContentByPath (export)
```

**依赖**：env-compute → graph（PackerGraph/NpmResolver/DependencyGraph）+ config-fixpoint（resolveAppAliasImpl）+ types（PackerContext/PageConfig/ComponentConfig）+ state（PackerSessionState）+ shared（uuid）。**不依赖 env.ts**（无循环）。

### D-EL1-2 — computeStoreInfo 签名（storeInfo 拆分）

storeInfo 现状（L1+L2 混合）：
```
storeInfo(workPath, options) → {pathInfo, configInfo, compilerOptions, dependencyGraph}
  = normalizeFileTypes + computePathInfo + new NpmResolver + new PackerGraph
    + graph.build/reconcile(toPackerContext(localCtx))
    + compat 写（getCompilerContext 写 6 条）   ← L2，保留 env.ts
  + return {pathInfo, configInfo, compilerOptions, dependencyGraph}
```

**拆分**：
- `computeStoreInfo(workPath, options) → { pathInfo, compilerOptions, graph, configInfo, dependencyGraph }`（纯计算，无 compat 写）。内部建 localCtx + `toPackerContext(localCtx)` + graph.build/reconcile。
- env.ts `storeInfo(workPath, options)` wrapper = `computeStoreInfo(workPath, options)` + compat 写（写 getCompilerContext singleton 6 条）+ return。签名/返回值不变（105 测试 caller 不动）。

**CompilerContext type 处理**：computeStoreInfo 内部用 CompilerContext shape（localCtx）。`toPackerContext(ctx: CompilerContext)` 收 CompilerContext。CompilerContext 是 env.ts 内部 type。**决策**：CompilerContext type 迁 env-compute（computeStoreInfo + toPackerContext 用），不 export（内部）。或 toPackerContext 收 raw 字段（workPath/targetPath/compilerOptions）——但 localCtx 是完整 CompilerContext。**倾向**：CompilerContext type 迁 env-compute internal（不 export），toPackerContext 迁 env-compute internal。

### D-EL1-3 — storeInfoCtx 迁出

storeInfoCtx 现状调 storeInfo（compat 写）。迁 env-compute 调 computeStoreInfo（无 compat 写）：
```
storeInfoCtx(ctx, graph, state) → void
  = computeStoreInfo(ctx.workPath, {graph}) → r
  + state.scratch = r.pathInfo.targetPath!
```
**注意**：storeInfoCtx 迁 env-compute 后**不再 compat 写**（orchestrate 链路纯函数——storeinfo-collapse 已确认 compat 写副作用不影响 orchestrate，因 collaborator 已迁 sctx.ctx/sctx.state）。但——storeInfoCtx 之前调 storeInfo（compat 写）。改调 computeStoreInfo 后 compat 写不跑——须验证 orchestrate 链路行为不变（compat 写副作用是否 orchestrate 依赖？storeinfo-collapse 说「compat 写副作用不影响 orchestrate 链路」——但需实证。**风险**：compat 写跑 vs 不跑，ALS getter 值不同——若 orchestrate 有隐藏 getter 读，行为变。须 7-diff 验）。

### D-EL1-4 — resolveAppAlias 迁出

resolveAppAlias 现状读 ALS `configInfo.appInfo`。迁 env-compute 收 appInfo：
```
resolveAppAlias(src, appInfo) → string | null
  = config-fixpoint.resolveAppAliasImpl(src, appInfo)
```
env.ts re-export（parse-walk import from env.ts 不变）——但 resolveAppAlias 签名变（加 appInfo 参数）。parse-walk.ts:312 caller 须改：`resolveAppAlias(specifier)` → `resolveAppAlias(specifier, getAppConfigInfo())`？——但 parse-walk 读 ALS getAppConfigInfo。**矛盾**：parse-walk 仍读 ALS（阶段 3 迁）。所以 resolveAppAlias 迁 env-compute 收 appInfo，但 caller parse-walk 仍从 ALS 读 appInfo 传入。env.ts 保留 wrapper `resolveAppAlias(src) = env-compute.resolveAppAlias(src, getCompilerContext().configInfo.appInfo)`？或 parse-walk 改读 ALS appInfo 传 env-compute。

**决策**（design lock 待定）：
- 选项 A：env.ts 保留 resolveAppAlias wrapper（读 ALS appInfo + 调 env-compute）——parse-walk import 不变
- 选项 B：parse-walk 改 import env-compute + 读 ALS getAppConfigInfo 传参

**倾向 A**（最小改动，parse-walk 不动）。

### D-EL1-5 — 死代码清理

删 5 薄壳函数（src/ 0 caller）：
- `storeProjectConfig`/`storeAppConfig`/`storePageConfig`/`getPages`/`createInitialDependencyGraph`
- env.ts export 列表删 5 函数
- env.spec.js 改：测 config-fixpoint.readProjectConfig 直接（或删 storeProjectConfig describe，config-fixpoint 自有测试）

**toPackerContext**：迁 env-compute internal（不 export）。env.ts export 列表删 toPackerContext（无外部 caller——source-audit 确认）。

### D-EL1-6 — env.ts 终态

```
src/packer/store/env.ts
├── L2 ALS 门面
│   ├── defaultCompilerContext singleton + createCompilerContext/getCompilerContext
│   ├── pathInfo/configInfo Proxy
│   ├── CompilerContext type（internal，若 computeStoreInfo 不需则删）
│   ├── getters: getTemplateExts/getStyleExts/getWorkPath/getTargetPath/...
│   └── ConfigInfo/PathInfo type (export)
├── L3 worker 桥接
│   └── resetStoreInfo (写 defaultCompilerContext)
├── storeInfo wrapper (调 env-compute.computeStoreInfo + compat 写)
├── resolveAppAlias wrapper (若选项 A——读 ALS appInfo + 调 env-compute)
└── re-export from env-compute: buildPackerContext/storeInfoCtx/buildResetStoreInfoData/
    getAppStyleScopeId/getContentByPath/normalizeFileTypes(?)
```

## 3. 塌缩路径

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | 新建 env-compute.ts（L1 纯函数 + 常量 + type） | L1 纯模块 |
| 2 | computeStoreInfo 拆出（storeInfo 纯计算）+ CompilerContext/toPackerContext internal | storeInfo 可拆 |
| 3 | storeInfoCtx 迁 env-compute（调 computeStoreInfo，无 compat 写）+ resolveAppAlias 迁（收 appInfo） | L1 函数迁完 |
| 4 | env.ts 退化：storeInfo wrapper（compat 写保留）+ re-export L1 + L2/L3 | env.ts 瘦身 |
| 5 | 死代码清理（5 薄壳 + toPackerContext export）+ env.spec 改 | 殁骸清 |

## 4. 风险

1. **storeInfoCtx 去 compat 写**（D-EL1-3）：storeInfoCtx 之前调 storeInfo（compat 写），改调 computeStoreInfo（无 compat 写）。orchestrate 链路行为是否变？storeinfo-collapse 说 compat 写副作用不影响 orchestrate——但须 7-diff 实证。**若 7-diff≠0**：storeInfoCtx 保留调 storeInfo（compat 写）不迁 env-compute，或 env-compute.storeInfoCtx 调 storeInfo wrapper（循环？）。**fallback**：storeInfoCtx 留 env.ts（不迁）。
2. **CompilerContext type 归属**（D-EL1-2）：computeStoreInfo 用 CompilerContext shape。迁 env-compute 须迁 type 或改 toPackerContext 收 raw。**倾向**：CompilerContext internal 迁 env-compute。
3. **resolveAppAlias 签名变**（D-EL1-4）：加 appInfo 参数。env.ts wrapper 选项 A 最小改动。**风险**：parse-walk 调 env.ts wrapper（读 ALS）——行为不变。
4. **env.spec 死代码测试**（D-EL1-5）：删 storeProjectConfig 须改 env.spec。config-fixpoint.readProjectConfig 逻辑是否被 env.spec 间接覆盖？须确认 config-fixpoint 自有测试。

## 5. Non-scope 守

- compat 写不动（storeInfo wrapper 保留）
- L2/L3 不动（getters/resetStoreInfo 保留）
- compiler/* 不动
- config-fixpoint 不动
- PackerContext dedup 不处理
- scratch 内化不处理

## 6. scope 取舍

L1 迁出（纯模块卫生）+ 死代码清理。**不碰 compat 写**（backflow 保留）+ **不碰 L2/L3**（阶段 3）。env.ts 三层混合 → L2/L3 薄门面 + L1 纯模块。
