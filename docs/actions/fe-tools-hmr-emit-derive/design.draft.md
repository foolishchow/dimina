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

**解法 B（cache 内存序）**：
- deriveFromGraph 改为不 `.sort()`，按 graph 遍历序（BFS pop 序）返回
- 或 ModuleResultCache 维护插入序（Map 保持插入序），deriveFromGraph 按 cache key 序
- **待实证**：cache 插入序 == emitBuckets 序?

**解法 C（bucket 概念进 graph）**：
- graph 加 'package' kind 边（main package → app + main pages；sub package → sub pages）
- deriveFromGraph(graph, cache, 'main-package') → main bucket closure
- **改 graph schema**——超出 H1 scope（触碰 G1 graph-persist）

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
