# Implementation Plan — fe-tools-view-parse-walk-migrate

Status authority: [Action Status](../STATUS.md)

## 分相（行为 0 每相 gate）

### P-VPM-1 — viewParseWalk 加 ctx 第 4 参 + 17 处 getter 改 ctx 读（A 批）

1. view/parse-walk.ts viewParseWalk 第 4 参加 ctx?: PackerContext
2. view/parse-walk.ts getWorkPath/getTargetPath DRY 提前到函数顶部（const workPath = ctx?.workPath ?? getWorkPath()）
3. view/parse-walk.ts 17 处 getter 改 ctx 读（ctx 读 5 getter + 保留 ALS 3 getter）
4. tsc 0

### P-VPM-2 — view/index.ts compile 建 ctx + 透传 + 内部 getter 改 ctx（B 批）

1. view/index.ts viewCompile 入口建 ctx（buildPackerContextFromOptions from storeInfo）
2. view/index.ts:126/137 viewParseWalk 调用传 ctx
3. view/index.ts:72 getWorkPath→ctx?.workPath ?? getWorkPath()
4. resetStoreInfo 保留（ALS compat）
5. tsc 0

### P-VPM-3 — 行为 0 全量验证（C 批）

1. tsc 0
2. vitest 88/88（flaky solo pass）
3. one-shot 7-diff=0
4. grep view getter import 减少（getWorkPath/getTargetPath/getContentByPath/getViewScriptExts/getViewScriptTags ALS import 减）

## 验证点

- P-VPM-1 后：viewParseWalk 签名加 ctx + 17 处 getter 部分改 ctx + tsc 0
- P-VPM-2 后：viewCompile 建 ctx + viewParseWalk 传 ctx + view/index 内部改 ctx + tsc 0
- P-VPM-3：行为 0 三件套绿

## 风险点

- **getViewScriptExts/getViewScriptTags ctx 读**（§4 确认等价 ✓）
- **viewParseWalk 内部函数透传**（DRY 提前——复用 A0 dev3）
- **resolveAppAlias 行为 0 守护**（A0 R8——须确认 view 是否用）
- **P-VPM-1..2 atomic**：建议合并单 commit（复用 A0 模式）
