# Requirements — fe-tools-module-invalidation

Status: **草案（2026-09-19）** — 随 Action `ready`（2026-09-20）；D-IV-1..9 已冻。

## R-IV0（MUST）遵守伞 D-MF-1

- `moduleId` = 今日 logic `CompileInfo.path`（方案 A）；不改 emit / runtime。
- 返回集 **仅 logic Module**；排除 view/style/config-only 挂接。
- **不**替换 / 伪装 `getAffectedEntries`。
- 词汇：Entry / Module 与伞一致。

## R-IV1（MUST）模块级失效 API

- `DependencyGraph#getInvalidatedModules(filePath): string[]`（排序）。
- `computeInvalidatedModules(graph, changedFiles): string[]`（排序去重）于 `model/invalidation.ts`。
- 语义：对该文件存在 `kind=logic` 的 file 边之 owner，再沿 **logic** `dependents` 闭包（D-IV-6/7；见 TD §2）。

## R-IV2（MUST）可观测验证

- 单测至少覆盖 5 案（对齐 TD §2.2 + D-IV-3）：改共享 JS → 含对应 moduleId；改 page.js → 含页 logic moduleId；改 wxml → **不**进入本 API 集；改 component.js → moduleId 进集但页 moduleId 不进集（验 D-IV-6）；未知文件 → `[]` 不抛（验 D-IV-3）。
- 全量 vitest 绿；对既有 Entry 失效路径行为可声明不变或仅加法。

## R-IV3（MUST）落点与边界

- 落点：`model/dependency-graph.ts` + `model/invalidation.ts`（D-IV-2）。
- 不引入 Packer 插件 API；不拆 env/logic；不改 `fe/packages`。

## Non-requirements

- 不实现 ModuleCache / 不清 compileRes（M2）。
- 不接 watch / compile-cache 接线（D-IV-4）。
- 不迁移 page moduleId 规范形。
