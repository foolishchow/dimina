# Design Draft — fe-tools-scratch-internalize

Status authority: [Action Status](../STATUS.md)

> **状态：draft**——D-SI-1..N 待 readiness review lock。基于 scratch 流 source-audit + storeInfo/env-l1 backflow。

## 1. scratch 流现状（source-audit）

| 环节 | 位置 | 性质 | 内化决策 |
|---|---|---|---|
| **mkdtemp** | `env-compute.computePathInfo`（L1 计算） | TEMP 原子分配 | 迁 BaseOutput 构造（I/O 层） |
| **state.scratch 源** | `storeInfoCtx` 设（= computePathInfo.targetPath） | storeInfo 链路 | 改 orchestrator 预设（= output.scratch 投影） |
| **computeStoreInfo** | env-compute（调 computePathInfo mkdtemp） | L1 计算 + mkdtemp | 去 mkdtemp（pathInfo 只 workPath） |
| **storeInfoCtx** | env-compute（设 state.scratch） | orchestrate 链路 | 不设 state.scratch（orchestrator 预设） |
| **storeInfo wrapper** | env.ts（调 computeStoreInfo + compat 写） | compat + 测试 fixture | 保留 mkdtemp（compat——compile-cli-cache 唯一性测试） |
| **state.scratch 消费方** | dist-preparer/publisher/config-compiler-collab/npm-builder/stage-dispatcher/config-collector/buildResetStoreInfoData | 7 处读 state.scratch | 不改（投影保持——state.scratch = output.scratch） |
| **DiskOutput.publish** | output.ts:197（opts.scratch） | 从 opts 读 | 不改（opts.scratch = state.scratch = output.scratch） |
| **Output 创建** | orchestrator.ts:166（mode-aware） | dev→MemOutput / disk→DiskOutput | 加 state.scratch 投影 |

## 2. 内化策略（方案：BaseOutput 持 scratch + 投影）

**mkdtemp 归属**：BaseOutput 构造（I/O 层拥有 TEMP 生命周期）。
**state.scratch 源**：orchestrator 投影（output.scratch → state.scratch），consumer 不改读源。
**storeInfo compat**：保留 mkdtemp（测试 fixture backflow）。

### D-SI-1 — BaseOutput 构造 mkdtemp

```
class BaseOutput {
	readonly scratch: string
	constructor() {
		this.scratch = computePathInfo-style mkdtemp  // 复刻 computePathInfo 的 mkdtemp 逻辑
	}
}
```

- 复刻 `computePathInfo` 的 mkdtemp 语义（TARGET_PATH env / GITHUB_WORKSPACE / os.tmpdir / `dimina-fe-dist-` 前缀）
- **TARGET_PATH env**：computePathInfo 优先 `process.env.TARGET_PATH`（非 mkdtemp）。BaseOutput 须复刻此分支？若 TARGET_PATH 设 → scratch = TARGET_PATH（非临时）。须保留 env 分支（行为 0）。
- MemOutput / DiskOutput 构造调 super()（继承 scratch）

### D-SI-2 — orchestrator 投影 state.scratch

```
// orchestrator.ts L166 后
const output = request.outputMode === 'dev' ? new MemOutput() : new DiskOutput()
state.scratch = output.scratch  // 投影——consumer 仍读 state.scratch
```

- state 是 orchestrate 入参（caller 建）——orchestrator 收 state 后设 state.scratch
- **时序**：output 创建（L166）→ state.scratch 投影 → tasks.run（store.load/storeInfoCtx 不设 state.scratch）

### D-SI-3 — computeStoreInfo/storeInfoCtx 去 mkdtemp

```
// env-compute.ts
function computeStoreInfo(workPath, options): { pathInfo: { workPath }, compilerOptions, graph, configInfo, npmResolver } {
	// 去 computePathInfo mkdtemp——pathInfo 只 workPath
	const localPathInfo: PathInfo = { workPath }  // 不算 targetPath
	...graph.build/reconcile(toPackerContext(localCtx))...
	return { pathInfo: localPathInfo, ... }
}

function storeInfoCtx(ctx, graph, state): void {
	const r = computeStoreInfo(ctx.workPath, { graph })
	// 不设 state.scratch——由 orchestrator 预设（= output.scratch）
	// state.scratch = r.pathInfo.targetPath!  ← 删
}
```

- computeStoreInfo 返回 pathInfo 只 workPath（targetPath 退役——orchestrate 链路用 output.scratch）
- storeInfoCtx 不覆盖 state.scratch（orchestrator 已预设）

### D-SI-4 — storeInfo compat wrapper 保留 mkdtemp

```
// env.ts
function storeInfo(workPath, options): {...} {
	// compat: 自己 mkdtemp（computeStoreInfo 去了——wrapper 须补，测试 fixture 依赖）
	const localPathInfo = computePathInfo(workPath)  // 保留 mkdtemp
	const r = computeStoreInfo(workPath, options)  // 但 computeStoreInfo 去 mkdtemp 了...
	// 矛盾：computeStoreInfo 去 mkdtemp 后 pathInfo 无 targetPath，wrapper 须自补
	...
}
```

