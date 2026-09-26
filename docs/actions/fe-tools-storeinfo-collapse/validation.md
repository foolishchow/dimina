# Validation — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Validation | Status |
| --- | --- | --- | --- |
| V-SC1 | R-SC6 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-SC2 | R-SC6 | vitest 全绿（88 files；flaky solo pass） | pending |
| V-SC3 | R-SC6 | **one-shot 7 项目 build diff=0**（`node --experimental-strip-types /tmp/dc-build.mjs diff`）——storeInfo 全局路径全量验证 | pending |
| V-SC4 | R-SC4 | grep `sctx\.storeInfo\|\.storeInfo as` src/ caller=0（殁骸拆除——全 6 消费方迁完） | pending |
| V-SC5 | R-SC4 | grep `defaultCompilerContext.*=\|compat 写\|context\.pathInfo =\|context\.configInfo =\|context\.compilerOptions =` 在 storeInfo 函数内 = 0（compat 写死） | pending |
| V-SC6 | R-SC5 | grep `resetStoreInfo` src/ 非 0（worker ALS 保留）+ `getAppId/getTargetPath/getWorkPath` 在 compiler/* parse-walk 非 0（ALS getters 保留，阶段 3） | pending |
| V-SC7 | R-SC3 | grep `function storeInfo` 签名（`→ void` 或无 return）+ 无 `return { pathInfo` | pending |
| V-SC8 | R-SC1 | grep `scratch` 在 OrchestratorState（state/session-state.ts）非 0 + `state.scratch` 在 publisher/dist-preparer 非 0 | pending |
| V-SC9 | R-SC2 | grep `sctx\.ctx` 在 collaborator 非 0（PackerContext 流）+ `ctx\.workPath\|ctx\.fileTypes` 在 collaborator 非 0 | pending |
| V-SC10 | R-SC7 | grep `compiler/parse-walk\|resetStoreInfo` 不变（compiler/* 不动）+ `defaultCompilerContext` 仍在 env.ts（ALS 门面不删） | pending |

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## 不验（Non-scope）

- worker ALS（resetStoreInfo + parse-walk getters）不动——不验
- compiler/* 不动——不验（现有 compiler spec 自动覆盖）
- env.ts ALS 门面不删——不验
- PackerContext 构造 dedup——不验
- scratch 内化——不验（Output 抽象 follow-up）
