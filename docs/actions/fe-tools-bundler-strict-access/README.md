# fe-tools-bundler-strict-access

- Action: `fe-tools-bundler-strict-access`
- Status: `ready`
- Updated: 2026-09-18
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-ts-migration`](../_archive/complete/fe-tools-ts-migration/README.md)（深度类型化 274→29 + tsconfig 5 类 strict lint + 35 处存量修复）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 背景

ts-migration 完成后，bundler tsconfig.json 已启用 6 类 strict lint（`strict` / `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noImplicitReturns` / `noImplicitOverride`）。但 TS 还有两个重量级选项未开：

1. **`noUncheckedIndexedAccess`** — `arr[i]` / `obj[key]` 返回 `T | undefined`。当前 63 处编译错误。
2. **`forceConsistentCasingInFileNames`** + **`allowUnusedLabels: false`** — 零成本，0 错。

`noUncheckedIndexedAccess` 是唯一还没开的重量级 TS 类型安全选项。它能防真实 bug（数组越界、缺 key 访问），但也逼着加 `!` 或类型守卫——与"减少类型断言"目标有一定张力。

## 问题

- 63 处索引访问未检查 undefined：`arr[i]` 返回 `T` 而非 `T | undefined`，越界访问不报错
- 文件名大小写不一致在跨平台（macOS↔Linux）时可能出问题
- Unused labels 无检测

## 目标

1. tsconfig.json 启用 `noUncheckedIndexedAccess: true` + `forceConsistentCasingInFileNames: true` + `allowUnusedLabels: false`
2. 63 处编译错误全修复（`!` 非空断言 / typeof 守卫 / `??` 默认值 / `?.` 链）
3. 行为 0（类型注解擦除，运行时不变）

## Non-goals

- 不开 `exactOptionalPropertyTypes`（49 错，第三方库摩擦大）
- 不开 `noPropertyAccessFromIndexSignature`（175 错，纯噪音）
- 不引入 ESLint 工具链（另立 Action）
- 不改 `__tests__/` 逻辑（tsconfig include 已含 `__tests__/`，ts-migration P-TM07；本门不改）

## 范围

`fe/tools/bundler/tsconfig.json` + 63 处错误涉及的 18 个 `.ts` 源文件。

## 依赖

- ts-migration（已完成：72 .js→.ts + 深度类型化 + 5 类 strict lint）

## 交付物

- tsconfig.json 新增 3 个编译选项
- 63 处 `noUncheckedIndexedAccess` 错误全修复
- 行为 0 证据（tsc 0 错 + 584/584 + 4 组 diff=0）

## readiness gaps

- 无。63 处错误已全量扫描，分类明确（TS2532 / TS18048 / TS2345 / TS2322 / TS2339），修复策略明确。
- 零成本选项已探测 0 错。
- Review R1 pass-with-findings：F1-F3 修正完毕（选项计数一致 + 步骤 7 文件数修正）。
- Review R2 pass：F4-F6 修正完毕（路径基统一为 src/ + 括注语义清晰化 + 外部脚本来源注记）。
- Review R3 pass：F7 修正完毕（V-SA0 grep 含值验证）。三轮 review 完成。
