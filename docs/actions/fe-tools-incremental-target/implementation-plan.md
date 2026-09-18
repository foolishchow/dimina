# Implementation Plan — fe-tools-incremental-target

Status: **ready（2026-09-19）** — D-IT-1..4 全拍板

## I0 契约冻结（文档级）

| Step | 动作 | 状态 |
| --- | --- | --- |
| 0 | D-IT-1..4 拍板；technical-design 冻结 v1 | ✅ |

## I1 watch 路径（S1 / S9 改道）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `compile-target.types.ts` | `StagePlan` 加 `filteredPages: PagesInfo` | 类型擦除 ✓ |
| 2 | `compile-target.ts` | 搬入 `filterPagesByEntries` 函数（从 build-pipeline.ts）；签名对齐 `PagesInfo` | 搬迁不改逻辑 ✓ |
| 3 | `compile-target.ts` | `deriveStagePlan` 签名改 `{ cwd, affectedEntries?: string[] }`（删 `filteredPages` 入参）；内部调 `filterPagesByEntries`；返回值加 `filteredPages` | 同输入同输出 ✓ |
| 4 | `build-pipeline.ts` | 删本地 `filterPagesByEntries` 函数 + L168 私算调用；改 `plan = deriveStagePlan(target, loadBindings, { cwd, affectedEntries })`；设 `ctx.pages = plan.filteredPages` | 搬迁不改逻辑 ✓ |
| 5 | watch-plan.ts / watch-runner.ts | 不改（方案 A 字段名不变） | N/A |
| 6 | session/runner.ts | 不改（白名单字段名不变） | N/A |
| 7 | dev-reload.ts | 不改（字段名读不变；D-IT-4）；专测锁定 | N/A |
| 8 | 测例 | `__tests__/` 现有增量测例全绿；新增结构断言测例（derive 返回 filteredPages；pipeline 无 filterPagesByEntries 私算） | — |

**I1 行为 0 基线**：`b124f84c`（ts-migration close）或 HEAD（strict-access close）。4 组 diff=0 + 584/584。

## I2 cache 路径 + S4（S3 / S4 单源）

| Step | 文件 | 动作 | 行为 0 |
| --- | --- | --- | --- |
| 1 | `compile-stages.ts` | 删本地 `COMPILE_STAGE_ORDER` L1；`import { COMPILE_STAGE_ORDER } from './compile-target.ts'` | 常量值不变 ✓ |
| 2 | `invalidation.ts` | 删 default `['view','logic','style']`；`import { COMPILE_STAGE_ORDER } from '../compiler/pipeline/compile-target.ts'`；default 用 import | 常量值不变 ✓ |
| 3 | compile-cache.ts | 不改（方案 A 字段名不变） | N/A |
| 4 | 测例 | compile-cache 增量测例全绿；结构断言：`grep -rn "const COMPILE_STAGE_ORDER" src/` 仅 compile-target.ts 命中 | — |

**I2 可与 I1 分 PR（D-IT-2），禁混。**

## 不做

- Listr 剥离、TS-2、真 web、renderer 扩展、PS3
- 不合并 `computeStagesForFiles` 与 `getCompileStagesForFiles`
- 不改 `build()` 公开签名
- 不改 dev-reload / preview-adapter 消费方式

## 消融纪律

- I1 消融：拔 `deriveStagePlan` 内 `filterPagesByEntries` 调用 → 回落 pipeline 私算 → 结构锚定失败（须恢复后全绿）
- I2 消融：拔 `compile-stages.ts` import → 回落本地拷贝 → `grep` 双拷贝 → 失败（须恢复后全绿）
- 消融补丁不入最终提交
