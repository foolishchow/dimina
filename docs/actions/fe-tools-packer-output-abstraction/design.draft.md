# Design Draft — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

> D-O1..7 待 review lock。本文档基于 [`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) + [`2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md) 讨论。Review round 1-3 findings F1-F12 已修正。

## §1 现状 output 机制（4 概念缠结）

### 1.1 数据流

```
worker compile → postMessage(EmitEntry) → 主线程
  → BuildModel.add(entry)                    [内存累积，entries Map + dirty set]
  → (one-shot/previewAdapter) materialize(model, TEMP)   [内存→盘 flush，dirty guard]
  → publishToDist(TEMP → FINAL)              [rename/copy/incremental sync]
  → (dev server 读)
      artifactResolver(path) = getArtifact   [内存 lazy index 读]
      miss → fs.readFile(serveRoot)           [盘读 fallback，非编译资产]
```

### 1.2 现有概念职责

| 概念 | 文件 | 职责 |
|---|---|---|
| BuildModel | emit/build-model.ts | 内存累积器：entries Map + add + getArtifact（lazy index）+ getDirtyEntries + clearDirty |
| materialize | emit/build-model.ts L104 | 内存→盘 flush：dirty 非空只写 dirty，空全量；mkdir+writeFileSync+String(map)；clearDirty |
| publishToDist | emit/publish.ts L106 | 盘→盘：buildDir(TEMP)→final；rename(同 fs)/copy+rm scratch(EXDEV)/incremental sync(content-diff) |
| createDist | emit/publish.ts L22 | 建 scratch：getTargetPath() + rmSync + mkdirSync + seed copy |
| artifactResolver | dev-server 注入 | dev 读：getArtifact 内存 → miss fs.readFile(serveRoot) |
| skipMaterialize | publisher L31 guard | mode 开关：dev(true 跳 materialize)/one-shot(false) |
| getTargetPath() | env.ts getter | 经 compat 写读 defaultCompilerContext.pathInfo.targetPath（TEMP scratch） |

### 1.3 张力

- **memory/disk 双路平行**——BuildModel（memory 累积+读）vs materialize/publishToDist（disk 写+复制），skipMaterialize 开关切换
- **targetPath 双语义**——PackerContext.targetPath（FINAL）vs sctx.storeInfo.pathInfo.targetPath/getTargetPath()（TEMP scratch）
- **compat 写 output 角色 load-bearing**——getTargetPath 喂 createDist/materialize/publishToDist
- **memfs 特殊路径**——dev 直读 BuildModel + skipMaterialize 是 mode-specific 分支

## §2 Output 抽象（D-O1..7）

### §2.0 Output 生命周期（F1 修正——必须先 lock，是 P-O1 实施前提）

**现状 buildModel 流**（Output 须同构替代）：
```
config-collector 设 sctx.buildModel = new BuildModel()
  → stage compile onOutput (orchestrator L83/85) → sctx.buildModel.add(entry)  [累积]
  → orchestrator L294: result.buildModel = (context as {buildModel?}).buildModel  [→ BuildResult]
  → session L244: state.buildModel = buildResult.buildModel  [首 build 持有]
  → session L255: build:end listener → state.buildModel = result?.buildModel  [每 rebuild 替换]
  → session L249: artifactResolver = state.buildModel?.getArtifact(path)  [dev server 读]
```

**Output 替代后同构流**（D-OL1..4 locked）：

- **D-OL1（方案 B——orchestrator 入口创建，mode-aware 点 + listr2 ctx 注入，F-R4-3 lock）**：Output impl 选择依赖 mode（skipMaterialize），mode 在 orchestrator request（L143）——**不在 config-collector 创建**（config-collector deps 不含 mode）。orchestrator `orchestrate()` 入口（L121 request 构造后）创建：
  ```ts
  const output = request.skipMaterialize
    ? new MemOutput()
    : new DiskOutput(ctx.targetPath)  // final = ctx.targetPath（mode-dep：dev=mkdtemp dmcc-dev- / one-shot=TARGET_PATH）
  ```
  **listr2 ctx 注入机制**（F-R4-3 实证）：`tasks.run({ output } as Record<string, unknown>)`（L292 改）——listr2 `run(ctx)` 接收 initial ctx 合并。Output 经 initial ctx 注入，config-collector 跑前 sctx.output 已存在（task 收 ctx.output）。**config-collector 删 `sctx.buildModel = new BuildModel()` 行**（L36），只消费 sctx.output（职责分离：orchestrator 决策 mode + 创建 Output；config-collector 只设其他 8 个 sctx 字段）。
