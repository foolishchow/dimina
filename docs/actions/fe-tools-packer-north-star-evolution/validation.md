# Validation — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../STATUS.md)

| ID | Req | Validation | Status |
| --- | --- | --- | --- |
| V-NS1 | R-NS7 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-NS2 | R-NS7 | vitest 全绿（87 files，flaky solo pass：compile-cli-cache + session-unify） | pending |
| V-NS3 | R-NS7 | 7 项目 build diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`：air-battle/base/subpackages/mpx-demo/vant/weui/taro-todo） | pending |
| V-NS4 | R-NS6 | `grep -rn 'packerALS\|runWithCompilerContext\|defaultCompilerContext' src/packer/store/env.ts` = 0（resetStoreInfo 保留） | pending |
| V-NS5 | R-NS4 | `grep 'as unknown as PackerOrchestrator\|as PackerOrchestrator' src/packer/orchestrator.ts` = 0 | pending |
| V-NS6 | R-NS1 | `grep 'getAppId\|getAppName\|getAppConfigInfo\|getConfigData\|getPageConfigInfo' src/packer/types.ts` Graph interface 非 0 | pending |

## PC-B10b D-OR-7 三重张力（实证记录，2026-10-10）

PC-B10b attempted array-with-attached-metadata（`Object.assign(entries, {appId, name, path, dependencyGraph, buildModel})`）→ 破 lifecycle-integration.spec L171 `Object.keys(result).sort() = ['appId','buildModel','dependencyGraph','name','path']`（array indices 混入）。撤回。

`as PackerOrchestrator` cast → tsc 报 state param 张力（PackerSessionState 窄 fingerprints + PackerGraph accessors vs OrchestratorState interface）+ moduleCache shape（CachedModuleResult vs {module, dependencies}）+ EmitEntry 未从 types.ts 导出。`as unknown as PackerOrchestrator` → 推张力到 caller（src/index.ts state arg + watch-runner casts）。

结论：D-OR-7 非单一 cast 可消解——需北星 interface 演进（R-NS1..NS3）。
