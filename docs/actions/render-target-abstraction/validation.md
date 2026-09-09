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
| target source | API `options.target`、CLI `--target`、watch inheritance、dev fixed webview | resolver/CLI integration log |
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
