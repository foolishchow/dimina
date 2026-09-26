# Design — fe-tools-style-parse-walk-ctx-leaf

> **状态：ready**——D-SPL-1 已实施（行为 0 三件套 ✓）。补走 readiness review。

## 背景

cleanup-final D-SCF-1-1 推迟 view/style parse-walk 迁（递归 caller 链 + scope）。style parse-walk 的 styleLoad 是**叶子函数**（不调其他独立函数——styleLoad 只读 ALS getDependencyGraph/getComponent，不调 getJSAbsolutePath/resolveDependencyId 等）——无递归 caller 链，scope 最小。

## D-SPL-1 — styleLoad 加 ctx + fallback ALS

styleLoad(L72) 加 `ctx?: PackerContext` 末参：
- L91 `getDependencyGraph().getDirectDependencies(...)` → `(ctx?.graph ?? getDependencyGraph()).getDirectDependencies(...)`（fallback ALS）
- L96 `getComponent(...)` → `(ctx?.component ? ctx.component(...) : getComponent(...))`（fallback ALS）

caller L136 `styleLoad(module, compiledPaths, ctx)`（buildCompileCss 内——ctx 已有）。

## 叶子函数论证

styleLoad 是叶子（while 循环内只读 ALS getDependencyGraph/getComponent + 操作 pendingModules）——不调其他独立函数。所以无递归 caller 链（对比 view parse-walk compileModule → tryModuleCache → mergeWxsModules → collectAllWxsModules 递归）。

## 行为 0 论证

ctx optional + fallback ALS 保留——caller 可传可不传：
- worker 传 ctx（D-SRC-1a）→ ctx?.graph 优先
- 测试不传 ctx → fallback ALS getDependencyGraph()
- 行为等价（ctx 优先，fallback 保留）

## 行为 0 三件套（已验证）

- **tsc**：0 error
- **vitest**：88/88 pass（3 flaky solo pass）
- **7-diff**：7 项目全 diff=0 ✓

## 后续覆盖

本 action 加 ctx optional + fallback ALS——后续 `fe-tools-fallback-als-delete` 删 fallback（ctx!.x!）。当前 styleLoad L91/96 已是 ctx!.graph!/ctx!.component!（fallback-als-delete 覆盖）。
