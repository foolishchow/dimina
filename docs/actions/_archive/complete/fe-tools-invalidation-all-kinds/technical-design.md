# Technical Design — fe-tools-invalidation-all-kinds

Status: **complete（2026-10-07）**

## §1 现状

### §1.1 getInvalidatedModules（dependency-graph.ts:111-129）

```typescript
getInvalidatedModules(filePath: string): string[] {
    const normalizedPath = normalizeFilePath(filePath)
    const ownerKinds = this.fileKinds.get(normalizedPath)
    if (!ownerKinds) return []
    const pending: string[] = []
    for (const [owner, kinds] of ownerKinds) {
        if (kinds.has('logic')) pending.push(owner)   // ← 只推 logic owner
    }
    const visited = new Set<string>()
    while (pending.length > 0) {
        const id = pending.pop()!
        if (visited.has(id)) continue
        visited.add(id)
        for (const dependent of this.getDirectDependents(id, 'logic')) {  // ← 只走 logic 边
            pending.push(dependent)
        }
    }
    return [...visited].sort()
}
```

### §1.2 委托链（全部签名不变）

```
watch-plan.ts:162  computeInvalidatedModules(dependencyGraph, actuallyChanged)
  → invalidation.ts:40  graph.getInvalidatedModules(filePath)   （对 changedFiles 逐个 union）
  → packer/graph.ts:141  this.graph.getInvalidatedModules(file) （委托）
  → dependency-graph.ts:111  getInvalidatedModules              （本门改）
```

### §1.3 消费者

| 消费者 | 位置 | G3 后影响 |
|---|---|---|
| logic worker 跳过 | `logic/index.ts:82` `if (cached && options?.invalidatedModules && !options.invalidatedModules.has(currentPath))` | moduleId 跨 kind 共享（view `compile.ts:37` / style `parse-walk.ts:282` / logic `index.ts:124` 同 namespace addFile）→ G3 后 view/style 变更会把共享 moduleId 放进 set，logic worker 运行时会命中 → skip→recompile（保守过失效，**非 no-op**）；行为 0 经 stages 门控 + 相同源重编译保证（见 §3 D-G3-5） |
| PackerContext | `packer/types.ts:357` `invalidatedModules?: string[]` | 集合变大，语义变全 kind——契约注释更新 |
| session-state | `packer/session-state.ts:23` `invalidatedModules: Set<string>` | 不变 |

### §1.4 getAffectedEntries 已是全 kind（对齐参照）

`getAffectedEntries`（entry 级）已无 kind 过滤：owner 全取 + `getDirectDependents(id)` 全 kind。**G3 让 module 级与 entry 级对齐**——两个失效查询语义一致。

## §2 Target

### §2.1 getInvalidatedModules 泛化（D-G3-1 = D-IU-1）

```typescript
getInvalidatedModules(filePath: string): string[] {
    const normalizedPath = normalizeFilePath(filePath)
    const ownerKinds = this.fileKinds.get(normalizedPath)
    if (!ownerKinds) return []
    const pending: string[] = []
    for (const [owner] of ownerKinds) {
        pending.push(owner)                          // ← 全 kind owner（不取第二绑定，noUnusedLocals 干净）
    }
    const visited = new Set<string>()
    while (pending.length > 0) {
        const id = pending.pop()!
        if (visited.has(id)) continue
        visited.add(id)
        for (const dependent of this.getDirectDependents(id)) {  // ← 全 kind dependents
            pending.push(dependent)
        }
    }
    return [...visited].sort()
}
```

- 签名不变
- `getDirectDependents(id)` 无 kind 参数已返回全 kind dependents（既有能力，无需新增）

### §2.2 computeInvalidatedModules（D-G3-2）

`invalidation.ts:40` 零代码变更——`getInvalidatedModules` 泛化后，对 changedFiles 的 union 自动返回全 kind。

### §2.3 委托与契约（D-G3-3）

- `packer/graph.ts:141`、`packer/types.ts:278`、`watch-plan.ts:97` 全部签名不变
- `packer/types.ts` invalidatedModules 字段（:357）注释从 "logic moduleCache 失效集" 更新为 "全 kind 失效模块列表"（契约文档层面，不改类型）。注：:278 `getInvalidatedModules` 方法的 JSDoc "失效模块列表" 已够泛，不改。
- `invalidation.ts:30-39` `computeInvalidatedModules` JSDoc 更新：去 "logic Module 集/仅 logic 边/D-IV-6 kind=logic/logic moduleId 列表" → "全 kind Module 集/全 kind 边/D-IU-1 全 kind/全 kind moduleId 列表"（函数体不变，D-G3-2）