**矛盾**（readiness gap 4）：computeStoreInfo 去 mkdtemp 后 pathInfo 无 targetPath。storeInfo wrapper 须自己 mkdtemp 设 pathInfo.targetPath（compat 返回值 + compat 写 context.pathInfo）。

**方案**：
- storeInfo wrapper = computeStoreInfo（pathInfo 只 workPath）+ 自己 mkdtemp 补 pathInfo.targetPath + compat 写（context.pathInfo = 补后 pathInfo）+ return（pathInfo 含 targetPath）
- computePathInfo 保留 env-compute export（storeInfo wrapper 用 + BaseOutput 用？或 BaseOutput 内联 mkdtemp）

**computePathInfo 去留**：storeInfo wrapper 用 + BaseOutput 用。computePathInfo 保留 env-compute（storeInfo compat + BaseOutput 共用）？或 BaseOutput 内联（不依赖 env-compute）？

**倾向**：computePathInfo 保留 env-compute（storeInfo compat wrapper 用）；BaseOutput 内联 mkdtemp 逻辑（不依赖 env-compute——Output 层独立）。或 BaseOutput 调 computePathInfo（env-compute → output 依赖？output.ts import env-compute——循环？output.ts 已 import? 让me 确认）。

### D-SI-5 — dev 模式 scratch 语义（readiness gap 1）

dev 模式（MemOutput）：
- MemOutput publish no-op（dev 不写盘）
- 但 config-compiler/npm-builder/dist-preparer 仍写 state.scratch（dev 也 mkdtemp？）

**audit 待决**：
- dev 链路是否真用 scratch fs？（dev server 读 Output.read 内存 vs scratch fs？）
- 若 dev 不须 scratch → MemOutput 跳过 mkdtemp（state.scratch 空？config-compiler 写空路径崩？）
- 若 dev 须 scratch → MemOutput 也 mkdtemp（BaseOutput 共用）

### D-SI-6 — 行为 0 + non-scope 守

tsc 0 + vitest 88/88 + 7-diff=0。compat 写不动 / L2/L3 不动 / compiler/* 不动 / consumer 不改读源。

## 3. 内化路径

| 步 | 内容 | 效果 |
|---|---|---|
| 1 | BaseOutput 构造 mkdtemp（scratch 属性）+ TARGET_PATH env 分支复刻 | mkdtemp 迁 Output 层 |
| 2 | orchestrator L166 后 state.scratch = output.scratch 投影 | state.scratch 源改 |
| 3 | computeStoreInfo 去 mkdtemp（pathInfo 只 workPath）+ storeInfoCtx 不设 state.scratch | storeInfo 链路去 mkdtemp |
| 4 | storeInfo compat wrapper 补 mkdtemp（computePathInfo 保留 env-compute） | 测试 fixture 不变 |
| 5 | 行为 0 全量验证 | 7-diff=0 |

## 4. 风险

1. **dev 模式 scratch 语义**（D-SI-5）：MemOutput 是否真须 mkdtemp。须 audit dev 链路（dev server 读 Output.read vs scratch fs；config-compiler 写 scratch 是否 dev 必需）。**若 dev 不须 → MemOutput 跳过 mkdtemp，state.scratch 须 dev/disk 分支**。
2. **storeInfo compat wrapper mkdtemp 双源**（D-SI-4）：测试直调 storeInfo（compat mkdtemp）不走 orchestrate（Output mkdtemp）——独立 mkdtemp。须确认 compile-cli-cache 唯一性测试仍 pass（storeInfo wrapper mkdtemp 保留 → 应 pass）。
3. **computePathInfo 去留**：storeInfo compat + BaseOutput 共用？BaseOutput 内联 vs 调 env-compute（output.ts import env-compute 循环？须确认 output.ts 现有 imports）。
4. **TARGET_PATH env 分支**：computePathInfo 优先 TARGET_PATH（非 mkdtemp）。BaseOutput 须复刻（行为 0——TARGET_PATH 设时 scratch = TARGET_PATH）。

## 5. Non-scope 守

- compat 写不动（storeInfo wrapper 保留 compat 写 + mkdtemp）
- L2/L3 不动（getters/resetStoreInfo/singleton/Proxy 保留）
- compiler/* 不动
- consumer 读源不改（state.scratch 投影保持）
- PackerContext dedup 不处理
- dev 模式 Output 形态不改（MemOutput publish no-op 保留）

## 6. scope 取舍

mkdtemp 归属正位（storeInfo 计算 → Output I/O）+ state.scratch 投影（最小改动 consumer 不改）。**不碰 compat 写**（backflow 保留）+ **不碰 L2/L3**（阶段 3）+ **不碰 consumer 读源**（投影保持）。
