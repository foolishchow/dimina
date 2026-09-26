# Design Draft — fe-tools-scratch-internalize

Status authority: [Action Status](../STATUS.md)

> **状态：in_progress**——D-SI-1..6 **已 review lock**（10 轮 readiness review：R1-R8 全 findings 修正 + R9+R10 连续 0-finding 收敛——含 F-R1-1 dev 模式实证 / F-R2-1 computeStoreInfo pathInfo? 参数 / F-R2-2 BaseOutput 内联 / F-R4-1/2 constructor 签名）。基于 scratch 流 source-audit + storeInfo/env-l1 backflow。

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
export abstract class BaseOutput implements Output {
	declare readonly scratch: string  // non-enumerable（Object.defineProperty）
	protected constructor() {
		// 内联 mkdtemp（不调 env-compute.computePathInfo——F-R2-2 自包含）
		// 优先 TARGET_PATH env（permanent）；否则 mkdtemp 临时分配
		const s = process.env.TARGET_PATH
			?? fs.mkdtempSync(path.join(process.env.GITHUB_WORKSPACE || os.tmpdir(), 'dimina-fe-dist-'))
		Object.defineProperty(this, 'scratch', { value: s, writable: false, enumerable: false, configurable: false })
	}
	// ...existing entries/_artifactIndex/add/read/getEntries/publish
}
```

- **`protected constructor()`**（F-R4-2——abstract class；子类 DiskOutput/MemOutput **须显式 `constructor() { super() }`**——实施 deviation：TS protected constructor 不自动合成子类 public constructor）
- **内联 mkdtemp 逻辑**（F-R2-2——BaseOutput 自包含，不调 env-compute.computePathInfo，避免 output.ts→store/env-compute 依赖；复刻 TARGET_PATH env / GITHUB_WORKSPACE / os.tmpdir / `dimina-fe-dist-` 前缀语义）
- **不设 `temporaryTargetPath` flag**（F-R4-1——flag 退役 0 caller，仅 computePathInfo compat 保留 for storeInfo wrapper；BaseOutput 只须 scratch 路径）
- **scratch non-enumerable**（实施 deviation——`Object.defineProperty(this, 'scratch', { enumerable: false })`：mkdtemp 随机路径不进 BuildResult.output 深对比，行为 0 纪律；property access 不受影响——`output.scratch` 仍可读）
- MemOutput / DiskOutput 显式 `constructor() { super() }` 继承 scratch

### D-SI-2 — orchestrator 投影 state.scratch

```
// orchestrator.ts L166 后
const output = request.outputMode === 'dev' ? new MemOutput() : new DiskOutput()
state.scratch = output.scratch  // 投影——consumer 仍读 state.scratch
```

- state 是 orchestrate 入参（caller 建）——orchestrator 收 state 后设 state.scratch
- **时序**：output 创建（L166）→ state.scratch 投影 → tasks.run（store.load/storeInfoCtx 不设 state.scratch）

### D-SI-3 — computeStoreInfo 收 pathInfo? 参数（F-R2-1 修正）

computeStoreInfo 去 mkdtemp 后，storeInfo wrapper 须 pathInfo.targetPath（compat 返回 + compat 写）。**方案**：computeStoreInfo 收 `pathInfo?` 参数（caller 传）——storeInfo wrapper 传 `computePathInfo(workPath)`（含 mkdtemp targetPath），storeInfoCtx 传 `{workPath}`（无 targetPath）。

```
// env-compute.ts
function computeStoreInfo(workPath, options, pathInfo?: PathInfo): { pathInfo: PathInfo, compilerOptions, graph, configInfo, npmResolver } {
	// pathInfo 由 caller 传：storeInfo wrapper 传 computePathInfo（含 mkdtemp），
	// storeInfoCtx 传 {workPath}（无 targetPath——orchestrate 链路用 output.scratch）
	const localPathInfo: PathInfo = pathInfo ?? { workPath }
	const localCtx: CompilerContext = { pathInfo: localPathInfo, ... }
	...graph.build/reconcile(toPackerContext(localCtx))...  // graph.build 不读 targetPath（实证 graph.ts:12）
	return { pathInfo: localPathInfo, ... }
}

