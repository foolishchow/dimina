# Validation — fe-tools-env-l1-extract

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Validation | Status |
| --- | --- | --- | --- |
| V-EL1-1 | R-EL1-5 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-EL1-2 | R-EL1-5 | vitest 全绿（88 files 648 tests；flaky solo pass——compile-cli-cache/lifecycle-integration） | pending |
| V-EL1-3 | R-EL1-5 | **one-shot 7 项目 build diff=0**（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui） | pending |
| V-EL1-4 | R-EL1-1 | grep `from '.*env-compute\.ts'` 在 env.ts 非 0（re-export）+ env-compute 不 import env.ts（无循环） | pending |
| V-EL1-5 | R-EL1-2 | grep `computeStoreInfo` 在 env-compute.ts export 非 0 + `storeInfo wrapper` 在 env.ts 调 computeStoreInfo + compat 写保留（grep `context\.pathInfo =\|context\.compilerOptions =` 在 env.ts storeInfo wrapper 非 0） | pending |
| V-EL1-6 | R-EL1-3 | grep `storeProjectConfig\|storeAppConfig\|storePageConfig\|\bgetPages\b\|createInitialDependencyGraph\|toPackerContext` 在 env.ts caller=0（死代码清） | pending |
| V-EL1-7 | R-EL1-1 | grep `normalizeFileTypes\|computePathInfo\|buildPackerContext\|buildResetStoreInfoData\|getAppStyleScopeId\|getContentByPath` 在 env-compute.ts export 非 0 + env.ts L1 函数定义 caller=0（全迁或删） | pending |
| V-EL1-8 | R-EL1-4 | grep `resolveAppAlias` 在 env-compute.ts 收 appInfo 参数（`(src.*appInfo)`）+ env.ts wrapper（选项 A）或 parse-walk import env-compute（选项 B） | pending |
| V-EL1-9 | R-EL1-6 | grep `resetStoreInfo\|getCompilerContext\|defaultCompilerContext` 在 env.ts 保留（L2/L3 不动）+ `compiler/parse-walk` 不变（compiler/* 不动） | pending |
| V-EL1-10 | R-EL1-5 | **D-EL1-3 风险验**：storeInfoCtx 迁 env-compute（调 computeStoreInfo 无 compat 写）后 7-diff=0。若 ≠0 fallback：storeInfoCtx 留 env.ts | pending |

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## 不验（Non-scope）

- compat 写不动（storeInfo wrapper 保留）——不验 compat 写 caller=0
- L2/L3 不动（getters/resetStoreInfo 保留）——不验
- compiler/* 不动——不验（现有 compiler spec 自动覆盖）
- config-fixpoint 不动——不验
- PackerContext 构造 dedup——不验
- scratch 内化——不验
