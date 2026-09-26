# Validation — fe-tools-scratch-internalize

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Validation | Status |
| --- | --- | --- | --- |
| V-SI-1 | R-SI-5 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-SI-2 | R-SI-5 | vitest 全绿（88 files 648 tests；flaky solo pass——compile-cli-cache/lifecycle-integration） | pending |
| V-SI-3 | R-SI-5 | **one-shot 7 项目 build diff=0**（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui） | pending |
| V-SI-4 | R-SI-1 | grep `readonly scratch` 在 BaseOutput 非 0 + `mkdtempSync` 在 output.ts 非 0（BaseOutput 构造）+ MemOutput/DiskOutput super() 调 | pending |
| V-SI-5 | R-SI-2 | grep `state\.scratch = output\.scratch\|state\.scratch = .*\.scratch` 在 orchestrator.ts 非 0（投影） | pending |
| V-SI-6 | R-SI-3 | grep `state\.scratch = r\.pathInfo` 在 env-compute storeInfoCtx = 0（去 mkdtemp）+ computeStoreInfo 收 `pathInfo?` 参数（storeInfoCtx 不传→默认 {workPath} 无 targetPath；storeInfo wrapper 传 computePathInfo 含 targetPath） | pending |
| V-SI-7 | R-SI-4 | grep `computePathInfo` 在 env-compute.ts 保留非 0（storeInfo compat wrapper 用）+ storeInfo wrapper mkdtemp 调 computePathInfo 非 0 + compile-cli-cache.spec mkdtemp 唯一性测试 pass | pending |
| V-SI-8 | R-SI-6 | grep `resetStoreInfo\|getCompilerContext\|defaultCompilerContext` 在 env.ts 保留（L2/L3 不动）+ `state\.scratch` 在 7 consumer 仍读（投影保持——dist-preparer/publisher/config-compiler-collab/npm-builder/stage-dispatcher/config-collector/buildResetStoreInfoData） | pending |
| V-SI-9 | R-SI-1 | grep `TARGET_PATH` 在 output.ts BaseOutput 构造非 0（env 分支复刻——行为 0） | pending |
| V-SI-10 | R-SI-5 | **dev 模式验证（F-R1-1 已解）**：MemOutput 也 mkdtemp（dev 防崩）；dev server 读 Output.read 内存不受影响。7-diff 是 one-shot disk（dev 不在 7-diff）——须 vitest dev spec 覆盖（dev-server.spec/dev-reload.spec） | pending |

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## 不验（Non-scope）

- compat 写不动（storeInfo wrapper 保留）——不验 compat 写 caller=0
- L2/L3 不动——不验
- compiler/* 不动——不验
- consumer 读源不改——不验（state.scratch 投影保持）
- PackerContext 构造 dedup——不验
- dev 模式 Output 形态——不验（MemOutput publish no-op 保留）
