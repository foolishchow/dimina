# Acceptance — fe-tools-view-parse-walk-migrate

Status authority: [Action Status](../../../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-VPM-1 | R-VPM-1 | viewCompile 建 ctx（A0 复用） | view/index.ts viewCompile 入口建 PackerContext（buildPackerContextFromOptions from storeInfo）+ resetStoreInfo 保留；tsc 0 | done |
| A-VPM-2 | R-VPM-2 | viewParseWalk 加 ctx 第 4 参 | viewParseWalk 第 4 参加 ctx?: PackerContext（optional + fallback ALS，复用 A0 dev1）；tsc 0 | done |
| A-VPM-3 | R-VPM-3 | view/parse-walk 17 处 getter 改 ctx 读 | ctx 读 5 getter（getWorkPath/getTargetPath/getContentByPath/getViewScriptExts/getViewScriptTags）+ 保留 ALS 3 getter（getDependencyGraph/getComponent/getAppId）；tsc 0 | done |
| A-VPM-4 | R-VPM-4 | view/index.ts viewParseWalk 调用传 ctx | view/index.ts:126/137 viewParseWalk 调用传 ctx；tsc 0 | done |
| A-VPM-5 | R-VPM-5 | view/index.ts 内部 getter | view/index.ts:72 getWorkPath→ctx?.workPath ?? getWorkPath() + successPayload L216 getDependencyGraph 保留 ALS；tsc 0 | done |
| A-VPM-6 | R-VPM-6 | ALS compat 保留 | resetStoreInfo 保留（style/index.ts:57 + emit-engine.ts:12 不动）+ view ALS 残留 getter 读 | done |
| A-VPM-7 | R-VPM-7 | 行为 0 | tsc 0 ✓ + vitest 88/88（4 flaky solo pass——compile-cli-cache/lifecycle-integration/view-selective-stages/bin-session-contract）+ 7-diff=0 ✓ | done |

## backflow（P-VPM-3 后记录）

- A3 style parse-walk 迁移（独立 Action——worker ctx 机制已建）
- A4 compat 写退役（门控 A1-A3）
- A5 singleton/Proxy 退役（门控 A1-A4——view ALS 残留 getter 统一迁）
- view ALS 残留 getter（getDependencyGraph/getComponent/getAppId——A5 统一迁）
