# Implementation Plan — fe-tools-worker-ctx-direct

Status authority: [Action Status](../STATUS.md)

## 分相（行为 0 每相 gate）

### P-WCD-1 — logicParseWalk 加 ctx 参数 + 内部 getter 改 ctx 读（A 批）

1. logic/parse-walk.ts logicParseWalk 第 8 参加 ctx: PackerContext
2. logic/parse-walk.ts 15 处 getter 改 ctx 读（方案 b 部分迁移——workPath/targetPath/fileTypes/readContent/resolveAlias/resolveNpm 改 ctx；getDependencyGraph/getAppId/getNpmResolver 保留 ALS——PackerContext 无 graph 字段）
3. tsc 0

### P-WCD-2 — worker 引擎 compile 建 PackerContext + 透传 + logic/index 路径改 ctx（B 批）

1. logic/index.ts compile 入口建 PackerContext（from storeInfo data——buildPackerContextFromOptions 内核）
2. logic/index.ts:211 logicParseWalk 调用传 ctx
3. logic/index.ts 内部 getter 改 ctx 读（workPath/targetPath/readContent 改 ctx；getDependencyGraph/getAppConfigInfo/getComponent/isMiniGame 保留 ALS）
4. resetStoreInfo 保留（ALS compat——view/style 仍读）
5. tsc 0

### P-WCD-3 — registry-impl 主线程 + successPayload + 测试（C 批）

1. registry-impl.ts _ctx → ctx + getContentByPath → ctx.readContent + logicParseWalk 传 ctx
2. logic/index.ts successPayload 改（getDependencyGraph 仍 ALS——successPayload 收 ctx 后改 ctx 读？readiness lock）
3. logic-loader.spec:53 logicParseWalk 直调加 ctx（buildPackerContext fixture）
4. tsc 0

### P-WCD-4 — 行为 0 全量验证（D 批）

1. tsc 0
2. vitest 88/88（flaky solo pass）
3. one-shot 7-diff=0
4. grep logic getter import 减少（getWorkPath/getTargetPath 等改 ctx 读——ALS import 减）

## 验证点

- P-WCD-1 后：logicParseWalk 签名加 ctx + 15 处 getter 部分改 ctx + tsc 0
- P-WCD-2 后：compile 建 PackerContext + logicParseWalk 传 ctx + logic/index 部分改 ctx + tsc 0
- P-WCD-3 后：registry-impl 传 ctx + successPayload + 测试 fixture + tsc 0
- P-WCD-4：行为 0 三件套绿

## 风险点

- **PackerContext 无 graph 字段**（方案 b 部分迁移——readiness lock）
- **successPayload ctx 来源**（readiness lock）
- **ALS compat 边界**（logic 迁 ctx 后 ALS 写冗余——readiness lock）
- **P-WCD-1..3 atomic**：建议合并单 commit
