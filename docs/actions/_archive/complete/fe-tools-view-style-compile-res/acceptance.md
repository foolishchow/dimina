# Acceptance — fe-tools-view-style-compile-res

Status: **complete（2026-10-08）**

> review R1-R3 修正后固化。A-G4-x 映射 R-G4-x（RG4-1/2/3/4 已解，见 TD D-G4-1..3/8）。

| ID | Req | Check | Evidence |
|---|---|---|---|
| A-G41 | R-G4-1 | view worker 返回 `ViewCompiledModule[]`（`{ moduleId, kind:'view', code, map, dependencies: [] }`；renderBody?/wxsBindings? 留 undefined）；只返回 dirty（D-IU-5）；emit 路径不变（inline `emitEntry` 保留） | P-G401 |
| A-G42 | R-G4-2 | style worker 返回 `StyleCompiledModule[]`（`{ moduleId, kind:'style', code, map, dependencies: [] }`；styleScopeId? 留 undefined）；只返回 dirty；emit 路径不变；styleEngine 用默认 successPayload（不补） | P-G401 |
| A-G43 | R-G4-3 | stage-channel 新增 view/style cache 写入块（guarded `ctx.viewCache?`/`ctx.styleCache?`，bare value）+ ctx 类型扩展（optional 字段或局部 `as`，D-G4-5）；logic 块不变（D-IU-3）；注入 mock ctx 验证 `set` 调用 | P-G402 |
| A-G44 | R-G4-4 | 行为 0 三件套：全量 7 项目 diff=0（P-G403，one-shot `ctx.viewCache/styleCache` 未设→写 no-op→无行为变更）+ vitest 全绿（P-G404）+ tsc 0 errors（P-G404）；watch 路径无 cache 实例→全量编译不变（G5 才接 cache hit skip）经 code review（P-G401：stage-channel guarded no-op + G4 期无 cache 实例） | P-G403 + P-G404 + P-G401 |
| A-G45 | R-G4-5 | 类型约束：无 `any`/`as any`/`@ts-nocheck`/`[key: string]` 新增；`as { viewCompileResults? }` 结构断言允许（与 stage-channel 现有模式同） | P-G405 |

## Non-acceptance

- watch-runner 创建 view/style cache 实例（G5）
- `PackerSessionState` `viewCache`/`styleCache` 字段（G5）
- `orchestrator.ts` state→ctx plumbing for view/style（G5）
- cache hit → skip（G5 = incremental-unify 重激活 A-IU-4；cross-rebuild 读，D-G4-9）
- ModuleResultCache 泛型化（D-IU-3 不泛型化；后续 Packer 接入）
- view/style emit 改 deferred（G4 保留 inline emit）
- logic cache / `CachedModuleResult` / `ModuleResultCache` class 改动（D-IU-3 logic 保持）
- `ViewCompiledModule`/`StyleCompiledModule` 类型定义改动（packer/types.ts 已存在，G4 只消费）
- watch 效率提升（G4 期无 cache 实例→仍全量；G5 才有 skip）

## Traceability

- 本门实现 incremental-unify 的 **A-IU-3** 部分（view/style cache 接入——数据源 + 写路径）；A-IU-3 拆分授权见 **D-G4-8**（G4=数据源+写，G5=实例+plumbing+skip）。
- **G4 反转 D-IU-2**（TD D-G4-1 字段降级 base+`[]` + D-G4-3 cache bare 双存→bare）；G5 重激活 incremental-unify 须 account 此反转（D-IU-2 原文假设全字段填充 + wrapped 双存）。
- **A-IU-4**（cache hit 跳过）归 **G5**（incremental-unify 重激活）未启；watch-runner 实例 + state 字段 + plumbing + skip = G5。
- G3（complete）已落 A-IU-1/A-IU-2（getInvalidatedModules + computeInvalidatedModules 泛化）；G4 落 A-IU-3 数据源；G5 落 A-IU-3 实例 + A-IU-4 skip → incremental-unify 整体闭合。
- 行为 0 + 类型约束（A-IU-5/A-IU-6）跨切——G4 满足本门范围（A-G44/A-G45）。
