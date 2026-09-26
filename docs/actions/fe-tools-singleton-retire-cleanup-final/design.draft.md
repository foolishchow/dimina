# Design — fe-tools-singleton-retire-cleanup-final

> **状态：ready**——D-SCF-1..3 已 review lock（R1-R4 findings 全 fix + R5 收敛）。承接 A5b 推迟的 D-SRC-1b/2/3b 完全退役收尾。

## 背景

A5b 实证：D-SRC-1b 删 fallback 破坏 121 测试——独立函数（enhanceCSS/collectAllWxsModules/styleLoad）caller 不传 ctx。须先迁独立函数 + caller 链，再删 fallback。

完全退役**不改变行为**——ctx 已携带全 data（D-SRC-1a worker 传全 + D-SRC-3a 测试传全），fallback ALS 仅保险（ctx 优先 `ctx?.x ?? ALSGetter()`）。删 fallback 后 ctx 必传，行为等价。

## D-SCF-1 — 独立函数迁 + 删 fallback

### D-SCF-1-1 独立函数加 ctx 参数（前置）

独立函数 10 处加 ctx optional 参数 + caller 链传 ctx：
- **logic parse-walk**：getJSAbsolutePath(L273)/resolveDependencyId(L291)/resolveNpmModuleId(L368)/resolveModuleIdToExistingPath(L376)——4 处无 ctx（读 getWorkPath/resolveAppAlias/getNpmResolver）
- **view parse-walk**：processIncludedFileWxsDependencies(L859——无 ctx，L871 getComponent)/collectAllWxsModules(L1278——**已有 ctx optional 但 caller 不传** F-R1-2，L1280 workPath)
- **style parse-walk**：styleLoad(L72——无 ctx，L91 getDependencyGraph.getDirectDependencies/L96 getComponent)