export function storeInfoCtx(ctx: PackerContext, graph: PackerGraph, _state: PackerSessionState): void {
	// D-SI-3: state 参数保留（store.load 契约）但标记不用——mkdtemp 内化入 BaseOutput，
	// orchestrator 预设 state.scratch = output.scratch（投影）。storeInfoCtx 不设 state.scratch。
	computeStoreInfo(ctx.workPath, { graph })  // pathInfo 默认 {workPath}——不 mkdtemp
}
```

- computeStoreInfo 用传入 pathInfo 建 localCtx（storeInfo wrapper 传含 targetPath——行为等价现状；storeInfoCtx 传只 workPath——graph.build 不读 targetPath 实证安全）
- storeInfoCtx 不覆盖 state.scratch（orchestrator 已预设）
- graph.build 实证不读 ctx.targetPath（graph.ts:12 注释「不经 ALS」+ R2 复查 grep 无 targetPath 读）

### D-SI-4 — storeInfo compat wrapper 保留 mkdtemp

```
// env.ts
function storeInfo(workPath, options): {...} {
	// F-R2-1：传 computePathInfo(workPath) 作 pathInfo 参数（含 mkdtemp targetPath）
	const r = computeStoreInfo(workPath, options, computePathInfo(workPath))
	// r.pathInfo 含 targetPath（来自 computePathInfo）——compat 写 + return 不变
	...
}
```

**方案（F-R2-1 锁定）**：
- storeInfo wrapper = computeStoreInfo(workPath, options, **computePathInfo(workPath)**)（传含 mkdtemp targetPath 的 pathInfo）+ compat 写（context.pathInfo = r.pathInfo 含 targetPath）+ return（pathInfo 含 targetPath）
- computePathInfo 保留 env-compute export（storeInfo wrapper 用——含 mkdtemp + TARGET_PATH env 分支）
- BaseOutput **内联** mkdtemp（F-R2-2 锁定——不调 computePathInfo，Output 层自包含）

**computePathInfo 去留（F-R2-2 锁定）**：computePathInfo 保留 env-compute（storeInfo compat wrapper 用）；BaseOutput **内联** mkdtemp 逻辑（不调 computePathInfo——output.ts 自包含，不依赖 env-compute）。

### D-SI-5 — dev 模式 scratch 语义（F-R1-1 实证已解）

dev 模式（MemOutput）实证（R1 audit）：
- `dev-server.ts:160` `outputRef?.output?.read(artifactPath)`——dev 读内存 **Output.read**（MemOutput entries），miss → fs fallback。dev **不读 scratch fs**。
- 但 dev 仍跑 dist-preparer（`createDist(scratch)` 删+mkdir——scratch 空/无则 `path.join` 崩）+ config-compiler（`compileConfig` 写 app-config.json 到 scratch——空路径崩）+ npm-builder（NpmBuilder 写 scratch）——dev **须 scratch 路径防崩**。
- MemOutput publish no-op（dev 不 publish 到 final）——但 scratch fs 写冗余（dev server 不读）。

**结论**：dev **须 mkdtemp**（createDist/compileConfig/npm-builder 防崩）——**MemOutput 也 mkdtemp，BaseOutput 共用正确**。dev 产物（Output.read 内存）不受 mkdtemp 影响（行为 0）。

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

## 4. 风险（R1-R4 全解，仅留现状注记）

1. ~~dev 模式 scratch 语义~~（D-SI-5——**F-R1-1 实证已解**）：dev 须 mkdtemp（createDist/compileConfig/npm-builder 防崩）——MemOutput 也 mkdtemp，BaseOutput 共用。dev server 读 Output.read 内存不受影响。
2. ~~storeInfo compat wrapper mkdtemp 双源~~（D-SI-4——**已解 F-R2-1**）：storeInfo compat wrapper 独立 mkdtemp（调 computePathInfo），测试直调 storeInfo 不走 orchestrate——独立 mkdtemp 无冲突。compile-cli-cache 唯一性测试 storeInfo wrapper mkdtemp 保留 → pass（vitest 验证）。
3. ~~computePathInfo 去留~~ **已解（F-R2-2）**：computePathInfo 保留 env-compute（storeInfo compat wrapper 用——传 computeStoreInfo pathInfo 参数）；BaseOutput **内联** mkdtemp（不调 computePathInfo——output.ts 自包含，不依赖 env-compute）。
4. ~~TARGET_PATH env 分支~~（**现状注记已补 F-R1-2**）：computePathInfo 优先 TARGET_PATH（非 mkdtemp）。BaseOutput 内联复刻（行为 0——TARGET_PATH 设时 scratch = TARGET_PATH）。现状风险（createDist 删 TARGET_PATH）+ watch 泄漏见下方注记。

**现状风险注记（F-R1-2，非本 Action scope）**：`createDist(scratch)`（output.ts:97）`fs.rmSync(scratch, recursive, force)` **不区分 temporary/permanent**——TARGET_PATH env 设时 scratch=TARGET_PATH，createDist 删 TARGET_PATH（用户目录）。`temporaryTargetPath` flag 0 caller（grep 确认）——flag 退役但 createDist 删行为不变。此为**现状行为**（行为 0 保持，BaseOutput 复刻不改变）；修复（createDist 区分 permanent 跳删）属独立 follow-up，不在本 Action scope。

**watch rebuild mkdtemp 泄漏注记（F-R3-1，非本 Action scope）**：`watch-runner.ts:91/96/128` 复用 sessionState + 每次 `build`→new output（new mkdtemp）——旧 output.scratch（mkdtemp 临时目录）退役未清理。此为**现状行为**（computePathInfo 也每次 mkdtemp 泄漏，本 Action 不引入）。BaseOutput 持 scratch 后可加 `finalize()` 清理（属独立 follow-up，非本 Action scope）。

## 5. Non-scope 守

- compat 写不动（storeInfo wrapper 保留 compat 写 + mkdtemp）
- L2/L3 不动（getters/resetStoreInfo/singleton/Proxy 保留）
- compiler/* 不动
- consumer 读源不改（state.scratch 投影保持）
- PackerContext dedup 不处理
- dev 模式 Output 形态不改（MemOutput publish no-op 保留）

## 6. scope 取舍

mkdtemp 归属正位（storeInfo 计算 → Output I/O）+ state.scratch 投影（最小改动 consumer 不改）。**不碰 compat 写**（backflow 保留）+ **不碰 L2/L3**（阶段 3）+ **不碰 consumer 读源**（投影保持）。
