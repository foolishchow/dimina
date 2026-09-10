# Validation — platform-abstraction

计划命令与证据形态；实际结果在执行阶段填写并支撑闭合判定。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| platforms / compile-config 规格 | `vitest run __tests__/platforms.spec.js __tests__/compile-config.spec.js` | 退出码 + 用例数 |
| 全量编译器回归 | `cd fe/packages/compiler && npx vitest run` | 退出码 + 文件/用例数 |
| 缺省产物 diff=0（A-004） | 同例 `examples/miniprogram/base`：基线 `918fb8d6` vs 当前，缺省 build | `changed=0` |
| native vs web 行为中立 | 同例 `platform:'web'` vs 缺省 native | `changed=0` |
| 消融缺省 native | 临时将 unset 缺省改为 `web` → 规格失败 → 恢复再绿 | 消融前后两次运行 |
| CLI / bin 契约 | build 有 `--platform`；dev 固定 `platform:'web'` 且无 flag | bin-contract 规格 |

## 执行环境记录要求

每次实际验证附：日期、commit、Node 版本、与计划偏差。

## 实际执行记录

### P-001（2026-09-10）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit（实现基线） | `5af081c5`（`feat(compiler): implement platform-abstraction (CF-2)`） |
| Environment | Node v22.22.0 · macOS darwin 24.6.0 |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| platforms + compile-config | `npx vitest run __tests__/platforms.spec.js __tests__/compile-config.spec.js` | 2 文件 / 18 用例通过 | 终端日志 | passed |
| 全量回归 | `npx vitest run` | 68 文件 / 444 用例全绿 | 终端日志 | passed |
| A-001 / A-005 / A-009 | `platforms.js` + config 恒有 platform/`sourcemapStrategy`；非法 platform → `InvalidPlatformError` | OK | 规格 | passed |
| A-002 / A-003 bin | build `--platform`；dev `platform:'web'` 且无 `--platform` option | OK | bin-contract | passed |
| A-006 钩子 | `assertRendererSupportsPlatform`；webview 双平台；夹具 lynx⊄web 失败 | OK | platforms.spec | passed |
| A-008 | 全量 68/444 | 全绿 | 同上 | passed |

与计划偏差：全量以 `npx vitest run` 执行（本机 pnpm corepack shim 不可用）。

### P-002（2026-09-10）— 消融缺省 native（A-001/A-003）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `5af081c5` + 工作区临时改动（未入库） |
| Environment | 同 P-001 |

| 步骤 | 操作 | 结果 | Result |
| --- | --- | --- | --- |
| 基线 | platforms + compile-config specs | 18/18 passed | passed |
| 消融 | 仅改 `resolvePlatform`：unset 缺省 `native` → `web`；**不改**测试 | **失败**：`defaults unset to native`；`uses build preset... default native platform` | passed（预期失败） |
| 恢复 | 还原 `platforms.js` | 与备份一致 | passed |
| 恢复后 | 再跑两份规格 | 18/18 passed | passed |

消融补丁未进入提交。证明：缺省 `native` 契约可识别。

### P-003（2026-09-10）— 产物 diff=0 + native/web 中立

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `5af081c5` |
| Product baseline | worktree @ `918fb8d6`（CF-2 feat 父提交） |
| Environment | 同 P-001；示例 `examples/miniprogram/base`；`useAppIdDir=false` |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| A-004 缺省 vs 基线 | 缺省 build | 92/92；`changed=0` | SHA256 对照 | passed |
| 行为中立 native vs web | 当前 HEAD 缺省 vs `platform:'web'` | `changed=0` | SHA256 对照 | passed |
| A-007 RFC | 本闭合回写 D6:B + §4.8 | 见闭合 commit | RFC diff | passed |

## Closure mapping

| Acceptance | Evidence |
| --- | --- |
| A-001 | P-001 + P-002 消融 |
| A-002 | P-001 bin-contract + compile-config cli 覆盖 |
| A-003 | P-001 + P-002 |
| A-004 | P-003 |
| A-005 | P-001 compile-config / platforms |
| A-006 | P-001 platforms.spec |
| A-007 | P-003 / 闭合 RFC |
| A-008 | P-001 68/444 |
| A-009 | P-001 InvalidPlatformError 规格 |
