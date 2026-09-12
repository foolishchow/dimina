# Validation — fe-tools-project-store

Status: `draft`（计划；与 Acc Round 2 + RR 对齐；Result 实施时填）

**基线（RR3）：** 升 `in_progress` 时记下对照 HEAD SHA；nomap 对拍相对该基线（不预绑今天 tip）。

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-PS01 | 全量回归 | `npm test` in `fe/tools/bundler` | A-PS01 / A-PS05 | pending |
| P-PS02 | 字节等价 | 基线 vs HEAD，`examples/miniprogram/base`，nomap `diff -rq` MUST；sourcemap SHOULD | A-PS05 | pending |
| P-PS03 | M-A / session 持有 | `build({ store })`：`Object.is`；两次 createBundler 两实例；**无**公开 `.store`；审查无 `new` 挂 ctx（RR6）；**`build:start` 剥 store（FR2）** | A-PS02 / A-PS03 | pending |
| P-PS04 | watch 刀 A | 既有 watch/dev 测例仍绿；直调 `createBuildWatcher` 无 store 不炸；闭包镜像仍在（审查） | A-PS04 | pending |
| P-PS05 | exports | `check-package-exports`；无新增子路径 | A-PS06 | pending |
| P-PS06 | diff 范围 | 符合 R1 清单；无 BP1 阶段表大搬；无 PS2 删闭包；无 cache 算法改 | A-PS02 / A-PS06 | pending |
| P-PS07 | CLI 冒烟（SHOULD） | dimina-cli / bundler CLI：build；可选 watch/dev 冒烟 | A-PS05 | pending |
| P-PS08 | M-A 消融（SHOULD） | 可拔挂接时：非同引用 → 断言失败；不可做则记原因 | A-PS03 Notes | pending |

消融：P-PS08 SHOULD；纯接线以 P-PS01/02 为主证据。  
**L4** 不设独立 P-*（Non-acceptance）。