- **D-OL2（F-R7-1 修正——sctx.buildModel.add 全 4 消费者 + read 3 迁入 sctx.output）**：
  - **add 路径全 4 处** → `sctx.output.add(entry)`（替代 sctx.buildModel.add）：
    1. orchestrator L83（runViewStage onOutput——default view renderer 路径）
    2. orchestrator L85（runStyleStage onOutput——default style renderer 路径）
    3. **stage-dispatcher L54**（dispatch 非 view/style 路径 onOutput `(sctx.buildModel).add(entry)`——logic/config dispatch 分支）
    4. **logic-emitter L42**（`buildModel.add(entry)`——logic emit 累积，非 onOutput，是 collaborator 主动累积）
  - **read 路径全 3 处** → `sctx.output`（替代 sctx.buildModel cast 读）：
    1. logic-emitter L37（`sctx.buildModel as BuildModel` cast → `sctx.output`，供 L42 add 用）
    2. publisher L34（`materialize(sctx.buildModel, ...)` → `output.publish`，D-O6）
    3. orchestrator L294（`result.buildModel = context.buildModel` → `result.output`，D-OL3）
- **D-OL3（F-R8-2 修正——L294 cast 显式）**：`BuildResult.buildModel` 字段演进——`types.ts` L503 `buildModel: BuildModel | undefined` → `output: Output | undefined`（同位替代）。orchestrator L294 `const buildModel = (context as {buildModel?: BuildModel}).buildModel` → `const output = (context as {output?: Output}).output`（cast 显式改）；L296 `entries: buildModel ? [...buildModel.entries.values()] : []` → `entries: output ? output.getEntries() : []`（F-R4-2）
- **D-OL4（dev server 持 OutputRef 窄接口读 state.output + F-R9-2 区分 SessionState vs PackerSessionState）**：session 持有 + rebuild 替换——L244 `state.output = buildResult.output`（首 build）；L255 `build:end` listener → `state.output = result?.output`（**每 rebuild 重新赋值 state.output 字段**，state 对象本身不变）；dev server **持 OutputRef 窄接口**（createServer params 收 `{ output: Output | undefined }`，F-R5-2 lock——避免暴露整个 PackerSessionState；preview-adapter 传 state，state 含 output 字段，结构子类型满足 OutputRef），dev server 内读 `outputRef.output?.read(path)`。
  - **F-R9-2 state 类型区分**：output 字段加到 **`SessionState`**（session/index.ts L59 `buildModel?: BuildModel` → `output?: Output`）——session 内部 state，持 buildModel 现态。**不加到 `PackerSessionState`**（state/session-state.ts class，orchestrator state 参数）——orchestrator 不持 output（经 sctx.output + result.output 流，不碰 state.output）。session L244/249/256 用 SessionState——output 字段只加 SessionState。

**关键**：Output 是**每 build 实例**（per-orchestrate，orchestrator 入口创建）。rebuild 时 result.output 重新赋值 state.output 字段（state 对象不变，字段更新）→ dev server 持 OutputRef 读 output 字段 → 读新 Output。dev server 不持 Output 首实例引用（会读旧），不持 closure getter（已选 OutputRef 窄接口方案，state 结构子类型满足）。

**final 来源**（DiskOutput 构造收）：`ctx.targetPath`（orchestrate 入参 = PackerContext.targetPath）——mode-dep：dev=mkdtemp dmcc-dev-（serveRoot/FINAL）/ one-shot=TARGET_PATH。MemOutput 不用 final（publish no-op）。DiskOutput.publish 内 mkdtemp scratch（TEMP，复刻 computePathInfo L334）——final 与 scratch 分离（消 targetPath 双语义）。

### D-O1 — Output interface

```ts
// types.ts
export interface PublishOpts {
  useAppIdDir?: boolean
  incremental?: boolean       // watch/compile-cache seedPath → content-diff sync
  seedPath?: string | null     // 增量复制旧产物根
  appId?: string
}

export interface Output {
  /** 累积 worker 流式产物（postMessage EmitEntry → 主线程调） */
  add(entry: EmitEntry): void
  /** 读产物（dev server 用——模式无关，读累积内存 lazy index，miss 返 null 走 fs fallback） */
  read(path: string): { code: string } | null
  /** 提交到 final（one-shot/previewAdapter：写 scratch + rename/copy；纯 dev：no-op） */
  publish(target: string, opts?: PublishOpts): void
  /** F-R4-2：BuildResult.entries 公开契约 sourced——返累积 EmitEntry[]（供 result.entries） */
  getEntries(): EmitEntry[]
}
```

