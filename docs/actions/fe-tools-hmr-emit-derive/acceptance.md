# Acceptance — fe-tools-hmr-emit-derive

Status: **draft（2026-10-09）**

## Acceptance

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-ED1 | R-ED-1 deriveFromGraph 接线 | orchestrator Logic emit task 调 deriveFromGraph（非 ctx.emitBuckets） | grep orchestrator: deriveFromGraph; 0 emitBuckets 读取 | pending |
| A-ED2 | R-ED-2 entry 映射 | main bucket = app + main pages union 闭包；subs = root 下页 union 闭包；序一致 | 实证 cache 序 == emitBuckets 序 + 集一致 | pending |
| A-ED3 | R-ED-3 行为 0 | one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿 | diff -r baseline == 0; tsc 0; vitest pass | pending |
| A-ED4 | R-ED-4 logic-only | view/style emit 不动（emitEntry/emitStyle 不变） | grep view/style emit 0 改动 | pending |
| A-ED5 | R-ED-5 emitBuckets 移除 | logicCompile 不返 emitBuckets；stage-channel 不存；orchestrator 不读 | grep emitBuckets 0 src 残留 | pending |

## Non-acceptance

- view/style emit（H1 不动）
- per-module HMR push（H4）
- registry 实体化（H2）
- per-module view/style cache（H3）

## Traceability

- R-ED-1..5 ↔ A-ED1..5
- 父伞 HMR-compiler H1 子门
- D-ED-1 entry 映射（design.draft §1）↔ A-ED2
- D-ED-2 策略 locked B（design.draft §2，反转 D-HMR-2 推荐 A）↔ A-ED5
