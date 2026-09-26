# Design Draft — fe-tools-singleton-retire-impl-core

> **状态：ready**——D-SIC-1..3 已 review lock。A5 核心迁移（PackerContext 扩 + ALS 迁 + successPayload）。

## 1. D-SIC-1 — PackerContext 扩 optional（形状纪律候选 a 锁定）

**types.ts PackerContext 扩**：
```ts
export interface PackerContext {
  workPath: string
  targetPath: string
  readContent: (path: string) => string
  resolveAlias: (src: string) => string | null
  resolveNpm: (src: string, baseFile: string) => string
  fileTypes: PackerFileTypes
  // D-SIC-1 扩 optional（A5 形状纪律候选 a——D-PCS-1/D-PCS-6 放宽）
  graph?: Graph              // 可变单例实例（addFile/addDependency 写入）
  appId?: string            // getAppId 实体化
  component?: (src: string) => unknown  // getComponent 实体化（返回 unknown 非 Module|null）
  configInfo?: Record<string, unknown>  // getAppConfigInfo/getPages 实体化（data——建 ctx 时设）
  npmResolver?: NpmResolver // getNpmResolver 实例（非 resolveNpm function）
  runtimeType?: string      // isMiniGame 实体化（F-R2-1：getRuntimeType——非 configInfo.isMiniGame）
}
```
- 注释修改（types.ts:103）：删/改「graph/moduleCache/invalidatedModules 不在 PackerContext」（graph 加 optional 后过时）
- **import 变更**（F-R1-3）：types.ts 加 `import type { Graph } from './graph/graph.ts'` + `import type { NpmResolver } from './graph/npm-resolver.ts'`（当前只 import GraphSnapshot + GraphConfigData）

**config-fixpoint.ts buildPackerContextFromOptions 扩**：
- 加 optional 参数：`graph?: Graph` + `appInfo?: Record` + `component?: (src) => unknown` + `configInfo?` + `npmResolver?` + `runtimeType?`
- **caller 5 处**（F-R1-2）：env-compute × 2 + config-fixpoint × 1 + style/index + logic/index（view/index 未调——F-R1-1 补建）。扩 optional 参数末尾——caller 不破坏（同 A0-A3 模式）
- **worker ctx graph 来源**（F-R4-1）：worker 引擎 ctx 建立（logic/style index.ts）须传 graph 实例——`buildPackerContextFromOptions(..., { graph: getDependencyGraph(), configInfo: getAppConfigInfo(), appId: getAppId(), runtimeType: getRuntimeType(), component: (src) => getComponent(src), npmResolver: getNpmResolver() ?? undefined, ... })`（**过渡**——ALS 读传 ctx，fallback ALS 兼容）
- **worker input graph 序列化路径**（F-R4-2）：buildResetStoreInfoData（env-compute.ts:287）组装 worker reset data（含 dependencyGraph snapshot）→ worker resetStoreInfo 重建 graph 到 ALS → ctx 建立 read ALS graph 传 ctx.graph → parse-walk 读 ctx.graph
- resolveAlias 闭包 appInfo：`resolveAlias: (src) => resolveAppAlias(src, appInfo)`（非 stub `(_src) => null`——A0 R8 守护）
- **行为 0 守护**：appInfo 不传时 fallback stub `(_src) => null`（原行为）；传时实体化

## 2. D-SIC-2 — ALS 残留 31 处迁移到 ctx 读（ctx optional + fallback ALS）

**迁移映射**：
| ALS getter | ctx 字段 | fallback | 等价说明 |
|---|---|---|---|
| getDependencyGraph() | ctx.graph | `?? getDependencyGraph()` | graph 可变单例实例 |
| getComponent(src) | ctx.component?.(src) | `?? getComponent(src)` | **闭包 graph + configInfo**（F-R2-3：`graph.getComponent(src) ?? configInfo.componentInfo[src]`） |
| getAppId() | ctx.appId | `?? getAppId()` | `configInfo.projectInfo.appid`（建 ctx 时设） |
| getNpmResolver() | ctx.npmResolver | `?? getNpmResolver()` | NpmResolver 实例 |
| resolveAppAlias(src) | ctx.resolveAlias(src) | — | 闭包 appInfo（D-SIC-1） |
| getAppConfigInfo() | ctx.configInfo | `?? getAppConfigInfo()` | **data 非 function**（F-R2-2：建 ctx 时设 `graph.getAppConfigInfo() ?? configInfo.appInfo`） |
| isMiniGame() | ctx.runtimeType | `?? isMiniGame()` | **F-R2-1 修正**：isMiniGame 读 `getRuntimeType() === MINI_GAME_RUNTIME_TYPE`（非 configInfo.isMiniGame）——ctx 加 `runtimeType?: string`（建 ctx 时从 getRuntimeType 设） |

