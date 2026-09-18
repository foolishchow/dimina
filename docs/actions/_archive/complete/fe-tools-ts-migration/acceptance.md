# Acceptance — fe-tools-ts-migration

| ID | Requirement | Observable condition | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-TM0 | R-TM0 | grep 零 .js in bundler/src（72 → 0） | `find src -name "*.js"` count=0 ✓（V-TM08） | passed |
| A-TM1 | R-TM1 | import 后缀全修正（显式 .ts，D-TM-1） | 零 `from '.*\.js'` in bundler/src import ✓（V-TM08） | passed |
| A-TM2 | R-TM1 | __tests__/ import 后缀（D-TM-2 已拍 scope 内） | grep __tests__/ import src/ 用 .ts ✓（V-TM07） | passed |
| A-TM3 | R-TM2 | 4 组产物 diff=0 + vitest 584/584 + tsc OK | diff -rq baseline=current 4× ✓ + vitest 584/584 ✓ + tsc 0 错 ✓（V-TM08） | passed |
| A-TM4 | R-TM3 | worker strip-types 注入保留 | grep `--experimental-strip-types` in executor.ts ✓（V-TM08） | passed |
| A-TM5 | R-TM4 | JSDoc→TS type 类型完善 | grep 零 `@typedef` in src（9→0）✓ + 零 `any` ✓ + tsc strict OK ✓（V-TM08） | passed |

## 超额交付（深度类型化 + lint，A-TM5 范围内）

| 项 | 原始 | 最终 | 消除率 |
| --- | --- | --- | --- |
| `@ts-expect-error` | 556 | 3 | 99.5% |
| 硬类型断言总计 | 274 | 29 | 89.4% |
| `as never` | 48 | 0 | 100% |
| `as unknown as` | 43 | 1 | 97.7% |
| `as string` | 87 | 10 | 88.5% |
| `as Record<string` | 57 | 15 | 73.7% |
| `as Error` | 34 | 0 | 100% |
| `as any` | 5 | 0 | 100% |
| `: any` | 25 | 0 | 100% |
| `: Function` | 9 | 0 | 100% |

剩余 29 处均为 TS 语言限制（Proxy key `string|symbol`、`unknown→Record` 无索引签名）或第三方库类型问题（cssnano），记录于 TODO「Bundler lint 增强」候选。

## lint 增强（A-TM5 范围内）

tsconfig.json 新增 5 类 strict lint 选项：`noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noImplicitReturns` / `noImplicitOverride`；35 处存量 lint 问题全修复（unused imports + missing return + unused params）。tsc build 自动执行 lint 检查，0 错。

## Non-acceptance

- 不改 scripts/、crates/ 等 src 外
- 不改行为（产物字节一致）
- 不用 any（类型体系完善）
