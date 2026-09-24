# Design Draft — fe-tools-hmr-emit-derive

> 本文件是设计草稿，非正式文档。用于 entry 映射 + 策略锁后产出正式 technical-design。

Status: **ready（2026-10-09）**

## §1 entry 映射挑战（D-ED-1）

### §1.1 现状：emitBuckets per-bucket

`logic/index.ts:274-297` logicCompile 返回：
```typescript
{ emitBuckets: { main: mainCompileRes, subs: [{root, modules: subCompileRes}] }, compileRes, logicDependencies }
```

- `main` = CompileInfo[]（app + 所有主包页 JS，FLAT list）
- `subs` = [{root, modules}]（分包根下页 JS，per-root）

orchestrator Logic emit task（`:266-296`）消费：
```typescript
for (const { root, modules } of emitBuckets.subs) {
  emitEngine({ entryId: 'logic:'+root, relPrefix: root, modules: modules.map(toEmitModule) })
}
emitEngine({ entryId: 'logic', relPrefix: 'main', modules: emitBuckets.main.map(toEmitModule) })
```

→ 产出 EmitEntry：`logic`（main）+ `logic:<root>`（per-sub）。

### §1.2 目标：deriveFromGraph per-entry

`convergence.ts:6`：
```typescript
deriveFromGraph(graph, cache, entryId): EmitModule[]
  = graph.getDependencyClosure(entryId).map(id => cache.get(id)).filter(Boolean)
```

- per-entry：单 entryId 的依赖闭包（含 entryId 自身）
- `getDependencyClosure(entryId)`（`dependency-graph.ts:190`）：BFS all outgoing edges，返回 `[...visited].sort()`

### §1.3 映射挑战

| bucket | emitBuckets 来源 | deriveFromGraph entryId? | 挑战 |
| --- | --- | --- | --- |
| main（'logic'） | app + 所有主包页 FLAT | app + 主包页各 page.path | **非单 entry**——需 union 多 entry 闭包 |
| subs（'logic:'+root） | 分包 root 下页 FLAT | 分包页各 page.path | **非单 entry**——需 union root 下页闭包 |

**核心问题**：main bucket ≠ `deriveFromGraph(graph, cache, 'app')`（app 闭包 ≠ app + 所有主包页）。main bucket = app + 所有主包页的 modules union。

**序挑战**：emitBuckets.main 是 FLAT list（app + main pages 按 compileJS 插入序）。deriveFromGraph 返回 `[...visited].sort()`（字典序）。**序不同 → emit 输出字节不同 → diff≠0**。

### §1.4 候选解法

**解法 A（union + 序重建）**：
```typescript
// main bucket
const mainEntryIds = ['app', ...mainPages.map(p => p.path)]
const mainModules = mainEntryIds.flatMap(id => deriveFromGraph(graph, cache, id))
  // 去重（component 被 page 共享）+ 序重建（match emitBuckets.main 序）
// subs bucket per root
const subModules = subPages[root].flatMap(p => deriveFromGraph(graph, cache, p.path))
```
- 去重：component 出现在多 page 闭包，须 dedup（emitBuckets 不重复）
- 序：须 match compileJS 插入序（非字典序）——**G5 P-G506 先例：序重建 from graph 不可行**（序不一致）

**解法 B（cache 插入序）**：
- deriveFromGraph 改为不 `.sort()`，按 graph 遍历序（DFS pop 序）返回
- 或 ModuleResultCache 维护插入序（Map 保持插入序），deriveFromGraph 按 cache key 序
- **⚠️ F2 修正：B 混淆两种序**：
  - **B1 graph DFS 序**：去 `.sort()` → `getDependencyClosure` 返回 DFS visit 序（`pending.pop()` LIFO）
  - **B2 cache 插入序**：ModuleResultCache Map 插入序（compileJS push 序）
  - **emitBuckets序 = B2**（compileJS push 序 == cache 插入序）
  - deriveFromGraph 当前遍历 graph closure（B1 路径）→ 去 `.sort()` 得 B1 DFS 序，**≠ B2 emitBuckets序**
  - **解法 B 须明确 B2**：deriveFromGraph 须按 cache 插入序迭代（非 graph closure 序）——可能需改 deriveFromGraph 签名（传 cache entry list 而非 graph closure）或 graph closure 按 cache 序返回
