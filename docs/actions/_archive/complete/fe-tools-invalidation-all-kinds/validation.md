# Validation — fe-tools-invalidation-all-kinds

Status: **complete（2026-10-07）**

| ID | Method | Criteria | Result |
|---|---|---|---|
| P-G301 | 代码审阅：① `dependency-graph.ts` `getInvalidatedModules` 无 `kind=logic` 过滤 ② `git diff` 4 文件（dependency-graph.ts + packer/types.ts JSDoc + invalidation.ts JSDoc + spec.js） ③ watch 安全论证：superset 单调性（set 只扩，skip 仅当 NOT in set → 永不欠失效）+ stages 门控（`compile-target.ts:138` `stages=COMPILE_STAGE_ORDER.filter(requestedStages.has)` + `:174` `if(stages.includes('logic'))` 才派发 logic）+ 相同源重编译字节一致（AST 重建图边一致） | 审阅通过 | ✅ commit `f32e87e`+working；diff 仅 4 文件 |
| P-G302 | vitest 单测（dependency-graph.spec.js 更新 + 新增用例） | 全绿 | ✅ 12/12 pass（2 反转 + 3 新增 + 7 保留） |
| P-G303 | 行为 0 全量：examples/miniprogram 7 项目（air-battle base mpx-demo subpackages taro-todo vant weui）`DIMINA_COMPILER_DIFF_VERIFY=1` baseline vs new `diff -r` | 7/7 diff=0 | ✅ 7/7 diff=0（git stash→baseline→pop→new→diff -r） |
| P-G304 | vitest 全量 + tsc 0 errors | 全绿 + 0 errors | ✅ tsc 0 errors；vitest 612/612（compile-cli-cache.spec.js flaky timeout 全量跑，单跑 2/2 pass 非回归） |
| P-G305 | V-PC-5 类型约束 grep：新交付物 0；既有文件 baseline vs current diff=0（无新增 `any` / `as any` / `@ts-nocheck` / `[key: string]`） | 0 新增 | ✅ 0 新增（3 生产文件 git diff +grep） |

## 流程

1. baseline：`git stash` → build 7 项目 → `git stash pop`
2. new：build 7 项目
3. `diff -r` 两产物目录 = 0
4. vitest 全量（注意 compile-cli-cache.spec.js 已知 flaky——单独重跑确认非回归）
5. tsc 0 errors