**设计要点**：
- `add` 是累积语义（非直写）——保 dirty tracking（DiskOutput 增量 publish 须）+ lazy index（MemOutput/DiskOutput read 须，F-R4-1）
- `read` 模式无关——**读累积内存 lazy index**（MemOutput + DiskOutput 同语义，复刻 BuildModel.getArtifact），miss 返 null（caller 决定 fs fallback）。F-R4-1：previewAdapter-dev 须即时内存读（stage compile 后即可，不等 publish），DiskOutput.read 非 null
- `publish` target=FINAL——DiskOutput 内部管 scratch（mkdtemp）+ rename/copy；MemOutput no-op（实证见 D-O2）
- `getEntries` F-R4-2：BuildResult.entries 现状 `sourced from buildModel.entries.values()`（orchestrator L296），Output 替代后须此 accessor 供 result.entries。**F-R13-2**：Output.entries Map<string, EmitEntry>（替代 BuildModelEntry——结构同形：EmitEntry `{entryId, kind, files: EmitEntryFile[], sourcemaps?: EmitEntrySourcemap[]}` = BuildModelEntry `{entryId, kind, files: {path,code}[], sourcemaps?: {path,map}[]}`，迁移自然）；getEntries 返 EmitEntry[]（BuildResult.entries: EmitEntry[] types.ts L497）

### D-O2 — MemOutput impl（dev memfs）

```ts
class MemOutput implements Output {
  private entries = new Map<string, EmitEntry>()
  private index: Map<string, { code: string }> | null = null  // lazy

  add(entry) { this.entries.set(`${entry.kind}:${entry.entryId}`, entry); this.index = null }
  read(path) {
    if (!this.index) { /* build index from entries.files/sourcemaps — 复刻 getArtifact */ }
    return this.index.get(path) ?? null
  }
  getEntries() { return [...this.entries.values()] }  // F-R4-2：BuildResult.entries sourced
  publish() { /* no-op */ }
}
```

**F2 实证——MemOutput.publish no-op 可行性**：
- 纯 dev（无 previewAdapter，skipMaterialize=true）现状：
  - `createDist(seedPath)` 建 buildDir（mkdtemp dimina-fe-dist-）+ seed（但 seedPath=undefined → 不 seed → buildDir 空）
  - materialize 跳过 → buildDir 仍空
  - publishToDist 复制**空 buildDir** → serveRoot（mkdtemp dmcc-dev-，resolve.ts L143）→ **serveRoot 空**
  - dev server 读：compiled → artifactResolver 内存（hit）；SDK → sdkRoot（dev-server L153，独立）；非编译非 SDK → fs.readFile(serveRoot 空) → **miss → 404**（纯 dev 本就如此）
- **结论**：纯 dev serveRoot 本空（seedPath 缺 + materialize 跳）。MemOutput.publish no-op == 现状纯 dev（serveRoot 不被 seed，dev server 读内存 + sdkRoot，fs fallback miss 404）。**no-op 等价成立**。
- **previewAdapter-dev 不走 MemOutput**——走 DiskOutput（见 D-O4），因 previewAdapter 模式 skipMaterialize=false → materialize 写 → serveRoot 有内容 → dev server fs fallback 有命中（previewAdapter 需 serveRoot 有内容供 adapter 读）。

**行为 == 现状纯 dev memfs**（D-MM-1 直读 BuildModel + skipMaterialize + serveRoot 空）：entries Map + lazy index + add 失效 + publish no-op。

### D-O3 — DiskOutput impl（one-shot + previewAdapter disk）

