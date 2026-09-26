# Acceptance — fe-tools-singleton-retire-impl-cleanup

## Scope 决策（partial completion）

D-SRC-1a + D-SRC-3a 完成（ctx 传全核心 + 测试传 ctx——行为 0 三件套 ✓）。
D-SRC-1b/2/3b 完全退役收尾推迟后续 action（`fe-tools-singleton-retire-cleanup-final`）——删 fallback + 独立函数迁 + resetStoreInfo 退役 + env.ts singleton 删。完全退役不改变行为（ctx 已携带全 data，fallback ALS 仅保险），scope 极大 + 行为 0 风险高（121 failed 证明独立函数 caller 不传 ctx）。

## A-SRC-1 — worker ctx 建立传全 optional ✓ done

logic/view/style index.ts worker ctx 建立传全 optional（graph/appId/component/configInfo/npmResolver/runtimeType/appInfo）+ view 补传 graph（A5a 遗漏）+ runtime caller 传 graph（候选 a 过渡——import getDependencyGraph）。

## A-SRC-2 — 删 fallback ALS ⏸ 推迟

parse-walk × 3 + index × 3 删 fallback ALS（ctx 必传）。**推迟**——删 fallback 破坏独立函数（enhanceCSS/collectAllWxsModules/styleLoad 等 caller 不传 ctx，121 failed）。须先迁独立函数 10 处 + caller 链——后续 action。

## A-SRC-3 — resetStoreInfo 退役 + storeInfo wrapper 重构 ⏸ 推迟

resetStoreInfo 4 处 caller 删 + 函数删 + storeInfo wrapper 删 compat 写。**推迟**——须 D-SRC-1b 前置（resetStoreInfo 仍 load-bearing fallback）。

## A-SRC-4 — 测试迁移 ✓ done

15 文件 compileSS/compileML 传 ctx + storeInfo si/ctx 建立 + buildCtxFromStoreInfo helper（getter try/catch fallback——测试 fixture 缺 project.config.json 等）。107 storeInfo caller 中 compileSS/compileML caller（15 文件）全迁。getPages 21 caller 推迟（须 ctx 扩 configData GraphConfigData——候选 a refined）。

## A-SRC-5 — env.ts singleton 删 ⏸ 推迟

env.ts 删 singleton + Proxy + 20 getters（L34 re-export 保留）。**推迟**——须 D-SRC-1b + src getter caller 迁（config-collector/define-engine/emit/dispatch/graph/orchestrator 等）+ runtime 改候选 b（postMessage 序列化）。

## A-SRC-6 — 行为 0 三件套 ✓ done

tsc 0 + vitest 88/88（3 flaky solo pass）+ 7-diff=0。
