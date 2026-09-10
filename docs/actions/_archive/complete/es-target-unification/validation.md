# Validation — es-target-unification（仅 logic）

计划命令与证据形态；实际结果在执行阶段填写并支撑闭合判定。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| logic-es-target 规格 | `vitest run __tests__/logic-es-target.spec.js` | 退出码 + 用例数 |
| 全量回归 | `cd fe/packages/compiler && npx vitest run` | 退出码 + 文件/用例数 |
| 产物对照（A-004） | 基线 `20a48c8c` vs 当前；分 view/style vs logic | changed 计数 |
| 消融 A-006 | CJS `target` 改回字面量 `es2020` → 规格失败 → 恢复 | 消融前后两次运行 |
| view 未改（A-003） | `git diff` feat 相对父提交无 `view-compiler.js` | diff --stat |

## 实际执行记录

### P-001（2026-09-10）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit（实现基线） | `d289561b`（`feat(compiler): wire logic CJS transform to esTarget.logic (CF-3)`） |
| Environment | Node v22.22.0 · macOS darwin 24.6.0 |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| logic-es-target 规格 | `npx vitest run __tests__/logic-es-target.spec.js` | 1 文件 / 3 用例通过 | 终端 | passed |
| 全量回归 | `npx vitest run` | 69 文件 / 447 用例全绿 | 终端 | passed |
| A-001 / A-005 | CJS 读 `esTarget.logic`；覆盖 `es2020` 生效；源码无硬编码 CJS target | 规格 | passed |
| A-002 | `DEFAULT_ES_TARGET` 未改（compile-config 规格仍绿） | 全量 | passed |
| A-003 | feat diff 不含 `view-compiler.js` | `git diff 20a48c8c..d289561b --stat` | passed |
| A-007 | `build()` 契约未破；全量绿 | 全量 | passed |

与计划偏差：全量以 `npx vitest run` 执行。

### P-002（2026-09-10）— 消融 CJS 接线（A-006）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `d289561b` + 工作区临时改动（未入库） |
| Environment | 同 P-001 |

| 步骤 | 操作 | 结果 | Result |
| --- | --- | --- | --- |
| 基线 | `logic-es-target.spec.js` | 3/3 passed | passed |
| 消融 | 仅改 CJS `target`：`activeCompileConfig.esTarget.logic` → `'es2020'`；**不改**测试 | **失败**：源码契约 + 缺省 es2023 断言（2 failed） | passed（预期失败） |
| 恢复 | 还原 `logic-compiler.js` | 与备份一致 | passed |
| 恢复后 | 再跑规格 | 3/3 passed | passed |

消融补丁未进入提交。

### P-003（2026-09-10）— 产物对照（A-004）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `d289561b` |
| Product baseline | worktree @ `20a48c8c`（CF-3 feat 父提交） |
| Environment | 同 P-001；`examples/miniprogram/base`；`useAppIdDir=false` |

| 验证项 | 结果 | Result |
| --- | --- | --- |
| 全文件 | 92/92；`changed=0` | passed |
| view/style | `view_style_changed=0` | passed |
| logic | 亦为 0（本例 CJS es2020→es2023 无字节差） | passed |
| A-008 RFC | 本闭合回写 §4.7 / §4.9 | passed |

## Closure mapping

| Acceptance | Evidence |
| --- | --- |
| A-001 | P-001 |
| A-002 | P-001 |
| A-003 | P-001 git diff |
| A-004 | P-003 |
| A-005 | P-001 override 规格 |
| A-006 | P-002 |
| A-007 | P-001 全量 |
| A-008 | 闭合 RFC |
