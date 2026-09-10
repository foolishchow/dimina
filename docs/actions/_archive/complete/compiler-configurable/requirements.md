# Requirements — compiler-configurable

## R-001（MUST）统一 compile configuration

新增结构化编译配置（见 [technical-design](technical-design.md)），至少包含：`mode`、`platform`（占位）、`minify`、`sourcemap`、`esTarget.logic`、`esTarget.view`。`build()` 经 options 合并进该结构后传给各 stage。

## R-002（MUST）CLI ⊆ API

凡本门新增的 CLI 能力（`--minify` / `--no-minify`）必须可经 API options / compile configuration 等价表达。不允许新增 CLI-only 能力。既有 API-only 选项（stages/seedPath 等）首版不暴露为 CLI。

## R-003（MUST）`esTarget` 双字段

- 形状仅为 `{ logic, view }`；**禁止**与双字段并存的顶层标量 `esTarget`
- 缺省：`logic: 'es2023'`，`view: 'es2020'`
- `view-compiler` 的 JS transform target 读 `esTarget.view`
- `logic-compiler` **bundle minify** 路径读 `esTarget.logic`
- style 不消费 JS `esTarget`
- logic 单模块 CJS 路径（现状硬编码 `es2020`）的同车道收敛属 CF-3，本门可不改该处取值以保障缺省 diff=0；须在设计中标注

## R-004（MUST）minify 可配置 + mode 缺省

- 消除 minify 硬编码 `true`
- mode=build 缺省 `minify=true`；mode=dev 缺省 `minify=false`
- CLI：`dmcc build` / `dmcc dev` 支持 `--minify` / `--no-minify`（dev 另支持显式打开 minify）
- sourcemap 模式下「跳过最终 minify」的既有语义显式化，行为等价

## R-005（MUST）sourcemap 收敛

现有 `--sourcemap` CLI 与 `options.sourcemap` 收敛进 compile configuration；缺省与改造前行为等价。

## R-006（MUST）缺省 build 产物 diff=0

未覆盖 minify/esTarget 时，与改造前同输入的默认 build 产物逐字节一致（含 `.map` 策略不变的前提下）。dev 默认不 minify 允许产物变化，须有独立验证。

## R-007（MUST）`build()` 公开契约不变

签名 `build(targetPath, workPath, useAppIdDir, options)`、返回值结构、结构化错误契约不变；options 向后兼容（新增字段可选）。

## R-008（MUST）规格全绿

`pnpm --filter compiler test` 全绿；新增 compile-config / minify / esTarget 双字段规格。

## Non-scope

见 [README](README.md) Non-goals：platform 枚举语义（CF-2）、抬高 view / logic 车道内 CJS 收敛（CF-3）、配置文件、运行时包。