- **待实证**：cache 插入序 == emitBuckets序?（B2 可行性）

**解法 C（bucket 概念进 graph）**：
- graph 加 'package' kind 边（main package → app + main pages；sub package → sub pages）
- deriveFromGraph(graph, cache, 'main-package') → main bucket closure
- **改 graph schema**——超出 H1 scope（触碰 G1 graph-persist）

**解法 D（cache order metadata）**：
- ModuleResultCache 存显式 order index（compileJS push 时赋 index）
- deriveFromGraph 按 order index 排序（非 graph 序、非 Map 插入序）
- **B2 失败时的 fallback**（cache 插入序 ≠ emitBuckets序）——介于 B2 与 C 之间，不改 graph schema
- **⚠️ cache shape 变更**：D 改 ModuleResultCache WRITE 路径（compileJS 加 orderIndex 字段），非 deriveFromGraph READ。cache shape 变更有 G4 先例（D-G4-1..9 view cache shape）——须显式决策（非 silent 改）。deriveFromGraph 仍只读。

**解法 E（cross-bucket dedup）**（F19 补，实证 #3 发现）：
- sub bucket closure 含共享依赖（如 `app`），但 emitBuckets.subs 不含（app 属 main bucket）
- deriveFromGraph for sub bucket = sub entries union closure **MINUS main bucket modules**（cross-bucket dedup）
- 实证：subPackageA closure=7 minus `app`=1 == emit=6 ✓
- emitBuckets 去重源：`hasCompileInfo(module.path, compileRes, mainCompileRes)`——compileJS for subs 传 mainCompileRes，已在 main 的不 push 到 sub
- **非独立解法**——是 B2 的补充（sub bucket 须 B2 + cross-bucket dedup）

### §1.5 D-ED-1 design gate

解法 A 序重建有 G5 P-G506 先例风险（不可行）。解法 B 待实证（cache 序 == emitBuckets 序?）。解法 C 改 graph schema（超 scope）。

**推荐解法 B2**（cache 插入序，非 graph closure 序）——最小改动 + 不改 graph schema。待 design.draft §4 实证 cache 序一致性（B2 可行性）。若 fail → 解法 D（order metadata）。

---

## §2 策略锁（D-ED-2 = D-HMR-2）

### §2.1 方案 A（渐进 dual-path）
deriveFromGraph 接线 + emitBuckets 保留 fallback（env/flag 切换），验证字节一致后删 emitBuckets。

**⚠️ SMPU 经验启示**：dual-path 有验证缺口风险——SMPU 的 `DIMINA_COMPILER_DIFF_VERIFY` dual-path 导致 6 轮 behavior-0 验的不是 production 路径。H1 若 dual-path，须确保验证的是 deriveFromGraph 路径（非 emitBuckets fallback）。

### §2.2 方案 B（一次性）
直接删 emitBuckets 改 deriveFromGraph，行为 0 验证（diff=0）。

**优势**：无 dual-path 验证缺口（SMPU 教训）。
**风险**：若 deriveFromGraph 输出 ≠ emitBuckets（序/集差异），diff≠0 需回溯。

### §2.3 D-ED-2 推荐

**推荐 B（一次性）**——SMPU 教训表明 dual-path 验证缺口风险 > 一次性风险。deriveFromGraph 已定义 + 只读 + cache 已 fill，一次性接线可 diff=0 验证。若 diff≠0 则解法 B（cache 序）调优。

**反转 D-HMR-2 推荐 A** → **locked B（一次性）**（SMPU 经验启示）。

**⚠️ F4 修正：locked B 条件化**——D-ED-2 locked B 须 §4 实证 pass：
- cache 序实证 pass（B2 可行）→ locked B 安全（一次性删 emitBuckets 改 deriveFromGraph，diff=0 验）
- cache 序实证 fail → 须先解法 D（cache order metadata）再 locked B；或回退解法 A（序重建，G5 风险）
- locked B 不是绝对——依赖 §4 实证结果。

---

## §3 行为 0 边界

### §3.1 one-shot diff=0（R-ED-3）

