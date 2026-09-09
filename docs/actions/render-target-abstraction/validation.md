# Validation — render-target-abstraction

## 计划命令

| 用途 | 命令 / 方法 | 证据形态 |
| --- | --- | --- |
| resolver/adapter | renderer 声明解析与 renderer contract vitest | spec 日志 |
| compiler 回归 | `cd fe && pnpm --filter compiler test` | 退出码 + 用例数 |
| runtime 相邻回归 | render/container-sdk suites | 退出码 + 用例数 |
| 产物一致 | 现有默认（webview）构建与改前基线在同一绝对路径下逐字节一致，nomap/sourcemap，全部 examples | `diff -r` 为空 |
| CLI/watch/dev | `dmcc build`、`dmcc build -w`、`dmcc dev` smoke | 命令日志 |
| invalid target | `options.target`/`--target` unknown：在 build lifecycle、resetAssetCache、目录创建/清理和 worker 启动前失败 | 错误 `DIMINA_INVALID_TARGET` + 目标目录 unchanged |
| renderer source | 项目声明 `app.json.renderer` + 各 `page.json.renderer`；无 CLI/API 覆盖 | renderer declaration/CLI smoke |
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

### P-002（2026-09-08）

| Field | Actual value |
| --- | --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `161a0f2d`（P-001 renderer 修订后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| registry 规格 | `vitest run __tests__/renderer-registry.spec.js` | 3/3：register/getRenderer、未注册 null、非法 name 拒绝 | `fe/packages/compiler/__tests__/renderer-registry.spec.js` | passed |
| 契约实现 | `renderers.js`：registerRenderer/getRenderer + `_rendererRegistryForTest`（测试清理）；`index.js`：webviewRenderer 薄适配（runViewStage/runStyleStage 委托 runCompileInWorker），logic 保持 renderer-neutral；createStageTask 按 stage 选 adapter；A1 runCompileInWorker 内部协议不变 | — | 源码 diff | passed |
| 真实构建冒烟 | `dist/bin/index.js build -c examples/miniprogram/air-battle --no-app-id-dir` | rc=0；main/app-config.json + logic.js 产物正常（view/style 经 adapter 路径） | 终端日志 + 产物树 | passed |
| 全量回归 | `pnpm --filter compiler test` | 63 文件 / 418 用例全绿（含 registry 3 新用例；既有 415 无回落） | 终端日志 | passed |
| Lint | `pnpm lint` | oxlint 干净 | 终端日志 | passed |

覆盖说明：

- webview adapter 为纯委托（不复制编译逻辑）；既有 worker 仅被包装一次。
- 未覆盖：产物逐字节一致性（P-005）、入口回归（P-006）、消融（P-007）。
