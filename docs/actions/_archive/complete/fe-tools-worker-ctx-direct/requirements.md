# Requirements — fe-tools-worker-ctx-direct

Status authority: [Action Status](../../../STATUS.md)

## 功能需求

| ID | Title | Requirement |
| --- | --- | --- |
| R-WCD-1 | worker ctx 直传机制（A0） | worker 引擎 compile 内建 PackerContext（from storeInfo data，方案 b——buildPackerContext(data)）+ defineEngine 透传 + successPayload 保留 ALS（getDependencyGraph 仍 ALS——A5 统一迁，A0 不改——F-R2-1） |
| R-WCD-2 | logicParseWalk 加 ctx 参数（A1） | logicParseWalk 第 8 参加 ctx: PackerContext + 内部 16 处 getter 改 ctx 读（getWorkPath→ctx.workPath / getDependencyGraph→ctx... / getAppId / getTargetPath / getNpmResolver / resolveAppAlias） |
| R-WCD-3 | logic/index.ts worker 路径改 ctx | logic/index.ts:211 logicParseWalk 调用传 ctx（compile 建 PackerContext 透传）+ logic/index.ts 内部 getter 改 ctx 读（~16 处）+ resetStoreInfo→保留（view/style compat）|
| R-WCD-4 | registry-impl 主线程路径改 _ctx | registry-impl.ts:33 logicParseWalk 调用传 _ctx（Loader.load 契约已有 _ctx: PackerContext）+ getContentByPath 改 ctx.readContent |
| R-WCD-5 | successPayload 保留 ALS（不改——F-R2-1） | defineEngine successPayload（logic/index.ts:301 getDependencyGraph().toJSON()）改读 ctx（非 ALS）——compile 建 ctx 透传 successPayload |
| R-WCD-6 | ALS compat 保留 | resetStoreInfo 保留（view/style worker 引擎仍调——A2/A3 后续迁移）+ view/index.ts:192 + style/index.ts:57 + emit-engine.ts:12 不动 |
| R-WCD-7 | 测试 fixture 改传 ctx | logic-loader.spec:53 logicParseWalk 直调加 ctx 参数（buildPackerContext 测试 fixture） |
| R-WCD-8 | 行为 0 | tsc 0 + vitest 88/88（flaky solo pass）+ one-shot 7-diff=0（PackerContext 构造 + logic parse-walk 全局路径→全量 7 项目） |

## Constraints

- **行为 0**：所有重构保持字节完全相同的输出（代码 + sourcemap diff=0），全 vitest 绿
- **PackerContext 形状不变**：workPath/targetPath/readContent/resolveAlias/resolveNpm/fileTypes 字段全保留
- **resolveAlias/resolveNpm stub 不动**：D-PCS-1 deferred
- **ALS compat 保留**：resetStoreInfo 不删（view/style 仍读 ALS）——logic 路径迁 ctx 后不再读 ALS
- **compiler/view + compiler/style 不动**：A2/A3 独立 Action
- **noUnusedLocals: true** / ESM 后缀 / `as` 窄类型断言允许（非 `as any`）

## Non-scope

- view parse-walk 迁移（A2）
- style parse-walk 迁移（A3）
- compat 写退役（A4）
- singleton/Proxy 退役（A5）
- PackerContext 形状改变
- normalizeFileTypes 重构
- resolveAlias/resolveNpm stub 实体化（D-PCS-1 deferred）
- compiler/view + compiler/style 不动
- emit-engine.ts（emit worker——A2/A3 同类，暂不动）
