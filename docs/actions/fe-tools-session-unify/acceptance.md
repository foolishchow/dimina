# Acceptance — fe-tools-session-unify

Status: **in_progress（2026-09-14）** — A-SU01..06；S1 实施中（基线 `ce14fa79`）；证据回填

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-SU01 | R-SU1 | 存在 `src/session/runner.js`；`composeOptions` / `runOnce` 可用；三入口共用内核组装的 options（`.build` 另经内核 `runOnce` 发起），经同构断言**可观测** | P-SU03 + 源码审查 | pending |
| A-SU02 | R-SU2 | `occupyLoop` / `releaseLoop` 单点；壳无 activeLoop 置位 / finally 清环；R1–R4 / R7 既有测试**不改断言**全绿；无重复 lifecycle 挂载 | P-SU01 / P-SU04 + 源码审查 | pending |
| A-SU03 | R-SU3 | 三方法签名 / 白名单 / 返回值与 O1–O3 一致；`exports["./session"]` 与主入口面零变化；内核不公开 | P-SU05 + 源码审查 | pending |
| A-SU04 | R-SU4 | vitest 全绿；nomap + sourcemap diff=0；错误消息文本不变（含 dev 期 `activeLoop='watch'`，D-SU-4） | P-SU01 / P-SU02 | pending |
| A-SU05 | R-SU5 | 同构三层全过：①规范化事件序列相等（入口特有事件白名单附加：dev preview 已知；watch 若有，以基线捕获登记）；②静态结构判据（三壳无内联组装 / 释放）；③产物字节等价 | P-SU03 / P-SU02 | pending |
| A-SU06 | R-SU6 | diff 范围限 `session/runner.js` + `session/index.js` + 测试；无 PS3 / TS-2 / target / 门面与 watcher 内部混入 | P-SU06 | pending |

## Non-acceptance（本门不验）

| 项 | 说明 |
| --- | --- |
| L4（stop 后 Store 保留） | 已由调度稿约束；project-store 未验，本门不新增 |
| watch-runner / BuildPipeline 内部行为 | 兄弟门已验 |
| preview 协议 / dev server 行为 | 不变即不验 |
| CLI 冒烟 | SHOULD（沿用 P-PS07 口径，字节等价内完成） |

## Notes

- **消融 ×2（MUST）**：S1 拔内核回落分叉 → 同构断言失败；S2 拔 releaseLoop 单点 → 双释放 / 漏释放用例失败。消融纪律按 Experience-Review §6：只禁用目标机制，不改测试 / 夹具 / 断言；失败须落在原缺陷对应断言。
- 结构判据（反面条）以 A-SU01 / A-SU02 / A-SU05 ② 为准；模式名不作为验收条件。
- D-SU-1..5 已拍板（2026-09-13，见 design v1）；实施须另授权升 `in_progress`。
