# Source Audit — fe-tools-compat-write-retire-research

## 1. storeInfo wrapper compat 写 6 条

**定义**（`src/packer/store/env.ts:78`）：

```ts
function storeInfo(workPath, options = {}) {
  const r = computeStoreInfo(workPath, options, computePathInfo(workPath))
  // compat 写 6 条到 defaultCompilerContext（ALS singleton）
  const context = getCompilerContext()
  context.pathInfo = r.pathInfo
  context.compilerOptions = r.compilerOptions
  context.npmResolver = r.npmResolver
  context.graph = r.graph
  context.configInfo = r.configInfo
  context.dependencyGraph = r.graph.getInnerGraph()
  return { pathInfo, configInfo, compilerOptions, dependencyGraph }
}
```

**load-bearing 评估**（compat 写 6 条消费方）：

| 消费方 | 读 ALS？ | 现状 | A5 退役 |
|---|---|---|---|
| dist-preparer | ❌（读 sctx.storeInfo.pathInfo.targetPath——per-request scratch） | 已迁 | 无须改 |
| npm-builder | ❌（无 getTargetPath/getWorkPath 调用） | 已迁 | 无须改 |
| worker resetStoreInfo（logic/view/style） | ⚠️ fallback ALS（A1-A3 已迁 ctx optional——ctx 传则不走 ALS） | 4 处 caller 保留 resetStoreInfo | A5 删 resetStoreInfo |
| 测试 fixture（107 caller） | ✅（调 storeInfo() 建立 ALS + compileSS/compileML fallback ALS 读） | 未迁 | A5 迁测试 ctx 直传 |

**结论**：compat 写 6 条 **仅测试 fixture load-bearing**（107 caller）+ worker resetStoreInfo fallback（A1-A3 已走 ctx，ALS 仅 fallback）。src orchestrate 链路 caller=0。

## 2. storeInfo wrapper caller 分布（112 → 107 __tests__ + 3 env.ts + 2 注释）

**src caller**：0 处直调（env-compute.ts:26 + project-store.ts:40 是注释——orchestrate 链路已不调 wrapper，scratch-internalize 已改 storeInfoCtx）。

**__tests__ caller**：107 处（compat mkdtemp 依赖——A5 主迁移）：

| 文件 | caller 数 |
|---|---|
| custom-file-types.spec.js | 26 |
| require-path-resolution.spec.js | 11 |
| style-compiler.spec.js | 8 |
| logic-loader.spec.js | 5 |
| import-support.spec.js | 5 |
| null-safe-member-access.spec.js | 4 |
| npm-component-error-handling.spec.js | 4 |
| global-usingComponents.spec.js | 4 |
| typescript-support.spec.js | 3 |
| template-prefix.spec.js | 3 |
| npm-view-script-custom-loading.spec.js | 3 |
| import-to-require-transformation.spec.js | 3 |
| view-style-compile-res.spec.js | 2 |
| logic-es-target.spec.js | 2 |
| logic-component-traversal.spec.js | 2 |
| custom-tab-bar.spec.js | 2 |
| compiler-hotpaths.spec.js | 2 |
| compile-cli-cache.spec.js | 2 |
| ... 其余各 1 | ~25 |

**测试 fixture 依赖模式**：
```js
storeInfo(tempDir)              // 建立 ALS singleton（compat 写）
compileSS(pages, ...)           // 内部 fallback ALS 读 getDependencyGraph/getComponent/getAppId
compileML(module, ...)          // 同上
getPages()                      // 读 ALS configInfo
```

## 3. getPages caller（A5 前置门控——22 文件）

**定义**（`src/packer/store/env.ts:213`）：L2 薄壳——调 getPagesImpl 读 ALS configInfo。

**caller 分布**：22 文件（__tests__ 为主）：

| 文件 | caller 数 |
|---|---|
| style-compiler.spec.js | 7 |
| custom-file-types.spec.js | 5 |
| null-safe-member-access.spec.js | 4 |
| module-result-cache.spec.js | 4 |
| module-cache.spec.js | 4 |
| global-usingComponents.spec.js | 4 |
| view-style-compile-res.spec.js | 2 |
| logic-component-traversal.spec.js | 2 |
| custom-tab-bar.spec.js | 2 |
| compiler-hotpaths.spec.js | 2 |
| ... 其余各 1 | ~12 |

**A5 门控**：getPages 删须先迁这 22 文件 caller（改 ctx.fileTypes.configInfo.pages or 显式传 pages）。

## 4. worker resetStoreInfo 4 处 caller

| caller | 现状 | A5 退役 |
|---|---|---|
| logic/index.ts:279 | 保留（A1 已迁 ctx optional——fallback ALS） | A5 删 |
| view/index.ts:192 | 保留（A2 已迁 ctx optional——fallback ALS） | A5 删 |
| style/index.ts:59 | 保留（A3 已迁 ctx optional——fallback ALS） | A5 删 |
| emit-engine.ts:12 | 保留（emit worker 独立——A2/A3 不动） | A5 删 |

**A1-A3 已迁**：worker 引擎 styleCompile/viewCompile/logicCompile 建 ctx + 透传 parse-walk。resetStoreInfo 仍调但 ALS 仅 fallback（ctx 传则不走 ALS）。

## 5. ALS 残留 getter 总量（A5 统一迁）

| 子系统 | ctx 读 getter | 保留 ALS getter | ALS 残留处 |
|---|---|---|---|
| logic（A1） | 3（getWorkPath/getTargetPath/getContentByPath） | 7（getDependencyGraph/getAppId/getNpmResolver/resolveAppAlias/getAppConfigInfo/getComponent/isMiniGame） | 19 处 |
| view（A2） | 5（+getViewScriptExts/getViewScriptTags） | 3（getDependencyGraph/getComponent/getAppId） | 8 处 |
| style（A3） | 4（+getStyleExts） | 3（getDependencyGraph/getComponent/getAppId） | 5 处 |
| **合计** | — | — | **~32 处 ALS 残留** |

## 6. A5 退役 scope 评估

**A5 singleton/Proxy 退役**须：

1. **env.ts 删 singleton + Proxy + 15 getters**（defaultCompilerContext + pathInfo/configInfo Proxy + getWorkPath/getTargetPath/getContentByPath/getStyleExts/getViewScriptExts/getViewScriptTags/getDependencyGraph/getComponent/getAppId/getNpmResolver/resolveAppAlias/getAppConfigInfo/isMiniGame/getPages）
2. **删 compat 写 6 条**（storeInfo wrapper 重构为纯 compute——删 compat 写）
3. **删 resetStoreInfo 4 处 caller** + resetStoreInfo 函数
4. **迁 107 __tests__ caller**（改 ctx 直传 or 删 storeInfo() 调用）
5. **迁 getPages 22 caller**（改 ctx.fileTypes.configInfo.pages or 显式传 pages）
6. **迁 ~32 处 ALS 残留 getter**（parse-walk 内保留 ALS 的 getter 改 ctx 读——须 ctx 扩 optional 字段：graph/appId/component/configInfo/resolveAlias/resolveNpm）

**scope**：大（env.ts 重构 + 107 测试迁 + 22 getPages 迁 + 32 ALS 残留迁）

**门控**：A1-A3 全完成（已解锁）+ A4 research（本文档——A5 规划）
