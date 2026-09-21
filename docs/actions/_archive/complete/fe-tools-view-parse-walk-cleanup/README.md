# FE Tools View Parse-Walk Cleanup

- Action: `fe-tools-view-parse-walk-cleanup`
- Status: `complete`
- Updated: 2026-09-21
- Status authority: [Action Status](../../../STATUS.md)
- 前身：[`fe-tools-parse-walk-extract`](../fe-tools-parse-walk-extract/README.md)（**complete 已归档**；view/parse-walk.ts 从 8 行 re-export 壳真抽出至 1,368 行）
- 工作分支：`feature/fe-tools-sidecar`

## 背景

`fe-tools-parse-walk-extract`（complete 归档）将 view/parse-walk.ts 从 8 行 re-export 壳真抽出至 1,368 行（40 个函数）。抽出是纯机械搬代码——目标是行为 0（diff=0），不碰内部结构。

抽出完成后，文件暴露出 **7 个内部质量问题**（详见 `source-audit.md`）：

1. `compileResCache` 三用途混用——同一个 `Map<string, unknown>` 同时缓存模块编译结果 / wxs 内容 / 失败缓存，靠 `typeof` 运行时分派
2. `collectAllWxsModules` 在 `compileModule` 内被重复调用（缓存命中路径 L476 + 正常路径 L546），两处逻辑几乎完全一致
3. 簇 1 AST 工具（parseJs / getProgramCode / isStringLiteral / getStringLiteralRawValue / getSource / applyCodeReplacements）与 logic/parse-walk.ts 概念重叠
4. `compileModule` 167 行——缓存命中 / 编译 / 包装三段逻辑全在一个函数内
5. `processWxsContent` 121 行——getRegExp / getDate / constructor / require 四种转换全在一个 walk 循环内
6. `insertWxsToRenderResult` 99 行——声明注入 / walk 替换 / sourcemap 三段全在一个函数内
7. `compileResCache` 类型 `unknown`——缓存条目无类型安全

## 目标

在 `view/parse-walk.ts` 单文件内做行为 0 的内部质量重构：

1. **拆 `compileResCache` 三用途** → 3 个独立 Map + `CacheEntry` union type（#1 + #7）
2. **提取 `collectAllWxsModules` 公共逻辑** — 消除 `compileModule` 内的代码重复（#2）
3. **拆 `compileModule`** → 缓存命中 / 编译 / 包装三段（#4）
4. **拆 `processWxsContent`** → 按转换类型分函数（#5）
5. **拆 `insertWxsToRenderResult`** → 声明注入 / walk 替换 / sourcemap 三段（#6）

## 非目标

- 跨车道 AST 工具共享（#3）——三车道隔离是硬约束，logic/view 的 `parseJs` 参数不同、walk 用途不同，概念重叠非代码重复
- 任何输出语义变更（行为 0 diff=0）
- view/style 增量接入 `invalidatedModules`（另门）
- HMR patch 产物（另门）
- 修 `collectAllWxsModules` 缓存泄漏（D-PW-3 正式决策保留，不在本门修）
- view 二次编译消除（D-PW-5 正式接受，不在本门修）
- page sourcemap 条件用（D-PW-4 正式决策，不在本门修）
- env.ts 拆分（packer-research 评估"不立即做"）
- W1 shim 机制变更（ESM 循环依赖的唯一解法，不可消）

## 设计输入

- 前身归档：[`fe-tools-parse-walk-extract`](../fe-tools-parse-walk-extract/README.md)
- 行为 0 纪律：nomap + sourcemap 产物 diff=0；全量 vitest 绿
- tsconfig 约束：`noUnusedLocals: true` / `noUnusedParameters: true` / `strict: true` / `noUncheckedIndexedAccess: true`
- 三车道隔离约束：logic/view 互不 import
- W1 cycle-break shim：15 binding 跨 2 个 shim 文件（`live.ts` 12 + `orchestrator-live.ts` 3）

## 交付物

- `view/parse-walk.ts`：内部结构改善（缓存拆分 + 长函数拆分 + 去重 + 类型安全）
- 无新文件（所有改动在单文件内）
- 无 dist 变化（tsc 直编译，行为 0）

## Requirements

- R-VC-1 MUST `compileResCache` 拆分为 3 个独立 Map（模块编译结果 / wxs 内容 / 失败缓存）
- R-VC-2 MUST 定义 `CacheEntry` union type 替代 `unknown`（`compileResCache` 类型安全）
- R-VC-3 MUST `collectAllWxsModules` 重复调用提取为公共函数（`compileModule` 内 L476 + L546 去重）
- R-VC-4 MUST `compileModule` 拆分为缓存命中 / 编译 / 包装三段（≤80 行/段）
- R-VC-5 MUST `processWxsContent` 按转换类型拆分（getRegExp / getDate / constructor / require 各独立函数）
- R-VC-6 MUST `insertWxsToRenderResult` 拆分为声明注入 / walk 替换 / sourcemap 三段（≤50 行/段）
- R-VC-7 MUST 行为 0（nomap + sourcemap diff=0；全量 vitest 绿；tsc 0 错）
- R-VC-8 MUST 不引入跨车道 import（`view/parse-walk.ts` 不 import from `../logic/` 或 `../style/`）
- R-VC-9 MUST 不引入 `any` / `@ts-nocheck` / `as any`
- R-VC-10 SHOULD 不新增文件（单文件内重构）

## Readiness gaps

- 已验证：5 轮 readiness review pass（12 findings 全修正）
  - 缓存 key 不冲突（F-002 验证：拆分后 Map 隔离）
  - 函数拆分后 W1 shim binding 不变（V-VC-4 grep 验证 22 个 export）
  - `collectAllWxsModules` 公共函数签名（TD §1.2 `mergeWxsModules`）
  - `ModuleCompileCacheEntry.instruction` 类型兼容（F-009 修正）
  - `buildWxsReplacements` renderBody 依赖（F-003/F-010 修正）

## Closure conditions

- R-VC-1..10 全 passed
- architecture-notes 回流（缓存拆分 + 长函数拆分定性）
- 行为 0 守卫通过
