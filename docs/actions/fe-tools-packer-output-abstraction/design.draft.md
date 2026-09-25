# Design Draft — fe-tools-packer-output-abstraction

Status authority: [Action Status](../STATUS.md)

> D-O1..N 待 review lock。本文档基于 [`2026-10-10-storeinfo-concept-analysis.md`](../../fe-tools/2026-10-10-storeinfo-concept-analysis.md) + [`2026-10-10-packer-architecture-analysis.md`](../../fe-tools/2026-10-10-packer-architecture-analysis.md) 讨论。

## §1 现状 output 机制（4 概念缠结）

### 1.1 数据流

```
worker compile → postMessage(EmitEntry) → 主线程
  → BuildModel.add(entry)                    [内存累积，entries Map + dirty set]
  → (one-shot/previewAdapter) materialize(model, TEMP)   [内存→盘 flush，dirty guard]
  → publishToDist(TEMP → FINAL)              [rename/copy/incremental sync]
  → (dev server 读)
      artifactResolver(path) = getArtifact   [内存 lazy index 读]
      miss → fs.readFile(serveRoot=FINAL)     [盘读 fallback，非编译资产]
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

## §2 Output 抽象（D-O1 locked 候选）

### D-O1 — Output interface

```ts
// types.ts §10
export interface PublishOpts {
  useAppIdDir?: boolean
  incremental?: boolean       // watch/compile-cache seedPath → content-diff sync
  seedPath?: string | null     // 增量复制旧产物根
  appId?: string
}

export interface Output {
  /** 累积 worker 流式产物（postMessage EmitEntry → 主线程调） */
  add(entry: EmitEntry): void
  /** 读产物（dev server 用——模式无关，miss 返 null 走 fs fallback） */
  read(path: string): { code: string } | null
  /** 提交到 final（one-shot/previewAdapter：写 scratch + rename/copy；dev：no-op） */
  publish(target: string, opts?: PublishOpts): void
}
```

**设计要点**：
- `add` 是累积语义（非直写）——保 dirty tracking（DiskOutput 增量 publish 须）+ lazy index（MemOutput read 须）
- `read` 模式无关——dev server 单一入口，miss 返 null（caller 决定 fs fallback）
- `publish` target=FINAL——DiskOutput 内部管 scratch（mkdtemp）+ rename/copy；MemOutput no-op

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
  publish() { /* no-op — dev server 直读内存 */ }
}
```

**行为 == 现状 dev memfs**（D-MM-1 直读 BuildModel + skipMaterialize）：entries Map + lazy index + add 失效。

### D-O3 — DiskOutput impl（one-shot + previewAdapter disk）

```ts
class DiskOutput implements Output {
  private entries = new Map<string, EmitEntry>()
  private dirty = new Set<string>()
  private scratch: string  // mkdtemp（computePathInfo 语义，构造时或 publish 时算）

  add(entry) { const k = `${entry.kind}:${entry.entryId}`; this.entries.set(k, entry); this.dirty.add(k) }
  read(path) { /* 读累积内存（或盘，依 publish 状态）—— one-shot 不常用 */ }
  publish(target, opts) {
    // 复刻 materialize + publishToDist + createDist：
    // 1. dirty 非空 → 只写 dirty；空 → 全量（materialize L105-106）
    // 2. 写 scratch：mkdir recursive + writeFileSync(dest, file.code) + writeFileSync(dest, String(map))
    // 3. publish scratch → target：rename(同 fs) / copy+rm scratch(EXDEV) / incremental sync(content-diff, F-H4-2)
    // 4. clearDirty
  }
}
```

**行为 == 现状 one-shot/previewAdapter**（materialize + publishToDist + createDist）：
- dirty tracking（H4 D-PUSH-3）保留
- mkdir+writeFileSync+String(map) byte-exact 复刻 materialize
- rename/EXDEV/incremental sync 复刻 publishToDist
- scratch mkdtemp 复刻 computePathInfo（构造时算，非 storeInfo 内重算）

