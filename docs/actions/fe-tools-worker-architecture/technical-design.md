# Technical Design — fe-tools-worker-architecture

> 状态：**草案（2026-09-10）**。决策 Action：ready = 冻结，不实施；实施分给 build-model / module-cache。基于 source-audit 的现状证据与本轮讨论收敛。

## 1. 决策依据（为什么需要演进）

三 worker 现状与目标的结构性落差（source-audit §3）：结果边界 / 协变 / 生命周期 / 协议 / 数据流 / 模型——六项落差是本 Action 决策的对象。**不是一步大改**：分四阶段，前 3 阶段不要求 worker 常驻。

## 2. 演进路径（四阶段）

```text
阶段 1：结果边界 — build-model M1
  现状：worker 直接写盘，主线程无产物
  改：   worker 产物回传主线程（BuildModel 持有）+ materialize 统一物化
  不改： worker new/terminate 生命周期；三 worker 数量
  验收： 字节级 diff=0（nomap + sourcemap 双模式）

阶段 2：协变 — build-model M2
  现状：入站全量 {pages, storeInfo}；出站仅 metadata
  改：   入站任务快照 {groups 子集, changedFiles, contextFingerprint}
         出站 WorkerResult {outputs, graph delta, diagnostics}
  不改： worker 生命周期；单向数据流原则确立
  验收： 受影响集行为断言 + 字节等价

阶段 3：模型层 — module-cache
  现状：主线程仅结构图；worker 内缓存单 stage 即亡
  改：   GroupModule（主线程权威）+ ViewFileModule/LogicFileModule 内容缓存
  不改： 三领域中间表示（DOM/AST/cssAST 异构）
  验收： 缓存命中 / 颗粒度断言

阶段 4：worker 常驻 service（可选，收益最高）— 未来独立决策
  改：   worker 内跨 update 保留 FileModule cache；生命周期管理
  前置： 阶段 1-3 完成；有明确性能收益测量支撑（避免盲目常驻）
```

## 3. D-WA 决策表（本讨论已收敛，待 ready 复核冻结）

| ID | 决策点 | 结论 |
| --- | --- | --- |
| D-WA-1 | worker 生命周期 | 前 3 阶段保留 new/terminate 无状态；接口按 service 形状设计（`update(changed)`）；常驻 = 阶段 4 可选 |
| D-WA-2 | logic 产物边界 | app 级单 bundle 保持；view/style 才 entry 级（粒度诚实） |
| D-WA-3 | 跨 build 复用途径 | 主线程 BuildModel 持有 entry 产物（未变 entry 不启动 worker）；非缓存实例共享 |
| D-WA-4 | 缓存分层 | worker 内 = 单 stage（FileModule 内容）；主线程 = 跨 build（entry 产物）；不冲突 |
| D-WA-5 | 数据流 | 单向：worker 回传 delta（outputs+graph delta+diagnostics），不反改 GroupModule；主线程合并 |
| D-WA-6 | 三领域中间表示 | 不统一（DOM vs AST vs cssAST）；共享仅机制/协议 |

## 4. WorkerTask / WorkerResult 协议草案（探针级，待细化）

```js
// 入站（阶段 2 起）
WorkerTask = {
  domain: 'view' | 'logic' | 'style',
  protocolVersion: 1,
  buildId,
  groups: [{ id, kind: 'page'|'component'|'npm',
             viewFiles?/logicFiles?/styleFiles? }],   // Group 子集（受影响）
  changedFiles: [...],
  contextFingerprint,     // 编译维度（minify/esTarget/fileTypes/renderer）
  seed: { targetPath, publishedPath },   // 种子/复用基线（若适用）
}

// 出站（单向回传，不反改模型）
WorkerResult = {
  domain, protocolVersion, buildId,
  outputs: [{ groupId, entryId, files: [{path, code}], sourcemaps? }],
  graphDelta,             // worker 观测到的依赖增量（主线程合并进 GroupModule）
  diagnostics: { warnings: [...], errors, shape: 'serializable' },
  stats: { cacheHits, cacheMisses, durationMs },   // 可观测性
  status: 'success' | 'failed',
}
```

**单向数据流原则（D-WA-5）**：worker 永不反向修改 GroupModule / BuildModel——只回传 delta；主线程是唯一合并与失效决策点。

## 5. 边界映射表（阶段 → 归属 Action）

| 阶段 | 归属 | 现有 Action 承接点 |
| --- | --- | --- |
| 1 结果边界 | build-model | M1（产物回传 + materialize + stage-channel 封装） |
| 2 协变 | build-model | M2（fingerprint + scan/closure 失效） |
| 3 模型层 | module-cache | MC1..3（FileModule 内容缓存 + Group 关联） |
| 4 常驻 service | 未来独立决策 | 前置：阶段 1-3 完成 + 性能收益测量 |

映射一致性：摊 up 与 build-model / module-cache README 交叉引用（R-WA4）。

## 6. 待探针（ready 前）

1. WorkerTask/Result 消息字段的精确形状（与 protocol.draft.md 的 output 流式设计对齐）
2. graphDelta 的序列化形状（DependencyGraph 增量 vs 全量快照——大图下增量必要）
3. contextFingerprint 与 build-model inputHash、module-cache key 的三方对齐

## 7. 风险

| 风险 | 缓解 |
| --- | --- |
| 决策 Action 变成无限讨论 | ready 条件写死（D-WA 全定稿 + 协议可评审）；ready 即冻结 |
| 边界映射双主/无主 | R-WA4 交叉引用一致性验收 |
| 阶段 4 常驻过早做 | 明确前置（阶段 1-3 + 性能测量），defer 记录 |
| 协议冻结过早被实现推翻 | 探针 + 后续 Action 冲突时修订记录（Closure ②） |