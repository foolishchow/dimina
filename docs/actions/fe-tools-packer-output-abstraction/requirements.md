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
- `read` 模式无关——MemOutput 读内存，DiskOutput 读累积内存（或盘）
- `publish` 提交到 final——DiskOutput 写 scratch + rename/copy 到 target；MemOutput no-op（内存即"已发布"，dev server 直读）

## R-O2 — MemOutput impl（dev memfs）

`MemOutput` 实现 Output，dev 模式用：
- `add` 写内存 Map（lazy index，add 失效——复刻 BuildModel.getArtifact 语义）
- `read` 读内存 Map（替代 artifactResolver + getArtifact）
- `publish` no-op（dev server 直读内存）
- 行为 == 现状 dev memfs（D-MM-1 直读 BuildModel + skipMaterialize）

## R-O3 — DiskOutput impl（one-shot + previewAdapter disk）

`DiskOutput` 实现 Output，one-shot + previewAdapter-dev 用：
- `add` 累积内存 + dirty tracking（H4 D-PUSH-3：dirtyEntries set，add 标 dirty）——复刻 BuildModel.add + dirty 语义
- `read` 读累积内存（或盘，依 publish 状态）
- `publish(target, opts)` 封装 materialize + publishToDist + createDist 语义：
  - dirty 非空 → 只写 dirty；空 → 全量（复刻 materialize L105-106）
  - 写 scratch（mkdtemp，computePathInfo 语义）：mkdir recursive + writeFileSync(dest, file.code) + writeFileSync(dest, String(map))（sourcemap）
  - publish scratch → target：rename（同 fs）/ copy + rm scratch（EXDEV 跨 fs）/ incremental sync（dist 已存在 content-diff，F-H4-2）
  - clearDirty after write（D-PUSH-3）
- 行为 == 现状 one-shot/previewAdapter（materialize + publishToDist + createDist）

## R-O4 — dev server 读路径统一

`dev-server.ts` 改 `Output.read` 单一入口（替代 artifactResolver + fs.readFile 双路）：
- `Output.read(path)` hit → 返产物（MemOutput 内存 / DiskOutput 累积或盘）
- miss → fs.readFile(serveRoot) fallback（非编译资产 SDK/static 仍在盘 FINAL）
- 消 artifactResolver callback 注入 + getArtifact 调用

## R-O5 — mode-driven impl 选择

Output impl 由 mode 选择（消 skipMaterialize 开关）：
- dev（session.dev，无 previewAdapter）→ MemOutput
- previewAdapter-dev（skipMaterialize=false 现状）→ DiskOutput
- one-shot（compile.ts build）→ DiskOutput
- 选择点：session（dev）/ build facade（one-shot）构造 Output 传入 orchestrate

## R-O6 — 殁骸拆除

P-O3 后退役（grep 验 caller=0）：
- `BuildModel` class（累积 + dirty 迁入 DiskOutput；getArtifact 迁入 Output.read）
- `materialize` 函数（语义入 DiskOutput.publish）
- `publishToDist` + `createDist` 函数（语义入 DiskOutput.publish）
- `artifactResolver` callback（dev server 改 Output.read）
- `skipMaterialize` flag（mode=impl 选择，无需 flag）
- compat 写 output 消费方死：`getTargetPath()` 在 createDist/materialize/publishToDist 的调用全消（grep 验）

## R-O7 — 行为 0

纯结构重构（output 机制统一，无语义改）。每相独立 commit + 行为 0 gate。dev（memfs）+ one-shot（disk）双模式 byte-identical。

- tsc 0 errors
- vitest 全绿（含 dev-reload / dev-server / compile-cli-cache / lifecycle-integration spec）
- 7 项目 build diff=0（`node --experimental-strip-types /tmp/dc-build.mjs diff`）

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
