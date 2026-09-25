# Requirements — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

## 背景

packer 产物输出路径因无统一 Output 抽象，分裂为 memory（BuildModel + getArtifact）与 disk（materialize + publishToDist + createDist）两套平行机制，skipMaterialize 是 mode 开关。targetPath 双语义（FINAL 发布 vs TEMP scratch）缠在 PackerContext + storeInfo + ALS singleton 三处。compat 写的 output-path 角色（getTargetPath 喂 createDist/materialize/publishToDist）是 P-NS6 backflow 的主要消费方。

详见 [README](README.md) Background + [`docs/fe-tools/2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md) §9。

## R-O1 — Output interface 抽象

`types.ts` 加 `Output` interface，统一产物写/读/发布：

```ts
interface Output {
  add(entry: EmitEntry): void                              // 累积 worker 流式产物
  read(path: string): { code: string } | null             // 读（dev server 用，模式无关）
  publish(target: string, opts: PublishOpts): void         // 提交到 final（one-shot；dev no-op）
}
```

- `add` 收 EmitEntry（worker postMessage 流式回传），内部累积（保留 dirty tracking 供增量 publish）
- `read` 模式无关——**读累积内存 lazy index**（MemOutput + DiskOutput 同语义，F-R4-1），miss 返 null 走 fs fallback
- `publish` 提交到 final——DiskOutput 写 scratch（per-build mkdtemp）+ rename/copy 到 target；MemOutput no-op（实证见 R-O2）
- `getEntries()` 返累积 EmitEntry[]（F-R4-2——BuildResult.entries sourced from output.getEntries()）

**R-O1.1 Output 生命周期**（F1 修正 D-OL1..4，方案 B——orchestrator 入口创建，替代 buildModel 流）：
- **D-OL1（方案 B + listr2 ctx 注入，F-R4-3 lock）**：orchestrator `orchestrate()` 入口（L121 request 构造后，mode-aware 点）创建 Output：`request.skipMaterialize ? new MemOutput() : new DiskOutput(ctx.targetPath)`。final = ctx.targetPath（mode-dep：dev=mkdtemp dmcc-dev- / one-shot=TARGET_PATH）。**listr2 ctx 注入**（F-R4-3 实证）：`tasks.run({ output })`（L292 改）——listr2 run 支持 initial ctx 合并，Output 经 initial ctx 注入，config-collector 跑前 sctx.output 已存在。**config-collector 删 `sctx.buildModel = new BuildModel()` 行**（L36），只消费 sctx.output（职责分离：orchestrator 决策 mode + 创建；config-collector 只设其他 8 sctx 字段）。
- D-OL2：stage compile onOutput → `sctx.output.add(entry)`（orchestrator L83/85）
- D-OL3：`BuildResult.buildModel`（types.ts L503）→ `output: Output | undefined`；orchestrator result.output = context.output
- D-OL4（dev server 持 OutputRef 窄接口读 state.output）：session L244 `state.output = buildResult.output`（首 build）+ L255 `build:end` listener 重新赋值 `state.output` 字段（同 state 对象，非替换 state）+ dev server createServer params 收 **OutputRef 窄接口**（`{ output: Output | undefined }`，F-R5-2 lock——避免暴露整个 PackerSessionState；preview-adapter 传 state（state 含 output 字段，结构子类型满足 OutputRef）），dev server 内读 `outputRef.output?.read(path)`（读当前值，非首 build 引用、非 closure getter）

## R-O2 — MemOutput impl（dev memfs）

`MemOutput` 实现 Output，dev 模式用：
- `add` 写内存 Map（lazy index，add 失效——复刻 BuildModel.getArtifact 语义）
- `read` 读内存 Map（替代 artifactResolver + getArtifact）
- `publish` no-op——实证前提（F2）：纯 dev（skipMaterialize=true）现状 createDist 不 seed（seedPath=undefined）+ materialize 跳 → buildDir 空 → publishToDist 复制空 → serveRoot 空 → dev server fs fallback miss 404（本就如此）。no-op == 现状纯 dev。
- previewAdapter-dev 不走 MemOutput（走 DiskOutput，因 skipMaterialize=false → materialize 写 → serveRoot 有内容 → dev server fs fallback 命中）
- 行为 == 现状纯 dev memfs（D-MM-1 直读 BuildModel + skipMaterialize + serveRoot 空）

## R-O3 — DiskOutput impl（one-shot + previewAdapter disk）

`DiskOutput` 实现 Output，one-shot + previewAdapter-dev 用：
- `add` 累积内存 + dirty tracking（H4 D-PUSH-3：dirtyEntries set，add 标 dirty）——复刻 BuildModel.add + dirty 语义
- `read` 返累积内存 lazy index（F-R4-1——**非 null**；与 MemOutput 同语义，复刻 BuildModel.getArtifact。previewAdapter-dev 须即时内存读，stage compile 后即可，不等 publish；MemOutput/DiskOutput 共用 read 逻辑）
- `publish(target, opts)` 封装 materialize + publishToDist + createDist 语义（**per-build mkdtemp scratch**，F3——publish 内 mkdtemp，复刻 storeInfo per-orchestrate computePathInfo；非构造时）：
  - dirty 非空 → 只写 dirty；空 → 全量（复刻 materialize L105-106）
  - 写 scratch（mkdtemp，computePathInfo 语义）：mkdir recursive + writeFileSync(dest, file.code) + writeFileSync(dest, String(map))（sourcemap）
  - publish scratch → target：rename（同 fs）/ copy + rm scratch（EXDEV 跨 fs）/ incremental sync（dist 已存在 content-diff，F-H4-2）
  - clearDirty after write（D-PUSH-3）
- 行为 == 现状 one-shot/previewAdapter（materialize + publishToDist + createDist）

## R-O4 — dev server 读路径统一

`dev-server.ts` 改 `outputRef.output?.read(path)` 单一入口（替代 artifactResolver + fs.readFile 双路）+ serveRoot 术语修正（F8）+ dev server 持 OutputRef 窄接口（D-OL4 + F-R5-2 lock）：
- `/sdk/*` → sdkRoot（dev-server L153，独立，不经 Output/serveRoot）
- `/index.html` `/pageFrame.html` → 内存常量
- else → `outputRef.output?.read(path)` hit → 返 compiled 内存
- miss → fs.readFile(resolveContainedPath(serveRoot, relativePath))（dev-server L166）——serveRoot = state.targetPath（mode-dep：纯 dev mkdtemp 空 / previewAdapter-dev mkdtemp 落盘有内容 / one-shot final targetPath）
- 消 artifactResolver callback 注入 + getArtifact 调用；dev server createServer params 改收 **OutputRef 窄接口**（`{ output: Output | undefined }`，避免暴露整个 PackerSessionState）——preview-adapter 传 state（state 含 output 字段，结构子类型满足 OutputRef）；dev server 读 outputRef.output 字段（rebuild 重新赋值，读当前值）

## R-O5 — mode-driven impl 选择

Output impl 由 mode 选择（消 skipMaterialize 开关）+ 4 mode 覆盖（F4 修正）+ 创建点 = orchestrator 入口（方案 B）：
- dev（session.dev，无 previewAdapter）→ MemOutput（serveRoot 空）
- previewAdapter-dev（skipMaterialize=false 现状）→ DiskOutput（serveRoot 落盘有内容）
- one-shot（compile.ts build）→ DiskOutput（= final targetPath）
- watch standalone（非 dev，无 dev server）→ DiskOutput（无读者，纯落盘）
- 选择点：**orchestrator `orchestrate()` 入口**（L121 request 构造后，mode-aware 点，按 request.skipMaterialize）创建 Output 设 sctx.output（经 task ctx 初始化）；config-collector 删 buildModel 行只消费 sctx.output

## R-O6 — 殁骸拆除（F11 修正含 BuildResult 字段）

P-O3 后退役（grep 验 caller=0）：
- `BuildModel` class（累积 + dirty 迁入 DiskOutput；getArtifact 迁入 MemOutput.read）
- `materialize` 函数（语义入 DiskOutput.publish）
- `publishToDist` + `createDist` 函数（语义入 DiskOutput.publish）
- `artifactResolver` callback（dev server createServer params 改收 Output，调 Output.read）
- `skipMaterialize` flag（mode=impl 选择，无需 flag）—— 全 caller 退役：types.ts L437 + publisher L31 + orchestrator **L143 request destructuring**（F-R5-1 补）+ L156/187/277 + session L235 + index.ts L26/78 + runner.ts L40
- compat 写 output 消费方死：`getTargetPath()` 在 createDist/materialize/publishToDist 的调用全消（emit/* caller=0）
- `BuildResult.buildModel` 字段（types.ts L503）→ `output: Output | undefined`；BuildModel type 删
- `BuildResult.entries`（types.ts L496，现 sourced from buildModel.entries.values()）→ sourced from `output.getEntries()`（F-R4-2：Output interface 加 getEntries() accessor，保公开契约）

## R-O7 — 行为 0

纯结构重构（output 机制统一，无语义改）。每相独立 commit + 行为 0 gate。**双模式验证 split**（F12 修正）：
- one-shot（DiskOutput）：7 项目 build diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）+ compile-cli-cache spec
- dev（MemOutput）：无 7-diff 方法（dc-build 只跑 one-shot）——dev 行为由 spec 覆盖（dev-reload/dev-server spec 验 dev server 读 Output.read + fs fallback + rebuild 替换 state.output）
- tsc 0 errors
- vitest 全绿（含 dev-reload / dev-server / compile-cli-cache / lifecycle-integration spec）

## R-O8 — Non-scope 边界

- 不动 storeInfo / sctx.storeInfo（config 计算正交）
- 不动 worker ALS（resetStoreInfo + parse-walk getters——worker 模型结构性）
- 不动 compiler/*（EmitEntry 边界不变）
- 不动 config computation（graph/config-collector）
- 不删 env.ts ALS 门面（compat 写 output 消费方死后仍剩 config 消费方——留 storeInfo 塌缩 initiative）
- 不迁 PackerContext 构造 duplication（独立 follow-up）

## backflow（为后续铺路，非此 Action scope）

- compat 写 output-path 消费方死后，剩 config 消费方（project-store.getDependencyGraph + publishToDist appId/isTemporary fallback——后者也被 DiskOutput 吸收）→ storeInfo 塌缩更易
- targetPath 双语义消解后，PackerContext 不再背 TEMP scratch → storeInfo 塌缩时 PackerContext 加 temporaryTargetPath 的 gap 关闭更易