**分布**（31 处）：
- logic/parse-walk 8 处 + logic/index 10 处（isMiniGame L56 + getAppConfigInfo L88/159 + getDependencyGraph L89/126/128/160/306 + getComponent L100/186）
- view/parse-walk 7 处 + view/index 1 处（getDependencyGraph L216 successPayload）
- style/parse-walk 5 处

**view ctx 透传链补全**（F-R1-1 **high**——A2 遗留）：
- A2 summary 说「viewCompile 建 ctx + compileML 透传」但实际未实施——viewParseWalk caller 未传 ctx（L126/137 ctx undefined fallback ALS）
- D-SIC-2 须先补 view ctx 透传链：viewCompile 建 ctx（buildPackerContextFromOptions）+ compileML 加 ctx 参数 + viewParseWalk caller 传 ctx
- **行为 0**：ctx 传走 ctx（A5a 新增 ALS 迁），不传 fallback ALS（A2 原行为——ctx undefined）

**ctx optional + fallback ALS**（渐进）：ctx 传走 ctx，不传 fallback ALS（原行为）——行为 0。

## 3. D-SIC-3 — successPayload 3 处改 ctx.graph

**签名扩**（define-engine.ts:18）：
```ts
successPayload: (ctx: { logger: {...}; graph?: Graph }) => Record<string, unknown>
```
- **caller**（F-R3-1）：runtime.ts:33 `engine.n({ logger })`——须改传 `{ logger, graph: ctx.graph }`（worker 引擎 ctx.graph）。graph 来源 = worker 引擎建 ctx 的 ctx.graph（D-SIC-1 buildPackerContextFromOptions 传 graph）
- 默认实现（define-engine.ts:28）：`({ graph }) => ({ dependencyGraph: graph?.toJSON() ?? getDependencyGraph().toJSON() })`（F-R3-2：fallback ALS——ctx.graph 不传时读 getDependencyGraph()）
- logicSuccessPayload（index.ts:304）+ viewSuccessPayload（index.ts:214）：同改 `({ logger, graph }) => ({ dependencyGraph: graph?.toJSON() ?? getDependencyGraph().toJSON(), compatibilityWarnings: logger.flush() })`
- **fallback ALS**：ctx.graph 不传时 fallback getDependencyGraph()（原行为）——行为 0

## 4. P-SIC-1..3 atomic

- **P-SIC-1**：types.ts PackerContext 扩 + config-fixpoint buildPackerContextFromOptions 扩（optional 参数 + resolveAlias 闭包 appInfo）
- **P-SIC-2**：parse-walk × 3 + index × 3 ALS getter 改 ctx optional + fallback ALS（31 处）
- **P-SIC-3**：define-engine successPayload 签名扩 + logic/view index.ts successPayload 改 ctx.graph

## 5. 风险

- **D-SIC-1 resolveAppAlias 实体化**：A0 R8 行为 0 守护——ctx.resolveAlias 须闭包 appInfo（非 stub）。appInfo 不传时 fallback stub（原行为）
- **D-SIC-2 graph 可变单例**：ctx.graph 传实例（addFile/addDependency 写入）——worker 重建 graph 实例 + successPayload toJSON 回传 + 主线程 mergeDelta 合并
- **D-SIC-3 successPayload 签名扩**：当前 `(ctx: { logger })`——扩 `{ logger, graph? }`。须改 3 处 caller（logicSuccessPayload/viewSuccessPayload/defineEngine 默认）

## 6. 跨权威一致性

- **A0（worker-ctx-direct）**：ctx optional + fallback ALS 模式——D-SIC-2 同模式
- **A2/A3（view/style parse-walk）**：独立函数透传链——D-SIC-2 ALS 迁同模式
- **A5 research（singleton-retire-research）**：D-SR-1..3 细化——D-SIC-1..3 对应
- **D-PCS-1/D-PCS-6**：PackerContext 形状——D-SIC-1 放宽（graph optional）

## 7. 结论

D-SIC-1..3 核心 migration（PackerContext 扩 + ALS 迁 + successPayload）。ctx optional + fallback ALS 渐进——行为 0。A5b（D-SR-4+5+6 cleanup）后续 formalize。
