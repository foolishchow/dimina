# Acceptance — fe-tools-style-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-SPM-1 | R-SPM-1 | styleCompile 建 ctx（A0/A2 复用） | style/index.ts styleCompile 入口建 PackerContext（buildPackerContextFromOptions from storeInfo）+ resetStoreInfo 保留；tsc 0 | pending |
| A-SPM-2 | R-SPM-2 | buildCompileCss 加 ctx 第 4 参 | buildCompileCss 第 4 参加 ctx?: PackerContext（optional + fallback ALS，复用 A0 dev1/A2）；tsc 0 | pending |
| A-SPM-3 | R-SPM-3 | style/parse-walk 16 处 getter 改 ctx 读 | ctx 读 4 getter（getWorkPath/getTargetPath/getContentByPath/getStyleExts）+ 保留 ALS 3 getter（getDependencyGraph/getComponent/getAppId）；tsc 0 | pending |
| A-SPM-4 | R-SPM-4 | style/index.ts compileSS/buildCompileCss 调用传 ctx | style/index.ts:30 buildCompileCss 调用传 ctx + compileSS 加 ctx 透传；tsc 0 | pending |
| A-SPM-5 | R-SPM-5 | buildCompileCss 递归透传 | style/parse-walk.ts:270 buildCompileCss 递归调传 ctx；tsc 0 | pending |
| A-SPM-6 | R-SPM-6 | resolveStyleImportPath/normalizeRootStyleImports default param | export 独立函数 default param 保留 `workPath = getWorkPath()`（fallback ALS）；tsc 0 | pending |
| A-SPM-7 | R-SPM-7 | ALS compat 保留 | resetStoreInfo 保留（logic/view 已迁 + emit-engine.ts:12 不动）+ style ALS 残留 getter 读 | pending |
| A-SPM-8 | R-SPM-8 | 行为 0 | tsc 0 + vitest 88/88（flaky solo pass）+ one-shot 7-diff=0 | pending |

## backflow（P-SPM-3 后记录）

- A4 compat 写退役（门控 A1-A3——全 parse-walk 已迁）
- A5 singleton/Proxy 退役（门控 A1-A4——logic 7 + view 8 + style 4 = 19 处 ALS 残留统一迁）
- style ALS 残留 getter（getDependencyGraph/getComponent/getAppId——A5 统一迁）
