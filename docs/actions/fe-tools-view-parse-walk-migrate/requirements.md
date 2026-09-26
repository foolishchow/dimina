# Requirements — fe-tools-view-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

## 功能需求

| ID | Title | Requirement |
| --- | --- | --- |
| R-VPM-1 | viewCompile 建 ctx（A0 复用） | view/index.ts viewCompile 入口建 PackerContext（from storeInfo data——buildPackerContextFromOptions，复用 A0 模式）+ resetStoreInfo 保留（ALS compat） |
| R-VPM-2 | viewParseWalk 加 ctx 第 4 参 | viewParseWalk(pageModule, options, select?, ctx?: PackerContext)——optional + fallback ALS（复用 A0 dev1 模式） |
| R-VPM-3 | view/parse-walk getter 改 ctx 读 | 17 处 getter（独立函数透传——F-R1-1）——ctx 读 5 getter（getWorkPath→ctx.workPath / getTargetPath→ctx.targetPath / getContentByPath→ctx.readContent / getViewScriptExts→ctx.fileTypes.viewScriptExts / getViewScriptTags→ctx.fileTypes.viewScriptTags）+ 保留 ALS 3 getter（getDependencyGraph/getComponent/getAppId） |
| R-VPM-4 | view/index.ts viewParseWalk 调用传 ctx | view/index.ts:126/137 viewParseWalk 调用传 ctx（viewCompile 建的 ctx） |
| R-VPM-5 | view/index.ts 内部 getter | view/index.ts:72 getWorkPath→ctx.workPath + successPayload L216 getDependencyGraph 保留 ALS（A5 统一迁） |
| R-VPM-6 | ALS compat 保留 | resetStoreInfo 保留（style/index.ts:57 + emit-engine.ts:12 不动——A3 独立 Action）+ view ALS 残留 getter 读（getDependencyGraph/getComponent/getAppId） |
| R-VPM-7 | 行为 0 | tsc 0 + vitest 88/88（flaky solo pass）+ one-shot 7-diff=0（view parse-walk 全局路径→全量 7 项目） |

## Constraints

- **行为 0**：所有重构保持字节完全相同的输出（代码 + sourcemap diff=0），全 vitest 绿
- **PackerContext 形状不变**：workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes 字段全保留（A0 已 lock）
- **ctx optional + fallback ALS 模式**：复用 A0 dev1（ctx?: PackerContext + ctx?.x ?? ALSGetter()）
- **ALS compat 保留**：resetStoreInfo 不删（style + emit-engine 仍读）——view 路径迁 ctx 后不再读 ALS（graph/component/appId 仍 ALS）
- **resolveAppAlias 行为 0 守护**（A0 R8）：ctx.resolveAlias stub 返 null ≠ ALS 实际解析——view 若用 resolveAppAlias 须保留 ALS（A5 实体化）
- **noUnusedLocals: true** / ESM 后缀 / `as` 窄类型断言允许（非 `as any`）

## Non-scope

- style parse-walk 迁移（A3）
- compat 写退役（A4）
- singleton/Proxy 退役（A5）
- PackerContext 形状改变
- compiler/style 不动
- emit-engine.ts 不动
