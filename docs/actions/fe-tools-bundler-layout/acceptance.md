# Acceptance — fe-tools-bundler-layout

Status: `ready`

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BL01 | R-BL1 | 目标树落地；抽检：`dev-server` 在 `dev/` 且不在 `session/`；`build-model` 在 `model/` 且不在 `dev/` | 目录 listing | pending |
| A-BL02 | R-BL2 | vitest 全绿；nomap 相对约定基线字节等价 | validation | pending |
| A-BL03 | R-BL3 | L2 后无 `src/common/` 实现文件（目录已移除） | 目录审查 | pending |
| A-BL04 | R-BL4 | exports 检查通过；dimina-cli build 与 dev 冒烟 | validation | pending |
| A-BL05 | R-BL5 | layout 表无 OPEN；与 D-BL-1 一致 | layout.draft.md | **pass**（ready 时已满足） |
| A-BL06 | R-BL6 | 存在 L1=`dev/` 单独合并或可指出的提交记录，且该点回归曾通过 | git / validation | pending |
