# Acceptance — fe-tools-packer-directory-convergence

Status: **complete（2026-10-09）**

## Acceptance（实施后填实）

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-DC1 | R-DC-1 packer 域归位 | `ls src/packer/{graph,store,registry,state,cache,emit,worker,pipeline,aspect}/` 9 子目录存在 + 文件归位 | ls + 归位映射对照（design.draft §3.1） | done |
| A-DC2 | R-DC-2 model/ 解散 | `ls src/model/` = 空或目录删 | ls | done |
| A-DC3 | R-DC-3 pipeline+worker-runtime 解散 | `ls src/compiler/pipeline/ src/compiler/worker-runtime/` = 空或删 | ls | done |
| A-DC4 | R-DC-4 core/ 解体 | `ls src/compiler/core/` = 空或删；packer 域文件在 packer/ 子目录；shared 文件在 `shared/` | ls + 归位对照 | done |
| A-DC5 | R-DC-5 compiler/ 只剩 per-kind | `ls src/compiler/` 仅 logic/view/style 三目录 | ls | done |
| A-DC6 | R-DC-6 行为 0 | tsc 0 + vitest 全绿 + 6 项目 diff=0 + 函数体机械 check（非 import 删除行=0） | 三件套执行记录 + `git diff -M` 机械 check | done |
| A-DC7 | R-DC-7 ③b/③c 消解 | `grep -rn "from '.*\(\.\./\)*compiler/pipeline" src/packer/` = 0（packer 内无 compiler/pipeline 反向 import）；③a 已 fixed（非本 Action） | grep + tracker | done |
| A-DC8 | R-DC-8 tracker+arch sync | tracker ③b/③c 状态更新；architecture-notes **新增**目录收敛条目 + **更新** stale path 引用（`grep 'pipeline/' docs/fe-tools/architecture-notes.md` 旧路径全更新）；STATUS/TODO sync | tracker diff + arch-notes review + grep | done |

## Non-acceptance（显式排除）

- D（facade + collaborator 抽取）——Round 1
- C（aspect 分离）——Round 2
- B（ALS→PackerContext 闭合）——Round 2 后 checkpoint
- compiler/logic|view|style per-kind 子结构调整——后续
- 函数体/逻辑变更（纯搬迁红线，D-DC-2）
- logicLoader 对齐 buildJSByPath（dispatch wiring，Round E，runtime 就绪后）

## Traceability

- F-PA-1..6（设计模式缺陷）→ A-DC1..5（散落温床解）
- ③b/③c（跨层 import；③a 已 fixed）→ A-DC7
- 行为 0 → A-DC6
- tracker → A-DC8