## §3 决策

### D-G3-1: getInvalidatedModules 去 `kind=logic` 硬编码（= D-IU-1）

owner 全推 + `getDirectDependents(id)` 全 kind 闭包。不改签名。

### D-G3-2: computeInvalidatedModules 零代码变更

行为自动随 `getInvalidatedModules` 泛化。签名不变（R-IU-2 满足）。

### D-G3-3: 委托链零改动

`packer/graph.ts` / `packer/types.ts` / `watch-plan.ts` 签名与调用不变。JSDoc 注释更新（语义描述，无类型/行为变更）：① `packer/types.ts:357` invalidatedModules 字段；② `invalidation.ts:30-39` computeInvalidatedModules（去 logic-only 措辞 + D-IV-6→D-IU-1）。

### D-G3-4: 测试更新（D-IV-6/7 反转，授权 = D-IU-1）

现 2 测试断言 logic-only 行为 → 反转。新增 view/style 覆盖：

| 测试 | 断言 |
|---|---|
| wxml → view owner 进集 | 反转原 `wxml → empty` |
| component.js → page 进集 | 反转原 D-IV-6 |
| wxss → style owner 进集 | 新增 |
| component .wxml 变更 → 依赖页 moduleId 进集 | 新增（view 边全 kind 闭包） |
| 同模块 js+wxml+wxss 任一变更 → 模块进集 | 新增（全 kind owner 收集） |
| shared JS → moduleId + logic dependents | 保留（回归） |
| page.js → page moduleId | 保留（回归） |
| unknown → `[]` 不抛 | 保留（D-IV-3） |

### D-G3-5: 行为 0 边界

`getInvalidatedModules` 只在 watch 路径（watch-plan）执行。examples one-shot build 不触发（`cached` 为空 → logic skip 分支不进入）→ 全量 7 项目 diff=0。

watch 路径**非 no-op**（§1.3）：G3 后 `invalidatedModules` 扩大为 superset——logic worker 运行时（stages 含 logic）会因共享 moduleId 命中而重编译更多模块。行为 0 经两条机制保证：
1. 纯 view/style 变更：`computeStagesForFiles` 按 changedFiles kind 算 stages → logic stage 不执行 → 不消费 set；
2. logic 涉及的变更：set 只扩大（superset，skip 仅当 NOT in set → 永不欠失效）→ 重编译相同源 → 字节一致 + 图边从不变 AST 重建一致。

边界：watch 效率回归（保守过失效）不在 diff=0 覆盖内——同 G1/G2（diff=0 只证 one-shot build；watch 行为由单测 + 审阅证明）。

### D-G3-6: 范围边界

只做 D-IU-1（dependency-graph.ts + spec.js + packer/types.ts JSDoc + invalidation.ts JSDoc，后两者 incidental）。不碰 D-IU-2..5（view/style cache、worker compileRes、watch-runner cache 实例）——归 G4/G5。

## §4 伪代码（实施）

```typescript
// src/model/dependency-graph.ts — 唯一函数体变更（另 2 处 JSDoc incidental，见 D-G3-3）
getInvalidatedModules(filePath: string): string[] {
    const normalizedPath = normalizeFilePath(filePath)
    const ownerKinds = this.fileKinds.get(normalizedPath)
    if (!ownerKinds) return []
    const pending: string[] = []
    for (const [owner] of ownerKinds) {
        pending.push(owner)
    }
    const visited = new Set<string>()
    while (pending.length > 0) {
        const id = pending.pop()!
        if (visited.has(id)) continue
        visited.add(id)
        for (const dependent of this.getDirectDependents(id)) {
            pending.push(dependent)
        }
    }
    return [...visited].sort()
}
```

## §5 风险

| 风险 | 缓解 |
|---|---|
| D-IV-6/7 反转被质疑为"无授权变更" | 授权 = incremental-unify D-IU-1（design draft §3 已拍板，deferred 仅指实施时点）；本门 README/requirements 明示 |
| 闭包变大——返回更多 module IDs | 预期行为（view/style 边也走闭包）；superset 保守方向，永不欠失效（D-G3-5） |
| logic worker 重编译扩大 | moduleId 跨 kind 共享 → view/style 变更命中共享 id → skip→recompile；行为 0 经 stages 门控 + 相同源重编译保证（§1.3 / §3 D-G3-5） |
| 行为 0 破坏 | 仅 watch 路径执行；examples one-shot 不触发（D-G3-5） |
| 测试语义漂移 | 反转用例直接改断言 + 新增 view/style 用例（D-G3-4） |
