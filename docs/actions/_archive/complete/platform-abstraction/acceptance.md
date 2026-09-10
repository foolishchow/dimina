# Acceptance — platform-abstraction

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 存在 `platforms.js`；`resolveCompileConfig` 后 `platform` 恒为 `native`/`web` | 源码 + platforms/compile-config spec | passed |
| A-002 | R-002 | `--platform` 与 `options.platform` 等价写入 config；无 CLI-only 能力 | CLI 审查 + 规格 | passed |
| A-003 | R-003 | 未指定 → `native`；`dmcc dev` options 含 `platform:'web'` 且无 `--platform` flag | 规格 + bin 审查 | passed |
| A-004 | R-004 / R-008 | 缺省 build 产物与基线 diff=0；minify/esTarget/sourcemap 生成路径不因 platform 分支 | diff + 源码审查 | passed |
| A-005 | R-005 | config 含 `sourcemapStrategy`；native→`quickjs-attach`，web→`devtools-url`；生成逻辑未读该字段改行为 | compile-config spec + 审查 | passed |
| A-006 | R-006 | `build()` 在 start 前做 renderer×platform 断言；webview×native/web 通过；可用夹具模拟 unsupported 失败 | 规格（可消融） | passed |
| A-007 | R-007 | RFC D6 修订为 D6:B（不变层/可变层）已回写 | RFC diff | passed |
| A-008 | R-009 | compiler 全量测试全绿（含新增） | 命令日志 | passed |
| A-009 | R-001 | 非法 platform 硬失败且不触发成功构建副作用 | 规格 / build-error 类证据 | passed |

## Closure evidence rule

- MUST 全部 `passed` 且写入 validation 后方可 `complete`
- 消融（Experience-Review §6）：建议消融「缺省 native」或 `assertRendererSupportsPlatform` 之一——目标规格须预期失败；补丁不入库
- 本门 **不** 要求跨 `platform=web` 与 `native` 的产物差异（行为中立下应一致）；A-004 锚定缺省/native 相对改造前基线

## Status

全部 `passed`：证据见 [validation](validation.md) P-001..P-003（含缺省 native 消融）。
