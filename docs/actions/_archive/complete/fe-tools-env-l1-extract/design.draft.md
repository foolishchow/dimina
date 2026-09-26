# Design Draft — fe-tools-env-l1-extract

Status authority: [Action Status](../../../STATUS.md)

> **状态：draft**——D-EL1-1..6 **已 review lock**（10 轮 readiness review：R1-R10，16+ findings 全修正——含 F-R4-1 迁移细则 / F-R6-1 npmResolver / F-R9-1 选项 A 锁定）。基于 env.ts 现状 source-audit + storeinfo-collapse backflow。

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
| **L1+L2 混合** | `toPackerContext` | 收 CompilerContext shape，仅内部用 | 迁 env-compute internal（不 export——D-EL1-2 锁定） |
| **L1+L2 混合** | `resolveAppAlias` | 读 ALS configInfo.appInfo | 迁 env-compute 收 appInfo 参数 + env.ts re-export |
| **死代码** | `storeProjectConfig`/`storeAppConfig`/`storePageConfig` | 薄壳委托，src/ 0 caller | 删（env.spec 改写 config-fixpoint 直测） |
| **死代码** | `createInitialDependencyGraph` | 薄壳委托，src/ 0 caller（graph.build 取代） | 删 |
| **死代码** | `storePathInfo` | 写 ALS pathInfo Proxy，src/ 0 caller | 删 |
| **L2 保留** | `getPages` | 薄壳委托，**src/ 0 caller 但测试 21 文件 47 调用点**（F-R1-1/F-R3-1） | env.ts L2 getter 保留（测试 fixture 依赖，不迁） |
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
├── type: FileTypesInput / PathInfo / ConfigInfo (export)
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
- `computeStoreInfo(workPath, options) → { pathInfo, compilerOptions, graph, configInfo, npmResolver }`（纯计算，无 compat 写；graph 实例返回——wrapper 自取 `graph.toJSON()`（return 值）+ `graph.getInnerGraph()`（compat 写），不冗余返回 dependencyGraph 字段；**npmResolver 返出**（F-R6-1——localCtx.npmResolver = new NpmResolver(workPath)，wrapper compat 写 `context.npmResolver = r.npmResolver` 喂主线程 parse-walk 测试路径：parse-walk.ts:363 getNpmResolver ← 9 测试文件 storeInfo 后主线程直调 logicParseWalk 依赖））。内部建 localCtx + `toPackerContext(localCtx)` + graph.build/reconcile。
- env.ts `storeInfo(workPath, options)` wrapper = `computeStoreInfo(workPath, options)` + compat 写（写 getCompilerContext singleton 6 条）+ return。签名/返回值不变（~107 调用点/34 测试文件不动）。

**CompilerContext type 处理**：computeStoreInfo 内部用 CompilerContext shape（localCtx）。`toPackerContext(ctx: CompilerContext)` 收 CompilerContext。CompilerContext 是 env.ts 内部 type。**决策**：CompilerContext type 迁 env-compute（computeStoreInfo + toPackerContext 用）。

**实施期 deviation（close review 回填）**：原 design「internal 不 export」修正为 **export**——env.ts 保留的 getPages 薄壳（21 文件 47 测试 fixture 依赖）调 `toPackerContext(getCompilerContext())` 须引用 CompilerContext type + toPackerContext 函数。env-compute export 二者（env.ts import）；env.ts 对外 **不 re-export toPackerContext**（保持 API 收缩意图——对外 caller=0）。CompilerContext type 同理（env.ts 内部用，不 re-export 对外）。

**迁移细则（F-R4-1——行为 0 纪律）**：computeStoreInfo **逐字搬迁** storeInfo 的 graph 分支逻辑（env.ts:196-209）：
- `if (options.graph)` 分支内**顺序执行** reconcile → restoreFromSnapshot → reconcile（注释写「State 路径 / 旧路径」但实际两段都跑——storeinfo-collapse 后 7-diff=0 已验证此行为正确）——**不「修正」为二选一**（行为变化）
- `SC_TRACE` console.error x2（env.ts:201/209——storeinfo-collapse 实施期诊断残留）——**逐字搬迁**（debug-only env-gate 不影响产物；删除属可选独立卫生步，不在本 Action 强制）

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

