# Acceptance — fe-tools-hmr-registry-materialize

Status: **ready（2026-10-09）**

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-REG1 | R-REG-1 registry 实体化 | emptyRegistry → 实体 registry（Loader/Compiler/Emitter 注册） | grep orchestrator: registry.get(kind); 0 emptyRegistry | pending |
| A-REG2 | R-REG-2 compile-target 替代 | compile 段经 registry 派发（非 deriveStagePlan stages） | grep compile-target: 0 compile 段; registry 派发 | pending |
| A-REG3 | R-REG-3 行为 0 | one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿 | diff -r baseline == 0; tsc 0; vitest pass | pending |
| A-REG4 | R-REG-4 env.ts gradual | load 函数 → Loader registry（gradual） | grep env.ts: load 委托 Loader | pending |
| A-REG5 | R-REG-5 compile-target 移除 | deriveStagePlan compile 段 dead code 移除 | grep compile-target: 0 compile 段 | pending |

## Non-acceptance

- per-module view/style cache（H3）
- per-module HMR push（H4）
- types.ts 接口改

## Traceability

- R-REG-1..5 ↔ A-REG1..5
- 父伞 HMR-compiler H2 子门
- D-REG-1 registry 策略（design.draft §1）↔ A-REG1/2
- D-REG-2 load 归属（design.draft §2）↔ A-REG4
- D-REG-3 stage 归属（design.draft §3）↔ A-REG2
