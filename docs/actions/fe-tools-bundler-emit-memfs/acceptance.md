# Acceptance — fe-tools-bundler-emit-memfs

Status: **ready（2026-09-20）** — D-MM-1..6 全拍板

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MM1 | R-MM1 | dev 模式 `materialize` 被跳过（`skipMaterialize` 生效）；BuildModel.entries 不写盘 | P-MM03 grep + 消融 | pending |
| A-MM2 | R-MM2 | 冷路径仍写盘：`app-config.json`（config-compiler）、tabBar icons（collectAssets）、`publishToDist` move 保留 | P-MM04 源码审查 | pending |
| A-MM3 | R-MM3 | 行为 0：全量 vitest 绿；dev HTTP 响应字节不变（resolver hit body == 磁盘读 body）；compile 模式不受影响（`build()` 仍 materialize） | P-MM01 / P-MM05 | pending |
| A-MM4 | R-MM4 | 零新依赖：`package.json` 无 memfs 或其他新增 | P-MM04 `git diff package.json` | pending |
| A-MM5 | R-MM5 | rebuild 后 dev server 用最新 BuildModel（`build:end` listener 更新 `state.buildModel`） | P-MM03 + 消融 | pending |

## Notes

- 升 `in_progress` 需明确授权。
- 消融 MUST：I1 拔 `getArtifact` → 404 回归；I5 拔 `build:end` listener → serve 旧产物。
- compile 模式（one-shot `build()`）不传 `skipMaterialize` → materialize 仍跑 → 产物仍落盘（R-MM3 compile 不受影响）。
