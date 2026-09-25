# Validation — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

| ID | Req | Validation | Status |
| --- | --- | --- | --- |
| V-NS1 | R-NS7 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-NS2 | R-NS7 | vitest 全绿（87 files，flaky solo pass：compile-cli-cache + session-unify） | pending |
| V-NS3 | R-NS7 | 7 项目 build diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`：air-battle/base/subpackages/mpx-demo/vant/weui/taro-todo） | pending |
| V-NS4 | R-NS6 | `grep -rn 'packerALS\|runWithCompilerContext' src/packer/store/env.ts` = 0（dead writer 删）+ storeInfo compat 写 L222-229 删（F-AC1-1）；retain worker 全链 defaultCompilerContext + pathInfo/configInfo Proxy + getCompilerContext + resetStoreInfo + getters；custom-file-types.spec + publish-incremental.spec 改读 storeInfo() 返回值（configInfo.appInfo.appId / compilerOptions.fileTypes / pathInfo.targetPath）；grep getDependencyGraph() main-thread caller = 0（F-AC3-1） | pending |
| V-NS5 | R-NS4 | `grep 'as unknown as PackerOrchestrator\|as PackerOrchestrator' src/packer/orchestrator.ts` = 0 | pending |
| V-NS6 | R-NS1 | `grep 'getAppId\|getAppName\|getAppConfigInfo\|getConfigData\|getPageConfigInfo' src/packer/types.ts` Graph interface 非 0 | pending |

## PC-B10b D-OR-7 三重张力（实证记录，2026-10-10）

PC-B10b attempted array-with-attached-metadata（`Object.assign(entries, {appId, name, path, dependencyGraph, buildModel})`）→ 破 lifecycle-integration.spec L171 `Object.keys(result).sort() = ['appId','buildModel','dependencyGraph','name','path']`（array indices 混入）。撤回。

`as PackerOrchestrator` cast 失败真因（probe2 实证，2026-10-10）：**return type mismatch**（`Record<string,unknown>` vs `Promise<EmitEntry[]>`）+ moduleCache shape（CachedModuleResult vs {module,dependencies}）+ `size` getter/method 错配。state param 经 **method bivariance** 放行（probe5——PackerSessionState 窄 fingerprints 不阻 implements）。EmitEntry 已 types.ts L26 import（非缺失）。`as unknown as PackerOrchestrator` → 推张力到 caller（src/index.ts state arg + watch-runner casts）。

结论：D-OR-7 非单一 cast 可消解——需北星 interface 演进（R-NS1..NS3）。
