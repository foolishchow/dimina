# Implementation Plan — fe-tools-style-cssnano-gate

Status: **ready（2026-10-07）** — 未授 `in_progress` 不改 `src`。

## 纪律

- D-CN-1..5；行为 0；不改 cssnano 配置；不改 external-class/autoprefixer；不加 any。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | 立项 `draft` | **done**（2026-10-07） |
| 1 | 升 `ready` | **done**（2026-10-07） |
| 2a | `style/emit.ts`：加 `import postcss`；迁 `loadCssnano()` + `cssnanoLoader`；`emitStyle` 加 cssnano canonical path（D-CN-1/3；`annotation: false` + `let map` 独立变量） | pending |
| 2b | `style/parse-walk.ts`：删 loader 定义；import 改 `from './emit.ts'`；cssnano 调用加 `isDiffVerifyMode()` gate（D-CN-2） | pending |
| 3 | P-CN* / A-CN*；回流 architecture-notes；close 另授 | pending |

## 依赖

```text
fe-tools-style-minify-gate (complete — minifyCss esbuild gate 先例)
        │
本 Action draft → ready → in_progress → complete
        │
        ▼
删除 DIMINA_COMPILER_DIFF_VERIFY 开关（收口，另门）
```
