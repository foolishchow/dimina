# Acceptance — fe-tools-packer-directory-convergence

Status: **draft（2026-10-09）**

## Acceptance（实施后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-DC1 | R-DC-1 packer 域归位 | `ls src/packer/{graph,store,registry,state,cache,emit,worker,pipeline,aspect}/` 9 子目录存在 + 文件归位 | ls + 归位映射对照（design.draft §3.1） | pending |
| A-DC2 | R-DC-2 model/ 解散 | `ls src/model/` = 空或目录删 | ls | pending |
| A-DC3 | R-DC-3 pipeline+worker-runtime 解散 | `ls src/compiler/pipeline/ src/compiler/worker-runtime/` = 空或删 | ls | pending |
| A-DC4 | R-DC-4 core/ 解体 | `ls src/compiler/core/` = 空或删；packer 域文件在 packer/ 子目录；shared/compiler 文件在 shared/ 或 compiler/utils/ | ls + 归位对照 | pending |
| A-DC5 | R-DC-5 compiler/ 只剩 per-kind | `ls src/compiler/` 仅 logic/view/style 三目录 | ls | pending |
| A-DC6 | R-DC-6 行为 0 | tsc 0 + vitest 全绿 + 6 项目 diff=0 + 函数体 git diff 仅 import 行 | 三件套执行记录 + git diff --stat | pending |
| A-DC7 | R-DC-7 ③a/b/c 消解 | `grep pipeline/ src/packer/cache/{invalidation,compile-cache}.ts src/packer/emit/convergence.ts` = 0（③b/③c 若 residual 仍 type-only，记 tracker 不阻塞） | grep + tracker | pending |
| A-DC8 | R-DC-8 tracker+arch sync | tracker ③a/b/c 状态更新 + architecture-notes 目录收敛条目 + STATUS/TODO sync | tracker diff + arch-notes review | pending |

## Non-acceptance（显式排除）

- D（facade + collaborator 抽取）——Round 1
- C（aspect 分离）——Round 2
- B（ALS→PackerContext 闭合）——Round 2 后 checkpoint
- compiler/logic|view|style per-kind 子结构调整——后续
- 函数体/逻辑变更（纯搬迁红线，D-DC-2）
- logicLoader 对齐 buildJSByPath（dispatch wiring，Round E，runtime 就绪后）

## Traceability

- F-PA-1..6（设计模式缺陷）→ A-DC1..5（散落温床解）
- ③a/b/c（跨层 import）→ A-DC7
- 行为 0 → A-DC6
- tracker → A-DC8
