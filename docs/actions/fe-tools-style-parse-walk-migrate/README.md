# fe-tools-style-parse-walk-migrate

- Status: `draft`
- Status authority: [Action Status](../STATUS.md)
- 设计门：[design.draft.md](design.draft.md)（**D-SPM-1..N 待 lock**——style parse-walk ctx 迁移）
- 需求门：[requirements.md](requirements.md)
- 实施门：[implementation-plan.md](implementation-plan.md)
- 验收门：[acceptance.md](acceptance.md)
- 验证门：[validation.md](validation.md)
- 前置：[`fe-tools-worker-ctx-direct`](../_archive/complete/fe-tools-worker-ctx-direct/README.md)（A0+A1）+ [`fe-tools-view-parse-walk-migrate`](../_archive/complete/fe-tools-view-parse-walk-migrate/README.md)（A2）

## Background

L2+L3 退役大倡议第三步。A0（worker ctx 直传机制）+ A1（logic）+ A2（view）已完成。A3 复用机制——style parse-walk（buildCompileCss）加 ctx + 内部 getter 改 ctx 读。

## Goal

1. **buildCompileCss 加 ctx 参数**：第 4 参加 ctx?: PackerContext（optional + fallback ALS，复用 A0/A2 模式）
2. **style/parse-walk getter 改 ctx 读**：16 处——ctx 读 4 getter（getWorkPath/getTargetPath/getContentByPath/getStyleExts）+ 保留 ALS 3 getter（getDependencyGraph/getComponent/getAppId）
3. **style/index.ts compile 建 ctx + 透传**：styleCompile 建 ctx（buildPackerContextFromOptions from storeInfo）+ compileSS/buildCompileCss 透传 ctx
4. **ALS compat 保留**：resetStoreInfo 保留（logic/view + emit-engine 已迁/不动）

## Non-goals

- compat 写退役（A4——门控 A1-A3）
- singleton/Proxy 退役（A5——门控 A1-A4）
- PackerContext 形状改变
- compiler/logic + compiler/view 不动（A1/A2 已迁）
- emit-engine.ts 不动

## Design inputs

- **前置 A0/A2**：worker ctx 直传机制 + optional + fallback ALS + DRY 提前 + buildPackerContextFromOptions
- **A3 style getter 调用**：style/parse-walk 16 处 + style/index.ts ~1 处
- **buildCompileCss 签名**：3 参（加 ctx 第 4 参 optional）
- **测试 fixture**：无测试直调 buildCompileCss（A0 确认——A3 不须改测试调用签名）
- **resolveStyleImportPath/normalizeRootStyleImports**（export）：default param `workPath = getWorkPath()`——export 独立函数

## Proposed design

详见 [design.draft.md](design.draft.md)。核心：

- D-SPM-1：styleCompile 建 ctx（buildPackerContextFromOptions from storeInfo，复用 A0/A2 模式）
- D-SPM-2：buildCompileCss 加 ctx 第 4 参（optional + fallback ALS）
- D-SPM-3：style/parse-walk 16 处 getter 改 ctx 读（ctx 读 4 getter + 保留 ALS 3 getter）
- D-SPM-4：style/index.ts compileSS/buildCompileCss 调用传 ctx
- D-SPM-5：ALS compat 保留（resetStoreInfo + logic/view/emit-engine 已迁/不动）
- D-SPM-6：resolveStyleImportPath/normalizeRootStyleImports default param（export 独立函数）

## Readiness gaps

**3 项**（design 待 lock）：

1. **getStyleExts ctx 读**：ctx.fileTypes.styleExts 与 ALS 等价确认
2. **buildCompileCss 内部函数透传**：16 处 getter 分布——ctx 须透传内部函数 or 顶部建 local
3. **resolveStyleImportPath/normalizeRootStyleImports default param**：export 独立函数 default param getWorkPath——加 ctx 后 default param 处理

## Closure conditions

- 全 MUST Acceptance passed with evidence（A-SPM-1..N done——行为 0 三件套）
- implementation deviations 回填 design
