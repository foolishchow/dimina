# Implementation Plan — fe-tools-style-parse-walk-migrate

Status authority: [Action Status](../../../STATUS.md)

## 分相（行为 0 每相 gate）

### P-SPM-1 — buildCompileCss 加 ctx 第 4 参 + 16 处 getter 改 ctx 读（A 批）

1. style/parse-walk.ts buildCompileCss 第 4 参加 ctx?: PackerContext
2. style/parse-walk.ts getWorkPath/getTargetPath DRY 提前到函数顶部（const workPath = ctx?.workPath ?? getWorkPath()）
3. style/parse-walk.ts 16 处 getter 改 ctx 读（ctx 读 4 getter + 保留 ALS 3 getter）
4. style/parse-walk.ts:270 buildCompileCss 递归调传 ctx
5. tsc 0

### P-SPM-2 — style/index.ts compile 建 ctx + 透传 + compileSS（B 批）

1. style/index.ts styleCompile 入口建 ctx（buildPackerContextFromOptions from storeInfo）
2. style/index.ts compileSS 签名加 ctx 透传
3. style/index.ts:30 buildCompileCss 调用传 ctx
4. resetStoreInfo 保留（ALS compat）
5. tsc 0

### P-SPM-3 — 行为 0 全量验证（C 批）

1. tsc 0
2. vitest 88/88（flaky solo pass）
3. one-shot 7-diff=0
4. grep style getter import 减少（getWorkPath/getTargetPath/getContentByPath/getStyleExts ALS import 减）

## 验证点

- P-SPM-1 后：buildCompileCss 签名加 ctx + 16 处 getter 部分改 ctx + tsc 0
- P-SPM-2 后：styleCompile 建 ctx + buildCompileCss 传 ctx + compileSS 透传 + tsc 0
- P-SPM-3：行为 0 三件套绿

## 风险点

- **getStyleExts ctx 读**（§4 确认等价 ✓）
- **buildCompileCss 内部函数透传**（DRY 提前——复用 A0 dev3/A2）
- **resolveStyleImportPath/normalizeRootStyleImports default param**（D-SPM-6——保留 default getWorkPath fallback ALS）
- **resolveAppAlias 行为 0 守护**（A0 R8——须确认 style 是否用）
- **P-SPM-1..2 atomic**：建议合并单 commit（复用 A0/A2 模式）
