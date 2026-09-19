# Validation — fe-tools-bundler-emit-memfs

权威参考：[Experience-Review.md](../../Experience-Review.md)

Status: **ready（2026-09-20）**

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-MM00 | tsc 前置 | `cd fe/tools/bundler && pnpm exec tsc -p tsconfig.build.json 2>&1 \| grep 'error TS' \| wc -l` = 0 | A-MM3 前置 | pending |
| P-MM01 | 全量回归 | `cd fe/tools/bundler && pnpm exec vitest run` → 全绿（含新增 `dev-server.spec.js` artifactResolver block） | A-MM3 | pending |
| P-MM02 | 结构判据：BuildModel.getArtifact | `grep -n 'getArtifact' src/model/build-model.ts` 命中（方法定义）；`grep -n '_artifactIndex' src/model/build-model.ts` 命中（lazy 索引 + add 失效） | A-MM1 | pending |
| P-MM03 | 结构判据：skipMaterialize + buildModel + PIPELINE_OPTION_KEYS | `grep -n 'skipMaterialize' src/compiler/pipeline/build-pipeline.ts` 命中（解构 + 条件守卫）；`grep -n 'buildModel' src/compiler/pipeline/build-pipeline.ts` 命中（result 字段）；`grep -n 'skipMaterialize' src/session/runner.ts` 命中（PIPELINE_OPTION_KEYS 白名单）；`grep -n 'skipMaterialize' src/session/index.ts` 命中（watch options + `!previewAdapter` 守卫）；`grep -n "build:end" src/session/index.ts` 命中（lifecycle listener） | A-MM1 / A-MM5 | pending |
| P-MM04 | 范围 + 零新依赖 | `git diff --stat` 限 build-model.ts / build-pipeline.ts / dev-server.ts / preview-adapter.ts / session/index.ts / session/runner.ts / dev-server.spec.js / Action 文档；`git diff package.json` 无新增依赖行 | A-MM2 / A-MM4 | pending |
| P-MM05 | dev server artifactResolver 注入 | `grep -n 'artifactResolver' src/dev/dev-server.ts` 命中（options + handler）；`grep -n 'stripAppIdPrefix' src/dev/dev-server.ts` 命中；`grep -n 'artifactResolver' src/session/preview-adapter.ts` 命中（透传） | A-MM3 | pending |
| P-MM06 | 冷路径保留 | `grep -n 'materialize' src/compiler/pipeline/build-pipeline.ts` 命中（条件守卫内）；`grep -n 'publishToDist' src/compiler/pipeline/build-pipeline.ts` 命中（条件守卫外，保留）；`grep -n 'writeFileSync' src/compiler/pipeline/config-compiler.ts` 命中（app-config.json 仍写盘） | A-MM2 | pending |

## 消融纪律

按 Experience-Review §6：
- I1 消融：拔 `getArtifact` → dev server miss → 全走磁盘 → materialize 被 `!previewAdapter` 守卫跳过 → build artifacts 不在磁盘 → **404 回归**
- I2 消融（守卫）：拔 `skipMaterialize` 条件 → materialize 仍跑 → dev 路径写盘（R-MM1 退化，不 404 但目标未达）
- I2 消融（白名单）：拔 `PIPELINE_OPTION_KEYS` 中 `skipMaterialize` → `splitBuildOverrides` throw `TypeError: unknown keys skipMaterialize` → **dev 启动 crash**
- I5 消融：拔 `build:end` listener → rebuild 后 `state.buildModel` 过期 → dev server serve 旧产物
- 消融补丁不入最终提交