**caller 链注记**（F-R1-1 + F-R8-1/R8-2 实证）——**非全 parse-walk 内**：
- **parse-walk 主函数内 caller**（ctx 可传——主函数已有 ctx optional）：resolveDependencyId(L119/142/168/194) + resolveNpmModuleId(L327) + resolveModuleIdToExistingPath(L275/299/357/399) + styleLoad(L136) + collectAllWxsModules(L491/557/1302/1314——**已有 ctx optional 但 caller 不传** F-R1-2）
- **非 parse-walk 内 caller**（F-R8-1/R8-2——须透传链）：
  - **processIncludedFileWxsDependencies**：view/wxml/load/index.ts:173 + 255（**非 parse-walk 内**——须 wxml/load/index.ts 加 ctx 透传链）
  - **getJSAbsolutePath**：logic/index.ts:122 + registry-impl.ts:24（**非 parse-walk 内**——须这些 caller 传 ctx）
- **测试直调 caller**（须测试传 ctx——getJSAbsolutePath/resolveDependencyId 测试直调须迁）

### D-SCF-1-2 删 fallback ALS（修正计数——含 workPath/targetPath）

fallback 删（ctx 必传——独立函数已迁）——**不止 15 处**（F-R2-1 修正——含 workPath/targetPath）：
- **graph fallback**：logic index 5（L89/90/127/160/161）+ logic parse-walk L45 + view parse-walk L388/787/905/1180 + style parse-walk L321/480
- **appId fallback**：logic parse-walk L98 + view parse-walk L911 + style parse-walk L486
- **configInfo fallback**：logic index L89/160
- **workPath fallback**：logic parse-walk L73 + style parse-walk L192/346/362/482 + view parse-walk L911
- **targetPath fallback**：logic parse-walk L74 + style parse-walk L486 + view parse-walk L911

`ctx?.x ?? ALSGetter()` → `ctx!.x[!]`（ctx 非空断言——worker + 测试已传全）。

**ctx.graph 类型 + TS quirks**（F-R2-2）：types.ts PackerContext.graph?: DependencyGraph（optional）。`ctx!.graph!` 双重非空——**helper 变量** `_graph = ctx!.graph!`（A5a deviation D-SIC-dev3——内联 `!` 报 void TS quirks，helper 变量解决）。

import 清理：删 fallback 后未用 getter import 删（getDependencyGraph/getAppId/getTargetPath/getWorkPath 等——保留独立函数用 + worker ctx 建立用）。

## D-SCF-2 — resetStoreInfo 退役 + storeInfo wrapper 重构

### resetStoreInfo 4 处退役

- logic/index.ts:280 + view/index.ts:194 + style/index.ts:59 + emit-engine.ts:12

resetStoreInfo 函数删（env.ts）。worker ctx 已传全（D-SRC-1a）——resetStoreInfo 不再 load-bearing。

**emit-engine 退役门控**（F-R10-1 修正）：
- emit-engine.ts:12 resetStoreInfo（emit-worker 建 ALS）
- **emit.ts:142 `resolve(getWorkPath(), sourcePath)` 读 ALS**（produceEntry 间接调用链——perModule 策略调 getWorkPath()，emit.ts L200 注释）
- **D-SCF-2 须 emit.ts:142 迁 ctx 读**（produceEntry 加 ctx 参数 + emit-engine compile 建 ctx 传 produceEntry）——resetStoreInfo 退役后 ALS 失效
- emit-engine.ts compile 须建 ctx（buildPackerContextFromOptions from storeInfo data）+ produceEntry 传 ctx

**buildResetStoreInfoData caller 保留**（F-R10-2）：stage-channel.ts:47 + logic-emitter.ts:40 调 buildResetStoreInfoData（返 data——非 reset）。D-SCF-2 退役后仍可用（worker reset data 组装——buildResetStoreInfoData 返 ResetStoreInfoOptions data，resetStoreInfo 删后 data 无消费——须确认是否删 buildResetStoreInfoData or 保留返 data）

### storeInfo wrapper 重构

**compat 写 6 条位置确认**（F-R4-1）：storeInfo wrapper 内 L88-94（非 resetStoreInfo）——`context.pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph = r.*`（6 条写回 defaultCompilerContext）。

storeInfo wrapper 删 compat 写 6 条（L88-94）——storeInfo 保留纯 compute（返 storeInfo data）。

**门控**（F-R4-2）：src storeInfo caller=0（orchestrate 已不调）+ test 107 caller（建 ALS + 返 data——D-SRC-3a 已迁 compileSS/compileML 传 ctx，storeInfo 调用保留建 ALS + 返 data）。D-SCF-1-2 删 fallback 后可重构。

## D-SCF-3 — env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b

### env.ts singleton 删

删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters。**L34 re-export 保留**（env-compute.ts re-export——buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath）。getContentByPath 来源确认（L34 re-export from env-compute——非 L219 getter）。

### src getter caller 迁

**src getter caller 数量实证**（F-R11-1）——几十处，scope 极大：
- getDependencyGraph: 13 文件 + getAppId: 13 文件 + getWorkPath: 9 文件
- getComponent: 8 文件 + getAppConfigInfo: 8 文件
- isMiniGame: 6 文件 + getRuntimeType: 6 文件
- getNpmResolver: 5 文件 + getTargetPath: 4 文件
- getPages: 2 文件 + resolveAppAlias: 1 文件

**批次划分**（F-R11-1——按子系统）：
- batch1: graph 层（getDependencyGraph 13——graph/orchestrator/emit/dispatch 等）
- batch2: app 层（getAppId 13 + getAppConfigInfo 8 + getRuntimeType 6 + isMiniGame 6 + getNpmResolver 5 + resolveAppAlias 1）
- batch3: path 层（getWorkPath 9 + getTargetPath 4 + getPages 2）

D-SCF-3 删前须这些 caller 迁 ctx 读（同 D-SCF-1-2 模式——ctx?.x ?? ALSGetter() → ctx!.x）。


### runtime 改候选 b

runtime.ts 候选 a（过渡——import getDependencyGraph）须改候选 b（env.ts singleton 删后 ALS 失效）。

**候选 b refined**（postMessage 序列化——F-R3-1）：runtime.ts:34 `Object.assign(response, compileResult)`——compileResult 合入 response postMessage。若 compile 返回 graph 实例（可变单例），结构化克隆失败。

**候选 b 实施路径**（F-R3-1）：
- runtime.ts L31 `engine.successPayload({ logger, graph: getDependencyGraph() })`——候选 a（过渡）。runtime 无 ctx 访问
- **候选 b**：compile 末尾调 successPayload（读 ctx.graph 后 toJSON——返回 serializedPayload 字段）+ runtime 读 `compileResult.serializedPayload`（不调 successPayload）
- 或：successPayload 签名改（graph 必传——runtime 从 compileResult 取 graph 实例但不 Object.assign——单独调 successPayload 后 spread）
- **define-engine.ts L28 默认 fallback 删**（F-R3-2）：`({ graph }) => ({ dependencyGraph: (graph ?? getDependencyGraph()).toJSON() })`——fallback ALS 删，graph 必传

**emit-engine 候选 b 须建 ctx**：emit-engine.ts 当前不建 ctx（只 resetStoreInfo）。候选 b 须 emit-engine 建 ctx + successPayload 读 ctx.graph。

## 迁移顺序门控

1. **D-SCF-1-1**：独立函数 10 处加 ctx 参数 + caller 链传 ctx（行为 0——ctx optional + fallback ALS 保留）
2. **D-SCF-1-2**：删 fallback ALS 15 处（ctx 必传——独立函数已迁，行为 0）
3. **D-SCF-2**：resetStoreInfo 4 处退役 + storeInfo wrapper 重构（须 D-SCF-1-2 前置）
4. **D-SCF-3**：env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b（须 D-SCF-2 前置）
