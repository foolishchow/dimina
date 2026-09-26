# fe-tools-view-parse-walk-migrate

- Status: `ready`
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-VPM-1..6 已 review lock**——R1-R4 全 findings fix + R5 收敛）
- 需求门：[requirements.md](requirements.md)
- 实施门：[implementation-plan.md](implementation-plan.md)
- 验收门：[acceptance.md](acceptance.md)
- 验证门：[validation.md](validation.md)
- 前置：[`fe-tools-worker-ctx-direct`](../_archive/complete/fe-tools-worker-ctx-direct/README.md)（A0+A1——worker ctx 直传机制 + logic parse-walk 迁移已完成）

## Background

L2+L3 退役大倡议第二步。A0（fe-tools-worker-ctx-direct）已建 worker ctx 直传机制（logicCompile 建 ctx + compileJS/buildJSByPath 透传 + logicParseWalk 收 ctx）。A2 复用机制——viewParseWalk 加 ctx + 内部 getter 改 ctx 读。

## Goal

1. **viewParseWalk 加 ctx 参数**：第 4 参加 ctx?: PackerContext（optional + fallback ALS，复用 A0 模式）
2. **view/parse-walk getter 改 ctx 读**：17 处——ctx 读 5 getter（getWorkPath/getTargetPath/getContentByPath/getViewScriptExts/getViewScriptTags）+ 保留 ALS 3 getter（getDependencyGraph/getComponent/getAppId）
3. **view/index.ts compile 建 ctx + 透传**：viewCompile 建 ctx（buildPackerContextFromOptions from storeInfo）+ viewParseWalk 传 ctx
4. **ALS compat 保留**：resetStoreInfo 保留（style + emit-engine 不动）

## Non-goals

- style parse-walk 迁移（A3——独立 Action）
- compat 写退役（A4——门控 A1-A3）
- singleton/Proxy 退役（A5——门控 A1-A4）
- PackerContext 形状改变
- compiler/style 不动
- emit-engine.ts 不动

## Design inputs

- **前置 A0**：worker ctx 直传机制已建（logicCompile 建 ctx + compileJS/buildJSByPath 透传 + optional + fallback ALS 模式）
- **A2 view getter 调用**：view/parse-walk 17 处 + view/index.ts ~3 处
- **viewParseWalk 签名**：3 参（加 ctx 第 4 参 optional）
- **测试 fixture**：无测试直调 viewParseWalk（A0 确认——A2 不须改测试调用签名）

## Proposed design

详见 [design.draft.md](design.draft.md)。核心：

- D-VPM-1：viewCompile 建 ctx（buildPackerContextFromOptions from storeInfo，复用 A0 模式）
- D-VPM-2：viewParseWalk 加 ctx 第 4 参（optional + fallback ALS）
- D-VPM-3：view/parse-walk 独立函数 17 处 getter 改 ctx 读（F-R1-1 透传链）（ctx 读 5 getter + 保留 ALS 3 getter）
- D-VPM-4：view/index.ts viewParseWalk 调用传 ctx
- D-VPM-5：ALS compat 保留（resetStoreInfo + style/emit-engine 不动）
- D-VPM-6：view/index.ts 内部 getter（getWorkPath L72 + successPayload getDependencyGraph L216）

## Readiness gaps（R1-R3 resolve）

**3 项**（R1-R3 全 resolve）：

1. **getViewScriptExts/getViewScriptTags ctx 读**（R1 resolve）：ctx.fileTypes.viewScriptExts/viewScriptTags 同源 ALS getCompilerContext().compilerOptions ✓（F-R1-2 等价确认）
2. **独立函数透传链**（R1 resolve）：7+ 独立函数加 ctx optional（compileViewTree/transAsses/processWxsContent 等——F-R1-1）+ 外部调用者 fallback ALS 兼容（F-R2-1/R2-2）
3. **view/index.ts 内部 getter + compileML 透传**（R3 resolve）：compileML 加 ctx 透传 + L72 getWorkPath→ctx?.workPath ?? getWorkPath() + successPayload 保留 ALS（F-R3-1/R3-2）

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-VPM-1..N done——行为 0 三件套）
- implementation deviations 回填 design
