# Design Draft — fe-tools-singleton-retire-impl-cleanup

> **状态：ready**——D-SRC-1..3 已 review lock。A5 cleanup（resetStoreInfo 退役 + 测试迁 + singleton 删）。

## 1. D-SRC-1 — worker ctx 建立传全 optional + runtime caller 传 graph + 删 fallback ALS

**worker ctx 建立传全 optional**（logic/view/style index.ts）：
```ts
buildPackerContextFromOptions(workPath, targetPath, compilerOptions, {
  graph: getDependencyGraph(),
  appId: getAppId(),
  component: (src) => getComponent(src),
  configInfo: getAppConfigInfo(),
  npmResolver: getNpmResolver() ?? undefined,
  runtimeType: getRuntimeType(),
  appInfo: getAppConfigInfo(),  // resolveAlias 闭包 appInfo
})
```
- **view/index.ts 补传 graph**（F-R1-2——A5a 遗漏：viewCompile 建 ctx 未传 graph，logic/style 已传）
- **import 补全**（F-R13-1）：worker ctx 传全须补 import——logic 缺 getAppId/getRuntimeType/getNpmResolver；view 缺 getAppId/getComponent/getAppConfigInfo/getRuntimeType/getNpmResolver（+5）；style 缺更多（+ getAppId/getComponent/getAppConfigInfo/getRuntimeType/getNpmResolver）
- **resolveAppAlias appInfo 同源**（F-R13-2）：resolveAppAlias env.ts:129 读 configInfo.appInfo；getAppConfigInfo() 返回 appInfo——appInfo 同源 ctx.configInfo（buildPackerContextFromOptions appInfo 参数 = getAppConfigInfo()）
- import 补：getAppId/getComponent/getAppConfigInfo/getRuntimeType/getNpmResolver（view/style 须加）

**runtime caller 传 graph**（runtime.ts:30）——**graph 来源候选**（F-R1-1）：
- **候选 a**：runtime import getDependencyGraph（过渡——A5b 完全迁移前。但 env.ts singleton 删后失效）
- **候选 b**：compile 返回 ctx.graph，runtime 读 `compileResult.graph` 传 successPayload（须 compile 返回值扩 graph 字段）。**postMessage 序列化问题**（F-R8-1）：runtime.ts:34 `Object.assign(response, compileResult)`——compileResult 合入 response postMessage。若 compile 返回 graph 实例（可变单例），结构化克隆失败。**候选 b refined**：compile 不返回 graph 实例；successPayload 在 compile 内调用（读 ctx.graph 后 toJSON）or runtime 读 compileResult.graph 但不 Object.assign（graph 实例不入 response）
- **候选 c**：successPayload 内部读 ctx.graph（引擎 ctx 透传——须 runtime 访问引擎 ctx，复杂）
- **emit-engine 候选 b/c 须建 ctx**（F-R8-2）：emit-engine.ts 当前不建 ctx（只 resetStoreInfo）。候选 b/c 须 emit-engine 建 ctx + 返回 graph or 透传
- **A5b 渐进**：D-SRC-1a 用候选 a（过渡），D-SRC-3b env.ts singleton 删前改候选 b（compile 返回 graph）

**删 fallback ALS（完全迁移）**（F-R14-1/R14-2）：
- **fallback ALS 15 处**：logic index 5 + style parse-walk 3 + logic parse-walk 2 + view parse-walk 5——`ctx?.x ?? ALSGetter()` → `ctx!.x`（ctx 必传）
- **独立函数保留 ALS 10 处**（F-R14-1——A1-A3 dev）：logic parse-walk 4（getJSAbsolutePath/resolveNpmModuleId/resolveModuleIdToExistingPath/resolveDependencyId）+ view parse-walk 2（processIncludedFileWxsDependencies）+ style parse-walk 4（styleLoad）——D-SRC-1b 须加 ctx 参数 + caller 传
- **测试直调破坏**（F-R14-2）：5 文件直调 compileSS/compileML 不传 ctx——D-SRC-1b ctx 必传破坏。须 D-SRC-3a 测试迁同步（compileSS/compileML 签名 ctx 必传后测试须传）
- **渐进**：先 worker ctx 传全 + runtime 传 graph（行为 0），后删 fallback（D-SRC-3a 测试迁后 D-SRC-1b）

## 2. D-SRC-2 — resetStoreInfo 4 处退役 + storeInfo wrapper 重构

**resetStoreInfo 退役**（D-SRC-1 完全迁移后——ALS 不再 load-bearing）：
- logic/index.ts:280 + view/index.ts:194 + style/index.ts:59 + emit-engine.ts:12
- resetStoreInfo 函数删（env.ts）
- **emit-engine 退役门控**（F-R3-1）：emit-engine.ts:12 resetStoreInfo——produceEntry 不直接读 ALS getter（grep 0）。须确认 produceEntry 间接调用链不读 ALS（emit.ts 内调用）