**决策（F-R9-1 收敛——选项 A 锁定）**：env.ts 保留 resolveAppAlias wrapper（读 ALS `configInfo.appInfo` + 调 env-compute.resolveAppAlias）——parse-walk.ts:312 `resolveAppAlias(specifier)` 单参调用与 import from env.ts **均不变**（最小改动）。env-compute 版双参 `(src, appInfo)` 纯函数；env.ts wrapper import alias（`import { resolveAppAlias as resolveAppAliasCompute } from './env-compute.ts'`）。选项 B（parse-walk 改 import + 传参）**否决**——compiler/* 不动（R-EL1-6 non-scope 守）。

### D-EL1-5 — 死代码清理（F-R1-1/F-R1-2 修正后）

删 src/ 0 caller 的薄壳/写函数：
- `storeProjectConfig`/`storeAppConfig`/`storePageConfig`/`createInitialDependencyGraph`/`storePathInfo`
- env.ts export 列表删 5 函数
- env.spec.js 改写：唯一 describe = storeProjectConfig（测 readProjectConfig project.config.json + private 优先级合并）→ 改为 config-fixpoint.readProjectConfig 直测（**保留合并逻辑覆盖**——config-fixpoint 无自有测试，不可只删丢覆盖）

**getPages 保留**（F-R1-1→F-R3-1 修正）：测试 caller **21 文件 47 调用点**（style-compiler(7)/custom-file-types(5)/module-cache(4)/module-result-cache(4)/null-safe-member-access(4)/global-usingComponents(4)/custom-tab-bar(2)/compiler-hotpaths(2)/logic-component-traversal(2)/view-style-compile-res(2)/canvas-component-path/component-index-style-path/component-index-view-path/global-components-wxs/import-support/logic-component-traversal/template-path-resolution/template-prefix/template-semantics/typescript-support/view-compiler-perf-cache/wxs-reserved-context 等 21 文件）。env.ts L2 getter 保留（读 ALS configInfo——测试 fixture 先 storeInfo 设 context 再 getPages 读）。不迁 env-compute。

**export 处置补充**（F-R3-2）：`PageConfig`/`ComponentConfig` type re-export（0 外部消费）删——canonical 在 types.ts；`getCompilerContext` export 删（0 外部 caller，internal 化——createCompilerContext/resetStoreInfo/storeInfo wrapper 内部用）。

**toPackerContext**：迁 env-compute internal（不 export）。env.ts export 列表删 toPackerContext（无外部 caller——source-audit 确认）。

**PathInfo/ConfigInfo type 迁移**（F-R1-3）：type 定义从 env.ts 迁 env-compute export；env.ts `export type { PathInfo, ConfigInfo }` re-export（resetStoreInfo 参数 + getters 返回仍用——消费方 import from env.ts 不变）。

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
├── re-export from env-compute: buildPackerContext/storeInfoCtx/buildResetStoreInfoData/
│   getAppStyleScopeId/getContentByPath + type PathInfo/ConfigInfo
│   （内部 import: normalizeFileTypes——resetStoreInfo fallback/getTemplateDirectivePrefixes
│      fallback/createCompilerContext 用，F-R4-2，非 re-export）
└── 保留 L2: getPages（21 文件 47 测试调用点）/ getters / getCompilerContext(internal 化)
    删: PageConfig/ComponentConfig re-export（0 消费）
```

## 3. 塌缩路径

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | 新建 env-compute.ts（L1 纯函数 + 常量 + type） | L1 纯模块 |
| 2 | computeStoreInfo 拆出（storeInfo 纯计算）+ CompilerContext/toPackerContext internal | storeInfo 可拆 |
| 3 | storeInfoCtx 迁 env-compute（调 computeStoreInfo，无 compat 写）+ resolveAppAlias 迁（收 appInfo） | L1 函数迁完 |
| 4 | env.ts 退化：storeInfo wrapper（compat 写保留）+ re-export L1 + L2/L3 | env.ts 瘦身 |
| 5 | 死代码清理（5 死代码函数 + toPackerContext/PageConfig/ComponentConfig/getCompilerContext export）+ env.spec 改写 | 殁骸清 |

## 4. 风险

1. **storeInfoCtx 去 compat 写**（D-EL1-3）：storeInfoCtx 之前调 storeInfo（compat 写），改调 computeStoreInfo（无 compat 写）。orchestrate 链路行为是否变？storeinfo-collapse 说 compat 写副作用不影响 orchestrate——但须 7-diff 实证。**若 7-diff≠0**：storeInfoCtx 保留调 storeInfo（compat 写）不迁 env-compute，或 env-compute.storeInfoCtx 调 storeInfo wrapper（循环？）。**fallback**：storeInfoCtx 留 env.ts（不迁）。
2. **CompilerContext type 归属**（D-EL1-2——**已锁定**）：CompilerContext type internal 迁 env-compute（computeStoreInfo + toPackerContext 用，不 export）；toPackerContext 同迁 internal。
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
