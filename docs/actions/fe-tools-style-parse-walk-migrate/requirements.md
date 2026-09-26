# Requirements — fe-tools-style-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

## 功能需求

| ID | Title | Requirement |
| --- | --- | --- |
| R-SPM-1 | styleCompile 建 ctx（A0/A2 复用） | style/index.ts styleCompile 入口建 PackerContext（from storeInfo data——buildPackerContextFromOptions，复用 A0/A2 模式）+ resetStoreInfo 保留（ALS compat） |
| R-SPM-2 | buildCompileCss 加 ctx 第 4 参 | buildCompileCss(module, compiledPaths?, options?, ctx?: PackerContext)——optional + fallback ALS（复用 A0 dev1/A2 模式） |
| R-SPM-3 | style/parse-walk getter 改 ctx 读 | 16 处 getter（独立函数透传——F-R1-1）——ctx 读 4 getter（getWorkPath→ctx.workPath / getTargetPath→ctx.targetPath / getContentByPath→ctx.readContent / getStyleExts→ctx.fileTypes.styleExts）+ 保留 ALS 3 getter（getDependencyGraph/getComponent/getAppId） |
| R-SPM-4 | style/index.ts compileSS/buildCompileCss 调用传 ctx | style/index.ts:30 buildCompileCss 调用传 ctx（styleCompile 建的 ctx）+ compileSS 加 ctx 透传 |
| R-SPM-5 | buildCompileCss 递归透传 | style/parse-walk.ts:270 buildCompileCss 递归调传 ctx |
| R-SPM-6 | resolveStyleImportPath/normalizeRootStyleImports default param | export 独立函数 default param `workPath = getWorkPath()`——加 ctx? 后 default param 处理（保留 default getWorkPath fallback ALS or 加 ctx 参数） |
| R-SPM-7 | ALS compat 保留 | resetStoreInfo 保留（logic/view 已迁 + emit-engine.ts:12 不动）+ style ALS 残留 getter 读（getDependencyGraph/getComponent/getAppId） |
| R-SPM-8 | 行为 0 | tsc 0 + vitest 88/88（flaky solo pass）+ one-shot 7-diff=0（style parse-walk 全局路径→全量 7 项目） |

## Constraints

- **行为 0**：所有重构保持字节完全相同的输出（代码 + sourcemap diff=0），全 vitest 绿
- **PackerContext 形状不变**：workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes 字段全保留（A0/A2 已 lock）
- **ctx optional + fallback ALS 模式**：复用 A0 dev1/A2（ctx?: PackerContext + ctx?.x ?? ALSGetter()）
- **ALS compat 保留**：resetStoreInfo 不删（logic/view 已迁 + emit-engine 仍读）——style 路径迁 ctx 后不再读 ALS（graph/component/appId 仍 ALS）
- **resolveAppAlias 行为 0 守护**（A0 R8）：style 若用 resolveAppAlias 须保留 ALS（A5 实体化）
- **noUnusedLocals: true** / ESM 后缀 / `as` 窄类型断言允许（非 `as any`）

## Non-scope

- compat 写退役（A4）
- singleton/Proxy 退役（A5）
- PackerContext 形状改变
- compiler/logic + compiler/view 不动（A1/A2 已迁）
- emit-engine.ts 不动
