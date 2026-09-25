# Validation — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

| ID | Req | Validation | Status |
| --- | --- | --- | --- |
| V-O1 | R-O7 | tsc 0 errors（`node ./node_modules/typescript/bin/tsc --noEmit`） | pending |
| V-O2 | R-O7 | vitest 全绿（88 files；dev-reload/dev-server/compile-cli-cache/lifecycle-integration flaky solo pass） | pending |
| V-O3 | R-O7 | **one-shot 7 项目 build diff=0**（`node --experimental-strip-types /tmp/dc-build.mjs diff`：air-battle/base/subpackages/mpx-demo/vant/weui/taro-todo）——DiskOutput.publish byte-exact 复刻 | pending |
| V-O4 | R-O6 | grep `BuildModel\|materialize\|publishToDist\|createDist\|artifactResolver\|skipMaterialize\|sctx.buildModel\|isTemporaryTargetPath\|copyDir\|syncIncremental\|collectFiles\|filesIdentical\|BuildModelEntry\|export.*createDist` src/ caller=0（殁骸拆除 + F-R7-1 sctx.buildModel + F-R11-2 isTemporaryTargetPath + F-R18-1 helper + F-R22-3 BuildModelEntry type + F-R26-1 export 链） | pending |
| V-O5 | R-O6 | grep `getTargetPath()\|isTemporaryTargetPath()` 在 `src/packer/emit/*` caller=0（compat 写 output 消费方死——F-R11-2 补 isTemporaryTargetPath；注 compiler/* parse-walk collectAssets 仍存，worker 侧不动）+ **F-R19-4 grep `getAppId()` 在 compiler/* 非 0**（保留——logic/style/view parse-walk 仍用） | pending |
| V-O6 | R-O1 | grep `interface Output` src/packer/types.ts 非 0 + `BaseOutput` abstract base + `MemOutput`/`DiskOutput` impl 非 0（F-R10-2 base class） | pending |
| V-O7 | R-O5 | grep `skipMaterialize` src/ caller=0（mode=impl 选择，flag 消）+ **F-R30-1 grep `outputMode` src/ 非 0**（request.outputMode 'dev'\|'disk' enum 替代） | pending |
| V-O8 | R-O8 | grep `resetStoreInfo` src/ 非 0（worker ALS 保留）+ `storeInfo` 函数仍在（不动 storeInfo） | pending |
| V-O9 | R-O1 | **Output 生命周期 D-OL1..4 方案 B**：grep `sctx.output\|state.output\|result.output` src/ 非 0 + `BuildResult.output` 字段（types.ts）非 0 + build:end listener 重新赋值 state.output 字段 + **orchestrator 入口创建 Output**（grep `new MemOutput\|new DiskOutput` 在 orchestrator.ts 非 0）+ **listr2 ctx 注入**（grep `tasks.run({` 在 orchestrator.ts 非 0，F-R4-3）+ **config-collector buildModel 行删**（grep `sctx.buildModel = new BuildModel` = 0）+ **sctx.output.add 全 4 路径**（grep `sctx.output.add` 在 orchestrator.ts L83/85 + stage-dispatcher L54 + logic-emitter L42，F-R7-1）+ **type 字段演进**（StageChannelContext types L123 + SessionState session L59 buildModel→output）+ **F-R30-1 outputMode 信号**（P-O3 后 grep `request.outputMode\|outputMode: 'dev'\|outputMode: 'disk'` src/ 非 0） | pending |
| V-O10 | R-O7 | **dev mode 行为 spec 覆盖**（F12 + F-R22-1 preview-adapter 中间层）：dev-reload.spec + dev-server.spec pass（dev server 持 **OutputRef 窄接口**读 outputRef.output.read + fs fallback + rebuild 重新赋值 state.output 字段 + preview-adapter createServer 收 outputRef 透传 createDevServer） | pending |
| V-O11 | R-O6 | grep `BuildResult.buildModel\|buildModel?` src/ caller=0（BuildModel type 删 + BuildResult.buildModel→output 字段演进，F11） |
| V-O12 | R-O1/R-O6 | **Output interface getEntries accessor**（F-R4-2）：grep `getEntries` src/packer/types.ts（interface）+ emit/output.ts（MemOutput/DiskOutput impl）+ orchestrator.ts（result.entries sourced from output.getEntries()）非 0 |
| V-O13 | R-O3 | **DiskOutput.read 读累积内存**（F-R4-1）：grep `read` 在 emit/output.ts DiskOutput 非 `return null`（读 lazy index）+ previewAdapter-dev spec 验即时内存读 |
| V-O14 | R-O3 | **DiskOutput.publish seed copy + temporary hardcode**（F-R13-1/F-R10-1/F-R14-2）：grep `copyDir.*seedPath\|temporary.*=.*true\|mkdtemp` 在 emit/output.ts DiskOutput.publish 非 0 + 无 `rmSync.*scratch`（mkdtemp 不需 rmSync） | pending | pending |

## 行为 0 三件套（每相 gate）

- **tsc**：`node ./node_modules/typescript/bin/tsc --noEmit` → 0 errors
- **vitest**：`node /Users/foolishchow/.cache/node/corepack/v1/pnpm/12.2.0/bin/pnpm.mjs exec vitest run` → 全绿（flaky solo pass：compile-cli-cache + lifecycle-integration）
- **7 diff（one-shot）**：`node --experimental-strip-types /tmp/dc-build.mjs baseline && node --experimental-strip-types /tmp/dc-build.mjs current && node --experimental-strip-types /tmp/dc-build.mjs diff` → all 7 diff=0

## 双模式验证 split（F12 修正）

- **dev（MemOutput）**：无 7-diff 方法（dc-build 只跑 one-shot）——dev 行为由 spec 覆盖：
  - dev-reload.spec（rebuild 替换 state.output）
  - dev-server.spec（dev server 读 Output.read + fs fallback miss/serveRoot）
  - lifecycle-integration.spec（dev 路径）
- **one-shot + previewAdapter + watch（DiskOutput）**：
  - compile-cli-cache.spec（one-shot materialize+publish 路径）
  - view-selective-stages.spec（previewAdapter disk）
  - 7 项目 one-shot diff=0
- **全量（P-O3）**：88 files 全绿 + 7 diff=0 + grep caller=0

## 不验（Non-scope）

- worker ALS（resetStoreInfo + parse-walk getters）不动——不验
- storeInfo/sctx.storeInfo 不动——不验
- compiler/* 不动——不验（现有 compiler spec 自动覆盖）
