# Validation — fe-tools-packer-context

Status: **complete（2026-10-07）** — 实施 + 验证完成。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-PC01 | PackerContext 构造可用 | `toPackerContext` 保留在 env.ts（CompilerContext → PackerContext）；readContent=`fs.readFileSync`；resolvers stub 注释（D-PCS-1）；无新 exists 字段 | R-PC-1 / A-PC1 | ✅ pass |
| P-PC02 | Graph 路 2 | `graph.build(ctx)` 创建 `FixpointCtx{ctx, configData, npm}` → 调 `readProjectConfig/readAppConfig/readPageConfig/buildInitialGraph`；全部从 `ctx.readContent`/`ctx.workPath`/`ctx.fileTypes` 读；`fs.existsSync` 实现层；`NpmResolver(ctx.workPath)`；无 `void ctx`；无 build 内 ALS getter 回环 | R-PC-2 / A-PC2 | ✅ pass |
| P-PC03 | orch + storeInfo 装配 | grep 确认：公开 build/watch 经 orch/storeInfo；ctx 由 `toPackerContext(getCompilerContext())` 装配；pipeline 无双脑回退 | R-PC-3 / A-PC3 | ✅ pass |
| P-PC04 | 行为 0 | 全量 7 项目 diff=0（air-battle / base / mpx-demo / subpackages / taro-todo / vant / weui）；vitest 608/608 pass（compile-cli-cache flaky 重跑 pass）；`tsc --noEmit` 0 errors | R-PC-4 / A-PC4 | ✅ pass |
| P-PC05 | 兼容 / 边界 | `getComponent`/`getAppConfigInfo`/`getRuntimeType`/`isMiniGame` getter 契约不变；无 Scheme 进 PackerContext；`storeProjectConfig`/`storeAppConfig`/`storePageConfig`/`createInitialDependencyGraph`/`resolveAppAlias`/`getPages` 为薄壳委托 config-fixpoint；`env.spec.js` 仍可 import storeProjectConfig 不改测 | R-PC-5 / A-PC5 | ✅ pass |

## Uncovered

- incremental-unify（deferred）
- load/compile 拆分；真 registry；PackerContext resolvers 真接（D-PC-4）
- PackerContext 存在性 API（明确本门不做，D-PC-7）
- Session 持久 state；EmitEntry[] 返回收敛
- MC3c；sourcemap 对照（按仓库惯例另列）

## Actual

| When | What |
| --- | --- |
| 2026-09-22 | 立项 `draft`：D-PC-0..3 冻。 |
| 2026-09-22 | 讨论收口 → **D-PC-4..6**。 |
| 2026-09-22 | Readiness ×3 **fail**（F1 exists I/O、F2 NpmResolver 等）。修 findings → **D-PC-7..11**；设计挡点已清。 |
| 2026-09-22 | 10 轮 formalization review pass（R1-R10，3 consecutive clean）。升 `ready`。 |
| 2026-10-07 | 升 `in_progress`；实施 D-PC-0..11。 |
| 2026-10-07 | 创建 `src/packer/config-fixpoint.ts`（~470 行）：14 函数从 ALS 迁移为 `FixpointCtx` 显式参数。 |
| 2026-10-07 | 修改 `src/packer/graph.ts`：`build(ctx)` 删 `void ctx`，创建 FixpointCtx → 调 config-fixpoint。删 env.ts runtime import（graph→env 环打破）。 |
| 2026-10-07 | 修改 `src/compiler/core/env.ts`：`storeProjectConfig`/`storeAppConfig`/`storePageConfig`/`createInitialDependencyGraph`/`resolveAppAlias`/`getPages` → 薄壳委托 config-fixpoint；删 14 个死函数 + 3 个常量 + 5 个 unused import。 |
| 2026-10-07 | tsc 0 errors；vitest 608/608；全量 7 项目 diff=0。行为 0 三件套 ✓。 |
| 2026-10-07 | V-PC-5：config-fixpoint.ts 0 `any`/0 `as any`/0 `@ts-nocheck`；2 `[key: string]` 为 `getPagesImpl` 返回类型（从 env.ts `getPages` 迁移的公开 API 签名，不变更以避免 scope overflow）。 |

## V-PC-5 Type Constraints

| File | `any` | `as any` | `@ts-nocheck` | `[key: string]` | Notes |
| --- | --- | --- | --- | --- | --- |
| `config-fixpoint.ts` (new) | 0 | 0 | 0 | 2 | `getPagesImpl` 返回类型从 env.ts `getPages` 迁移 |
| `graph.ts` (modified) | 0 | 0 | 0 | 0 | 无新增 |
| `env.ts` (modified) | 0 | 0 | 0 | 5 | 从 6→5（删 1 死 local var） |
