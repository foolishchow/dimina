# Implementation Plan — fe-tools-style-minify-gate

Status: **complete（2026-10-07）** — D-SM-1..4 实施 + 验证完成。

## 纪律

- D-SM-1..4；行为 0；不改 cssnano；不改 minifyCss 函数；不加 any。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | 立项 `draft` | **done**（2026-10-07） |
| 1 | 升 `ready`（另授） | **done**（2026-10-07） |
| 2a | `style/emit.ts`：加 `isDiffVerifyMode()`；`emitStyle` 激活 `minify` 参数（D-SM-1/3） | **done**（2026-10-07） |
| 2b | `style/parse-walk.ts`：sourcemap=false 路径 minifyCss 调用加 gate（D-SM-2） | **done**（2026-10-07） |
| 3 | P-SM* / A-SM*；回流 architecture-notes；close 另授 | **done**（2026-10-07） |

## 依赖

```text
fe-tools-emit-transform-split (complete — emit 拆分)
        │
本 Action draft → ready → in_progress → complete
        │
        ▼
cssnano 迁移（sourcemap=true，另门）
删除 env var 开关（收口，另门）
```
