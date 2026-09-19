# Acceptance — fe-tools-bundler-emit-memfs

Status: **complete（2026-09-20）** — D-MM-1..6 全拍板，实施完成

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MM1 | R-MM1 | dev 模式 `materialize` 被跳过（`skipMaterialize` 生效）；BuildModel.entries 不写盘 | P-MM03 grep ✓ + 消融 I3（拔 artifactResolver 调用 → test (a)(d) fail）✓ | pass |
| A-MM2 | R-MM2 | 冷路径仍写盘：`app-config.json`（config-compiler）、tabBar icons（collectAssets）、`publishToDist` move 保留 | P-MM06 grep ✓ + P-MM04 范围 ✓ | pass |
| A-MM3 | R-MM3 | 行为 0：全量 vitest 588/589 绿（compile-cli-cache flaky timeout 单独重跑 pass）；4 组 diff=0；compile 模式不受影响（`build()` 仍 materialize） | P-MM01 ✓ / P-MM05 ✓ + 4-group diff=0 | pass |
| A-MM4 | R-MM4 | 零新依赖：`package.json` 无 memfs 或其他新增 | P-MM04 `git diff package.json` 无变化 ✓ | pass |
| A-MM5 | R-MM5 | rebuild 后 dev server 用最新 BuildModel（`build:end` listener 更新 `state.buildModel`）；自定义 adapter 路径下 `skipMaterialize = false` 防回归 | P-MM03 grep ✓ + 消融 I2 白名单（TypeError crash）✓；消融 I5 不适用隔离测试（结构 grep 覆盖） | pass |

## Notes

- 升 `in_progress` 需明确授权。
- 消融 MUST：I1 拔 `getArtifact` → 404 回归；I5 拔 `build:end` listener → serve 旧产物；I2 拔 `PIPELINE_OPTION_KEYS` 白名单 → `TypeError` crash。
- compile 模式（one-shot `build()`）不传 `skipMaterialize` → materialize 仍跑 → 产物仍落盘（R-MM3 compile 不受影响）。
- 自定义 `previewAdapter` 路径下 `skipMaterialize = false`（`!previewAdapter` 守卫）→ materialize 仍跑 → dev server 从磁盘读 → 无回归。
