# Requirements — fe-tools-bundler-strict-access

## R-SA0（MUST）tsconfig 选项启用

- `noUncheckedIndexedAccess: true` — 索引访问返回 `T | undefined`
- `forceConsistentCasingInFileNames: true` — 跨平台文件名大小写一致
- `allowUnusedLabels: false` — 禁止 unused labels

## R-SA1（MUST）编译错误全修复

- `noUncheckedIndexedAccess` 启用后产生的 63 处编译错误全修复
- 修复方式：`!` 非空断言 / typeof 守卫 / `??` 默认值 / `?.` 链 / 数组边界检查
- 不用 `any` / 不用 `@ts-expect-error` / 不用 `@ts-nocheck`
- tsc build（含全部 strict lint）0 错

## R-SA2（MUST）行为 0

- 4 组产物 diff=0（nomap / min-nomap / sm / sm-min）
- vitest 584/584
- 类型注解擦除，运行时不变

## R-SA3（MUST）lint 回流

- 修正后的 tsconfig.json 保持原有 6 类 strict lint 选项不回退：`strict` / `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noImplicitReturns` / `noImplicitOverride`
- 新增 3 类：`noUncheckedIndexedAccess` / `forceConsistentCasingInFileNames` / `allowUnusedLabels`
- 合计 9 类

## Non-requirements

- 不开 `exactOptionalPropertyTypes` / `noPropertyAccessFromIndexSignature`
- 不引入 ESLint
- 不改 `__tests__/` 逻辑
- 不改 `scripts/` / `crates/`
