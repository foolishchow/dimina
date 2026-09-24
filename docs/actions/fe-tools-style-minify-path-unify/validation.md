# Validation — fe-tools-style-minify-path-unify

Status: **draft（2026-10-09）**

## 验证方法

| ID | 方法 | check | evidence |
|---|---|---|---|
| P-SMPU1 | 代码审阅 | ① dual-path 全删（`isDiffVerifyMode` 函数 + guards + parse-walk 调用）② 单一 minify 路径（per-module + `\n` 保留）③ `StyleEmitOptions.minify` 死参注释（若方案 A） | 待审 |
| P-SMPU2 | grep 0 引用 | `grep -rn "DIMINA_COMPILER_DIFF_VERIFY\|isDiffVerifyMode" src/ __tests__/` = 0（含 verify 脚本） | 待测 |
| P-SMPU3 | 行为 0 production 路径 | 6 项目 one-shot diff=0 对 baseline（**不设 env**，验 production 真实路径；非旧 verify 路径） | 待测 |
| P-SMPU4 | tsc + vitest | tsc 0 errors；vitest 全绿（含 style-sourcemap.spec.js cssnano 路径回归） | 待测 |
| P-SMPU5 | V-PC-5 类型约束 | changed files（style/emit.ts + style/parse-walk.ts）无 `as any`/`@ts-nocheck`/`[key: string]: unknown` 新增 | 待测 |
| P-SMPU6 | cssnano sourcemap=true 路径回归 | `style-sourcemap.spec.js`（方案 A 后 cssnano 统一 parse-walk per-module，输出变）→ empirical 验 token-offset 断言是否仍 pass；若破则更新期望（per-module `\n` vs aggregated） | 待测 |

## 流程

1. D-SMPU-2 design gate review 定 A/B
2. 生产代码（按选定方案）
3. verify 脚本 + 测试删 env 设置
4. tsc + vitest 全量
5. 行为 0 production 路径 6 项目 diff=0（**不设 env**）
6. V-PC-5 grep
7. cssnano sourcemap=true 路径回归
8. architecture-notes SMPU 条目

## 行为 0 边界

- **one-shot**：production 路径（统一后 per-module + `\n`）== baseline → diff=0（**首次验 production 真实路径**——旧 verify 设 env 验的是 parse-walk，现 production = parse-walk 路径统一）
- **watch**：cache-hit re-emit cached code（G5 行为 0 延续，不受 minify 路径影响）
- **核心反转**：旧 D-SM-4/D-CN-4 "production ≠ baseline 但均有效" → 新 "production == baseline（字节恒等）"
