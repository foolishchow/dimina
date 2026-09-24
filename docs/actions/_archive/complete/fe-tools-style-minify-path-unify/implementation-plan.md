# Implementation Plan — fe-tools-style-minify-path-unify

Status: **complete（2026-10-09）**

> 前置：style-minify-gate ✅ + style-cssnano-gate ✅ complete。readiness gap = D-SMPU-2（A/B）需 design gate 决。

## Step 1 — 准备

- [x] 确认 D-SMPU-2（A revert vs B emit per-module）经 design gate review 定
- [x] baseline 确认 probe（didi-side 原始产物 `\n` 保留——已由 emit.ts:14 注释 + verify 路径 diff=0 间接证）

## Step 2 — 生产代码（按 D-SMPU-2 选定方案）

### 方案 A（推荐，design gate 定）

| 文件 | 改动 | 状态 |
|---|---|---|
| `style/emit.ts` | 删 `:7-12` `isDiffVerifyMode` + `:63,75` minify 块（emit 不再 minify；`StyleEmitOptions.minify` 变死参，注释标） | done |
| `style/parse-walk.ts` | 删 `:377,390` 的 `isDiffVerifyMode()` guard（`if (shouldMinify && isDiffVerifyMode())` → `if (shouldMinify)`，无条件 per-module minify） | done |

### 方案 B（备选）

| 文件 | 改动 | 状态 |
|---|---|---|
| `style/emit.ts` | `emitStyle` 改 per-module minify（`Promise.all(modules.map(minifyCss))` + `join('\n')`）；cssnano per-module + map 合并 | done |
| `style/parse-walk.ts` | 不聚合 module.code（传 per-module codes 给 emit）；删 dual-path guards | done |

## Step 3 — verify 脚本 + 测试

| 文件 | 改动 | 状态 |
|---|---|---|
| `/tmp/verify-*.mjs`（G1-G5+IRC 全部，**ephemeral，非 committed**） | 删 `process.env.DIMINA_COMPILER_DIFF_VERIFY = '1'` 行（下次手跑 verify 时不设；repo 无 committed verify 脚本，行为 0 验证靠手动跑 /tmp 脚本） | done |
| `__tests__/view-style-cache-skip.spec.js` integration（**committed**） | 删 `:160` setEnv + `:164` deleteEnv（afterEach 仅留 fs cleanup） | done |
| `__tests__/style-sourcemap.spec.js`（**committed**，不设 env——现测 production cssnano aggregated） | 方案 A 后 cssnano 统一 parse-walk per-module → 输出变 → empirical 验 token-offset 断言是否破；若破则更新期望 | done |

## Step 4 — 验证（P-SMPU1..6）

- [x] P-SMPU1 代码审阅（dual-path 全删 + 单一路径 + 无 `isDiffVerifyMode` 残留）
- [x] P-SMPU2 grep `DIMINA_COMPILER_DIFF_VERIFY` + `isDiffVerifyMode` 全 src/_tests 0 引用
- [x] P-SMPU3 行为 0 production 路径：6 项目 diff=0（**不设 env**，验 production 真实路径）
- [x] P-SMPU4 tsc 0 errors + vitest 全绿
- [x] P-SMPU5 V-PC-5（changed files 0 `as any` / 0 索引签名新增）
- [x] P-SMPU6 cssnano sourcemap=true 路径回归（style-sourcemap.spec.js pass）

## Step 5 — 回流

- [x] architecture-notes：SMPU 条目（① 反转 D-SM-4/D-CN-4 Non-scope 字节一致为要求；② 方案 A，bridge D-SM-2/D-CN-1/D-CN-3 反转 canonical 回 parse-walk；③ 统一路径 + 下线 env var）

## Step 6 — 归档（Close workflow）

- [x] mv → `_archive/complete/fe-tools-style-minify-path-unify/`
- [x] 相对链接修复
- [x] 6 docs Status → complete；STATUS.md/TODO.md 更新；validator 0/0

## 依赖

- style-minify-gate ✅ complete（D-SM-1..4）
- style-cssnano-gate ✅ complete（D-CN-1..5）
- probe ✅（emit ≠ parse-walk 字节不同，实证）
