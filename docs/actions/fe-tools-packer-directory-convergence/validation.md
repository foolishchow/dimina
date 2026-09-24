# Validation — fe-tools-packer-directory-convergence

Status: **draft（2026-10-09）**

## Validation Plan（实施后执行）

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-DC1 | packer/ 子目录结构 | `ls -d src/packer/{graph,store,registry,state,cache,emit,worker,pipeline,aspect}/` 9 子目录存在 + 文件归位对照 design.draft §3.1 | pending |
| P-DC2 | model/ 解散 | `ls src/model/` = 空或目录不存在 | pending |
| P-DC3 | pipeline + worker-runtime 解散 | `ls src/compiler/pipeline/ src/compiler/worker-runtime/` = 空或不存在 | pending |
| P-DC4 | core/ 解体 | `ls src/compiler/core/` = 空或不存在；shared/compiler 文件归位 | pending |
| P-DC5 | compiler/ 只剩 per-kind | `ls src/compiler/` 仅 logic/view/style | pending |
| P-DC6 | 行为 0 三件套 | `tsc --noEmit` 0；vitest 全绿（87/646 基线）；6 项目 one-shot `diff -r` baseline = 0 | pending |
| P-DC7 | 函数体零改（纯搬迁红线） | `git diff --stat` 行数 ~= import 改写数；抽样 git diff 函数体无变更（只 import 行 + 文件位置） | pending |
| P-DC8 | ③b/③c 消解 | `grep -rn "from '.*\(\.\./\)*compiler/pipeline" src/packer/` = 0（packer 内无 compiler/pipeline 反向 import）；③a 已 fixed（chain-residuals，非本 Action） | pending |
| P-DC9 | packer→compiler 方向单向 | `grep -rn "from '.*packer/" src/compiler/logic src/compiler/view src/compiler/style` 非零（packer→compiler I/O 供给，方向正确）；反向（compiler→packer 内部非 I/O）须消除 | pending |
| P-DC10 | tracker + arch sync | tracker ③b/③c 状态更新；architecture-notes 新增目录收敛条目 + **更新 stale path 引用**（`grep 'pipeline/' docs/fe-tools/architecture-notes.md` 旧路径 → packer/ 新路径）；STATUS/TODO sync | pending |

## 行为 0 边界（本 Action 特别声明）

- **纯搬迁红线（D-DC-2）**：函数体、逻辑、类型签名不动。只 import 路径 + 文件位置变。验证：P-DC7 函数体 git diff 仅 import 行
- **6 项目 diff=0**：逻辑零改 → 产物字节不变（import 行变不影响 build 产物——build 产物是编译输出，非源码 import）
- **ESM 显式后缀**：dist 是 tsc 直编译（不 bundle），Node native 跑须显式 `.ts`/`.js` 后缀——搬迁后所有 import 后缀须验
- **分批行为 0 gate（D-DC-3）**：每批（B1-B5）结束 tsc + vitest + 6 项目 diff，不累积到末尾验

## Uncovered（预期声明）

- D（facade + collaborator）/ C（aspect）/ B（ALS 闭合）——后续轮
- compiler per-kind 子结构调整——后续
- logicLoader 对齐 buildJSByPath（dispatch wiring，runtime 就绪后）
