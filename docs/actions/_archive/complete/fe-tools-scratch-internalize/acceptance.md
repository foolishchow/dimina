# Acceptance — fe-tools-scratch-internalize

Status authority: [Action Status](../../../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-SI-1 | R-SI-1 | BaseOutput 构造 mkdtemp | `BaseOutput` 加 `readonly scratch: string` + 构造 mkdtemp（复刻 computePathInfo 的 TARGET_PATH env / GITHUB_WORKSPACE / os.tmpdir / `dimina-fe-dist-` 前缀）；MemOutput/DiskOutput 继承（super 调）；dev 模式 MemOutput 也 mkdtemp（F-R1-1——dev 防崩）；tsc 0 | done |
| A-SI-2 | R-SI-2 | orchestrator 投影 state.scratch | orchestrator.ts L166 后 `state.scratch = output.scratch`；state 创建时序正确（output 创建→投影→tasks.run）；tsc 0 | done |
| A-SI-3 | R-SI-3 | computeStoreInfo/storeInfoCtx 去 mkdtemp | `computeStoreInfo` pathInfo 只 workPath（无 targetPath）；`storeInfoCtx` 不设 state.scratch（删 `state.scratch = ...`）；graph.build 仍用 ctx.workPath（不读 targetPath）；tsc 0 | done |
| A-SI-4 | R-SI-4 | storeInfo compat wrapper 保留 mkdtemp | `storeInfo` compat wrapper 自己 mkdtemp（调 computePathInfo 保留）+ 返回 pathInfo.targetPath + compat 写 context.pathInfo；compile-cli-cache.spec mkdtemp 唯一性测试 pass（测试 fixture 不变）；tsc 0 | done |
| A-SI-5 | R-SI-5 | 行为 0 | tsc 0 + vitest 88/648（2 flaky solo pass——compile-cli-cache/session-unify）+ one-shot 7-diff=0（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui） | done |
| A-SI-6 | R-SI-6 | Non-scope 守 | compat 写不动（storeInfo wrapper 保留）+ L2/L3 不动（getters/resetStoreInfo 保留）+ compiler/* 不动 + consumer 读源不改（state.scratch 投影保持）+ PackerContext dedup 不处理 + dev Output 形态不改 | done |

## backflow（P-SI-3 后记录）

- 阶段 3（L2+L3 退役）：compiler/* 加 PackerContext + worker 模型调整 + singleton/getters/Proxy/resetStoreInfo 全删
- PackerContext 构造 dedup（buildPackerContext/buildFixpointCtx/toPackerContext 三同质）
- compat 写保留（storeInfo wrapper mkdtemp + compat 写——阶段 3 退役）
