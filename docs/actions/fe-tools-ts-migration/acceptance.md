# Acceptance — fe-tools-ts-migration

| ID | Requirement | Observable condition | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-TM0 | R-TM0 | grep 零 .js in bundler/src（72 → 0） | `find src -name "*.js"` 退出码 1 | pending |
| A-TM1 | R-TM1 | import 后缀全修正（显式 .ts，D-TM-1） | grep `from '.*\.ts'` 命中 + 零 `from '.*\.js'` in bundler/src import | pending |
| A-TM2 | R-TM1 | __tests__/ import 后缀（D-TM-2 已拍 scope 内） | grep __tests__/ import src/ 用 .ts | pending |
| A-TM3 | R-TM2 | 4 组产物 diff=0 + vitest 584/584 + tsc OK | diff -rq baseline current + vitest + tsc | pending |
| A-TM4 | R-TM3 | worker strip-types 注入保留 | grep `--experimental-strip-types` in worker-runtime/executor.js | pending |
| A-TM5 | R-TM4 | JSDoc→TS type 类型完善 | grep 零 `@typedef` in src（9→0）+ 零 `any` + tsc strict OK | pending |

## Non-acceptance

- 不改 scripts/、crates/ 等 src 外
- 不改行为（产物字节一致）
- 不用 any（类型体系完善）