one-shot build 不传 state → 无 invalidatedModules → 全量编译。deriveFromGraph(graph, cache, entryId) 派生须 == emitBuckets 输出（同集同序同 code）。

**关键验证**：
1. 集——deriveFromGraph 闭包 == emitBuckets modules 集（无缺无重）
2. 序——deriveFromGraph 返回序 == emitBuckets 插入序（解法 B2 cache 序待实证）
3. code——cache.get(id).compileInfo.code == emitBuckets CompileInfo.code（同源 ModuleResultCache，应一致）
4. **moduleId 结构 match**（F9 补实证）：graph node id == `module.path` == `CompileInfo.path`——`addFile(currentPath, ...)` at `logic/index.ts:124`（currentPath = module.path）；`compileInfo.path = module.path` at `:113`。故 deriveFromGraph `moduleId: id` == orchestrator toEmitModule `moduleId: m.path`。EmitModule shape 全一致（moduleId/code/map/extraInfoCode 同源）。序 + 集是唯一实证 gap。

### §3.2 watch 路径（H1 不改 watch 行为）

H1 只改 emit 来源（emitBuckets → deriveFromGraph），watch 仍全量 emit（per-bucket）。增量 emit 是 H4 范围。H1 watch 字节恒等延续。

---

## §4 实证结果（base project，2026-10-09）

实证方法：临时 instrument orchestrator Logic emit task dump emitBuckets + cache + graph closures；跑 base one-shot build；分析 /tmp/h1-probe.json。Instrument 已 revert（tsc 0）。

### 实证 #1: cache 序 == emitBuckets 序? — **PASS ✓**
- cacheKeys (58) == emitBuckets 全序 (main++subs = 58)
- cache 插入序 (filter to emit集) == emitBuckets 全序 **完美序匹配**
- **结论：B2 可行**——deriveFromGraph 按 cache 插入序迭代即可匹配 emitBuckets 序。无需解法 D（order metadata）。

### 实证 #2: main 闭包集 == emitBuckets.main 集? — **PASS ✓**
- main entries (42 main pages) closure union (cached) = 52 modules
- emitBuckets.main = 52 modules
- set match ✓（无缺无重）
- **结论：main bucket = main entries union closure（cache 插入序）**

### 实证 #3: subs 映射? — **FAIL → 可解（cross-bucket dedup）**
- subPackageA: closure (cached) = 7 vs emit = 6
- **`app` 在 sub closure 但不在 emitBuckets.subs**（app 属 main bucket）
- 原因：subpackage page depends on `app`（graph 边），但 emitBuckets.subs 不含 `app`（compileJS for subs 传 mainCompileRes，已在 main 的不 push 到 sub）
- **解法 E（cross-bucket dedup）**：sub bucket = sub entries union closure **MINUS main bucket modules**
- 验证：7 minus `app` = 6 == emit ✓
- subPackageB/commonPackage: 0 pages → closure=0 == emit=0 ✓

### 实证 #4: independent subs — **N/A**
- base 无 `independent: true` subPackages
- code-level reasoning：compileJS for independent subs 传 `[]` 作 mainCompileRes → sub closure 不应含 main modules（graph 边须不连 independent sub → main）
- 待 independent subs 项目实证（或接受 code-level reasoning）

### 实证总结

| # | 实证 | 结果 | 影响 |
| --- | --- | --- | --- |
| 1 | cache 序 == emitBuckets 序 | **PASS ✓** | B2 可行；D-ED-2 locked B 安全 |
| 2 | main 闭包集 == emitBuckets.main | **PASS ✓** | main bucket = main entries union closure |
| 3 | subs 映射 | **FAIL → 可解** | 须解法 E cross-bucket dedup（sub minus main） |
| 4 | independent subs | N/A | code-level reasoning（compileJS 传 [] for independent） |

**D-ED-1 锁**：解法 **B2 + E**（cache 插入序 + cross-bucket dedup）。
- main bucket = main entries union closure（cache 插入序，无 dedup）
- sub bucket = sub entries union closure MINUS main bucket modules（cache 插入序，cross-bucket dedup）

**D-ED-2 锁**：**locked B 确认**（实证 #1 pass → cache 序一致 → 一次性安全）。F4 条件满足。

实证 pass → 升 ready → 实施。
