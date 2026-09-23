# FE Tools Style Minify Gate

- Action: `fe-tools-style-minify-gate`
- Status: `ready`
- Updated: 2026-10-07
- Status authority: [Action Status](../STATUS.md)
- 前置：[`fe-tools-emit-transform-split`](../_archive/complete/fe-tools-emit-transform-split/README.md)（**complete**；三车道 parse+walk / transform / emit 拆分）
- 工作分支：`feature/fe-tools-sidecar`

## Background

Style minify 目前在 **parse-walk（编译阶段）** 做，不在 emit。这阻碍了 emit 阶段统一的 minify 策略——因为把 minify 迁到 emit 会改变产物字节，无法保证 diff=0。

现状：`minifyCss`（esbuild）函数定义在 `style/emit.ts`，但被 `parse-walk.ts` import 调用。`emitStyle` 的 `StyleEmitOptions` 有 `minify: boolean` 字段但**是死参数**。

### 两条 minify 路径

| sourcemap | minify 机制 | 位置 | diff=0 覆盖？ |
|---|---|---|---|
| `true` | cssnano（PostCSS 插件） | parse-walk | ✗（diff=0 默认 sourcemap=false） |
| `false` | `minifyCss`（esbuild） | parse-walk | ✓ |

### diff=0 验证现状

`build(target, workPath, true, {})` 默认 `sourcemap=false` + `minify=true` → 只走 `minifyCss`（esbuild）路径。

## Goal

加 `DIMINA_COMPILER_DIFF_VERIFY` 环境变量开关，gate `minifyCss`（esbuild）的执行位置：

- **设置** → `minifyCss` 留 parse-walk（现状不变）→ diff=0 保证
- **未设置** → parse-walk 不 minify，`emitStyle` 调 `minifyCss` → minify 在 emit 做

为后续 emit 阶段统一 minify 策略铺路，不破坏行为 0 验证。

## Non-goals

- cssnano（sourcemap=true 路径）迁移——diff=0 不覆盖，不需本门处理
- 删除 env var 开关——后续完全迁移后另开 Action 收口
- 其他 style 管线变更
- logic / view 车道 minify（已在 emit，不受影响）

## Design inputs

- [Experience-Review.md](../../Experience-Review.md) §12 行为 0 全量验证
- [fe-tools-emit-transform-split](../_archive/complete/fe-tools-emit-transform-split/README.md)（emit 拆分）
- `src/compiler/style/parse-walk.ts`（minifyCss 调用点）
- `src/compiler/style/emit.ts`（minifyCss 定义 + emitStyle 死参数）

## Deliverables

- `src/compiler/style/parse-walk.ts`：sourcemap=false 路径 minifyCss 调用加 env var gate
- `src/compiler/style/emit.ts`：加 `isDiffVerifyMode()` + `emitStyle` 激活死 `minify` 参数（`!sourcemap` 守卫）

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

- 无；设计明确，范围有界。

## Closure conditions

- A-SM1..5 全部 [x]；
- `DIMINA_COMPILER_DIFF_VERIFY` 设置时全量 7 项目 diff=0；
- `DIMINA_COMPILER_DIFF_VERIFY` 未设置时 vitest 全绿 + tsc 0 errors；
- 回流 architecture-notes。