```ts
class DiskOutput implements Output {
  private entries = new Map<string, EmitEntry>()
  private dirty = new Set<string>()
  private final: string  // FINAL 发布目录（构造收）

  add(entry) { const k = `${entry.kind}:${entry.entryId}`; this.entries.set(k, entry); this.dirty.add(k); this.index = null }
  private index: Map<string, { code: string }> | null = null  // lazy（add 失效，复刻 getArtifact）
  read(path) {
    if (!this.index) { /* build index from entries.files/sourcemaps — 复刻 BuildModel.getArtifact，F-R4-1 */ }
    return this.index.get(path) ?? null  // F-R4-1：读累积内存（非 null）——previewAdapter-dev 须即时内存读
  }
  getEntries() { return [...this.entries.values()] }  // F-R4-2：BuildResult.entries sourced
  publish(target, opts) {
    // 复刻 materialize + publishToDist + createDist（per-build mkdtemp，F3 + F-R10-1 temporary hardcode + F-R13-1 seed copy + F-R14-2 mkdtemp 注）：
    // 1. mkdtemp scratch（computePathInfo 语义——每 publish 新 mkdtemp，复刻 storeInfo per-orchestrate computePathInfo；**mkdtemp 总创新目录，不需 createDist L24-26 rmSync/mkdirSync**，F-R14-2）
    // 1b. **seed copy**（if opts.seedPath → copyDir(seedPath, scratch)，复刻 createDist L27-28，F-R13-1——incremental sync diff 正确性前提：scratch 须含上一轮 final seed + compiled，syncIncremental 才能算 diff）
    // 2. dirty 非空 → 只写 dirty；空 → 全量（materialize L105-106）
    // 3. 写 scratch：mkdir recursive + writeFileSync(dest, file.code) + writeFileSync(dest, String(map))
    // 4. publish scratch → target：**temporary=true hardcode**（mkdtemp 总临时，F-R10-1——不读 sctx.storeInfo.pathInfo.temporaryTargetPath）→ rename(同 fs) / copy+rm scratch(EXDEV) / incremental sync(content-diff, F-H4-2，依赖 1b seed + 3 compiled)
    // 5. clearDirty
  }
}
```

**F-R10-1 修正——DiskOutput.publish temporary hardcode + publisher 删 storeInfo.pathInfo 消费**：
- DiskOutput.publish 内 mkdtemp scratch → 总是 temporary → **hardcode temporary=true**（复刻 computePathInfo L334 mkdtemp + temporaryTargetPath=true）。不读 sctx.storeInfo.pathInfo.temporaryTargetPath。
- **publisher deps 删 sctx.storeInfo.pathInfo 消费**（targetPath buildDir + temporaryTargetPath 标志）——storeInfo 返回值 output 消费方死。publisher 不再读 sctx.storeInfo.pathInfo（buildDir/temporaryTargetPath），只调 output.publish(target, opts)。
- compat 写 getter fallback 消费方死：publishToDist L116 `isTemporary ?? isTemporaryTargetPath()` fallback——DiskOutput.publish hardcode temporary=true 后不调 isTemporaryTargetPath()（D-O7 殁骸补，F-R11-2）。

**F-R10-2 修正——read 共用 BaseOutput abstract base**：MemOutput/DiskOutput 共用 read 逻辑（lazy index from entries，add 失效）——lock **abstract `BaseOutput`**（含 entries Map<string, EmitEntry> + index + read + getEntries + add 通用）。**F-R13-3 BaseOutput.add virtual**：add 是 virtual（abstract 或 concrete + override），DiskOutput override 加 dirty 标记（super.add + dirty.add + index=null，H4 D-PUSH-3），MemOutput 用 BaseOutput.add。MemOutput extend（publish no-op）+ DiskOutput extend（加 dirty + publish）。`emit/output.ts` 含 base + 2 impl（§6）。

**F-R4-1 修正——DiskOutput.read 语义**：**读累积内存 lazy index**（与 MemOutput 同语义，复刻 BuildModel.getArtifact），**非返 null**。理由：previewAdapter-dev 现状 `artifactResolver = state.buildModel?.getArtifact(path)`（**内存即时读**，stage compile 后即可，不等 publish）。若 DiskOutput.read 返 null → dev server 走 fs fallback serveRoot → 须等 publish 完成（时序改 + 读路径内存→盘）。故 DiskOutput.read 须内存读（F-R4-3 验证 previewAdapter rebuild 读时序——内存读比 fs fallback 早，更安全）。one-shot 不调 read（无 dev server），但 interface 统一内存读语义。read 逻辑共用 BaseOutput（F-R10-2）。

