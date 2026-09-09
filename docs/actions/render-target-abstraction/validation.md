# Validation — render-target-abstraction

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| resolver/adapter | target resolver 与 adapter contract vitest | spec 日志 |
| compiler 回归 | `cd fe && pnpm --filter compiler test` | 退出码 + 用例数 |
| runtime 相邻回归 | render/container-sdk suites | 退出码 + 用例数 |
| 产物一致 | 同一绝对路径依次构建 default/explicit webview，nomap/sourcemap，全部 examples；两轮使用同一 Node/pnpm 与输入 | `diff -r` 为空 |
| CLI/watch/dev | `dmcc build`、`dmcc build -w`、`dmcc dev` smoke | 命令日志 |
| invalid target | `options.target`/`--target` unknown：在 build lifecycle、resetAssetCache、目录创建/清理和 worker 启动前失败 | 错误 `DIMINA_INVALID_TARGET` + 目标目录 unchanged |
| target source | 项目声明 `app.json.renderer`、API `options.target`、CLI `--target`、watch inheritance、dev respects declaration | resolver/CLI integration log |
| lifecycle target | A4 首版不增加 target 字段；对既有 A1 observer payload 做 source/diff 检查 | decision record + clean diff |
| ablation | 移除 resolver 或绕过 adapter 后目标规格失败；恢复后相同命令通过 | 前后日志 |
| scope guard | git diff 检查无 Lynx/rspack/native/logic/service/bridge/HMR/ws 改动 | source diff |
| production | compiler/render/container-sdk build + compat sync | build 日志 + clean diff |

## 执行环境记录要求

每次实际验证附：日期、commit、Node/pnpm 版本、与计划偏差。

## 闭合判定（模板）

- A-001~A-010 全部 passed；
- 默认/显式 webview 产物矩阵 diff=0；
- target-neutral 与 Web-only/native 边界有证据；
- Lynx/rspack 未进入本 Action；
- 持久发现回写 RFC 与 umbrella roadmap；
- 无未记录的未覆盖区域。

## 实际执行记录

### P-001（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `6dc593fb`（promote 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| resolver 规格 | `vitest run __tests__/target-resolver.spec.js` | 2/2：缺省/显式 webview；未知 target 抛 `InvalidTargetError`（code/target/message） | `fe/packages/compiler/__tests__/target-resolver.spec.js` | passed |
| 全量回归 | `pnpm --filter compiler test` | 62 文件 / 411 用例全绿（既有 409 无回落） | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 无告警 | 终端日志 | passed |
| 契约实现 | `src/common/targets.js`（DEFAULT_TARGET=webview、SUPPORTED_TARGETS、InvalidTargetError(code=DIMINA_INVALID_TARGET/target)、resolveTarget）；`runBuild` 在 lifecycle 前调用 resolveTarget；CLI `--target` 映射到 `options.target` 且 watch rebuild 继承；`dmcc dev` 固定 `target:'webview'` | — | 源码 diff 5 文件 | passed |

覆盖说明：

- target 校验位于 `runBuild` 顶部、lifecycle 创建前，满足 F-A4-003 的“pre-lifecycle、无目录副作用”顺序；非法 target 不会触发 `build:start`。
- 未覆盖：view/style adapter 接线（P-002/P-003）、产物矩阵（P-005）、消融（P-007）。