**scratch 归属**：DiskOutput 构造时算 mkdtemp（computePathInfo 语义）——不再在 storeInfo 内重算。消 targetPath 双语义：DiskOutput 持 scratch（封装），PackerContext.targetPath = FINAL。

### D-O4 — mode-driven impl 选择（消 skipMaterialize）

| mode | Output impl | 选择点 |
|---|---|---|
| dev（session.dev，无 previewAdapter） | MemOutput | session.dev 构造 |
| previewAdapter-dev（现状 skipMaterialize=false） | DiskOutput | session.dev（previewAdapter 分支） |
| one-shot（compile.ts build） | DiskOutput | build facade / compile.ts |

**消 skipMaterialize flag**——mode = impl 选择，publisher 不再 guard（publish 调用统一，MemOutput.publish no-op 等价 skip）。

### D-O5 — dev server 读路径统一

```ts
// dev-server.ts
// 现状: artifactResolver?.(path) → hit return; miss fs.readFile(serveRoot)
// 改: output.read(path) → hit return; miss fs.readFile(serveRoot)
```

**消 artifactResolver callback**——dev server 收 Output（非 callback），调 Output.read。fs fallback 保留（非编译资产 SDK/static 在 FINAL 盘）。

### D-O6 — collaborator 接 Output

- `publisher` collaborator 改调 `output.publish(target, opts)`（非 materialize + publishToDist）
- `dist-preparer` 退役（createDist 语义入 DiskOutput.publish）或改调 `output.prepareScratch()`（如需分离）
- Output 经 sctx.output 或 deps.output 流给 collaborator

### D-O7 — 殁骸拆除（P-O3）

grep 验 caller=0 后删：
- `BuildModel` class（累积 + dirty 迁入 DiskOutput；getArtifact 迁入 Output.read）
- `materialize` / `publishToDist` / `createDist` 函数
- `artifactResolver` callback + dev server 注入点
- `skipMaterialize` flag（CompileOptions/publisher guard）
- compat 写 output 消费方：`getTargetPath()` 在 createDist/materialize/publishToDist 调用全消

## §3 边界（不动）

- storeInfo / sctx.storeInfo（config 计算正交）
- worker ALS（resetStoreInfo + parse-walk getters——worker 模型结构性）
- compiler/*（EmitEntry 边界不变）
- config computation（graph/config-collector）
- env.ts ALS 门面（compat 写 output 消费方死后仍剩 config 消费方——留 storeInfo 塌缩）
- PackerContext 构造 duplication（独立 follow-up）

## §4 行为 0 风险与对策

| 风险 | 对策 |
|---|---|
| DiskOutput.publish 须 byte-exact 复刻 materialize + publishToDist | impl 封装现有逻辑（mkdir recursive/writeFileSync/String(map)/rename/EXDEV/incremental sync/dirty guard）——非新逻辑，逐相 tsc + 7 diff 验 |
| MemOutput.read 须复刻 getArtifact lazy index | impl 复刻（add 失效 index + 从 entries.files/sourcemaps 建） |
| dev server fs fallback 保留（非编译资产） | Output.read miss 返 null → caller fs.readFile（语义不变） |
| dirty tracking 须保留（H4 D-PUSH-3 增量） | DiskOutput 内部 dirty set + publish dirty guard（复刻 materialize L105-106） |
| Output impl 构造点（scratch mkdtemp 时机） | DiskOutput 构造时算 mkdtemp（非 storeInfo 内重算）——须验并行构建 mkdtemp 原子性不变 |

## §5 实施序依赖

```
P-O1（Output interface + MemOutput + dev 接入）
  → dev（memfs）行为 0 验（dev-reload + dev-server spec + 7 diff dev mode）
P-O2（DiskOutput + one-shot/previewAdapter 接入）
  → one-shot 行为 0 验（compile-cli-cache + 7 diff one-shot）
P-O3（殁骸拆除 + compat 写 output 消费方死）
  → 全量行为 0 验（tsc 0 + vitest 全绿 + 7 diff=0 + grep caller=0）
```

每相独立 commit + 行为 0 gate。P-O3 后 compat 写 output 消费方死 → 记 storeInfo 塌缩 initiative backflow。
