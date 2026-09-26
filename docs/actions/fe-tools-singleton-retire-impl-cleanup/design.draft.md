# Design Draft — fe-tools-singleton-retire-impl-cleanup

> **状态：draft**——D-SRC-1..3 待 readiness review lock。A5 cleanup（resetStoreInfo 退役 + 测试迁 + singleton 删）。

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
- **view/index.ts 补传 graph**（A5a 遗漏——viewCompile 建 ctx 未传 graph）
- import 补：getAppId/getComponent/getAppConfigInfo/getRuntimeType/getNpmResolver（view/style 须加）

**runtime caller 传 graph**（runtime.ts:30）：
```ts
engine.successPayload({ logger, graph: getDependencyGraph() })
```
- runtime.ts import getDependencyGraph

**删 fallback ALS（完全迁移）**：
- parse-walk × 3 + index × 3：`ctx?.x ?? ALSGetter()` → `ctx!.x`（ctx 必传——非 optional）
- 但 ctx 参数仍 optional（测试直调可能不传——须测试迁 D-SRC-3 同步）
- **渐进**：先 worker ctx 传全 + runtime 传 graph（行为 0），后删 fallback（D-SRC-3 测试迁后）

## 2. D-SRC-2 — resetStoreInfo 4 处退役 + storeInfo wrapper 重构

**resetStoreInfo 退役**（D-SRC-1 完全迁移后——ALS 不再 load-bearing）：
- logic/index.ts:280 + view/index.ts:194 + style/index.ts:59 + emit-engine.ts:12
- resetStoreInfo 函数删（env.ts）

**storeInfo wrapper 重构**：
- storeInfo wrapper 删 compat 写 6 条（纯 compute——返 storeInfo data）
- resetStoreInfo 函数删 + ResetStoreInfoOptions 类型保留（worker input 仍 storeInfo data 序列化）

## 3. D-SRC-3 — __tests__ 107 caller + getPages 21 caller 迁移 + env.ts singleton 删

**__tests__ 107 caller 迁移**：
- 改 ctx 直传（buildPackerContextFromOptions from storeInfo() 返回值 + graph 实例）
- 或删 storeInfo() 调用（若测试已建 ctx）
- **分批 atomic**（测试 fixture 大量）

**getPages 21 caller 迁移**：
- getPages 读 ALS configInfo + npmResolver——改 ctx.configInfo.pages or 显式传 pages
- getPages 函数删（env.ts）——21 caller 迁后

**env.ts singleton 删**：
- 删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters
- **L34 re-export 保留**（env-compute.ts re-export——buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath）
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
