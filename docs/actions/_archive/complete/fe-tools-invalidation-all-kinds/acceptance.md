# Acceptance — fe-tools-invalidation-all-kinds

Status: **complete（2026-10-07）**

| ID | Req | Check | Evidence |
|---|---|---|---|
| A-G31 | R-G3-1 | `getInvalidatedModules` 无 `kind=logic` 过滤：owner 全推 + `getDirectDependents(id)` 全 kind 闭包 | P-G301 |
| A-G32 | R-G3-2 | 签名不变：`getInvalidatedModules` / `computeInvalidatedModules` / packer 委托 / watch-plan 注解 / invalidation.ts 函数体零变更（JSDoc 注释更新见 D-G3-3） | P-G301 |
| A-G33 | R-G3-3 | 测试更新：wxml → view owner 进集（D-IV-7 反转）；wxss → style owner 进集；component 边 → page 进集（D-IV-6 反转）；component .wxml → 依赖页进集；同模块多文件任一变更 → 进集；logic 回归（shared JS / page.js）；unknown → `[]` 不抛（D-IV-3） | P-G302 |
| A-G34 | R-G3-4 | 行为 0 三件套：全量 7 项目 diff=0（P-G303，one-shot 可执行）+ vitest 全绿（P-G304）+ tsc 0 errors（P-G304）；watch 路径保守过失效安全论证（superset + stages 门控 + 相同源重编译）经审阅（P-G301）证明，**非 no-op**；P-G302 仅证图级 superset 属性，不覆盖 logic worker 交互 | P-G303 + P-G304 + P-G301 |
| A-G35 | R-G3-5 | 类型约束：无 `any` / `as any` / `@ts-nocheck` / `[key: string]` 新增 | P-G305 |

## Non-acceptance

- view/style ModuleResultCache 接入（G4+G5）
- view/style worker 返回 compileRes（G4）
- watch-runner 创建 view/style cache 实例（G5）
- ModuleResultCache 泛型化
- `invalidation.ts` 函数体 / `watch-plan.ts` / `packer/*` 生产代码变更（R-G3-2 要求零改动；JSDoc 注释更新见 D-G3-3，非行为变更）
- `computeAffectedEntries` 改动
- 无授权来源的 D-IV-6/7 反转（授权 = incremental-unify D-IU-1，已在 requirements/README 明示）

## Traceability

- 本门实现 incremental-unify 的 **A-IU-1**（getInvalidatedModules 泛化）+ **A-IU-2**（computeInvalidatedModules 泛化）。
- G3 完结即部分满足 incremental-unify（仍 deferred）；**A-IU-3/A-IU-4**（view/style cache 接入 + cache hit 跳过）归 **G4+G5** 未启；**A-IU-5/A-IU-6**（行为 0 + 类型约束）跨切——G3 已满足本门范围（A-G34/A-G35），G4/G5 闭合整体。
- G5 重激活 incremental-unify 时追溯本门，将其 A-IU-1/A-IU-2 标为已落、引用 G3 闭环证据。