**storeInfo wrapper 重构**（F-R3-2 门控）：
- storeInfo wrapper 删 compat 写 6 条（纯 compute——返 storeInfo data）
- resetStoreInfo 函数删 + ResetStoreInfoOptions 类型保留（worker input 仍 storeInfo data 序列化）
- **门控**：D-SRC-3a 测试迁后（src caller=0 已确认——orchestrate 链路已不调 wrapper，仅 __tests__ 107 caller）

## 3. D-SRC-3 — __tests__ 107 caller + getPages 21 caller 迁移 + env.ts singleton 删

**__tests__ 107 caller 迁移**：
- 改 ctx 直传（buildPackerContextFromOptions from storeInfo() 返回值 + graph 实例）
- 或删 storeInfo() 调用（若测试已建 ctx）
- **分批 atomic**（F-R9-2：35 文件——最大 custom-file-types 26 + require-path-resolution 11 + style-compiler 8 + 5 × 2 等。批次可按 caller 数划分：batch1（26+11=37）/batch2（8+5+5=18）/batch3（其余 52））

**getPages 21 caller 迁移**（F-R2-1）：
- 测试调 `storeInfo() → getPages().mainPages → compileSS(getPages().mainPages)`——getPages 读 ALS
- **迁移候选**：
  - **候选 a**：getPages 改 ctx 参数（`getPages(ctx)` 读 ctx.configInfo）——但 getPagesImpl 须 FixpointCtx（ctx + configData + npm），getPages 须组装 FixpointCtx
  - **候选 b**：删 getPages，测试改 getPagesImpl 直调（须 FixpointCtx——复杂，测试须组装）
  - **候选 c**：getPages 保留（fallback ALS），A5b 不删 getPages（推迟 A5b 后续 or 保留 compat）
- **A5b 倾向**：候选 a（getPages 改 ctx 参数——最小改动，测试传 ctx）。**候选 a refined**（F-R9-1）：getPagesImpl 读 `fc.configData.runtimeType`（GraphConfigData）。A5a ctx.configInfo = getAppConfigInfo()（只 appInfo，不含 runtimeType）。候选 a 须 ctx 扩 `configData?: GraphConfigData`（非 configInfo: Record）or getPages 保留 fallback（configData from ALS configInfo）
- **compileSS/compileML 测试传 ctx 签名位置**（F-R2-2）：ctx 第 7 参（optional）——测试调 `compileSS(getPages().mainPages, null, {...})` 须补 undefined × 3 + ctx

**env.ts singleton 删**（F-R4-1）：
- 删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters
- **src getter caller 迁移**（F-R4-1）：src 非 env.ts 多处引用 getters——config-collector/define-engine/emit/dispatch/graph/orchestrator/config-compiler/view 等。D-SRC-3b 删前须这些 caller 迁 ctx 读（同 D-SRC-1b 模式）
- **L34 re-export 保留**（env-compute.ts re-export——buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath）。**getContentByPath 来源确认**（F-R4-2）：L34 re-export from env-compute（保留）——非 L219 getter
- storeInfo wrapper 保留纯 compute（或删——若 caller=0）

## 4. 迁移顺序 + 门控

1. **D-SRC-1a** worker ctx 建立传全 optional + view 补传 graph + runtime caller 传 graph（行为 0——ctx 传全，fallback ALS 保留）
2. **D-SRC-3a** __tests__ 107 caller + getPages 21 caller 迁移（改 ctx 直传——ctx 传全）
3. **D-SRC-1b** 删 fallback ALS（完全迁移——ctx 必传，测试已迁）
4. **D-SRC-2** resetStoreInfo 4 处退役 + storeInfo wrapper 重构
5. **D-SRC-3b** env.ts singleton 删（20 getters + Proxy + defaultCompilerContext）

## 5. 风险

- **D-SRC-1 worker ctx 传全 optional**：须 import getAppId/getComponent/getAppConfigInfo/getRuntimeType/getNpmResolver（view/style 须加）
- **D-SRC-3 测试 fixture 大量**：107 caller 分批 atomic——工作量大
- **D-SRC-2 resetStoreInfo 退役**：须 D-SRC-1b 完全迁移后（ALS 不再 load-bearing）
- **D-SRC-3b env.ts singleton 删**：须 D-SRC-3a 测试迁后（caller=0）

## 6. 跨权威一致性

- **A5a（singleton-retire-impl-core）**：PackerContext 扩 + ALS 迁 ctx optional + fallback ALS——A5b 完全迁移（删 fallback）
- **A5 research（singleton-retire-research）**：D-SR-4+5+6 细化——D-SRC-1..3 对应
- **D-PCS-1/D-PCS-6**：PackerContext 形状——A5a 已扩（A5b 不再改形状）

## 7. 结论

D-SRC-1..3 cleanup（resetStoreInfo 退役 + 测试迁 + singleton 删）。渐进 atomic——D-SRC-1a 传全 → D-SRC-3a 测试迁 → D-SRC-1b 删 fallback → D-SRC-2 退役 → D-SRC-3b 删 singleton。A5b 完成后 L2/L3 退役结束。
