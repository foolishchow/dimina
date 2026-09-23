# Requirements — fe-tools-style-minify-gate

Status: **draft（2026-10-07）**

## 问题

Style 的 esbuild CSS minify（`minifyCss`）在 parse-walk（编译阶段）执行，不在 emit。这阻碍了 emit 阶段统一 minify 策略的推进，因为迁到 emit 会改变产物字节，破坏 diff=0 验证。

## 需求

### R-SM-1（MUST）— env var gate

`DIMINA_COMPILER_DIFF_VERIFY` 环境变量控制 `minifyCss`（esbuild）的执行位置：
- 设置 → `minifyCss` 在 parse-walk 执行（现状）
- 未设置 → `minifyCss` 在 emit 执行（parse-walk 不 minify）

依据：行为 0 验证需保留旧路径；生产环境用新路径。

### R-SM-2（MUST）— emitStyle 激活 minify 参数

`emitStyle` 的 `StyleEmitOptions.minify` 当前是死参数。在 `DIMINA_COMPILER_DIFF_VERIFY` 未设置时，`emitStyle` 调 `minifyCss` 对 `module.code` 做 minify。

### R-SM-3（MUST）— 行为 0（验证模式）

`DIMINA_COMPILER_DIFF_VERIFY` 设置时，全量 7 项目 diff=0（air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui）。vitest 全绿。tsc 0 errors。

依据：Experience-Review.md §12。

### R-SM-4（MUST）— 不改 cssnano

cssnano（sourcemap=true 路径）不本门处理。它只在 sourcemap=true 时跑，diff=0 验证（sourcemap=false）不覆盖。

### R-SM-5（SHOULD）— 生产模式可跑

`DIMINA_COMPILER_DIFF_VERIFY` 未设置时，vitest 全绿，tsc 0 errors。产物 minified（per-module vs aggregated minify 产出字节可能不同——见 D-SM-4，但均为有效 minified CSS）。

## 约束

- 行为 0 原则：验证模式下产物字节完全不变。
- `minifyCss` 函数本身不改（不改 esbuild 参数）。
- 不改 `StyleOptions` / `StyleEmitOptions` 接口签名（`minify` 字段已有，只是激活）。
- 不加 `any` / `as any` / `@ts-nocheck` / `[key: string]`。

## Non-scope

- cssnano 迁移（sourcemap=true）
- 删除 env var 开关（收口另开 Action）
- logic / view minify（已在 emit）
- style 管线其他变更
