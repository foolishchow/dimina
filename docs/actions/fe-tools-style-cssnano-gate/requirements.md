# Requirements — fe-tools-style-cssnano-gate

Status: **draft（2026-10-07）**

## 问题

cssnano（sourcemap=true 路径的 style minify）仍在 parse-walk，未 gate。代码归置不清晰：`loadCssnano()` + `cssnanoLoader` 定义在 parse-walk，应归置到 emit 侧（正本）。

## 需求

### R-CN-1（MUST）— env var gate

`DIMINA_COMPILER_DIFF_VERIFY` 控制 cssnano 的执行位置：
- 设置 → cssnano 在 parse-walk PostCSS pipeline（现状，legacy fallback）
- 未设置 → parse-walk 不加 cssnano；emit 单独跑 cssnano PostCSS（canonical）

依据：与 style-minify-gate 同模式；env var 为临时桥。

### R-CN-2（MUST）— 代码归置 emit 侧

`loadCssnano()` + `cssnanoLoader` 定义迁到 `style/emit.ts`（正本）。`parse-walk.ts` import 自 `./emit.ts`（legacy fallback 借用正本）。

依据：用户确认架构原则——emit 拥有 minify 逻辑，parse-walk 只是过渡期借用。

### R-CN-3（MUST）— 行为 0（验证模式）

`DIMINA_COMPILER_DIFF_VERIFY` 设置时，全量 7 项目 diff=0（air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui）。vitest 全绿。tsc 0 errors。

依据：Experience-Review.md §12。

### R-CN-4（MUST）— style-sourcemap.spec.js 双模式全绿

- 验证模式（`DIMINA_COMPILER_DIFF_VERIFY` 设置）：cssnano 在 parse-walk → `style-sourcemap.spec.js` 全绿
- 生产模式（未设置）：cssnano 在 emit → `style-sourcemap.spec.js` 全绿（sourcemap 链正确）

依据：cssnano 在 emit 需要正确处理 sourcemap chain（PostCSS `map: { prev }`）。

### R-CN-5（MUST）— 不改 cssnano 配置

cssnano 调用方式不改（`cssnano()` 无参数，默认 preset）。external-class / autoprefixer 逻辑不改。

## 约束

- 行为 0 原则：验证模式下产物字节完全不变。
- cssnano 函数调用不改（`cssnano()` 无参数）。
- 不改 `StyleOptions` / `StyleEmitOptions` 接口签名。
- 不加 `any` / `as any` / `@ts-nocheck` / `[key: string]`。
- `as unknown as postcss.Plugin` 断言允许（已有，非新增 `as any`）。

## Non-scope

- 删除 `DIMINA_COMPILER_DIFF_VERIFY` 开关（收口另开 Action）
- cssnano 输出与 parse-walk 字节一致（per-module vs aggregated）
- 改 cssnano preset / 配置
- external-class / autoprefixer 迁移
- logic / view 车道
