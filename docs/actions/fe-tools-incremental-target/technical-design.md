# Technical Design — fe-tools-incremental-target

Status: **冻结 v1（2026-09-19）** — 升 `ready`

## 1. 与 CompileTarget 的关系

| 层 | 全量（已交付） | 增量（本门） |
| --- | --- | --- |
| 静态形态 | `createCompileTarget(runOptions)` | 同；`requestedStages` 可来自增量契约而非全量默认 |
| 动态绑定 | `readLoadBindings` | 同（collect-config 后） |
| 派生 | `deriveStagePlan(target, bindings, { cwd, filteredPages })` | `filteredPages` 的**权威输入**改由 `affectedEntries` 在 derive 内显式消费，不再靠 pipeline 私过滤 |

## 2. 决策

| ID | 决策 | 依据 |
| --- | --- | --- |
| **D-IT-1** | 契约 = **方案 A** — 仍走 `build(options)`，字段名不变（`stages` / `affectedEntries` / `seedPath` / `prepareConfig` / `prepareNpm`）；成文为 CompileTarget 输入的权威增量补丁 | 行为 0 友好；改动面小；dev-reload 自动兼容 |
| **D-IT-2** | compile-cache 与 watch 分门（I1 / I2），可分 PR 禁混 | 降低 review 面；I2 不阻塞 I1 |
| **D-IT-3** | `COMPILE_STAGE_ORDER` 单源在 `compile-target.ts`（已导出 L178）；`compile-stages.ts` / `invalidation.ts` 删本地拷贝改 import | D-CT-4 形态单源不变量；三份拷贝→一份 |
| **D-IT-4** | dev-reload 随 I1 自动对齐 — `dev-reload.ts` L48-49 读 `plan.options.stages` / `plan.options.affectedEntries` 字段名读，方案 A 下字段名不变 | 专测锁定 |

## 3. S9 改道：filterPagesByEntries 从 pipeline 搬入 derive

### 当前（私算）

```text
build-pipeline.ts L167-173:
  ctx.allPages = loadBindings.pages           // 全量
  ctx.pages = filterPagesByEntries(           // ← 私算（build-pipeline 内）
    loadBindings.pages, affectedEntries)
  plan = deriveStagePlan(target, loadBindings,
    { cwd, filteredPages: ctx.pages })        // 传预过滤结果
```

### 改后（单源）

```text
build-pipeline.ts:
  plan = deriveStagePlan(target, loadBindings,
    { cwd, affectedEntries })                // ← derive 内显式消费
  ctx.pages = plan.filteredPages             // ← derive 返回
```

`filterPagesByEntries` 函数从 `build-pipeline.ts` 搬到 `compile-target.ts`，签名对齐 `PagesInfo`。

### ctx.pages 消费链（验证）

| 消费方 | 当前 | 改后 |
| --- | --- | --- |
| `deriveStagePlan` L131 `pagesForStyle` | `filteredPages ?? bindings.pages` | 内部计算 `filteredPages`（不变） |
| `createStageTask` L242 `workerOptions.pages \|\| ctx.pages` | ctx.pages 作 view 阶段 fallback | `plan.filteredPages` → `ctx.pages`（不变） |
| `stageSpecs.logic.workerOptions.pages` | `bindings.pages`（未过滤，intentional） | 不变 |

### StagePlan 类型增字段

```ts
// compile-target.types.ts
export interface StagePlan {
    stages: string[]
    stageSpecs: Record<string, StageSpec>
    sourcemapTargetPath: string
    stylePages: PagesInfo
    filteredPages: PagesInfo  // 新增：供 pipeline 设 ctx.pages
}
```

## 4. S4 单源：COMPILE_STAGE_ORDER

| 文件 | 当前 | 改后 |
| --- | --- | --- |
| `compile-target.ts` L25 | `const COMPILE_STAGE_ORDER = [...]` + L178 export | 不变（权威源） |
| `compile-stages.ts` L1 | `const COMPILE_STAGE_ORDER = [...]` 本地；零 import | 删，`import { COMPILE_STAGE_ORDER } from './compile-target.ts'`（sibling，无循环） |
| `invalidation.ts` L49 | `allStages = ['view','logic','style']` default；零 import | 删 default，`import { COMPILE_STAGE_ORDER } from '../compiler/pipeline/compile-target.ts'`，default 用 import |

**结构性变更（F5）**：`compile-stages.ts` / `invalidation.ts` 当前零 import。新增 import 后 `invalidation.ts`（`model/`）→ `compile-target.ts`（`compiler/pipeline/`）形成新依赖边。`compile-target.ts` 不反向 import 这两文件，无循环。boundaries 落点表两文件均属 Scheme，Scheme→Scheme 允许。

## 5. S3 双函数说明（不统一，仅对齐词汇）

| 函数 | 位置 | 调用方 | 返回 | 边缘处理 |
| --- | --- | --- | --- | --- |
| `computeStagesForFiles` | `invalidation.ts` | `watch-plan.ts` | `Set<string>` | kinds 空 → 全量 `Set(allStages)`（保守） |
| `getCompileStagesForFiles` | `compile-stages.ts` | `compile-cache.ts` | `{ stages, unknownKinds }` | kinds 空 → 空 stages + 调用方检查 |

两函数边缘处理**intentionally different**（watch 保守全量 vs cache 显式检查）。本门仅统一 `COMPILE_STAGE_ORDER` 源（D-IT-3），不合并函数。合并另立。

## 6. 职责表

| 关注点 | 归属 |
| --- | --- |
| 变更 → stages / affectedEntries | watch-plan / compile-cache（生产者）；共用 `COMPILE_STAGE_ORDER` 单源 |
| affectedEntries → filteredPages | `deriveStagePlan`（compile-target.ts） |
| session 白名单 | `runner.ts` — 字段名不变，无需改 |
| Listr / worker | 不动（Non-goal） |

## 7. 不做

- 不合并 `computeStagesForFiles` 与 `getCompileStagesForFiles`（intentionally different）
- 不改 `build()` 公开签名
- 不碰 Listr / TS-2 / 真 web / renderer 扩展 / PS3
- 不改 `compile-cache.ts` 选项字段名（方案 A）
- 不改 `dev-reload.ts` 消费方式（字段名不变，自动兼容）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 草案：A/B 契约；待定 ①–④ |
| 2026-09-19 | **冻结 v1**：D-IT-1..4 全拍板（A / 分门 / compile-target 单源 / dev-reload 自动对齐）；source audit 实锚 S1/S2/S3/S4/S9；filterPagesByEntries 搬入 derive + StagePlan 加 filteredPages |
| 2026-09-19 | Review R1-R3（7 findings 全 low 全修正）：F1 标题漏 S4；F2 baseline 钉死 `0fad4128`；F3 补正向 grep；F4 补目标签名；F5 标注新依赖边；F6 P-IT02 全量/增量语义明确；F7 P-IT05 测文件改 `dev-reload.spec.js` |
| 2026-09-19 | Review R4-R6（7 findings 全修正）：F8 前置上下文漏 S4；F9 I1 Step 8 加 `compile-target.spec.js` 须改（L199-219 `filteredPages` break）；F10 P-IT02 测文件列表修正（补 build-stages + compile-target，移除 watch-runner 过度陈述）；F11 D-CT-1→D-CT-4；F12 P-IT05 补 preview-adapter；F13 S2 语义升格非收口；F14 结构断言复用既有测例模式 |
