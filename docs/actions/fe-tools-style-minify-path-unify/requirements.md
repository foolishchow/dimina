# Requirements — fe-tools-style-minify-path-unify

Status: **ready（2026-10-09）**

## 问题

`DIMINA_COMPILER_DIFF_VERIFY` 制造 style minify 双路径：verify 脚本（设 env）走 parse-walk per-module minify（保留模块间 `\n`），production（bin/ 不设）走 emit aggregated minify（删 `\n`）。两路径字节不同（probe 实证）。G1-G5+IRC 6 轮 behavior-0 "diff=0" 全验 parse-walk 路径——**production 路径未被验**。D-SM-4/D-CN-4 显式将字节一致设为 Non-scope（迁移期妥协）。

## 需求

### R-SMPU-1（MUST）— 统一 minify 路径（字节恒等）

style minify 统一到**单一字节恒等路径**：per-module minify + 保留模块间 `\n`（= baseline）。删 dual-path 分支。具体路径（A revert vs B emit per-module）由 D-SMPU-2 定。

### R-SMPU-2（MUST）— 下线 `DIMINA_COMPILER_DIFF_VERIFY`

删 `isDiffVerifyMode()`（`style/emit.ts`）+ `style/parse-walk.ts:377,390` 的 `isDiffVerifyMode()` 调用 + `style/emit.ts:63,75` 的 `!isDiffVerifyMode()` guards。删 env var 本身。

### R-SMPU-3（MUST）— verify 脚本验 production 路径

所有 verify 脚本（`/tmp/verify-*.mjs`）+ `__tests__/view-style-cache-skip.spec.js` integration：删 `process.env.DIMINA_COMPILER_DIFF_VERIFY = '1'` + `afterEach` 的 delete。verify 直接验 production 真实路径。

### R-SMPU-4（MUST）— 反转 D-SM-4/D-CN-4 Non-scope + bridge D-SM-2/D-CN-1/D-CN-3 反转

architecture-notes 记：① D-SM-4/D-CN-4 的"Non-scope 不要求字节一致"反转——字节一致为要求（production == baseline）；② 方案 A，D-SM-2（esbuild minify 归 emit）+ D-CN-1（cssnano 正本归 emit）+ D-CN-3（cssnano PostCSS in emit canonical）均反转——canonical 回 parse-walk，load/compile 拆时重定。SMPU 条目作 bridge。

### R-SMPU-5（MUST）— 行为 0（production 路径）

6 项目 one-shot build diff=0 对 baseline，**验 production 路径**（非旧 verify 路径）。tsc 0 errors + vitest 全绿。

### R-SMPU-6（MUST）— minify 算法不变

esbuild `minifyCss` + cssnano 配置参数不动。仅改 minify **位置/聚合方式**（per-module vs aggregated），不改 minify 算法本身。

## 约束

- 行为 0（production 路径 diff=0 对 baseline——这是本 Action 的核心交付，非继承）
- 类型约束（V-PC-5）：无 `as any` / `[key: string]: unknown` 新增
- 不重写 style-minify-gate / style-cssnano-gate 归档文档（immutable，architecture-notes bridge）

## Non-scope

- CSS minify 算法 / cssnano 配置参数（不改）
- logic / view minify（已在 emit 且无 dual-path）
- sourcemap 路径切换（sourcemap=true 仍 cssnano，sourcemap=false 仍 esbuild）
- HMR / load-compile 拆 / deriveFromGraph 接入（后续门）
- 重写已 complete Action 归档文档
