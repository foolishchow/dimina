# Requirements — fe-tools-singleton-retire-cleanup-final

承接 A5b 推迟的 D-SRC-1b/2/3b 完全退役收尾。

## R-SCF-1 — 独立函数加 ctx 参数

独立函数 10 处（enhanceCSS/collectAllWxsModules/styleLoad/processIncludedFileWxsDependencies/getJSAbsolutePath/resolveDependencyId 等）加 ctx optional 参数 + caller 链传 ctx（D-SRC-1b-1 前置——删 fallback 须独立函数已迁）。

## R-SCF-2 — 删 fallback ALS

fallback ALS 15 处删（ctx 必传——`ctx?.x ?? ALSGetter()` → `ctx!.x`）。主函数 ctx 必传（worker + 测试已传——D-SRC-1a + D-SRC-3a）。

## R-SCF-3 — resetStoreInfo 退役

resetStoreInfo 4 处 caller 删（logic/view/style index.ts + emit-engine.ts）+ resetStoreInfo 函数删 + storeInfo wrapper 重构（删 compat 写 6 条——pathInfo/compilerOptions/npmResolver/graph/configInfo/dependencyGraph）。

## R-SCF-4 — env.ts singleton 删

env.ts 删 defaultCompilerContext + pathInfo/configInfo Proxy + 20 getters（getAppConfigInfo/getDependencyGraph/getAppId/getAppName/getComponent/getNpmResolver/getPageConfigInfo/getPages/getProjectConfig/getRuntimeType/getStyleExts/getTargetPath/getTemplateDirectivePrefixes/getTemplateExts/getViewScriptExts/getViewScriptTags/getWorkPath/isMiniGame/resetStoreInfo/resolveAppAlias/storeInfo）。L34 re-export 保留（env-compute.ts re-export——buildPackerContext/storeInfoCtx/buildResetStoreInfoData/getAppStyleScopeId/getContentByPath）。

## R-SCF-5 — src getter caller 迁 + runtime 改候选 b

src 非 env.ts getter caller 迁（config-collector/define-engine/emit/dispatch/graph/orchestrator/config-compiler/view 等）+ runtime.ts 改候选 b（postMessage 序列化——compile 返回 graph 不可序列化，successPayload 在 compile 内调用读 ctx.graph 后 toJSON or runtime 读 graph 但不 Object.assign）。

## R-SCF-6 — 行为 0 三件套

tsc 0 + vitest 全绿（88/88，flaky solo pass）+ 7-diff=0。完全退役不改变行为（ctx 已携带全 data，fallback ALS 仅保险——删 fallback 后 ctx 必传，行为等价）。
