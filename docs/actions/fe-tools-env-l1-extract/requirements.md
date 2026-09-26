# Requirements — fe-tools-env-l1-extract

Status authority: [Action Status](../STATUS.md)

## Problem

env.ts 是 L1（计算）+ L2（ALS 门面）+ L3（worker 桥接）三层混合（概念分析 §1 L21 表）。L1 计算层无法独立测试（须先 storeInfo 设 ALS context），且含死代码（薄壳委托 5 函数 src/ 无 caller——config-fixpoint 已被 graph.build 取代）。storeinfo-collapse 归档时记录阶段 2 backflow（L1 迁出推迟）。

## Requirements

### R-EL1-1 — 新建 env-compute.ts L1 纯模块（MUST）

新建 `src/packer/store/env-compute.ts`，承载 L1 计算层：
- **常量**：`DEFAULT_TEMPLATE_EXTS`/`DEFAULT_TEMPLATE_DIRECTIVE_PREFIXES`/`DEFAULT_STYLE_EXTS`/`DEFAULT_VIEW_SCRIPT_EXTS`/`DEFAULT_VIEW_SCRIPT_TAGS`/`MINI_PROGRAM_RUNTIME_TYPE`/`MINI_GAME_RUNTIME_TYPE`/`RESERVED_EXTS`
- **fileTypes 规范化**：`normalizeExt`/`normalizeTag`/`mergeUnique`/`normalizeFileTypes`（+ `FileTypesInput` interface export）
- **path 计算**：`computePathInfo`（workPath → pathInfo，mkdtemp 副作用保留）
- **PackerContext 构造**：`buildPackerContext`（workPath/targetPath/fileTypes → PackerContext，纯）
- **storeInfo 纯计算**：`computeStoreInfo`（storeInfo 拆出的纯计算部分——normalizeFileTypes + computePathInfo + NpmResolver + graph build/reconcile + pathInfo，**无 compat 写**）。返回含 npmResolver（F-R6-1——wrapper compat 写喂 parse-walk:363 主线程测试路径）。签名 design §3 lock。
- **storeInfoCtx**：调 computeStoreInfo → `state.scratch = pathInfo.targetPath!`（orchestrate 链路纯函数，无 compat 写）
- **buildResetStoreInfoData**：ctx/state → resetStoreInfoData（纯，字段名转换 + configInfo `as ConfigInfo`）
- **纯工具**：`getAppStyleScopeId`（uuid）、`getContentByPath`（fs.readFileSync）
- **type**：`PathInfo`/`ConfigInfo` interface 迁 env-compute export（computeStoreInfo 返回 configInfo + buildResetStoreInfoData 用 `as ConfigInfo` 断言须用）+ env.ts re-export（resetStoreInfo/getters 仍用）

### R-EL1-2 — env.ts 退化为 L2/L3 门面 + re-export（MUST）

env.ts 退化为：
- **L2 ALS 门面**：`defaultCompilerContext` singleton + `createCompilerContext`/`getCompilerContext` + `pathInfo`/`configInfo` Proxy + getters（`getTemplateExts`/`getStyleExts`/`getWorkPath`/`getTargetPath`/`getAppId`/`getDependencyGraph`/`getComponent`/`getPageConfigInfo`/`getAppConfigInfo`/`getRuntimeType`/`isMiniGame`/`getNpmResolver`/`getAppName`/`getViewScriptExts`/`getViewScriptTags`/`getTemplateDirectivePrefixes`/`getProjectConfig`）+ `ConfigInfo`/`PathInfo` type
- **L3 worker 桥接**：`resetStoreInfo`（写 defaultCompilerContext——worker 上下文恢复）
- **storeInfo wrapper**：调 `env-compute.computeStoreInfo` 取结果 + **compat 写保留**（写 getCompilerContext singleton——backflow，测试 fixture 依赖 ALS getter）。旧签名 `storeInfo(workPath, options)` 不变（~107 调用点/34 测试文件不动）
- **re-export L1**：从 env-compute re-export `buildPackerContext`/`storeInfoCtx`/`buildResetStoreInfoData`/`getAppStyleScopeId`/`getContentByPath`（方案 A 最小改动——消费方 import from env.ts 不变）

