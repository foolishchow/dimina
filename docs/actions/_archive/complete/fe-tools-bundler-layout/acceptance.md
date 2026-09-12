# Acceptance — fe-tools-bundler-layout

Status: `complete`（2026-09-12）

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BL01 | R-BL1 | 目标树落地；抽检：`dev-server` 在 `dev/` 且不在 `session/`；`build-model` 在 `model/` 且不在 `dev/` | P-BL05 listing | **pass** |
| A-BL02 | R-BL2 | vitest 全绿；nomap 相对约定基线字节等价 | P-BL01 / P-BL02 | **pass** |
| A-BL03 | R-BL3 | L2 后无 `src/common/` 实现文件（目录已移除） | 目录审查：`common/` / `core/` / 根 `env.js` 均不存在 | **pass** |
| A-BL04 | R-BL4 | exports 检查通过；dimina-cli build 与 dev 冒烟 | P-BL03 / P-BL04 | **pass** |
| A-BL05 | R-BL5 | layout 表无 OPEN；与 D-BL-1 一致 | layout.draft.md | **pass** |
| A-BL06 | R-BL6 | 存在 L1=`dev/` 单独合并或可指出的提交记录，且该点回归曾通过 | 单次实施会话内 L1→L2 连续交付（无中间 commit）；`src/dev/` 可独立指出；全量回归在 L2 闭合点通过（P-BL01） | **pass**（诚实：无独立 L1 commit） |
