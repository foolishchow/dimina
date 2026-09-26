# Implementation Plan — fe-tools-scratch-internalize

Status authority: [Action Status](../../../STATUS.md)

## 分相（行为 0 每相 gate）

### P-SI-1 — BaseOutput 构造 mkdtemp（A 批：添加）

1. `output.ts` BaseOutput 加 `readonly scratch: string` 属性 + 构造 mkdtemp（复刻 computePathInfo 的 TARGET_PATH env / GITHUB_WORKSPACE / os.tmpdir / `dimina-fe-dist-` 前缀）
2. MemOutput / DiskOutput 构造调 super()（继承 scratch）
3. dev 模式（MemOutput）mkdtemp——若 readiness audit 证 dev 不须则分支（readiness gap 1）
4. tsc 0

### P-SI-2 — orchestrator 投影 + storeInfo 链路去 mkdtemp（B 批：wire）

1. orchestrator.ts L166 后：`state.scratch = output.scratch`（投影）
2. env-compute.ts `computeStoreInfo` 收 `pathInfo?` 参数（F-R2-1——caller 传：storeInfoCtx 传 {workPath}，storeInfo wrapper 传 computePathInfo）
3. env-compute.ts `storeInfoCtx` 不设 state.scratch（orchestrator 预设——删 `state.scratch = r.pathInfo.targetPath!`）
4. env.ts `storeInfo` compat wrapper 调 computeStoreInfo(workPath, options, **computePathInfo(workPath)**)（传含 mkdtemp targetPath 的 pathInfo——compat 返回 + compat 写不变）
5. computePathInfo 保留 env-compute（storeInfo compat wrapper 用——F-R2-2；BaseOutput 内联 mkdtemp 不调）
6. tsc 0

### P-SI-3 — 行为 0 全量验证（C 批：验）

1. tsc 0（`node ./node_modules/typescript/bin/tsc --noEmit`）
2. vitest 88/88（flaky solo pass——含 compile-cli-cache mkdtemp 唯一性测试）
3. one-shot 7-diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）
4. grep `computePathInfo` mkdtemp 在 orchestrate 链路 caller=0（storeInfoCtx 不调）+ `state.scratch = output.scratch` 在 orchestrator 非 0

## 验证点

- P-SI-1 后：BaseOutput.scratch 非 0 + MemOutput/DiskOutput 继承 + tsc 0
- P-SI-2 后：orchestrator 投影生效 + computeStoreInfo 收 pathInfo? 参数（storeInfoCtx 传 {workPath} 无 targetPath；storeInfo wrapper 传 computePathInfo 含 targetPath）+ storeInfo wrapper compat mkdtemp + tsc 0
- P-SI-3：行为 0 三件套绿 + compile-cli-cache 唯一性测试 pass（storeInfo compat mkdtemp 保留）

## 风险点

- ~~D-SI-5 dev 模式~~（**F-R1-1 已解**）：dev 须 mkdtemp（防崩）——P-SI-1 步 3 MemOutput 也 mkdtemp（BaseOutput 共用）
- ~~D-SI-4 storeInfo compat 双源~~（**F-R2-1 已解**）：storeInfo wrapper 独立 mkdtemp（computePathInfo），测试不走 orchestrate——P-SI-2 步 4 compile-cli-cache 测试 vitest 验证
- **P-SI-1/P-SI-2 atomic**：BaseOutput mkdtemp + orchestrator 投影 + storeInfo 链路去 mkdtemp 须 atomic（否则 state.scratch 无源）。建议合并单 commit。