**F3 修正——scratch mkdtemp 生命周期**：**per-build**（每 publish 调用内 `mkdtemp`），非构造时。复刻现状 storeInfo per-orchestrate `computePathInfo` mkdtemp（orchestrator 每 orchestrate 调 storeInfo → mkdtemp）。构造时只持 `final`（FINAL 发布目录）。

**行为 == 现状 one-shot/previewAdapter**（materialize + publishToDist + createDist）：
- dirty tracking（H4 D-PUSH-3）保留
- mkdir+writeFileSync+String(map) byte-exact 复刻 materialize
- rename/EXDEV/incremental sync 复刻 publishToDist
- scratch mkdtemp per-build 复刻 computePathInfo

**消 targetPath 双语义**：DiskOutput 持 `final`（FINAL，构造收）；publish 内 mkdtemp scratch（TEMP，封装）。PackerContext.targetPath = FINAL 不变。sctx.storeInfo.pathInfo.targetPath（TEMP）的 output 角色死（compat 写 output 消费方死，见 D-O7）——targetPath 双语义消解。

### D-O4 — mode-driven impl 选择（消 skipMaterialize）

| mode | Output impl | 选择点 | serveRoot 状态 |
|---|---|---|---|
| dev（session.dev，无 previewAdapter） | MemOutput | orchestrator 入口（mode-aware） | 空（no-op publish，dev server 读内存 + sdkRoot） |
| previewAdapter-dev（skipMaterialize=false 现状） | DiskOutput | orchestrator 入口（previewAdapter 分支） | 有内容（materialize+publish 落盘，dev server 读 serveRoot） |
| one-shot（compile.ts build） | DiskOutput | build facade / compile.ts | = final targetPath（产物落盘） |
| **watch standalone（非 dev，F4 修正）** | **DiskOutput** | **session.watch options 传** | **= targetPath（无 dev server 读，纯落盘）** |

**选择点机制**：**orchestrator `orchestrate()` 入口**（L121 request 构造后，mode-aware 点）按 `request.skipMaterialize` 决定 `new MemOutput()` 或 `new DiskOutput(ctx.targetPath)`（D-OL1 方案 B）。final = ctx.targetPath（FINAL，mode-dep）。经 task ctx 初始化设 sctx.output（config-collector 跑前，config-collector 删 buildModel 行只消费）。**消 skipMaterialize flag**——mode = impl 选择，publisher 不再 guard（publish 调用统一，MemOutput.publish no-op 等价 skip）。

### D-O5 — dev server 读路径统一

```ts
// dev-server.ts
// 现状: artifactResolver?.(path) → hit return; miss fs.readFile(serveRoot)
// 改: output.read(path) → hit return; miss fs.readFile(serveRoot)
```

**F8 修正——serveRoot 术语 + dev server Output 引用形式**：dev server 读路径：
- `/sdk/*` → sdkRoot（dev-server L153，独立，**不经 Output 也不经 serveRoot**）
- `/index.html` `/pageFrame.html` → 内存常量
- else → `outputRef.output?.read(path)`（hit 返 compiled 内存——**dev server 持 OutputRef 窄接口读 output 字段**，D-OL4，F-R5-2）
- miss → `fs.readFile(resolveContainedPath(serveRoot, relativePath))`（dev-server L166）

**dev server Output 引用形式**（D-OL4 + F-R5-2 lock 窄接口）：createServer params 改 artifactResolver → **窄接口 `OutputRef`**（`{ output: Output | undefined }`，避免暴露整个 PackerSessionState 类型依赖）。但 state.output 是 rebuild 重新赋值字段（state 对象不变），须 mutable 引用——preview-adapter 传 `state`（本身实现 OutputRef，因 state 有 output 字段）或 `{ get output() { return state.output } }` getter 对象。dev server 内读 `outputRef.output?.read(path)`——rebuild listener 重新赋值 state.output 字段（同 state 对象），dev server 读当前 Output（非首 build 引用、非 closure getter）。**F-R5-2 lock**：用 OutputRef 窄接口（dev-server.ts 不引入 PackerSessionState 类型）；preview-adapter 传 state（state 含 output 字段，结构子类型满足 OutputRef）。

serveRoot = `state.targetPath`（session 注入）——**mode-dep**：
- 纯 dev → mkdtemp TEMP（dmcc-dev-，resolve.ts L143）——MemOutput no-op → 空 → fs fallback miss 404
- previewAdapter-dev → 同上 mkdtemp——DiskOutput publish 落盘 → 有内容 → fs fallback 命中
- one-shot → final targetPath（compile.ts TARGET_PATH）

