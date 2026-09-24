# fe-tools-style-minify-path-unify

- Status: `draft`
- 前置：[`fe-tools-style-minify-gate`](../_archive/complete/fe-tools-style-minify-gate/README.md)（**complete**；D-SM-1..4 minifyCss esbuild gate `DIMINA_COMPILER_DIFF_VERIFY`）· [`fe-tools-style-cssnano-gate`](../_archive/complete/fe-tools-style-cssnano-gate/README.md)（**complete**；D-CN-1..5 cssnano gate 同开关）
- 参照：[Experience-Review.md](../../Experience-Review.md) §12 行为 0 全量验证 · [architecture-notes](../../fe-tools/architecture-notes.md)

## Background

style-minify-gate + style-cssnano-gate 用 `DIMINA_COMPILER_DIFF_VERIFY` env var gate 了 style minify 的**双路径**：

| 路径 | minify 位置 | 模块间 `\n` | 谁跑 |
|---|---|---|---|
| **verify**（env 设） | parse-walk per-module | **保留** | 所有 verify 脚本（G1-G5+IRC） |
| **production**（env 未设） | emit aggregated | **删除** | bin/ dev/build |

D-SM-4 / D-CN-4 显式记录："per-module 保留模块间 `\n`，aggregated 删除……两种模式产出均为有效 minified CSS + 有效 sourcemap。**Non-scope 明确不要求字节一致**。"

## 问题

**验证缺口**：6 轮 behavior-0 "diff=0"（G1-G5+IRC）全验 **parse-walk 路径**（verify 脚本设 env）；production 跑 **emit 路径**（bin/ 不设 env）。两路径字节不同（probe 实证：`...{...}\n.wrapper...` vs `...{...}.wrapper...`）→ **behavior-0 对 production 不成立**。

这与项目行为 0 纪律（G1-G5+IRC 全围绕字节恒等）不一致。D-SM-4/D-CN-4 的"Non-scope 不要求字节一致"在当时是迁移期妥协——minify 迁到 emit 未完成对齐。

## Goal

**统一 style minify 到单一字节恒等路径**：`production 路径 = verify 路径 = didi-side baseline`（per-module minify + 保留模块间 `\n`），然后**下线 `DIMINA_COMPILER_DIFF_VERIFY` 开关 + 双路径**。

具体：
1. **反转 D-SM-4/D-CN-4 Non-scope**——字节一致现为**要求**（production == baseline）
2. **统一 minify 路径**（design gate 定 A/B，见 technical-design D-SMPU-2）
3. **删 `isDiffVerifyMode()`** + `style/emit.ts` + `style/parse-walk.ts` dual-path 分支
4. **删 `DIMINA_COMPILER_DIFF_VERIFY` env var** + 所有 verify 脚本对其的设置
5. **行为 0**：6 项目 diff=0 对 didi-side baseline，**验 production 路径**（非旧 verify 路径）

## Non-goals

- CSS minify 算法不变（esbuild `minifyCss` + cssnano 配置不动）
- logic / view minify 不涉（已在 emit 且无 dual-path）
- sourcemap 路径本身不变（sourcemap=true 仍 cssnano，sourcemap=false 仍 esbuild）
- HMR / load-compile 拆 / deriveFromGraph 接入（后续门）

## 交付

- `style/emit.ts`：删 `isDiffVerifyMode` + dual-path guards；统一 minify 路径（D-SMPU-2 A/B）
- `style/parse-walk.ts`：删 `:377,390` dual-path minify 分支（legacy fallback 删）
- verify 脚本（`/tmp/verify-*.mjs` + `__tests__/view-style-cache-skip.spec.js` integration）：删 `process.env.DIMINA_COMPILER_DIFF_VERIFY` 设置
- 行为 0：6 项目 diff=0（production 路径，对 baseline）
- architecture-notes：SMPU 条目（反转 D-SM-4/D-CN-4 Non-scope）

## 前置 + readiness

- style-minify-gate ✅ complete（D-SM-1..4）
- style-cssnano-gate ✅ complete（D-CN-1..5）
- probe ✅（emit ≠ parse-walk，字节不同，实证）
- readiness gap：D-SMPU-2（A revert vs B emit per-module）需 design gate 决

## 关闭条件

- 单一 minify 路径（无 dual-path + 无 `isDiffVerifyMode` + 无 env var）
- 6 项目 production 路径 diff=0 对 baseline
- verify 脚本不再设 env
- D-SM-4/D-CN-4 Non-scope 反转记入 architecture-notes
