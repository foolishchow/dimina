# Design Draft — fe-tools-hmr-push

> 设计草稿。D-PUSH-1/2/3 锁后产出 technical-design。

Status: **complete（2026-10-09）**

## §1 L_HMR level 设计（D-PUSH-1）— **locked**

### §1.1 现状：RELOAD_LEVELS L0-L3

`dev-reload.ts:22`：
```typescript
const RELOAD_LEVELS = Object.freeze({
  L0: 'L0',  // 非增量全量
  L1: 'L1',  // 页面 relaunch
  L2: 'L2',  // 同 L3 语义（style）
  L3: 'L3',  // 上报级别（view）
})
```
无 HMR level。dev-server broadcast `{ type: 'reload', ...pendingReload }`（全量）。

### §1.2 目标：L_HMR level

加 `L_HMR: 'L_HMR'`——per-module payload 推送，runtime per-module update。
- payload = 变更 module 集（H1 deriveLogicBuckets 增量 + H3 per-module cache 增量）
- runtime 收 L_HMR → per-module hot-swap（非 page reload）

### §1.3 D-PUSH-1 design gate — **locked**

**D-PUSH-1 locked**：L_HMR level = per-module payload 推送（`{ type:'hmr', level:'L_HMR', modules:{[moduleId]:{code,map}}, entries:string[] }`）。触发条件：单/少 module 变更 + runtime 就绪。L_HMR vs L1：L_HMR = per-module update（runtime hot-swap），L1 = page reload（fallback）。

L_HMR 语义边界：
- L_HMR vs L1：L_HMR = per-module update（runtime 就绪），L1 = page reload（fallback）
- L_HMR 触发条件：单 module/少 module 变更 + runtime 就绪
- L_HMR payload 格式：moduleId → code/map（增量集）

**待 H4 formalize 锁**：payload 格式 + 触发条件边界。

---

## §2 fallback downgrade 机制（D-PUSH-2 = D-HMR-5）— **locked 选项②**

### §2.1 问题

dev server 如何知 runtime 未就绪 → downgrade L_HMR→L1？

### §2.2 选项

**选项 ① runtime capability probe**：
- dev server 探测 runtime capability（feature flag / handshake）
- runtime 就绪 → L_HMR；未就绪 → L1
- **优势**：明确 downgrade
- **风险**：runtime probe 协议（运行时侧依赖）

**选项 ② 编译侧始终发 L_HMR payload，runtime 侧自降 L1**：
- 编译侧发 L_HMR，runtime 收后自降 L1（runtime-side downgrade）
- **优势**：编译侧不需知 runtime 状态
- **风险**：runtime 须实现 downgrade 逻辑

### §2.3 D-PUSH-2 推荐

**推荐选项 ②（runtime-side downgrade）**——编译侧不依赖 runtime probe（运行时侧依赖最小化）。runtime 收 L_HMR 后：就绪 → hot-swap；未就绪 → 自降 L1 reload。

**⚠️ F3 补：选项 ② 风险**——若 runtime 未实现 downgrade 逻辑（旧 runtime / runtime 未升级），L_HMR payload 丢失（无 reload，dev server 不知情）。mitigation：① dev server 加 timeout（发 L_HMR 后无 client ack → fallback L1）② 接受 H4 非阻塞伞 close（编译侧 HMR 完成，runtime downgrade 是运行时侧交付物）。选项 ① capability probe 更安全（dev server 主动知 runtime 状态），但增加编译侧 runtime 依赖。**待 H4 formalize 锁时权衡**。

---

## §3 materialize 增量化（D-PUSH-3）— **locked**

### §3.1 现状：publishToDist 全量

`publish.ts` publishToDist（全量发布 BuildModel → dist）。`materialize` 全量写盘。

### §3.2 目标：增量 materialize

只写变更产物（非全量）。BuildModel 增量 materialize：
- one-shot：全量 materialize（无 state → 无增量概念）
- watch：增量 materialize（只写 dirty entries）

**⚠️ F5 补：现状实现**：`publish.ts:8` `publishToDist` 用 `fs.readdirSync(src)` + `copyFileSync`（**全目录拷贝**，非 entry 级）。`build-model.ts:15` `entries: Map<string, ...>` 不 track dirty。增量 materialize 须：① BuildModel 加 dirty set（track 变更 entries）② publishToDist 改 entry 级增量拷贝（只 copy dirty entries）。