**消 artifactResolver callback**——dev server 收 Output（经 createServer params，替代 artifactResolver callback），调 `output.read`。fs fallback 保留（serveRoot mode-dep，非编译非 SDK 资产）。

### D-O6 — collaborator 接 Output（F6 修正 lock deps.output）

- **Output 流经 collaborator：`deps.output`**（与现有 collaborator deps 模式一致——publisher/dist-preparer 等 deps 传参）
- `publisher` collaborator deps 字段演进（F-R11-1 显式）：删 `skipMaterialize`（D-O5 消 flag）+ 删 sctx.storeInfo.pathInfo 读（F-R10-1，buildDir/temporaryTargetPath 内化入 DiskOutput.publish）+ 加 `output: Output`；保留 `targetPath`/`useAppIdDir`/`seedPath`/`appId`/`lifecycle`。改调 `output.publish(target, {useAppIdDir, seedPath, appId, incremental: !!seedPath})`（**F-R14-1 incremental=!!seedPath**，复刻 publisher L40 `!!seedPath`；非 materialize + publishToDist）
- `dist-preparer` collaborator：createDist 语义已入 DiskOutput.publish——**dist-preparer 退役**（P-O3 删；P-O2 阶段如需分离 prepareScratch 可保留 thin wrapper，但倾向直接并入 publish）
- sctx.output 由 **orchestrator 入口创建**（D-OL1 方案 B）+ task ctx 初始化设；collaborator 经 deps.output 读（deps.output = sctx.output，由 orchestrator task ctx 注入）

### D-O7 — 殁骸拆除（P-O3，F11 + F-R7-1/R7-2/R7-3/R8-1 修正含全 sctx.buildModel 消费者 + type 字段演进）

