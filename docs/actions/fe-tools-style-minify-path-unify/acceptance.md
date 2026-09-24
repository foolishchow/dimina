# Acceptance — fe-tools-style-minify-path-unify

Status: **draft（2026-10-09）**

## A-SMPU1 — 统一 minify 路径（R-SMPU-1, D-SMPU-1/2）

- [ ] style minify 单一路径（per-module minify + 保留模块间 `\n`）
- [ ] production 路径 == baseline（字节恒等）
- [ ] D-SMPU-2（A/B）经 design gate 定 + 实施

## A-SMPU2 — 下线 `DIMINA_COMPILER_DIFF_VERIFY`（R-SMPU-2, D-SMPU-3）

- [ ] 删 `style/emit.ts` `isDiffVerifyMode()` 函数
- [ ] 删 `style/parse-walk.ts:377,390` `isDiffVerifyMode()` 调用
- [ ] 删 `style/emit.ts:63,75` `!isDiffVerifyMode()` guards
- [ ] `DIMINA_COMPILER_DIFF_VERIFY` env var 无 src/_tests 引用

## A-SMPU3 — verify 脚本验 production 路径（R-SMPU-3, D-SMPU-4）

- [ ] `/tmp/verify-*.mjs` 删 `process.env.DIMINA_COMPILER_DIFF_VERIFY = '1'`
- [ ] `__tests__/view-style-cache-skip.spec.js` integration 删 setEnv/deleteEnv
- [ ] `__tests__/style-sourcemap.spec.js` 删 env 设置（若有）

## A-SMPU4 — 反转 Non-scope + bridge 迁移反转（R-SMPU-4）

- [ ] architecture-notes SMPU 条目记：① D-SM-4/D-CN-4 "Non-scope 不要求字节一致" 反转——字节一致为要求；② 若选方案 A，D-SM-2（esbuild minify 归 emit）+ D-CN-1（cssnano 正本归 emit）+ D-CN-3（cssnano canonical in emit）均反转——canonical 回 parse-walk

## A-SMPU5 — 行为 0 production 路径（R-SMPU-5）

- [ ] 6 项目 one-shot diff=0 对 baseline（**不设 env**，验 production 真实路径）
- [ ] tsc 0 errors；vitest 全绿
- [ ] V-PC-5：changed files 0 `as any` / 0 `[key: string]: unknown` 新增

## A-SMPU6 — minify 算法不变（R-SMPU-6）

- [ ] esbuild `minifyCss` 配置不动（仅改位置/聚合方式）
- [ ] cssnano 配置参数不动
- [ ] sourcemap=true 仍 cssnano，sourcemap=false 仍 esbuild（路径切换不变）

## Non-acceptance

- CSS minify 算法 / cssnano 配置参数（不改）
- logic / view minify（已在 emit 且无 dual-path）
- D-SM-2 迁移目标（若选方案 A，esbuild minify 归 emit 的迁移放弃——load/compile 拆时重做；architecture-notes 记）
- D-CN-1/D-CN-3（若选方案 A，cssnano 正本/canonical 归 emit 反转——cssnano 回 parse-walk per-module；canonical 在 load/compile 拆时重定）
- HMR / load-compile 拆 / deriveFromGraph 接入（后续门）
- 重写 style-minify-gate / style-cssnano-gate 归档文档（immutable，architecture-notes bridge）

## Traceability

- R-SMPU-1..6 ↔ A-SMPU1..6 ↔ P-SMPU-1..6（implementation-plan Step 4）
- 反转 D-SM-4（style-minify-gate）+ D-CN-4（style-cssnano-gate）Non-scope → architecture-notes bridge
