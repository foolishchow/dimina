# FE Tools HMR Emit Derive（H1 子门）

- Action: `fe-tools-hmr-emit-derive`
- Status: `draft`
- Updated: 2026-10-09
- Status authority: [Action Status](../STATUS.md)
- 父伞：[`fe-tools-hmr-compiler`](../fe-tools-hmr-compiler/README.md)（**`ready`**；H1 子门）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：增量链 G1-G5+IRC+SMPU complete；Packer shape（`convergence.ts` deriveFromGraph 已定义未调）

## 背景

HMR-compiler 伞 H1 子门。design.draft §1.2 实证：orchestrator Logic emit task（`orchestrator.ts:266-296`）当前读 `ctx.emitBuckets`（logic worker 全量输出）→ emit-engine 全量 re-emit。HMR 需增量 emit（只 emit 受影响 modules）。

`deriveFromGraph`（`convergence.ts:6`）已定义：`graph.getDependencyClosure(entryId)` → `cache.get(id)` → `EmitModule[]`。只读不改 graph/cache。但**未接线**——production emit 仍走 emitBuckets。

## Goal

orchestrator Logic emit task 改调 `deriveFromGraph`（非 `emitBuckets`），使 emit 集 = graph 派生。为 HMR 增量 emit 铺路（H4 per-module push 的前置）。

## Non-goals

- view/style emit（已 per-page in-domain via emitEntry/emitStyle，不经 emitBuckets——H1 不动）
- per-module HMR push（H4）
- registry 实体化（H2）
- per-module view/style cache（H3）
- 改 emit-engine / produceEntry 内部（仅改调用方 orchestrator）

## Scope

```text
H1:  orchestrator Logic emit task: emitBuckets → deriveFromGraph
     entry 映射: deriveFromGraph(entryId) → bucket 结构（main + subs）
     行为 0: one-shot diff=0（派生 == emitBuckets 输出）
不做: view/style emit; H2-H4; emit-engine 内部
```

## Design inputs

- `orchestrator.ts:266-296` Logic emit task（emitBuckets 消费点）
- `convergence.ts:6` deriveFromGraph（graph→cache→EmitModule，定义未调）
- `logic/index.ts:274-297` logicCompile（emitBuckets 生产：main + subs）
- `dependency-graph.ts:190` getDependencyClosure（per-entry 闭包）
- D-HMR-2（伞级）：方案 A 渐进 vs B 一次性——H1 formalize 锁（见 design.draft §2）

## Readiness gaps

- **D-ED-1 entry 映射**（design.draft §1）：deriveFromGraph per-entry vs emitBuckets per-bucket——main bucket = app + main pages union？subs = subpackage pages per root union？序如何保？待 design.draft 详评
- **D-ED-2 策略锁**（design.draft §2）：D-HMR-2 锁 A（渐进 dual-path）or B（一次性）——SMPU dual-path 经验启示

## 闭合条件

- D-ED-1 entry 映射冻结 + 实证字节一致
- orchestrator Logic emit task 改调 deriveFromGraph
- 行为 0：one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿
- emitBuckets 移除（或保留 fallback，D-ED-2 锁后定）
- 持久发现回流 architecture-notes
- STATUS / 导航一致
