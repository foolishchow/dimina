# Action — fe-tools-singleton-retire-cleanup-final

> **状态：draft**——D-SRC-1b/2/3b 完全退役收尾（A5b 推迟）。承接 `fe-tools-singleton-retire-impl-cleanup`（A5b partial——D-SRC-1a + D-SRC-3a 已完成 ctx 传全核心，fallback ALS 保留为保险）。

## 背景

A5b（`fe-tools-singleton-retire-impl-cleanup`）partial completion：D-SRC-1a（worker ctx 传全）+ D-SRC-3a（测试迁 compileSS/compileML 传 ctx）已完成，行为 0 三件套 ✓。D-SRC-1b/2/3b 完全退役收尾推迟本 action——删 fallback + 独立函数迁 + resetStoreInfo 退役 + env.ts singleton 删。

完全退役**不改变行为**——ctx 已携带全 data，fallback ALS 仅保险（ctx 优先 `ctx?.x ?? ALSGetter()`）。A5b 实证：D-SRC-1b 删 fallback 破坏 121 测试（独立函数 enhanceCSS/collectAllWxsModules/styleLoad caller 不传 ctx）——须先迁独立函数 + caller 链。

## Scope

- **D-SRC-1b**：删 fallback ALS 15 处（ctx 必传）+ 独立函数 10 处迁（加 ctx 参数 + caller 传）
- **D-SRC-2**：resetStoreInfo 4 处退役 + storeInfo wrapper 重构（删 compat 写 6 条）
- **D-SRC-3b**：env.ts singleton 删（20 getters + Proxy + defaultCompilerContext）+ src getter caller 迁 + runtime 改候选 b（postMessage 序列化）

## 迁移顺序门控

1. **D-SRC-1b-1**：独立函数 10 处加 ctx 参数 + caller 链传 ctx（enhanceCSS/collectAllWxsModules/styleLoad/processIncludedFileWxsDependencies/getJSAbsolutePath/resolveDependencyId 等）
2. **D-SRC-1b-2**：删 fallback ALS 15 处（ctx 必传——独立函数已迁）
3. **D-SRC-2**：resetStoreInfo 4 处退役 + storeInfo wrapper 重构
4. **D-SRC-3b**：env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b

## 文档

- [requirements.md](requirements.md)（R-SCF-1..6）
- [design.draft.md](design.draft.md)（**D-SCF-1..3 已 review lock**——R1-R4 findings 全 fix + R5/R6/R7 收敛）
- [acceptance.md](acceptance.md)（A-SCF-1..6）
- [validation.md](validation.md)（V-SCF-1..6）

## 行为 0 三件套

- tsc 0（`node ./node_modules/typescript/bin/tsc --noEmit`）
- vitest 全绿（88/88，flaky solo pass）
- 7-diff=0（air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui）
