# Validation — fe-tools-session-unify

Status: **in_progress（2026-09-14）** — P-SU00..07；**基线（S1）= `ce14fa79`**（S2 基线 = S1 合入后 HEAD）；Result 届时回填

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-SU00 | dist 镜像同步前置 | src 改动后先 `pnpm build`（`scripts/sync-dist-from-src.js`：src→dist 整树镜像）再执行 P-SU02 / P-SU05——exports 面与 CLI 在 **dist**，测试直连 **src**；不同步则 exports 校验对旧镜像空转假阳性 | A-SU03 / A-SU04 / A-SU05 ③ 前置 | pending |
| P-SU01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | A-SU02 / A-SU04 | pending |
| P-SU02 | 字节等价 | 基线 vs HEAD，`examples/miniprogram/base`，nomap + sourcemap `diff -rq` MUST（前置 P-SU00：经 CLI/dist 驱动前先同步镜像）。**基线随门递进**：S1 基线 = 升 `in_progress` 时 HEAD；S2 基线 = S1 合入后 HEAD（先例 project-store：PS1 `aa6b6508` → PS2 `0556f320`） | A-SU04 / A-SU05 ③ | pending |
| P-SU03 | 同构断言 | `session-unify.spec`：spy / 内录 lifecycle 规范化事件序列——`.build()` vs `watch.start()` 首编 vs `.dev()` 首编相等。**规范化**：以事件名序列为主，载荷仅保留稳定键（剥离耗时 / 计数等易变字段）。**白名单**：入口特有事件以基线捕获为准（dev preview 已知；watch 若有，实施时登记后附加） | A-SU01 / A-SU05 ① | pending |
| P-SU04 | 调度语义 | 既有 R1–R4 / R7 用例**不改断言**全绿；+ 双释放 / 漏释放 / 重复挂载防回归用例 | A-SU02 | pending |
| P-SU05 | exports | 前置 P-SU00；`node scripts/check-package-exports.js`（按包名 import → 实际校验 dist 镜像） | A-SU03 | pending |
| P-SU06 | diff 范围 | `git diff --stat`（限 session/runner + session/index + 测试） | A-SU06 | pending |
| P-SU07 | 消融 ×2 | **S1**：拔 runner 回落三壳内联 → P-SU03 失败 → 恢复全绿；**S2**：拔 releaseLoop 单点 → P-SU04 失败 → 恢复全绿 | A-SU01 / A-SU02 Notes | pending |

## 消融纪律（Experience-Review §6）

- 只禁用 / 移除待验证的最小修复机制；**不得**同时修改测试、夹具、输入数据和断言；
- 消融后目标用例必须因**原缺陷对应的断言**失败（非编译错误 / 环境损坏 / 无关异常 / 超时）；
- 恢复修复后用相同命令与环境再次运行并通过；
- 消融补丁、临时日志**不得**进入最终提交；交付说明记录消融内容、预期与实际失败点。