grep 验 caller=0 后删：
- `BuildModel` class（累积 + dirty 迁入 DiskOutput；getArtifact 迁入 MemOutput/DiskOutput.read）
- `materialize` / `publishToDist` / `createDist` 函数
- `artifactResolver` callback + dev server 注入点（dev-server createServer params 改收 OutputRef，F-R5-2）
- `skipMaterialize` flag（CompileOptions/types.ts L437 + publisher guard L31 + orchestrator **L143 request destructuring**（F-R5-1）+ L156/187/277 + session L235 + index.ts L26/78 + runner.ts L40）
- compat 写 output 消费方：`getTargetPath()` 在 createDist/materialize/publishToDist 调用全消（emit/* caller=0）；**F-R11-2 `isTemporaryTargetPath()` fallback 消费方死**（publish.ts L116 `isTemporary ?? isTemporaryTargetPath()`——DiskOutput.publish hardcode temporary=true 后不调，F-R10-1）
- **BuildResult.buildModel 字段**（types.ts L503）→ `output: Output | undefined`（D-OL3）——BuildModel type 删，BuildResult 字段名 output
- **BuildResult.entries**（types.ts L496）→ sourced from `output.getEntries()`（F-R4-2）——保 entries 公开契约
- **F-R7-1 殁骸消费者迁移**（sctx.buildModel add 4 + read 3 → sctx.output，见 D-OL2）：
  - stage-dispatcher L54（dispatch 路径 onOutput `sctx.buildModel.add` → `sctx.output.add`）
  - logic-emitter L37/L42（`sctx.buildModel as BuildModel` 读 + `buildModel.add(entry)` 累积 → `sctx.output` + `sctx.output.add`）
- **F-R7-2 StageChannelContext 字段演进**：types.ts L121-123 `interface StageChannelContext { buildModel?: unknown }` → `output?: Output`（sctx 类型字段）
- **F-R7-3/R8-2 SessionState 字段演进**：session/index.ts L59 `SessionState.buildModel?: BuildModel` → `output?: Output`（F-R9-2：只 SessionState，不加 PackerSessionState）

## §3 边界（不动）

- storeInfo / sctx.storeInfo（config 计算正交——Output 不碰 storeInfo config 角色）
- worker ALS（resetStoreInfo + parse-walk getters——worker 模型结构性）
- compiler/*（EmitEntry 边界不变）
- config computation（graph/config-collector——加 Output 构造是扩展，不改 config 逻辑）
- env.ts ALS 门面（compat 写 output 消费方死后仍剩 config 消费方——留 storeInfo 塌缩）
- PackerContext 构造 duplication（独立 follow-up）

## §4 行为 0 风险与对策

| 风险 | 对策 |
|---|---|
| DiskOutput.publish 须 byte-exact 复刻 materialize + publishToDist | impl 封装现有逻辑（mkdir recursive/writeFileSync/String(map)/rename/EXDEV/incremental sync/dirty guard）——非新逻辑，逐相 tsc + 7 diff 验 |
| MemOutput.read 须复刻 getArtifact lazy index | impl 复刻（add 失效 index + 从 entries.files/sourcemaps 建）—— **DiskOutput.read 同须复刻**（F-R4-1，MemOutput/DiskOutput 共用 read 逻辑） |
| dev server fs fallback 保留（非编译非 SDK 资产） | Output.read miss 返 null → caller fs.readFile(serveRoot)（语义不变，serveRoot mode-dep） |
| dirty tracking 须保留（H4 D-PUSH-3 增量） | DiskOutput 内部 dirty set + publish dirty guard（复刻 materialize L105-106） |
| **scratch mkdtemp per-build**（F3） | DiskOutput.publish 内 mkdtemp（非构造时）——复刻 storeInfo per-orchestrate computePathInfo，并行构建原子性不变 |
| **F-R4-1——DiskOutput.read 读累积内存**（非 null） | DiskOutput.read 复刻 getArtifact lazy index（与 MemOutput 共用）；previewAdapter-dev 须即时内存读（stage compile 后即可，不等 publish）—— notifyBuildPublished 在 publisher 后（L277 最后 task），内存读比 fs fallback 时序更宽 |
| **F-R4-2——Output interface 缺 entries accessor** | D-O1 加 `getEntries(): EmitEntry[]`；BuildResult.entries sourced from output.getEntries()（保公开契约） |
| **F-R4-3——listr2 ctx 注入机制** | `tasks.run({ output })`（L292 改，实证 listr2 run 支持 initial ctx）—— Output 经 initial ctx 注入，config-collector 跑前 sctx.output 已存在 |
| **Output 每 build 实例 + rebuild 替换**（F1/D-OL4） | orchestrator 入口 per-orchestrate new Output（方案 B，mode-aware 点）；session build:end listener 重新赋值 state.output 字段（同 state 对象，非替换 state）；dev server 持 OutputRef 窄接口读 output 字段（F-R5-2，非首 build 引用、非 closure getter） |
| **F12——dev mode byte-identical 验证方法** | dev mode（MemOutput）无 7-diff 方法（dc-build 只跑 one-shot）——dev 行为由 spec 覆盖（dev-reload/dev-server spec 验 dev server 读 state.output.read + fs fallback + rebuild 重新赋值 state.output 字段）；7-diff 仅验 one-shot（DiskOutput publish byte-exact）。validation V-O3 split：one-shot 7-diff + dev spec 覆盖 |

## §5 实施序依赖

```
P-O1（Output interface + MemOutput + dev 接入 + Output 生命周期 D-OL1..4）
  → dev（memfs）行为 0 验（dev-reload + dev-server spec 覆盖 dev server 读；one-shot 7-diff 仍 pass 因 MemOutput 不影响 one-shot）
P-O2（DiskOutput + one-shot/previewAdapter/watch 接入）
  → one-shot 行为 0 验（compile-cli-cache + 7 diff one-shot byte-exact）
P-O3（殁骸拆除 + compat 写 output 消费方死 + BuildResult.buildModel→output）
  → 全量行为 0 验（tsc 0 + vitest 全绿 + 7 diff=0 + grep caller=0）
```

每相独立 commit + 行为 0 gate。P-O3 后 compat 写 output 消费方死 → 记 storeInfo 塌缩 initiative backflow。

## §6 文件归置（F7 修正 lock）

- **Output interface + BaseOutput + MemOutput + DiskOutput**：`emit/output.ts` 单文件（abstract BaseOutput + 2 impl class + 1 interface，F-R10-2 lock）
- build-model.ts 退役（P-O3 删，累积/dirty/getArtifact 逻辑迁入 output.ts）
- publish.ts 退役（P-O3 删，createDist/publishToDist/copyDir/syncIncremental 逻辑迁入 DiskOutput.publish）
- dist-preparer.ts 退役（P-O3 删，createDist 调用入 DiskOutput.publish）