### R-EL1-3 — 死代码清理（MUST）

删 src/ 无 caller 的薄壳委托函数（config-fixpoint 已被 graph.build/reconcile 取代）：
- `storeProjectConfig`/`storeAppConfig`/`storePageConfig`（薄壳委托 config-fixpoint，读 ALS configInfo）
- `createInitialDependencyGraph`（薄壳委托 config-fixpoint.buildInitialGraph，graph.build 已取代）
- `storePathInfo`（写 ALS pathInfo Proxy + npmResolver——src/ 0 caller）
- `toPackerContext`（仅 env.ts 内部用——computeStoreInfo 内部化后删 export）

**保留**（测试 fixture 依赖，非死代码）：
- `getPages`（**21 测试文件 47 调用点**：style-compiler(7)/custom-file-types(5)/module-cache(4)/module-result-cache(4)/null-safe-member-access(4)/global-usingComponents(4)/custom-tab-bar(2)/compiler-hotpaths(2)/logic-component-traversal(2)/view-style-compile-res(2)/canvas-component-path 等 21 文件——读 ALS configInfo，env.ts L2 getter 保留，不迁 env-compute）

**export 处置补充**（F-R3-2）：
- `PageConfig`/`ComponentConfig` type re-export（env.ts:64「向后兼容」注释）：0 外部消费方——**删 re-export**（canonical 在 types.ts，死 re-export）
- `getCompilerContext` export：0 外部 caller——**改 internal**（createCompilerContext/resetStoreInfo/storeInfo wrapper 内部用，删 export）

**测试调整**：`env.spec.js` 唯一 describe = storeProjectConfig（测 readProjectConfig 合并优先级逻辑）。删 storeProjectConfig 后 env.spec 整文件无剩余内容——**改写为 config-fixpoint.readProjectConfig 直测**（保留 project.config.json + private 优先级合并覆盖；config-fixpoint 无自有测试，不可只删 env.spec 丢覆盖）。

### R-EL1-4 — resolveAppAlias 迁出（MUST）

`resolveAppAlias`（logic/parse-walk.ts:312 唯一 src/ caller）从 ALS 读 configInfo.appInfo。迁 env-compute 收 appInfo 参数：
- `resolveAppAlias(src, appInfo)`（纯函数，调 config-fixpoint.resolveAppAliasImpl）
- env.ts 保留 re-export（parse-walk import from env.ts 不变）或 parse-walk 改 import env-compute（design §3 lock）

### R-EL1-5 — 行为 0（MUST）

tsc 0 + vitest 88/88 + one-shot 7-diff=0。env.ts 全局路径→全量 7 项目 diff。

### R-EL1-6 — Non-scope 守（MUST）

- compat 写不动（storeInfo wrapper 保留 compat 写 backflow）
- L2/L3 不动（getters/resetStoreInfo/singleton/Proxy 保留）
- compiler/* 不动（parse-walk 仍读 ALS getters）
- config-fixpoint 不动
- PackerContext 构造 dedup 不处理
- scratch 内化不处理

## Constraints

- 行为 0 原则：所有重构保持字节完全相同的输出
- 行为 0 全量验证：env.ts 全局路径 → 全量 7 项目 diff（含 air-battle）
- tsc：`node ./node_modules/typescript/bin/tsc --noEmit`
- pnpm：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run`
- no any / no `[key: string]: unknown`（ts-migration 方向）
- Node ESM 后缀必须

## Non-scope

详见 [README](README.md) Non-goals。

## backflow（迁出后记录）

- 阶段 3（L2+L3 退役）：compiler/* 加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- scratch 内化：DiskOutput.publish 内化 mkdtemp
- PackerContext 构造 dedup（buildPackerContext/buildFixpointCtx/toPackerContext 三同质）
- compat 写保留（storeInfo wrapper——阶段 3 退役）
