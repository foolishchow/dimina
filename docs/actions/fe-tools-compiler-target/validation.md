# Validation — fe-tools-compiler-target

Status: **in_progress（2026-09-14）** — P-CT00..08；**基线（T0）= `4f7b712a`**（T1 = T0 合入后 HEAD；T2 = T1 合入后 HEAD）；Result 届时回填

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-CT00 | dist 镜像同步前置 | src 改动后先 `pnpm build`（`scripts/sync-dist-from-src.js`）再执行 P-CT02 / P-CT06——exports 面与 CLI 在 **dist**，测试直连 **src** | A-CT3 / A-CT6 前置 | pending |
| P-CT01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | A-CT3 | pending |
| P-CT02 | 字节等价 | 基线 vs HEAD，`examples/miniprogram/base`，nomap + sourcemap `diff -rq` MUST（前置 P-CT00）。**基线随门递进**：T0 = 升 in_progress 时 HEAD；T1 = T0 合入后 HEAD；T2 = T1 合入后 HEAD | A-CT3 | pending |
| P-CT03 | lifecycle 序列 | session-unify.spec 行为同构断言（`.build` vs `watch.start` 首编 vs `.dev` 首编）继续全绿——形态重构不得改变事件序列 | A-CT2 / A-CT3 | pending |
| P-CT04 | T0 组合行为 | `build --platform web`（CLI）→ 非零退出 + stderr 含 `command:'build' requires compile.platform:'native'`；API `resolveBundlerConfig({command:'build', cli:{platform:'web'}})` → throw 同消息；`/D-R2\/C/` 既有用例不改全绿；直调 `build({platform:'web'})` 仍可编译（编程自由度）；**compile-config.spec 直测不受 T0 影响**（不经 resolveBundlerConfig，F4 明示） | A-CT0 | pending |
| P-CT05 | 结构判据 | ① compile-target.spec 单测（create：白名单 / 非法 stages / renderer 校验 / **消息文本锁定**；derive：bindings 组合矩阵）+ ② 源文件锚定（**T1 子集**：`_runBuild` 顶部与组装处无 `getRenderer(` 反查、无 `MODE_PRESETS`/`sourcemapStrategyFor` 私算；**T2 子集**：`'编译项目'` 闭包内无 `!miniGame` 直耦 push、无内联 `sourcemapTargetPath`、无手工三捆 workerOptions；`BUILD_END` 载荷 appId 经 bindings）③ E1 不变量文档 + grep 锚定。**per-gate 验证取子集：T1 跑 ②T1 子集 + ③；T2 跑 ②T2 子集** | A-CT1 / A-CT2 / A-CT4 / A-CT5 | pending |
| P-CT06 | exports | 前置 P-CT00；`node scripts/check-package-exports.js`（compile-target 不得进入公开面） | A-CT3 / A-CT0 | pending |
| P-CT07 | diff 范围 | `git diff --stat`（限 compile-target + build-pipeline + session/resolve + bin/index + 测试） | A-CT6 | pending |
| P-CT08 | 消融 ×3 | **T0**：拔断言 → P-CT04 拒绝用例失败 → 恢复全绿；**T1**：拔 createCompileTarget（回落内联）→ P-CT05 ②T1 子集失败 → 恢复全绿；**T2**：拔 deriveStagePlan → P-CT05 ②T2 子集失败 → 恢复全绿 | A-CT0 / A-CT1 / A-CT2 Notes | pending |

## 消融纪律（Experience-Review §6）

- 只禁用 / 移除待验证的最小修复机制；**不得**同时修改测试、夹具、输入数据和断言；
- 消融后目标用例必须因**原缺陷对应的断言**失败（非编译错误 / 环境损坏 / 无关异常 / 超时）；
- 恢复修复后用相同命令与环境再次运行并通过；
- 消融补丁、临时日志**不得**进入最终提交；交付说明记录消融内容、预期与实际失败点。