**⚠️ F6 补：deletion handling**：增量 materialize 须 handle entries removed（page deleted）→ 对应 files 须从 dist 删除。全量 materialize 隐式处理（overwrite all）；增量须显式 deletion tracking（dirty set 含 deletions，非仅 additions/changes）。D-BM-4（字节不变）+ D-P2（path 零转换）不违反——增量只改写盘集，不改字节/path。

### §3.3 D-PUSH-3 design gate — **locked**

**D-PUSH-3 locked**：materialize 增量化可行（BuildModel 加 dirtyEntries set，F-H4-1）；publishToDist 须重构（atomic full move → incremental copy，F-H4-2）。增量 materialize guard：`if (dirtySet) 增量写入 else 全量`（one-shot 全量，F8）。deletion handling（F6）：entries removed → files 从 dist 删除。规模升级：publishToDist 重构是主要工作量（S-M → M）。


materialize 增量化边界：
- BuildModel 须 track 变更 entries（dirty set）
- publishToDist 须增量发布（只 copy dirty entries）
- **待实证**：BuildModel 能否 track dirty？publishToDist 增量边界？

---

## §4 行为 0 边界

### §4.1 one-shot 不受影响

H4 仅 watch 路径。one-shot 不传 state → no HMR → no L_HMR → 全量 reload（L0-L3 不变）→ diff=0 平凡成立。

**⚠️ F8 补：materialize 增量化是 watch-only**——one-shot build 仍调 `materialize()` + `publishToDist()`（orchestrator '写入编译产物' task）。H4 增量 materialize 须 guard：`if (dirtySet) 增量写入 else 全量写入`（one-shot 无 dirtySet → 全量，行为不变 → diff=0）。publishToDist 同理（one-shot 全目录拷贝不变）。

### §4.2 watch 路径渐进

watch 路径加 L_HMR——runtime 就绪时 per-module push，未就绪 fallback L1。watch 字节恒等（materialize 增量产物 == 全量产物子集）。

---

## §5 实证结果（2026-10-09）

### H4.1 BuildModel dirty tracking — **F-H4-1 补**

`BuildModel`（build-model.ts）：`entries: Map<string, {entryId, kind, files, sourcemaps}>` + `add(entry)`（set entry + invalidate _artifactIndex）。**无 dirty set**——不 track 哪些 entries 自上次 materialize 后变更。

**H4 须加**：`dirtyEntries: Set<string>`（或 `dirtyFiles: Set<string>`）——`add()` 时加入，`materialize()` 后清。直接扩展（add 已 invalidate _artifactIndex，同点加 dirty）。

### H4.2 publishToDist 增量边界 — **F-H4-2 补（low-med）**

`publishToDist`（publish.ts）：**atomic full move** —— `rmSync(absolutePath)` → `mkdirSync` → `renameSync`（临时目录）或 `copyDir`（全目录拷贝）。当前模式 "rm dist + move/copy all" ≠ 增量。

**H4 增量 publish 须重构**："keep dist + update changed files only"（no rmSync）。但 `renameSync`（atomic move）无法增量——须改为 `copyDir` + 只 copy dirty files。语义变更（dist 不再 rmSync 重建，而是原地更新）。**待 H4 升 ready 前重评**。

### H4.3 payload 格式 — **design definition**

L_HMR payload = 变更 module 集（`moduleId → {code, map}`）。源：H1 `deriveLogicBuckets` 增量（logic emit 变更）+ H3 per-module cache 增量（view/style 变更）。格式：
```typescript
{ type: 'hmr', level: 'L_HMR', modules: { [moduleId]: { code: string, map?: string } }, entries: string[] }
```

### H4.4 runtime fallback 协议 — **out of scope**（运行时侧）

选项 ② runtime-side downgrade 可行性需运行时侧确认（非编译侧实证）。F3 风险已记（runtime 未实现 downgrade → payload 丢失）。

### 实证总结

| # | 实证 | 结果 | 影响 |
| --- | --- | --- | --- |
| 1 | payload 格式 | **design def** | L_HMR payload = moduleId→code/map |
| 2 | BuildModel dirty | **F-H4-1** | 须加 dirtyEntries set |
| 3 | publish 增量边界 | **F-H4-2**（low-med） | publishToDist atomic move ≠ 增量，须重构 |
| 4 | runtime fallback | **out of scope** | 运行时侧确认 |

**D-PUSH-3 gate**：materialize 增量化可行（BuildModel 加 dirty set）；publishToDist 增量化须重构（atomic move → incremental copy）。待 H4 升 ready 前重评 publish 重构规模。
