# Validation — compiler-configurable

计划命令与证据形态；实际结果在执行阶段填写并支撑闭合判定。

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| compile-config 规格 | `vitest run __tests__/compile-config.spec.js` | 退出码 + 用例数 |
| 全量编译器回归 | `cd fe/packages/compiler && npx vitest run` | 退出码 + 文件/用例数 |
| 缺省产物 diff=0（A-006） | 同例 `examples/miniprogram/base`：基线 `78ffdb11` vs 当前 HEAD，`useAppIdDir=false`，缺省 build | `changed=0` |
| mode=dev 不 minify（A-009） | 同例分别 `mode: 'build'` / `mode: 'dev'` | logic.js 体积差 / 内容不等 |
| 消融 A-006 | 临时改 `MODE_PRESETS.build.minify=false` → build preset 规格失败 → 恢复再绿 | 消融前后两次运行 |
| CLI ⊆ API | `bin/index.js` / `bin/dev.js` 仅传 `minify`/`mode` 进 `build()` options | 源码审查 |

## 执行环境记录要求

每次实际验证附：日期、commit、Node 版本、与计划偏差。

## 实际执行记录

### P-001（2026-09-10）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit（实现基线） | `9afd6364`（`feat(compiler): implement compile configuration (CF-1)`） |
| Environment | Node v22.22.0 · macOS darwin 24.6.0 |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| compile-config 规格 | `npx vitest run __tests__/compile-config.spec.js` | 1 文件 / 8 用例通过 | 终端日志 | passed |
| 全量回归 | `npx vitest run`（compiler 包） | 67 文件 / 434 用例全绿 | 终端日志 | passed |
| A-001 / A-003 接线 | `compile-config.js` + `index.js` 解析后经 worker `compileConfig` 下发；view 读 `esTarget.view`，logic bundle 读 `esTarget.logic` | OK | 源码审查 | passed |
| A-002 CLI ⊆ API | `bin/index.js` / `bin/dev.js`：`--minify`/`--no-minify` → `options.minify`；dev 默认 `mode: 'dev'` | OK | 源码审查 | passed |
| A-005 sourcemap | 既有 sourcemap 相关规格含于全量 434 | 全绿 | P-001 全量 | passed |
| A-007 契约 | `build()` 签名未改；build-error / build-output 等含于全量 | 全绿 | P-001 全量 | passed |

覆盖说明：

- A-004 / A-009 的 mode preset 由 `compile-config.spec` 断言；产物侧见 P-003。
- A-006 产物 diff 与消融见 P-002 / P-003。
- 与计划偏差：本机 `pnpm` corepack shim 损坏，全量改用 `npx vitest run`（等价于 filter compiler test）。

### P-002（2026-09-10）— 消融 A-006（build preset minify）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit | `9afd6364` + 工作区临时改动（未入库） |
| Environment | 同 P-001 |

| 步骤 | 操作 | 结果 | Result |
| --- | --- | --- | --- |
| 基线 | `vitest run __tests__/compile-config.spec.js` | 8/8 passed | passed |
| 消融 | 仅改 `MODE_PRESETS.build.minify`：`true` → `false`；**不改**测试与夹具 | 规格 **失败**：`uses build preset minify=true...` 期望 `minify: true` 得 `false` | passed（预期失败） |
| 恢复 | `git checkout -- src/common/compile-config.js` | 与 HEAD 一致 | passed |
| 恢复后 | 再跑 compile-config.spec | 8/8 passed | passed |

消融补丁未进入提交。证明：A-006 相关缺省 minify 契约能识别 build preset 是否被破坏。

### P-003（2026-09-10）— 产物 diff=0 + mode=dev

| Field | Actual value |
| --- | --- |
| Date | 2026-09-10 |
| Source commit（当前） | `c6320963` 工作区（实现仍为 `9afd6364`） |
| Product baseline | worktree @ `78ffdb11`（CF-1 feat 父提交），`node_modules` 链自主仓 |
| Environment | 同 P-001；示例 `examples/miniprogram/base`；`useAppIdDir=false` |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| A-006 缺省 build diff | 基线 vs 当前缺省 `mode: 'build'` | 92/92 文件；`changed=0`；`logic.js` 字节相同 | python SHA256 对照 | passed |
| A-009 / A-004 mode=dev | 同例 `mode: 'dev'` vs build | `logic.js` 97423 → 155885 bytes；内容不等 | `cmp` / `wc -c` | passed |

## Closure mapping

| Acceptance | Evidence |
| --- | --- |
| A-001 | P-001 compile-config + 接线审查 |
| A-002 | P-001 CLI 审查 + compile-config 合并优先级 |
| A-003 | P-001 compile-config.spec + 接线 |
| A-004 | P-001 规格 + P-003 体积 |
| A-005 | P-001 全量（sourcemap specs） |
| A-006 | P-003 产物 diff=0 + P-002 消融 |
| A-007 | P-001 全量 + 签名审查 |
| A-008 | P-001 67/434 |
| A-009 | P-001 规格 + P-003 mode=dev |
