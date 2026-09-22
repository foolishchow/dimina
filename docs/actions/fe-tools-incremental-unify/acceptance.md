# Acceptance — fe-tools-incremental-unify

## A-IU-1 — getInvalidatedModules 泛化（R-IU-1, D-IU-1, D-IV-6 泛化）

- [ ] `getInvalidatedModules(filePath)` 不按 kind=logic 过滤 owner
- [ ] `getInvalidatedModules(filePath)` 不调 `getDirectDependents(id, 'logic')`——调无 kind 参数版
- [ ] 返回受影响的全 kind module IDs

## A-IU-2 — computeInvalidatedModules 泛化（R-IU-2, D-IU-1）

- [ ] `computeInvalidatedModules(graph, changedFiles)` 返回全 kind module IDs
- [ ] 签名不变——调用方（watch-plan）不改

## A-IU-3 — view/style ModuleResultCache 接入（R-IU-3, D-IU-2, D-IU-3）

- [ ] view/style worker 返回 compile result + dependencies
- [ ] stage-channel 写 view/style cache
- [ ] watch-runner 创建 view/style cache 实例

## A-IU-4 — cache hit 跳过（R-IU-4, D-IU-4, D-IU-5）

- [ ] view/style worker 收 cache 快照 + invalidatedModules
- [ ] cache hit 时跳过 compile（返回 cached result）

## A-IU-5 — 行为 0（R-IU-5）

- [ ] `git diff --stat` 产物 diff=0
- [ ] tsc 0 错
- [ ] vitest 全绿

## A-IU-6 — 类型约束（R-IU-6）

- [ ] 无 `any` / `as any` / `@ts-nocheck`
- [ ] 无 `[key: string]: unknown` 索引签名
