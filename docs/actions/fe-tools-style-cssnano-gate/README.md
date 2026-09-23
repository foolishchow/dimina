# FE Tools Style CSSnano Gate

- Action: `fe-tools-style-cssnano-gate`
- Status: `ready`
- Updated: 2026-10-07
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-style-minify-gate`](../_archive/complete/fe-tools-style-minify-gate/README.md)（**complete**；minifyCss esbuild 已 gate `DIMINA_COMPILER_DIFF_VERIFY`）
- 工作分支：`feature/fe-tools-sidecar`

## Background

style-minify-gate 完成了 esbuild `minifyCss`（sourcemap=false 路径）的 gate。cssnano（sourcemap=true 路径）仍在 parse-walk，未 gate。

cssnano 当前作为 PostCSS 插件，与 external-class + autoprefixer **同一次 PostCSS 处理**跑在 parse-walk。`loadCssnano()` + `cssnanoLoader` 也定义在 parse-walk。

### 架构原则（用户确认）

- **emit 侧 = 正本**：cssnano 加载 + 调用逻辑归置到 `style/emit.ts`
- **parse-walk 侧 = legacy fallback**：env var 设了才走，将来删

### 两条 style minify 路径现状

| sourcemap | minify 机制 | gate 状态 | 位置 |
|---|---|---|---|
| `false` | `minifyCss`（esbuild） | ✅ 已 gate（style-minify-gate） | parse-walk (legacy) / emit (canonical) |
| `true` | cssnano（PostCSS 插件） | ✗ 未 gate | parse-walk（仅此一处） |

### diff=0 验证现状

`build(target, workPath, true, {})` 默认 `sourcemap=false` → 只走 minifyCss 路径。cssnano 路径（sourcemap=true）不被 diff=0 覆盖，但被 `style-sourcemap.spec.js` 覆盖。

## Goal

cssnano 也用 `DIMINA_COMPILER_DIFF_VERIFY` gate，代码归置到 emit 侧：

- **设置** → cssnano 留 parse-walk PostCSS pipeline（现状，legacy fallback）
- **未设置** → parse-walk 不加 cssnano；emit 单独跑 cssnano PostCSS（canonical）

为最终删 env var 开关收口铺路。

## Non-goals

- 删除 `DIMINA_COMPILER_DIFF_VERIFY` 开关（收口另开 Action）
- cssnano 输出与 parse-walk 字节一致（per-module vs aggregated，见 D-CN-4）
- 改 cssnano 配置参数
- 改 external-class / autoprefixer 逻辑
- logic / view 车道

## Design inputs

- [Experience-Review.md](../../Experience-Review.md) §12 行为 0 全量验证
- [style-minify-gate](../_archive/complete/fe-tools-style-minify-gate/README.md)（minifyCss gate 先例）
- `src/compiler/style/parse-walk.ts`（cssnano 在 PostCSS pipeline，line 382-383）
- `src/compiler/style/emit.ts`（minifyCss + isDiffVerifyMode 正本，canonical home）

## Deliverables

- `src/compiler/style/emit.ts`：加 `import postcss`；迁 `loadCssnano()` + `cssnanoLoader`；`emitStyle` 加 cssnano canonical path（sourcemap=true；`annotation: false` + `let map` 独立变量）
- `src/compiler/style/parse-walk.ts`：cssnano 调用加 `isDiffVerifyMode()` gate（legacy fallback）；`loadCssnano` + `cssnanoLoader` 改为 import 自 `./emit.ts`

## Requirements

- [requirements.md](requirements.md)

## Technical design

- [technical-design.md](technical-design.md)

## Implementation plan

- [implementation-plan.md](implementation-plan.md)

## Acceptance

- [acceptance.md](acceptance.md)

## Validation

- [validation.md](validation.md)

## Readiness gaps

- 无；style-minify-gate 已立先例，模式清晰。

## Closure conditions

- A-CN1..5 全部 [x]；
- `DIMINA_COMPILER_DIFF_VERIFY` 设置时 `style-sourcemap.spec.js` 全绿（legacy fallback 生效）；
- `DIMINA_COMPILER_DIFF_VERIFY` 未设置时 `style-sourcemap.spec.js` 全绿（canonical path 生效）；
- 回流 architecture-notes。
