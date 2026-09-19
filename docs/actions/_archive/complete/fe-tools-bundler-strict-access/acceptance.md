# Acceptance — fe-tools-bundler-strict-access

| ID | Requirement | Observable condition | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-SA0 | R-SA0 | tsconfig.json 含 `noUncheckedIndexedAccess` + `forceConsistentCasingInFileNames` + `allowUnusedLabels: false` | grep tsconfig.json | pass |
| A-SA1 | R-SA1 | `noUncheckedIndexedAccess` 启用后 tsc 0 错（含全部 strict lint） | `tsc -p tsconfig.build.json` exit 0 | pass |
| A-SA2 | R-SA2 | 4 组产物 diff=0 + vitest 584/584 | diff -rq + vitest | pass |
| A-SA3 | R-SA3 | tsconfig.json 保持原有 6 类 strict lint 不回退（`strict` / `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noImplicitReturns` / `noImplicitOverride`） | grep tsconfig.json 6 选项 | pass |

## Non-acceptance

- 用 `any` / `@ts-expect-error` / `@ts-nocheck` 绕过
- 开 `exactOptionalPropertyTypes` 或 `noPropertyAccessFromIndexSignature`
- 任何行为变化（产物 diff≠0）
