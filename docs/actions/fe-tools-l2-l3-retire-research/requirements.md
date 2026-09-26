# Requirements — fe-tools-l2-l3-retire-research

Status authority: [Action Status](../STATUS.md)

## 功能需求

| ID | Title | Requirement |
| --- | --- | --- |
| R-LR-1 | L2 ALS getters audit | 完整 audit env.ts 15 getters 的 caller 分布（compiler/* 10 文件）——getWorkPath(6)/getDependencyGraph(5)/getContentByPath(5)/getComponent(3)/getAppId(3)/getTargetPath(3)/getViewScriptTags(3)/getTemplateExts(2)/getViewScriptExts(2)/getStyleExts(1)/getAppConfigInfo(1)/isMiniGame(1)/getNpmResolver(1)/resolveAppAlias(1)/getPages(21 测试 fixture) |
| R-LR-2 | L3 worker 桥接 audit | 完整 audit resetStoreInfo caller（3 worker 引擎：emit-engine/view/style/logic index）+ worker 透传路径（storeInfo ALS 恢复 vs ctx 直传） |
| R-LR-3 | compat 写 audit | 完整 audit storeInfo wrapper caller（112 处——src + __tests__）+ 测试 fixture 依赖 |
| R-LR-4 | 门控链条分析 | L2 getters 退役 ← compiler/* 迁 PackerContext ← worker ctx 直传 ← PackerContext 序列化（readContent function 不可序列化）——门控链条完整 |
| R-LR-5 | 拆分方案 A0-A5 | 产出 A0（worker ctx 直传——根门控）/A1（logic parse-walk）/A2（view parse-walk）/A3（style parse-walk）/A4（compat 写退役）/A5（singleton/Proxy 退役）拆分方案——scope + 门控 + 依赖 |
| R-LR-6 | 根门控 PackerContext 序列化 | A0 根门控分析——readContent function 不可序列化，worker 须重建；方案候选 a/b/c + 倾向 |
| R-LR-7 | 无代码实施 | research 性质——不实施任何代码改动（纯 audit + 方案） |

## Constraints

- **纯 research**：不实施代码（audit + 拆分方案产出）
- **行为 0 不适用**：无代码改动——不跑 tsc/vitest/7-diff
- **audit 完整性**：L2/L3/compat 全 caller 分布 + 门控链条 + 拆分方案

## Non-scope

- 实施任何代码（A0-A5 各自子 Action formalize + 实施）
- formalize 子 Action（独立 Action）
- worker 模型改造
- PackerContext 序列化实施
