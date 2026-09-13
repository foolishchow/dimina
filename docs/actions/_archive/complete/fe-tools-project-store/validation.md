# Validation — fe-tools-project-store

Status: **complete（2026-09-12）** — PS1+PS2 已交付；Result 列已填；消融 ×3；已归档

**基线（RR3）：** `aa6b6508`（升 in_progress 时 HEAD = PS1 提交）；PS2 对拍基线 `0556f320`（PS2 改动前 HEAD）。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-PS01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | A-PS01 / A-PS05 | **pass（PS1+PS2）** — 487 tests / 73 suites 全绿（PS1：481；PS2：+2 watch store 用例） |
| P-PS02 | 字节等价 | 基线 vs HEAD，`examples/miniprogram/base`，nomap `diff -rq` MUST；sourcemap SHOULD | A-PS05 | **pass（PS1+PS2）** — PS1 对照 aa6b6508：nomap 94 / sourcemap 185 diff=0；PS2 对照 0556f320：nomap 0 / sourcemap 0 diff |
| P-PS03 | M-A / session 持有 | `__tests__/project-store.spec.js`（4 用例）+ 源码审查 | A-PS02 / A-PS03 | **pass（PS1）** — load 恰好 1 次 / graphSpy 被调 / captured≡result / 无 store 临时路径；双 createBundler 隔离由 A-PS02 源码审查覆盖；无 `new` 挂 ctx（RR6）✓；build:start 剥 store（FR2）✓ |
| P-PS04 | watch 刀 A / **PS2** | watch-runner.spec（7 用例，+3 PS2）；session.watch 注入 state.store；无 store 直调临时 store（W2）；**闭包镜像已删（W3→仅 Store）** | A-PS04 | **pass（PS1+PS2）** — watch/dev 全绿；注入 store 同一引用传 build；无 store 临时 create 复用；闭包 `dependencyGraph` 变量与 `new DependencyGraph` 已删；增量 rebuild plan 读 store 活图（spy 验证） |
| P-PS05 | exports | `node scripts/check-package-exports.js` | A-PS06 | **pass（PS1+PS2）** — 6 ESM exports 校验通过；无新增子路径 |
| P-PS06 | diff 范围 | `git diff --stat` | A-PS02 / A-PS06 | **pass（PS1+PS2）** — PS1：project-store+session+watch-runner+index+测试；PS2：watch-runner（删闭包+store 持有）+session.watch（补 store）+watch-runner.spec；无阶段表/cache/exports 混入 |
| P-PS07 | CLI 冒烟（SHOULD） | base 工程 build（双模式） | A-PS05 | **pass（PS1+PS2）** — 双模式构建成功（P-PS02 内完成）；watch 冒烟由 watch-runner/session 测试覆盖 |
| P-PS08 | M-A 消融（SHOULD） | project-store.spec M-A 用例拔挂接 | A-PS03 Notes | **pass（PS1）** — 消融 §A：store 解析改回 createProjectStore() → 3 用例失败于 load 0 次；恢复后 4/4 绿 |

消融：P-PS08 SHOULD；纯接线以 P-PS01/02 为主证据。  
**L4** 不设独立 P-*（Non-acceptance）。
