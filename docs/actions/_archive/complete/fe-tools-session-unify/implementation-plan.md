# Implementation plan — fe-tools-session-unify

Status: **in_progress（2026-09-14）** — S1 实施中；基线 `ce14fa79`；S1/S2 各自 PR，禁混（对齐 P5）

## S1 触达序（机械抽取 · 行为 0）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/session/runner.js` | **新建**：`createSessionRunner(state)` → `composeOptions`（`splitBuildOverrides` + `state.compile`/`fileTypes` 合并 + `store`/`lifecycle` 注入）+ `runOnce`（one-shot 编译调用） |
| 2 | `src/session/index.js` | `.build` / `.watch` 的 options 组装改道 `composeOptions`；`.dev` 经 `session.watch` 间接生效；壳保留白名单校验与返回值形状；顺带修正头注释 lifecycle listener 计数 3→2（Review F3，勿扩大） |
| 3 | 测例 | `__tests__/session-unify.spec.js`（独立文件 · Review F4 已定）：行为同构断言（spy / 事件序列，按 P-SU03 规范化与白名单口径）+ 结构锚定 |
| 4 | 验证 | 全量 vitest；先 `pnpm build` 同步 dist 镜像（P-SU00：exports/CLI 面在 dist，测试直连 src）→ nomap + sourcemap diff=0；exports 校验 |
| 5 | 消融 | 拔 runner（回落三壳内联组装）→ 同构断言失败 → 恢复全绿 |

## S2 触达序（语义收口 · 语义不变）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `src/session/runner.js` | + `occupyLoop`（断言 + 置位，R3）/ `releaseLoop`（幂等释放）；`runOnce` 内化 `assertNoActiveLoop`（R4，消息文本不变，R-SU4）——壳不再显式调用断言 |
| 2 | `src/session/index.js` | 删壳内 `state.activeLoop` 置位、`.build` 的显式断言调用与各 `finally` 清环；watch handle.stop / dev close / R7 回滚统一走 `releaseLoop`；lifecycle 挂载点唯一化 |
| 3 | 测例 | 既有 R1–R4 / R7 测试**不改断言**全绿；+ 双释放 / 漏释放 / 重复挂载防回归用例 |
| 4 | 验证 | 同 S1 全套（含 P-SU00 前置） |
| 5 | 消融 | 拔 releaseLoop 单点（恢复壳内清环）→ 双释放 / 漏释放用例失败 → 恢复全绿 |

## 不做（本 Action）

- PS3 / TS-2 / compiler target 方向
- watch-runner、build-pipeline、`build()` 门面内部改动（除接线必需）
- lifecycle `off()`（A1 v1 已知限制维持）
- activeLoop 标签 `'watch'`→`'dev'`（D-SU-4 保持）

## 验证

升 `in_progress` 时记基线 SHA（随门递进，见 P-SU02）→ [validation.md](validation.md) P-SU00..07（Result 届时回填）
