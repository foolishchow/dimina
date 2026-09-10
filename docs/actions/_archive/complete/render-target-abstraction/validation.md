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

## 闭合判定（2026-09-08）

- A-001~A-010 全部 passed（P-001..P-007 实施记录支撑）。
- 产物零变化：基线 `5c1a6a3a` vs 当前 `a059f065`，同绝对路径 nomap/sourcemap、7 示例，diff exit=0 lines=0。
- renderer-neutral 边界有证据（P-007 范围护栏：无 native/logic/service/bridge/HMR/ws/Lynx/rspack 改动）。
- 无 CLI/API renderer 覆盖（dmcc dev help 无 renderer flag）。
- 持久发现回写 RFC §5 A4 行（renderer 抽象落地）与 v1.7 术语映射。
- 无未记录的未覆盖区域。

Decision: **closable**（待 Close workflow 归档）。

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

### P-003 / P-004 / P-005（2026-09-08）

| Field | Actual value |
| --- | --- | --- |
| Date | 2026-09-08 |
| Baseline | `5c1a6a3a`（A4 代码改前，A3 闭合后） |
| Current | `9ed0fe0f`（P-002 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS · 同绝对路径 `/tmp/a4-matrix` |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| P-003 产物契约不变 | view/style 经 adapter 的真实构建（air-battle）rc=0；compiler 全量 63/418 绿 | 既有 worker 仅被包装一次，逻辑 renderer-neutral | `pnpm --filter compiler test` | passed |
| P-004 决策 | A4 首版不增加 renderer 字段到 A1 lifecycle payload；renderer 仅在声明解析/前端诊断使用 | 决策记录（implementation-plan / validation） | — | passed |
| P-005 nomap | `diff -r out/baseline-nomap out/current-nomap`（同路径 git archive + 构建） | 7 示例，0 行差异（exit=0） | `/tmp/a4-diff-nomap.txt` | passed |
| P-005 sourcemap | `diff -r out/baseline-map out/current-map` | 7 示例，0 行差异（exit=0） | `/tmp/a4-diff-map.txt` | passed |

覆盖说明：

- 同绝对路径控制消除了既有资源绝对路径哈希的假差异；基线/当前均 7/7 构建成功。
- 未覆盖：P-006 入口回归（dmcc build/-w/dev/compile）、P-007 消融与范围护栏。

### P-006 / P-007（2026-09-08）

| Field | Actual value |
| --- | --- |
| Date | 2026-09-08 |
| Source commit（实施前基线） | `9ed0fe0f`（P-002 后） |
| Environment | Node v22.23.2 · pnpm 12.2.0（corepack）· macOS |

| 验证项 | 命令 / 观察 | 结果 | 证据 | Result |
| --- | --- | --- | --- | --- |
| dmcc build | `dist/bin/index.js build -c examples/miniprogram/base --no-app-id-dir` | rc=0 | 终端日志 | passed |
| dev 无 CLI | `dist/bin/index.js dev --help` | 无 renderer flag（符合无 CLI 覆盖设计） | 终端 | passed |
| pnpm compile | `corepack pnpm compile` | rc=0 | 终端日志 | passed |
| compat | `sync:compat` + git diff | Already in sync；reference 零 diff | 终端 | passed |
| renderer 前置消融 | `vitest run __tests__/target-renderer-integration.spec.js` | 3/3：默认/`renderer:webview` 构建成功；未知 renderer 在 lifecycle 前失败且目标目录未创建、app.json 未改动 | `target-renderer-integration.spec.js` | passed |
| 全量 | `pnpm --filter compiler test` | 64 文件 / 421 用例全绿（含新增 integration 3） | 终端日志 | passed |
| 范围护栏 | `git diff --name-only 5c1a6a3a..HEAD` | 无 native/harmony/android/ios/lynx 路径；A4 改动仅 `fe/packages/compiler`（renderers.js / index.js / 相关 spec） | source diff | passed |
| Lint / build | `pnpm lint` / compiler build | oxlint 干净；dist build 成功 | 终端日志 | passed |

