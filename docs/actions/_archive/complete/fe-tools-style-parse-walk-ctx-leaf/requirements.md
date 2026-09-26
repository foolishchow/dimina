# Requirements — fe-tools-style-parse-walk-ctx-leaf
## R-SPL-1 — styleLoad 加 ctx optional
styleLoad(L72) 加 ctx optional 末参 + L91 getDependencyGraph() → (ctx?.graph ?? getDependencyGraph()) + L96 getComponent() → (ctx?.component ? ctx.component(...) : getComponent(...))。fallback ALS 保留（行为 0）。
## R-SPL-2 — caller 传 ctx
L136 styleLoad(module, compiledPaths) → styleLoad(module, compiledPaths, ctx)（buildCompileCss 内——ctx 已有）。
