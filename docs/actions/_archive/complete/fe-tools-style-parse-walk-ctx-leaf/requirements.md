# Requirements — fe-tools-style-parse-walk-ctx-leaf

承接 cleanup-final D-SCF-1-1 推迟的 view/style parse-walk 迁。style parse-walk 的 styleLoad 是**叶子函数**（不调其他独立函数——无递归 caller 链），scope 最小。

## R-SPL-1 — styleLoad 加 ctx optional

styleLoad(L72) 加 `ctx?: PackerContext` 末参 + L91 `getDependencyGraph()` → `(ctx?.graph ?? getDependencyGraph())` + L96 `getComponent(...)` → `(ctx?.component ? ctx.component(...) : getComponent(...))`。fallback ALS 保留（行为 0——ctx optional 不破坏）。

## R-SPL-2 — caller 传 ctx

L136 `styleLoad(module, compiledPaths)` → `styleLoad(module, compiledPaths, ctx)`（buildCompileCss 内——ctx 已有，L135 buildCompileCss 签名已有 ctx?）。

## R-SPL-3 — 行为 0

tsc 0 + vitest 88/88 + 7-diff=0。ctx optional + fallback ALS 保留——行为 0（caller 可传可不传）。

## 前置关系

- 本 action 是 `fe-tools-fallback-als-delete` 的前置（删 fallback 须 styleLoad 已加 ctx + caller 传）
- 承接 `fe-tools-singleton-retire-cleanup-final` D-SCF-1-1 推迟的 style parse-walk 迁
