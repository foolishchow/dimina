# Acceptance — fe-tools-worker-ctx-direct

Status authority: [Action Status](../STATUS.md)

| ID | Requirement | Title | Acceptance criterion | Status |
| --- | --- | --- | --- | --- |
| A-WCD-1 | R-WCD-1 | worker ctx 直传机制（A0） | logic/index.ts compile 入口建 PackerContext（from storeInfo data——buildPackerContextFromOptions）+ defineEngine 透传 + ALS compat 保留（resetStoreInfo 仍调）；tsc 0 | pending |
| A-WCD-2 | R-WCD-2 | logicParseWalk 加 ctx 参数（A1） | logicParseWalk 第 8 参加 ctx: PackerContext + 16 处 getter 部分改 ctx 读（ctx 读 3 getter（F-R8-2 修正：getWorkPath/getTargetPath/getContentByPath→ctx.readContent）；保留 ALS 7 getter（F-R8-2 +resolveAppAlias：getDependencyGraph/getAppId/getNpmResolver/resolveAppAlias/getAppConfigInfo/getComponent/isMiniGame——F-R1-1/R1-2）——方案 b）；tsc 0 | pending |
| A-WCD-3 | R-WCD-3 | logic/index.ts worker 路径改 ctx | logic/index.ts:211 logicParseWalk 传 ctx + 内部 getter 部分改 ctx（workPath/targetPath/readContent；getDependencyGraph/getAppConfigInfo/getComponent/isMiniGame 保留 ALS）；tsc 0 | pending |
| A-WCD-4 | R-WCD-4 | registry-impl 主线程路径改 _ctx | registry-impl.ts _ctx → ctx + getContentByPath → ctx.readContent + logicParseWalk 传 ctx；tsc 0 | pending |
| A-WCD-5 | R-WCD-5 | successPayload 保留 ALS（不改——F-R2-1） | logic/index.ts successPayload 保留 ALS（getDependencyGraph 仍 ALS——A5 统一迁，F-R2-1）；tsc 0 | pending |
| A-WCD-6 | R-WCD-6 | ALS compat 保留 | resetStoreInfo 保留（logic/index.ts:275 仍调——view/style compat）+ view/index.ts:192 + style/index.ts:57 + emit-engine.ts:12 不动 | pending |
| A-WCD-7 | R-WCD-7 | 测试 fixture 改传 ctx | logic-loader.spec:53 logicParseWalk 直调加 ctx（buildPackerContext fixture） | pending |
| A-WCD-8 | R-WCD-8 | 行为 0 | tsc 0 + vitest 88/88（flaky solo pass）+ one-shot 7-diff=0 | pending |

## backflow（P-WCD-4 后记录）

- A2 view parse-walk 迁移（独立 Action——worker ctx 机制已建）
- A3 style parse-walk 迁移（独立 Action）
- A4 compat 写退役（门控 A1-A3）
- A5 singleton/Proxy 退役（门控 A1-A4——logic getter 保留 ALS 部分须 A5 统一迁）
- logic getter 保留 ALS（getDependencyGraph/getAppId/getNpmResolver——A5 统一迁）
