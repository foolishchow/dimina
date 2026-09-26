# Design Draft — fe-tools-compat-write-retire-research

> **状态：ready**——D-CWR-1..6 已 review lock。A5 singleton/Proxy 退役迁移规划。

## 1. 研究结论

A4 原定实施性（storeInfo wrapper 删 + 测试 fixture 迁）。A1-A3 实施后发现：

- **compat 写 6 条 load-bearing 仅测试 fixture**（107 caller）+ worker resetStoreInfo fallback（A1-A3 已走 ctx，ALS 仅 fallback）
- **src orchestrate 链路 caller=0**（scratch-internalize 已改）
- **测试 fixture 依赖 ALS singleton**（compileSS/compileML 入口 fallback ALS 读 getDependencyGraph/getComponent/getAppId——A5 singleton 退役才迁）

**结论**：A4 无法单独实施 compat 写删——须合并入 A5。A4 转为 research（审计 + A5 迁移规划）。

## 2. A5 退役迁移规划（D-CWR-1..6）

### D-CWR-1 — env.ts singleton + Proxy 退役

- 删 `defaultCompilerContext`（ALS singleton）
- 删 pathInfo/configInfo Proxy（getter 陷阱）
- 删 15 getters（getWorkPath/getTargetPath/getContentByPath/getStyleExts/getViewScriptExts/getViewScriptTags/getDependencyGraph/getComponent/getAppId/getNpmResolver/resolveAppAlias/getAppConfigInfo/isMiniGame/getPages）
- **PackerContext 扩 optional 字段**：graph/appId/component/configInfo/resolveAlias/resolveNpm（A5 实体化——ctx 加 optional）
- **形状纪律冲突**（F-R2-1）：D-PCS-1/D-PCS-6 说 graph/moduleCache 在 OrchestratorState（不在 PackerContext）。A5 实施时定——**候选 a**：扩 PackerContext optional 字段（违反 D-PCS-1/D-PCS-6）；**候选 b**：用 OrchestratorState 传 graph（保留形状纪律，须 collaborator 读 state.graph）；**候选 c**：graph 经 collaborator 注入（非 ctx 字段）

### D-CWR-2 — storeInfo wrapper 重构

- storeInfo wrapper 删 compat 写 6 条（纯 compute——返 storeInfo data）
- resetStoreInfo 函数删（4 处 caller 先迁）
- **保留 storeInfo() 计算**（computeStoreInfo 复用——orchestrate 链路仍须 storeInfo data 透传 worker）

### D-CWR-3 — worker resetStoreInfo 4 处退役

- logic/index.ts:279 + view/index.ts:192 + style/index.ts:59 + emit-engine.ts:12
- A1-A3 已迁 ctx optional——worker 引擎建 ctx + 透传 parse-walk（不走 ALS）
- A5 删 resetStoreInfo caller（ctx 必传——无 fallback ALS）

### D-CWR-4 — parse-walk ALS 残留 ~32 处退役

- logic 19 处 + view 8 处 + style 5 处
- getDependencyGraph/getComponent/getAppId/getNpmResolver/resolveAppAlias/getAppConfigInfo/isMiniGame 改 ctx 读
- **ctx 扩 optional 字段**（D-CWR-1a）——A5 实体化
- **完全迁**（F-R3-2）：须无 fallback ALS——D-CWR-4 完全迁后 D-CWR-3 才能退役 resetStoreInfo（ALS 不再 load-bearing）
- **resolveAppAlias 实体化路径**（F-R2-2）：env.ts:128 读 ALS configInfo.appInfo；config-fixpoint.ts:470 `resolveAppAlias(src, appInfo?)` appInfo 是参数——A5 可改 ctx.resolveAlias 闭包 appInfo（不须 ctx 加 configInfo，直接传 appInfo 作 ctx.resolveAlias 闭包）。须 A0 R8 行为 0 守护（ctx.resolveAlias 非 stub `(_src) => null`）

### D-CWR-5 — __tests__ 107 caller 迁移

- 改 ctx 直传（buildPackerContextFromOptions from storeInfo() 返回值）
- 或删 storeInfo() 调用（若测试已建 ctx）
- **getPages 22 caller**（F-R2-3 修正）：getPages 读 ALS configInfo + npmResolver（非 fileTypes.configInfo）——A5 迁移改 ctx.configInfo.pages（须 ctx 加 configInfo optional——D-CWR-1 候选 a）or 显式传 pages 参数

### D-CWR-6 — 迁移顺序 + 门控（F-R3-1 拆 D-CWR-1a/1b）

1. **D-CWR-1a** PackerContext 扩 optional 字段（graph/appId/component/configInfo/resolveAlias/resolveNpm）——形状纪律冲突见 D-CWR-1 候选 a/b/c
2. **D-CWR-4** parse-walk ALS 残留 ~32 处改 ctx 读（**完全迁——无 fallback ALS**，F-R3-2 修正：D-CWR-4 须完全迁后 D-CWR-3 才能退役）
3. **D-CWR-3** worker resetStoreInfo 4 处退役（ctx 必传——D-CWR-4 完全迁后 ALS 不再 load-bearing）
4. **D-CWR-5** __tests__ 107 caller 迁移 + getPages 22 caller
5. **D-CWR-2** storeInfo wrapper 重构（删 compat 写 6 条）
6. **D-CWR-1b** env.ts singleton + Proxy + 15 getters 删

## 3. 风险

- **D-CWR-1 PackerContext 形状扩**：graph/appId/component/configInfo/resolveAlias/resolveNpm 加 optional——D-PCS-1 PackerContext 形状限制放宽（A5 实体化须）
- **D-CWR-4 resolveAppAlias 实体化**：A0 R8 行为 0 守护——ctx.resolveAlias 须闭包 appInfo（`resolveAppAliasImpl(src, appInfo)` 非 stub `(_src) => null`）
- **D-CWR-5 测试 fixture 大量**：107 caller 迁移工作量大——须分批 atomic

## 4. 跨权威一致性

- **A0（worker-ctx-direct）**：ctx optional + fallback ALS 模式——A5 实体化 ctx 必传
- **A2/A3（view/style parse-walk）**：独立函数透传链——A5 ALS 残留迁同模式
- **D-PCS-1**：PackerContext 形状——A5 扩 optional 字段
- **D-LR-3**：A4 原 scope——refined 为 research（compat 写 load-bearing 仅测试 fixture）

## 5. 结论

A4 转为 research——产出 A5 singleton/Proxy 退役迁移规划（D-CWR-1..6）。A5 实施须 A4 research 锁定后 formalize 独立 Action。
