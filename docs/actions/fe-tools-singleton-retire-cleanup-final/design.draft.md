# Design — fe-tools-singleton-retire-cleanup-final

> **状态：draft**——D-SCF-1..3 待 readiness review lock。承接 A5b 推迟的 D-SRC-1b/2/3b 完全退役收尾。

## 背景

A5b 实证：D-SRC-1b 删 fallback 破坏 121 测试——独立函数（enhanceCSS/collectAllWxsModules/styleLoad）caller 不传 ctx。须先迁独立函数 + caller 链，再删 fallback。

完全退役**不改变行为**——ctx 已携带全 data（D-SRC-1a worker 传全 + D-SRC-3a 测试传全），fallback ALS 仅保险（ctx 优先 `ctx?.x ?? ALSGetter()`）。删 fallback 后 ctx 必传，行为等价。

## D-SCF-1 — 独立函数迁 + 删 fallback

### D-SCF-1-1 独立函数加 ctx 参数（前置）

独立函数 10 处加 ctx optional 参数 + caller 链传 ctx：
- **logic parse-walk**：getJSAbsolutePath/resolveDependencyId/resolveNpmModuleId/resolveModuleIdToExistingPath（4 处——L318 resolveAppAlias/L369 getNpmResolver/L274/351/378 getWorkPath）
- **view parse-walk**：processIncludedFileWxsDependencies/collectAllWxsModules（2 处——L871 getComponent/L1280 workPath）
- **style parse-walk**：styleLoad（4 处——L91 getDependencyGraph.getDirectDependencies/L96 getComponent/L321/480 addFile）

caller 链传 ctx（parse-walk 主函数 → 独立函数 + 测试直调须传 ctx）。

### D-SCF-1-2 删 fallback ALS 15 处

fallback 15 处删（ctx 必传——独立函数已迁）：
- logic index 5（L89/90/127/160/161）
- style parse-walk 3（L321/480/486）
- logic parse-walk 2（L45/98）
- view parse-walk 5（L388/787/905/911/1180）

`ctx?.x ?? ALSGetter()` → `ctx!.x[!]`（ctx 非空断言——worker + 测试已传全）。helper 变量 `_graph = ctx!.graph!`（双重非空——ctx.graph optional 类型）。

import 清理：删 fallback 后未用 getter import 删（getDependencyGraph/getAppId/getTargetPath 等——保留独立函数用 + worker ctx 建立用）。

## D-SCF-2 — resetStoreInfo 退役 + storeInfo wrapper 重构

### resetStoreInfo 4 处退役

- logic/index.ts:280 + view/index.ts:194 + style/index.ts:59 + emit-engine.ts:12

resetStoreInfo 函数删（env.ts）。worker ctx 已传全（D-SRC-1a）——resetStoreInfo 不再 load-bearing。

**emit-engine 退役门控**：emit-engine.ts:12 resetStoreInfo——produceEntry 不直接读 ALS getter（grep 0）。须确认 produceEntry 间接调用链不读 ALS（emit.ts 内调用）。

### storeInfo wrapper 重构

storeInfo wrapper 删 compat 写 6 条（pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph 写到 defaultCompilerContext ALS singleton）。storeInfo 保留纯 compute（返 storeInfo data）。

**门控**：D-SCF-1-2 删 fallback 后（src caller=0 已确认——orchestrate 链路已不调 wrapper，仅 __tests__ 107 caller——D-SRC-3a 已迁 compileSS/compileML，storeInfo 调用保留建 ALS + 返 data）。

## D-SCF-3 — env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b

### env.ts singleton 删

删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters。**L34 re-export 保留**（env-compute.ts re-export——buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath）。getContentByPath 来源确认（L34 re-export from env-compute——非 L219 getter）。

### src getter caller 迁

src 非 env.ts 多处引用 getters——config-collector/define-engine/emit/dispatch/graph/orchestrator/config-compiler/view 等。D-SCF-3 删前须这些 caller 迁 ctx 读（同 D-SCF-1-2 模式）。

### runtime 改候选 b

runtime.ts 候选 a（过渡——import getDependencyGraph）须改候选 b（env.ts singleton 删后 ALS 失效）。

**候选 b refined**（postMessage 序列化）：runtime.ts:34 `Object.assign(response, compileResult)`——compileResult 合入 response postMessage。若 compile 返回 graph 实例（可变单例），结构化克隆失败。

**候选 b 实施**：successPayload 在 compile 内调用（读 ctx.graph 后 toJSON）——不 runtime 调。compile 末尾调 successPayload（传入 ctx.graph）。runtime 不读 graph——response 不含 graph 实例。

**emit-engine 候选 b 须建 ctx**：emit-engine.ts 当前不建 ctx（只 resetStoreInfo）。候选 b 须 emit-engine 建 ctx + successPayload 读 ctx.graph。

## 迁移顺序门控

1. **D-SCF-1-1**：独立函数 10 处加 ctx 参数 + caller 链传 ctx（行为 0——ctx optional + fallback ALS 保留）
2. **D-SCF-1-2**：删 fallback ALS 15 处（ctx 必传——独立函数已迁，行为 0）
3. **D-SCF-2**：resetStoreInfo 4 处退役 + storeInfo wrapper 重构（须 D-SCF-1-2 前置）
4. **D-SCF-3**：env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b（须 D-SCF-2 前置）
