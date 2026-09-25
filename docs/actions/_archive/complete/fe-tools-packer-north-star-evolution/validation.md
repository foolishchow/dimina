# Validation — fe-tools-packer-north-star-evolution

Status authority: [Action Status](../../../STATUS.md)

| ID | Req | Validation | Status |
| --- | --- | --- | --- |
| V-NS1 | R-NS7 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pass（6 相全 commit） |
| V-NS2 | R-NS7 | vitest 全绿（88 files 648 tests；compile-cli-cache + lifecycle-integration flaky solo pass） | pass |
| V-NS3 | R-NS7 | 7 项目 build diff=0（air-battle/base/subpackages/mpx-demo/vant/weui/taro-todo all ✓） | pass |
| V-NS4 | R-NS6 | `grep -rn 'packerALS\|runWithCompilerContext' src/packer/store/env.ts` = 0（dead writer 删）+ getCompilerContext 简化（删 packerALS.tryGet 分支）；**compat 写 RETAINED**（实证 load-bearing——dist-preparer createDist 读 pathInfo.targetPath 删则 mkdirSync(undefined) 崩 + npm-builder fallback + parse-walk 经 worker resetStoreInfo；主线程 getter 消费方未全迁 storeInfo() 返回值前不可删，留作后续 initiative）；grep runWithCompilerContext caller = 0 | pass（audit 修正：design 预设删 compat write 经实证 REVERT——非 dead） |
| V-NS5 | R-NS4 | `grep 'as unknown as PackerOrchestrator\|as PackerOrchestrator' src/packer/orchestrator.ts` = 0；createPackerOrchestrator 返类型注解 `: PackerOrchestrator`（structural conformance + method bivariance） | pass |
| V-NS6 | R-NS1 | `grep 'getAppId\|getAppName\|getAppConfigInfo\|getConfigData\|getPageConfigInfo' src/packer/types.ts` Graph interface 非 0；PageConfig/ComponentConfig relocate env.ts→types.ts | pass |

## PC-B10b D-OR-7 三重张力（实证记录，2026-10-10）

PC-B10b attempted array-with-attached-metadata（`Object.assign(entries, {appId, name, path, dependencyGraph, buildModel})`）→ 破 lifecycle-integration.spec L171 `Object.keys(result).sort() = ['appId','buildModel','dependencyGraph','name','path']`（array indices 混入）。撤回。

`as PackerOrchestrator` cast 失败真因（probe2 实证，2026-10-10）：**return type mismatch**（`Record<string,unknown>` vs `Promise<EmitEntry[]>`）+ moduleCache shape（CachedModuleResult vs {module,dependencies}）+ `size` getter/method 错配。state param 经 **method bivariance** 放行（probe5——PackerSessionState 窄 fingerprints 不阻 implements）。EmitEntry 已 types.ts L26 import（非缺失）。`as unknown as PackerOrchestrator` → 推张力到 caller（src/index.ts state arg + watch-runner casts）。

结论：D-OR-7 非单一 cast 可消解——需北星 interface 演进（R-NS1..NS3）。
