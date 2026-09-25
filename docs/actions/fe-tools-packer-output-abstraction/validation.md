# Validation — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

| ID | Req | Validation | Status |
| --- | --- | --- | --- |
| V-O1 | R-O7 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-O2 | R-O7 | vitest 全绿（88 files；dev-reload/dev-server/compile-cli-cache/lifecycle-integration flaky solo pass） | pending |
| V-O3 | R-O7 | 7 项目 build diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`：air-battle/base/subpackages/mpx-demo/vant/weui/taro-todo） | pending |
| V-O4 | R-O6 | grep `BuildModel\|materialize\|publishToDist\|createDist\|artifactResolver\|skipMaterialize` src/ caller=0（殁骸拆除） | pending |
| V-O5 | R-O6 | grep `getTargetPath()` 在 `src/packer/emit/*` caller=0（compat 写 output 消费方死；注 compiler/* parse-walk collectAssets 仍存，worker 侧不动） | pending |
| V-O6 | R-O1 | grep `interface Output` src/packer/types.ts 非 0 + `MemOutput`/`DiskOutput` impl 非 0 | pending |
| V-O7 | R-O5 | grep `skipMaterialize` src/ caller=0（mode=impl 选择，flag 消） | pending |
| V-O8 | R-O8 | grep `resetStoreInfo` src/ 非 0（worker ALS 保留）+ `storeInfo` 函数仍在（不动 storeInfo） | pending |

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass：compile-cli-cache + lifecycle-integration）
- **7 diff**：`node --experimental-strip-types /tmp/dc-build.mjs baseline && node --experimental-strip-types /tmp/dc-build.mjs current && node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## 双模式验证

- **dev memfs**（P-O1）：dev-reload.spec + dev-server.spec（dev server 读 Output.read）+ lifecycle-integration.spec（dev 路径）+ 7 diff dev mode
- **one-shot disk**（P-O2）：compile-cli-cache.spec（one-shot materialize+publish 路径）+ lifecycle-integration.spec（one-shot）+ view-selective-stages（previewAdapter）+ 7 diff one-shot
- **全量**（P-O3）：88 files 全绿 + 7 diff=0

## 不验（Non-scope）

- worker ALS（resetStoreInfo + parse-walk getters）不动——不验
- storeInfo/sctx.storeInfo 不动——不验
- compiler/* 不动——不验（现有 compiler spec 自动覆盖）
