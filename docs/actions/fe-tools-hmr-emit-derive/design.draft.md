# Design Draft — fe-tools-hmr-emit-derive

> 本文件是设计草稿，非正式文档。用于 entry 映射 + 策略锁后产出正式 technical-design。

Status: **draft（2026-10-09）**

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

### §1.5 D-ED-1 design gate

解法 A 序重建有 G5 P-G506 先例风险（不可行）。解法 B 待实证（cache 序 == emitBuckets 序?）。解法 C 改 graph schema（超 scope）。

**推荐解法 B**（cache 插入序）——最小改动 + 不改 graph schema。待 design.draft 实证 cache 序一致性。

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
2. 序——deriveFromGraph 返回序 == emitBuckets 插入序（解法 B cache 序待实证）
3. code——cache.get(id).compileInfo.code == emitBuckets CompileInfo.code（同源 ModuleResultCache，应一致）

### §3.2 watch 路径（H1 不改 watch 行为）

H1 只改 emit 来源（emitBuckets → deriveFromGraph），watch 仍全量 emit（per-bucket）。增量 emit 是 H4 范围。H1 watch 字节恒等延续。

---

## §4 实证待做（升 ready 前）

1. **cache 序实证**：ModuleResultCache 插入序 == emitBuckets.main 序?（解法 B 可行性）
2. **闭包集实证**：deriveFromGraph(graph, cache, 'app') + main pages union == emitBuckets.main 集?（去重后）
3. **subs 映射实证**：分包 root 下页 union 闭包 == emitBuckets.subs[root]?

实证通过 → D-ED-1 解法 B 锁 → 升 ready → 实施。

实证失败 → 解法 A（union + 序重建，G5 风险）or 解法 C（graph schema，超 scope）—— design gate 再评。
