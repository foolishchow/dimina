# Acceptance — fe-tools-hmr-per-module-cache

Status: **ready（2026-10-09）**

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-PMC1 | R-PMC-1 view cache per-module | viewCache `Map<string, ViewCompiledModule>` + order list | grep session-state: per-module viewCache | pending |
| A-PMC2 | R-PMC-2 style cache per-module | styleCache per moduleId | grep session-state: per-module styleCache | pending |
| A-PMC3 | R-PMC-3 bundle 重建字节一致 | emit 时 per-module → bundle 重建（order list）字节一致 | watch diff=0 vs per-page-bundle | pending |
| A-PMC4 | R-PMC-4 行为 0 | one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿 | diff -r baseline == 0; tsc 0; vitest pass | pending |
| A-PMC5 | R-PMC-5 per-module invalidation | 单 module dirty → 单 cache-miss | grep view/index: per-module invalidation | pending |

## Non-acceptance

- per-module HMR push（H4）
- logic cache 粒度
- G5 设计改

## Traceability

- R-PMC-1..5 ↔ A-PMC1..5
- 父伞 HMR-compiler H3 子门
- D-PMC-1 bundle 重建策略（design.draft §1）↔ A-PMC3
- D-PMC-2 invalidation 粒度（design.draft §2）↔ A-PMC5
- D-PMC-3 watch 字节恒等（design.draft §3）↔ A-PMC3/4
