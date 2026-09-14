# Validation — fe-tools-compiler-target

Status: **in_progress（2026-09-14）** — P-CT00..08；**基线（T0）= `4f7b712a`**；**基线（T1）= `f89f4488`**；**基线（T2）= T1 工作区 tip 产物快照**

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-CT00 | dist 镜像同步前置 | src 改动后先 `pnpm build`（`scripts/sync-dist-from-src.js`）再执行 P-CT02 / P-CT06——exports 面与 CLI 在 **dist**，测试直连 **src** | A-CT3 / A-CT6 前置 | **pass** — 各门均先 sync-dist |
| P-CT01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | A-CT3 | **pass（T2：525/525）** — 75 suites（compile-target.spec 23） |
| P-CT02 | 字节等价 | 基线 vs HEAD，`examples/miniprogram/base`，nomap + sourcemap `diff -rq` MUST（前置 P-CT00）。**基线随门递进** | A-CT3 | **pass（T2）** — 对照 T1 产物快照：nomap 94 / sourcemap 185 diff=0（同 examples 绝对路径） |
| P-CT03 | lifecycle 序列 | session-unify.spec 行为同构断言继续全绿 | A-CT2 / A-CT3 | **pass** — 含于 525 全绿 |
| P-CT04 | T0 组合行为 | build+web 拒绝 / 直调自由度 / D-R2/C 双侧 | A-CT0 | **pass（T0）** |
| P-CT05 | 结构判据 | ① 单测 + ②T1/T2 源文件锚定 + ③ E1 文档 | A-CT1 / A-CT2 / A-CT4 / A-CT5 | **pass** — ①+②T1+②T2+③ 全绿 |
| P-CT06 | exports | `node scripts/check-package-exports.js` | A-CT3 / A-CT0 | **pass** — 6 ESM + CLI；无 compile-target 公开面 |
| P-CT07 | diff 范围 | `git diff --stat` | A-CT6 | **pass** — compile-target + build-pipeline + 测试 + Action 文档（+ T0 的 resolve/bin） |
| P-CT08 | 消融 ×3 | T0/T1/T2 per-gate | A-CT0 / A-CT1 / A-CT2 Notes | **pass** — T0 ✓；T1 回落基线 pipeline → ②T1 3 fail → 恢复；**T2 回落 T1 pipeline → ②T2 2 fail → 恢复 525 绿** |

## 消融纪律（Experience-Review §6）

- 只禁用 / 移除待验证的最小修复机制；**不得**同时修改测试、夹具、输入数据和断言；
- 消融后目标用例必须因**原缺陷对应的断言**失败（非编译错误 / 环境损坏 / 无关异常 / 超时）；
- 恢复修复后用相同命令与环境再次运行并通过；
- 消融补丁、临时日志**不得**进入最终提交；交付说明记录消融内容、预期与实际失败点。
