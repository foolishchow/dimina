# fe-tools-scratch-internalize

- Action: `fe-tools-scratch-internalize`
- Status: `complete`
- Created: 2026-10-10
- Status authority: [Action Status](../../../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-SI-1..6 已 review lock**——10 轮 readiness review 收敛 R9+R10 连续 0-finding）
- 实施计划：[implementation-plan.md](implementation-plan.md)
- 验证：[validation.md](validation.md)
- 背景：[`fe-tools-storeinfo-collapse`](../fe-tools-storeinfo-collapse/README.md)（scratch 内化 backflow）+ [`fe-tools-env-l1-extract`](../fe-tools-env-l1-extract/README.md)（scratch 内化 follow-up）+ [`fe-tools-packer-output-abstraction`](../fe-tools-packer-output-abstraction/README.md)（DiskOutput 封装 scratch→final）

## Background

storeInfo 塌缩（fe-tools-storeinfo-collapse）+ env.ts L1 迁出（fe-tools-env-l1-extract）均记录 backflow：**scratch 内化推迟**——`DiskOutput.publish 内化 mkdtemp（须重构 config-compiler/npm-builder 写 DiskOutput.scratch）`。

**现状 scratch 流**（source-audit）：
- mkdtemp 在 `env-compute.computePathInfo`（storeInfo 链路）→ `storeInfoCtx` 设 `state.scratch = pathInfo.targetPath`
- `state.scratch` 消费方（7 处）：dist-preparer / publisher / config-compiler-collab / npm-builder / stage-dispatcher / config-collector（buildFixpointCtx）/ env-compute（buildResetStoreInfoData）
- `DiskOutput.publish`（output.ts:197）从 `opts.scratch` 读（per-request，publisher 传）
- `types.ts:419` 注释明示：「scratch 路径（per-request TEMP——D-SC1 后 sctx.state.scratch；**后续 DiskOutput 内化 mkdtemp**）」

**概念问题**：mkdtemp（TEMP 目录原子分配）是 Output 的 I/O 职责，却由 storeInfo 链路（computePathInfo，L1 计算）承载——概念错位。storeInfo/graph bootstrap 不应关心 TEMP 目录创建。

## Goal

mkdtemp 从 storeInfo 链路（computePathInfo）内化到 **Output 层**（BaseOutput 构造时 mkdtemp，dev/disk 共用）；`state.scratch` 改为 `output.scratch` 投影（orchestrator 预设）；`computeStoreInfo`/`storeInfoCtx` 去 mkdtemp；`storeInfo` compat wrapper 保留 mkdtemp（测试 fixture backflow——compile-cli-cache 唯一性测试不变）。

mkdtemp 归属正位：Output（I/O 层）拥有 TEMP 目录生命周期；storeInfo/graph（计算层）不碰 mkdtemp。

## Non-goals

- **compat 写不动**（storeInfo wrapper 保留 compat 写 + mkdtemp——测试 fixture backflow，推迟为阶段 3）
- **L2/L3 不动**（getters/resetStoreInfo/singleton/Proxy 保留——阶段 3）
- **compiler/* 不动**（parse-walk 仍读 ALS getters——阶段 3）
- **PackerContext 构造 dedup 不处理**（独立 follow-up）
- **consumer 读源不改**（config-compiler/npm-builder/dist-preparer/publisher 仍读 state.scratch——投影保持，最小改动）
- **dev 模式 Output 形态不改**（MemOutput publish no-op 保留——仅 scratch 创建源改）

## Design inputs

- storeInfo 塌缩 backflow：[`fe-tools-storeinfo-collapse`](../fe-tools-storeinfo-collapse/README.md) Non-goals（scratch 内化）
- env-l1 backflow：[`fe-tools-env-l1-extract`](../fe-tools-env-l1-extract/README.md) Non-goals（scratch 内化）
- Output 抽象：[`fe-tools-packer-output-abstraction`](../fe-tools-packer-output-abstraction/README.md)（DiskOutput 封装 scratch→final；D-O1..7 + D-OL1..4）
- env-compute 现状：`computePathInfo`（mkdtemp）+ `storeInfoCtx`（设 state.scratch）+ `computeStoreInfo`
- types.ts:419 注释（「后续 DiskOutput 内化 mkdtemp」）

## Requirements

详见 [requirements.md](requirements.md)。

## Proposed design

详见 [design.draft.md](design.draft.md)。核心：

1. BaseOutput 构造 mkdtemp（`scratch` 属性，dev/disk 共用）
2. orchestrator 创建 output 后设 `state.scratch = output.scratch`（投影）
3. computeStoreInfo 去 mkdtemp（pathInfo 只 workPath）+ storeInfoCtx 不设 state.scratch（orchestrator 预设）
4. storeInfo compat wrapper 保留 mkdtemp（测试 fixture——compile-cli-cache 唯一性测试不变）

## Readiness gaps

**原 4 项经 5 轮 readiness review（R1-R5）全解**：

1. ~~dev 模式 scratch 语义~~ **已解（F-R1-1）**：dev 须 mkdtemp（createDist/compileConfig/npm-builder 防崩）——MemOutput 也 mkdtemp，BaseOutput 共用。dev server 读 Output.read 内存不受影响。
2. ~~BaseOutput vs DiskOutput 持 scratch~~ **已解（F-R1-1）**：MemOutput 也须 mkdtemp（dev 防崩）→ BaseOutput 共用（dev/disk 同源）。
3. ~~state.scratch 投影 vs 退役~~ **已解（F-R2-1）**：投影保留（consumer 不改读源，最小改动）——state.scratch = output.scratch 投影。
4. ~~storeInfo compat mkdtemp 双源~~ **已解（F-R2-1）**：storeInfo compat wrapper 独立 mkdtemp（调 computePathInfo），测试直调不走 orchestrate——无冲突。

**当前无 open 设计 gap**（实施期验证项：D-SI-3 computeStoreInfo pathInfo? 参数行为等价 + D-SI-4 storeInfo compat mkdtemp compile-cli-cache 测试——vitest 覆盖）。

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-SI-1..6 done——行为 0 三件套达成）

## Implementation deviations（P-SI-1..3 实施期发现，已回填 design）

1. **scratch non-enumerable**（`Object.defineProperty` enumerable:false）——mkdtemp 随机路径不进 BuildResult.output 深对比（lifecycle-integration.spec:281 toEqual——行为 0 纪律）；property access 不受影响。
2. **MemOutput/DiskOutput 显式 `constructor() { super() }`**——TS protected constructor 不自动合成子类 public constructor（须显式 super 调）。
3. **storeInfoCtx `_state` 参数**——noUnusedLocals（state 保留 store.load 契约但不再使用——mkdtemp 内化后 storeInfoCtx 不设 state.scratch）。
- 行为 0 三件套绿（tsc 0 + vitest 88/88 + 7-diff=0）
- grep `computePathInfo` mkdtemp caller=0（orchestrate 链路）+ `state.scratch` 源 = output.scratch 投影
- storeInfo compat wrapper mkdtemp 保留（测试 fixture backflow）
- backflow：阶段 3（worker ALS 退役）+ PackerContext dedup 留 follow-up
