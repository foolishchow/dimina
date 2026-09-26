# Validation — fe-tools-storeinfo-collapse

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Validation | Status |
| --- | --- | --- | --- |
| V-SC1 | R-SC6 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | done |
| V-SC2 | R-SC6 | vitest 全绿（88 files 648 tests；flaky solo pass——compile-cli-cache/lifecycle-integration） | done |
| V-SC3 | R-SC6 | **one-shot 7 项目 build diff=0**（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui） | done |
| V-SC4 | R-SC4 | grep `sctx\.storeInfo\|\.storeInfo as\|const storeInfo = sctx\|storeInfo:` 在 src/ caller=0（殁骸拆除——sctx.storeInfo 全清，worker input storeInfo 字段名保留值改 helper） | done |
| V-SC5 | R-SC4 | **compat 写保留 backflow**——grep `context\.pathInfo = localPathInfo\|context\.compilerOptions =\|context\.graph =` 在 storeInfo 旧函数内非 0（storeInfoCtx 调旧 storeInfo，测试 fixture 依赖 ALS getter——D-SC3 推迟）。殁骸 grep sctx.storeInfo=0 | done |
| V-SC6 | R-SC5 | grep `resetStoreInfo` src/ 非 0（worker ALS 保留）+ `getAppId/getTargetPath/getWorkPath` 在 compiler/* parse-walk 非 0（ALS getters 保留，阶段 3） | done |
| V-SC7 | R-SC3 | grep `function storeInfoCtx` 签名 export（env.ts）+ `storeInfo(ctx, graph, state)` 3 参数 + `state.scratch = r.pathInfo.targetPath!` | done |
| V-SC8 | R-SC1 | grep `scratch` 在 PackerSessionState 非 0 + **mutable（非 readonly）** + `state.scratch` 在 publisher/dist-preparer/config-compiler-collab 非 0 | done |
| V-SC9 | R-SC2 | grep `sctx\.ctx` 在 collaborator 非 0 + `buildResetStoreInfoData` 在 env.ts export 非 0 + stage-channel L45 + logic-emitter L39 调 helper 非 0（字段名转换 `templateDirectivePrefixes:.*directivePrefixes`） | done |
| V-SC10 | R-SC7 | grep `compiler/parse-walk\|resetStoreInfo` 不变（compiler/* 不动）+ `defaultCompilerContext` 仍在 env.ts（ALS 门面不删） | done |

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
