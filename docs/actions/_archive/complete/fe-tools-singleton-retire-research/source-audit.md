# Source Audit — fe-tools-singleton-retire-research

## 1. graph 可变单例 worker 透传机制（已实施）

**parse-walk 内 graph 写入**（12 处——addFile/addDependency/getDirectDependencies）：

| 子系统 | addFile | addDependency | getDirectDependencies | clearOutgoingEdges | toJSON | 合计 |
|---|---|---|---|---|---|---|
| logic/parse-walk | 1 | 4 | 0 | 0 | 0 | 5 |
| view/parse-walk | 1 | 0 | 1 | 0 | 0 | 4（含其他 2）|
| style/parse-walk | 2 | 0 | 1 | 0 | 0 | 3 |
| logic/index | 1 | 0 | 2 | 1 | 1 | 5 |
| view/index | 0 | 0 | 0 | 0 | 1 | 1 |
| **合计** | 5 | 4 | 4 | 1 | 2 | **18 处 getDependencyGraph 调用**（14 写入 + 4 读）|

**写入 14 处**（F-R1-1 修正）：parse-walk 12（addFile 4 + addDependency 4 + getDirectDependencies 2 + 其他 2）+ logic index 2（addFile L126 + clearOutgoingEdges L128）。

**graph 跨线程机制**（已实施）：

| 步骤 | 代码 | 说明 |
|---|---|---|
| worker resetStoreInfo | env.ts:113 `graph.restoreFromSnapshot(opts.configInfo, opts.dependencyGraph)` | worker 从 snapshot 重建 graph 实例 |
| parse-walk 写入 | `getDependencyGraph().addFile/addDependency` | 写入 worker ALS graph 实例 |
| successPayload 回传 | define-engine.ts:28 `() => ({ dependencyGraph: getDependencyGraph().toJSON() })` + logic/view index.ts `dependencyGraph: getDependencyGraph().toJSON()` | worker graph 变更 toJSON 回传 |
| 主线程 mergeDelta | graph.ts:114 `mergeDelta(delta: GraphSnapshot)` | 主线程合并 worker graph delta |

**结论**：graph 跨线程 delta 合并机制已实施——A5 退役须 ctx.graph 替代 ALS getDependencyGraph（worker 建 ctx.graph 实例 + parse-walk 写入 ctx.graph + successPayload 读 ctx.graph.toJSON()）。

## 2. 形状纪律候选 a/b/c 决策

**候选 a：扩 PackerContext optional graph**（**锁定**）
- graph 可变单例 worker 透传须 ctx 携带 graph 实例（addFile/addDependency 写入）
- worker 重建 graph 实例（restoreFromSnapshot）→ ctx.graph 传实例 → parse-walk 写入 ctx.graph → successPayload toJSON 回传
- **D-PCS-1/D-PCS-6 放宽**：graph 加 optional 到 PackerContext（形状纪律冲突——A5 实体化须）

**候选 b：OrchestratorState 传 graph**（不可行）
- worker 无 OrchestratorState（OrchestratorState session-scoped，ALS pipeline-scoped——D-PCS-9）
- parse-walk 在 worker 引擎——无法访问 OrchestratorState

**候选 c：collaborator 注入 graph**（不可行）
- parse-walk 非 collaborator（parse-walk 是 worker 引擎内独立函数）
- collaborator 模式不适用 parse-walk

**决策**：**候选 a 锁定**。PackerContext 扩 optional 字段：graph/appId/component/configInfo + resolveAlias 闭包 appInfo + resolveNpm。

## 3. resolveAppAlias 实体化路径（A0 R8 行为 0 守护）

- env.ts:128 `resolveAppAlias(src) → resolveAppAliasCompute(src, configInfo.appInfo)`——读 ALS configInfo.appInfo
- config-fixpoint.ts:470 `resolveAppAlias(src, appInfo?)`——appInfo 是参数
- config-fixpoint.ts:69 `resolveAlias: (_src: string) => null`——stub（A0 R8 守护点）
- **A5 实体化**：ctx.resolveAlias 闭包 appInfo（`resolveAppAlias(src, ctx.configInfo?.appInfo)`）——非 stub `(_src) => null`
- **行为 0 守护**：ctx.resolveAlias 须等价 ALS resolveAppAliasImpl(src, appInfo)

## 4. ALS 残留 31 处精确分布

| 子系统 | ctx 读 getter | 保留 ALS getter | ALS 残留处 |
|---|---|---|---|
| logic（A1） | 3（getWorkPath/getTargetPath/getContentByPath） | 7（getDependencyGraph/getAppId/getNpmResolver/resolveAppAlias/getAppConfigInfo/getComponent/isMiniGame） | 18 处（parse-walk 8 + index 10） |
| view（A2） | 5（+getViewScriptExts/getViewScriptTags） | 3（getDependencyGraph/getComponent/getAppId） | 8 处 |
| style（A3） | 4（+getStyleExts） | 3（getDependencyGraph/getComponent/getAppId） | 5 处 |
| **合计** | — | — | **31 处 ALS 残留** |

## 5. successPayload 3 处（graph 回传）

| 引擎 | successPayload | 含 dependencyGraph？ |
|---|---|---|
| logic | logicSuccessPayload（index.ts:304） | ✅ `dependencyGraph: getDependencyGraph().toJSON()` |
| view | viewSuccessPayload（index.ts:214） | ✅ `dependencyGraph: getDependencyGraph().toJSON()` |
| style | defineEngine 默认（define-engine.ts:28） | ✅ `dependencyGraph: getDependencyGraph().toJSON()` |

**A5 迁移**：successPayload 改读 ctx.graph.toJSON()（非 ALS getDependencyGraph）。

## 6. worker resetStoreInfo 4 处 + __tests__ 107 caller + getPages 21 caller

（同 A4 source-audit §4/§2/§3——不重复）

## 7. A5 scope 评估

**A5 singleton/Proxy 退役**须：

1. **PackerContext 扩 optional 字段**（D-SR-1）：graph/appId/component/configInfo + resolveAlias 闭包 appInfo + resolveNpm
2. **parse-walk ALS 残留 31 处迁 ctx 读**（D-SR-2）：getDependencyGraph→ctx.graph + getComponent→ctx.component + getAppId→ctx.appId + getNpmResolver→ctx.resolveNpm + resolveAppAlias→ctx.resolveAlias + getAppConfigInfo→ctx.configInfo + isMiniGame→ctx.configInfo?.isMiniGame
3. **successPayload 3 处改 ctx.graph**（D-SR-3）：logicSuccessPayload/viewSuccessPayload/defineEngine 默认
4. **worker resetStoreInfo 4 处退役**（D-SR-4）：ctx.graph 必传——resetStoreInfo 不再 load-bearing
5. **__tests__ 107 caller + getPages 21 caller 迁移**（D-SR-5）
6. **storeInfo wrapper 重构 + env.ts singleton 删**（D-SR-6）

**scope**：大（PackerContext 扩 + 31 ALS 迁 + 3 successPayload + 4 resetStoreInfo + 107 测试 + 22 getPages + env.ts 重构）
