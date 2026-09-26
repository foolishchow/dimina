# Acceptance — fe-tools-singleton-retire-cleanup-final

## A-SCF-1 — 独立函数加 ctx 参数

独立函数 10 处加 ctx optional 参数 + caller 链传 ctx（D-SCF-1-1）。

## A-SCF-2 — 删 fallback ALS

fallback ALS 15 处删（ctx 必传——D-SCF-1-2）。import 清理（未用 getter 删）。

## A-SCF-3 — resetStoreInfo 退役

resetStoreInfo 4 处 caller 删 + 函数删 + emit-engine 退役门控（produceEntry 不读 ALS 确认）。

## A-SCF-4 — storeInfo wrapper 重构

storeInfo wrapper 删 compat 写 6 条（纯 compute——返 storeInfo data）。门控 D-SCF-1-2 后。

## A-SCF-5 — env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b

env.ts 删 defaultCompilerContext + Proxy + 20 getters（L34 re-export 保留）。src getter caller 迁（config-collector/define-engine/emit/dispatch/graph/orchestrator 等）。runtime 改候选 b（successPayload 在 compile 内调用——postMessage 序列化）。

## A-SCF-6 — 行为 0 三件套

tsc 0 + vitest 全绿（88/88，flaky solo pass）+ 7-diff=0。完全退役不改变行为。
