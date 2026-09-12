# Validation — fe-tools-bundler-layout

Status: `ready`（计划冻结；Result 实施时填）

基线建议：升 `in_progress` 前的 HEAD（写入本表 Result 时记下 hash）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-BL01 | 全量回归 | `pnpm --filter @dimina/bundler test`（或现行 vitest 命令） | pending |
| P-BL02 | 字节等价 | 基线 vs HEAD，**nomap MUST**；sourcemap SHOULD | pending |
| P-BL03 | exports | `check-package-exports`（或 package 脚本 / postbuild） | pending |
| P-BL04 | CLI 冒烟 | `dimina-cli build` + `dimina-cli dev`（HTTP） | pending |
| P-BL05 | 目录口诀 | listing：`dev/` 含 dev-server；`session/` 无 dev-server 实现；`model/` 含 build-model | pending |
| P-BL06 | diff 范围 | 以搬家 + import + 垫片删除为主；无 view/logic/style 算法大改 | pending |

消融：纯搬家可不做机制消融；L2 删垫片后 P-BL01 仍绿即可。
