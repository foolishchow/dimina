# Acceptance — fe-tools-hmr-push

Status: **ready（2026-10-09）**

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-PUSH1 | R-PUSH-1 L_HMR level | RELOAD_LEVELS 含 L_HMR | grep dev-reload: L_HMR | pending |
| A-PUSH2 | R-PUSH-2 增量 payload | dev-server 增量 payload broadcast | grep dev-server: 增量 payload | pending |
| A-PUSH3 | R-PUSH-3 materialize 增量 | publishToDist 增量发布 + dirty tracking | grep publish: 增量; build-model: dirty | pending |
| A-PUSH4 | R-PUSH-4 fallback L1 | L_HMR fallback → L1（runtime-side downgrade） | grep dev-reload: fallback | pending |
| A-PUSH5 | R-PUSH-5 行为 0 | one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿 | diff -r baseline == 0; tsc 0; vitest pass | pending |

## Non-acceptance

- runtime HMR API 协议定义
- runtime per-module hot-swap 实现

## Traceability

- R-PUSH-1..5 ↔ A-PUSH1..5
- 父伞 HMR-compiler H4 子门
- D-PUSH-1 L_HMR level（design.draft §1）↔ A-PUSH1/2
- D-PUSH-2 fallback downgrade（design.draft §2）↔ A-PUSH4
- D-PUSH-3 materialize 增量化（design.draft §3）↔ A-PUSH3
