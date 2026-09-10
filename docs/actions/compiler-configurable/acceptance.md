# Acceptance — compiler-configurable

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-001 | R-001 | 存在 `compile-config` 模块；`build()` 合并后各 stage 从 config 读 minify/sourcemap/esTarget | 源码 + compile-config.spec | pending |
| A-002 | R-002 | `--minify`/`--no-minify` 与 API `options.minify` 等价；无新增 CLI-only 能力 | CLI/API 规格或冒烟 | pending |
| A-003 | R-003 | config 为 `esTarget.{logic,view}`；标量 `esTarget` 被拒绝；view 读 view、logic bundle 读 logic；缺省 es2023/es2020 | compile-config.spec + 接线审查 | pending |
| A-004 | R-004 | build 缺省 minify=true；dev 缺省 false；sourcemap 跳过最终 minify 语义保留 | 规格 + 产物/体积或 AST 抽查 | pending |
| A-005 | R-005 | `--sourcemap` / `options.sourcemap` 行为与改造前等价 | 既有 sourcemap 相关 spec | pending |
| A-006 | R-006 | 缺省 build（无 minify/esTarget 覆盖）产物与基线逐字节一致 | diff 脚本/日志 | pending |
| A-007 | R-007 | `build()` 签名/返回/错误契约未改；既有 build-error / build-output 等 spec 通过 | git diff + 全量测试 | pending |
| A-008 | R-008 | `pnpm --filter compiler test` 全绿（含新增） | 命令日志 | pending |
| A-009 | R-004 | `dmcc dev` 默认不 minify；可选 `--minify` 打开 | 冒烟或规格 | pending |

## Closure evidence rule

- MUST 全部 `passed` 且写入 validation 后方可 `complete`
- A-006 消融建议：恢复 minify 硬编码或去掉 config 下发 → 相关规格失败，或 diff=0 断言在「错误缺省」下失败（Experience-Review §6）
- logic 单模块 CJS 仍为 es2020 硬编码属本门已知边界，验收不得要求其已读 `esTarget.logic`（归 CF-3）

## Status

全部 `pending`：Action 已 `ready`，**尚未授权实施**；表结构供实施与验证填写。
