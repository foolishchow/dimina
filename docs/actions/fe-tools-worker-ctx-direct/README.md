# fe-tools-worker-ctx-direct

- Status: `ready`
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-WCD-1..7 已 review lock**——R1-R4 全 findings fix + R5 收敛）
- 需求门：[requirements.md](requirements.md)
- 实施门：[implementation-plan.md](implementation-plan.md)
- 验收门：[acceptance.md](acceptance.md)
- 验证门：[validation.md](validation.md)
- 前置 research：[`fe-tools-l2-l3-retire-research`](../_archive/complete/fe-tools-l2-l3-retire-research/source-audit.md)（拆分方案 A0-A5 + 序列化方案 b）

## Background

L2+L3 退役大倡议的第一步。research Action（fe-tools-l2-l3-retire-research）产出拆分方案 A0-A5 + 根门控序列化方案 b。A0（worker ctx 直传）单独建机制无消费者（ctx 闲置）——**合并 A0+A1**：建 worker ctx 直传机制 + logic parse-walk 迁移（第一个消费者验证机制）。

## Goal

1. **worker ctx 直传机制**（A0）：worker 引擎 compile 内建 PackerContext（from storeInfo data，方案 b）+ defineEngine 透传 + successPayload 改 ctx
2. **logic parse-walk 迁移**（A1）：logicParseWalk 加 ctx 参数 + 内部 getter 改 ctx 读（15 处）+ logic/index.ts worker 路径 + registry-impl 主线程路径 + 测试 fixture
3. **ALS compat 保留**：resetStoreInfo 保留（view/style 仍读 ALS——A2/A3 后续迁移后退役）

## Non-goals

- view parse-walk 迁移（A2——独立 Action）
- style parse-walk 迁移（A3——独立 Action）
- compat 写退役（A4——门控 A1-A3）
- singleton/Proxy 退役（A5——门控 A1-A4）
- PackerContext 形状改变
- normalizeFileTypes 重构
- resolveAlias/resolveNpm stub 实体化（D-PCS-1 deferred）
- compiler/view + compiler/style 不动

## Design inputs

- **前置 research**：[source-audit](../_archive/complete/fe-tools-l2-l3-retire-research/source-audit.md)（A0-A5 拆分 + 序列化方案 b + defineEngine 透传路径 + successPayload ALS 依赖）
- **A0 改造点 4 处**：emit-engine.ts:12 + logic/index.ts:275 + view/index.ts:192 + style/index.ts:57（resetStoreInfo caller——**A0 只改 logic 路径，view/style 保留 ALS compat**）
- **A1 logic getter 调用**：logic/parse-walk 15 处 + logic/index.ts ~15 处 + registry-impl 1 处
- **logicParseWalk 签名**：7 参（加 ctx 第 8 参）
- **测试 fixture**：logic-loader.spec:53 直调 logicParseWalk（须改传 ctx）

## Proposed design

详见 [design.draft.md](design.draft.md)。核心：

- D-WCD-1：worker 引擎 compile 内建 PackerContext（from storeInfo data，方案 b）
- D-WCD-2：logicParseWalk 加 ctx 参数 + 内部 getter 改 ctx 读（15 处）
- D-WCD-3：logic/index.ts worker 路径改 ctx（resetStoreInfo→buildPackerContext 透传）
- D-WCD-4：registry-impl 主线程路径改 _ctx 透传
- D-WCD-5：successPayload 保留 ALS（不改——F-R2-1）（非 ALS）
- D-WCD-6：ALS compat 保留（view/style resetStoreInfo 不动）
- D-WCD-7：测试 fixture（logic-loader.spec:53）改传 ctx

## Readiness gaps（R1-R3 resolve）

**4 项**（R1-R3 全 resolve）：

1. **ctx 参数位置**（R1 resolve）：logicParseWalk 第 8 参末尾（D-WCD-2）
2. **worker 引擎 compile 建 PackerContext 时机**（R1/R3 resolve）：compile 入口建 + 透传 parse-walk（D-WCD-1）+ storeInfo compilerOptions 形状匹配 ✓（F-R3-1）
3. **successPayload ctx 来源**（R2 resolve）：successPayload 保留 ALS 不改（F-R2-1——getDependencyGraph 仍 ALS，A5 统一迁）
4. **ALS compat 边界**（R3 resolve）：logic 迁 ctx 后 resetStoreInfo 保留（view/style compat + logic ALS 残留 19 处 getter 读——F-R3-3）

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-WCD-1..N done——行为 0 三件套）
- implementation deviations 回填 design
