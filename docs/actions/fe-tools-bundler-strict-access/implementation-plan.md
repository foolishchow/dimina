# Implementation Plan — fe-tools-bundler-strict-access

## 纪律

- 不用 `any` / `@ts-expect-error` / `@ts-nocheck`
- 不开 `exactOptionalPropertyTypes` / `noPropertyAccessFromIndexSignature`
- 不改行为（产物 diff=0）

## 步骤

| Step | 动作 | 验证 |
| --- | --- | --- |
| 0 | tsconfig.json 加 `forceConsistentCasingInFileNames: true` + `allowUnusedLabels: false` | tsc 0 错（零成本） |
| 1 | tsconfig.json 加 `noUncheckedIndexedAccess: true` | tsc 报 63 错（预期） |
| 2 | 修复 napi/parse.ts（11 错）— SpanView AST 索引访问 | tsc 该文件 0 错 |
| 3 | 修复 logic/index.ts（8 错）— AST walker 参数访问 | tsc 该文件 0 错 |
| 4 | 修复 parity.ts（7 错）— 比较节点数组访问 | tsc 该文件 0 错 |
| 5 | 修复 watch-plan.ts（6 错）+ view/index.ts（6 错） | tsc 两文件 0 错 |
| 6 | 修复 compile-cache.ts + tools.ts + document-ops.ts + build-pipeline.ts（14 错） | tsc 四文件 0 错 |
| 7 | 修复剩余 11 错（7 文件各 1-2） | tsc 全 0 错 |
| 8 | 全量验证：tsc build + vitest + 4 组 diff | 0 错 + 584/584 + diff=0 |

## 不做

- 不引入 ESLint
- 不开 exactOptionalPropertyTypes / noPropertyAccessFromIndexSignature
- 不改 __tests__ 逻辑
