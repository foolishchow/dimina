# Acceptance — fe-tools-singleton-retire-cleanup-final

## Scope 决策（partial completion）

D-SCF-1-1 logic parse-walk 完成（6 函数加 ctx optional + caller 传 ctx + fallback ALS 保留——行为 0 三件套 ✓）。
D-SCF-1-1 view/style parse-walk + D-SCF-1-2/2/3b 推迟——递归 caller 链 + A2 deviation D-VPM-dev1 compileModule 撤回 ctx 阻塞 + scope 极大。完全退役不改变行为（ctx 已携带全 data，fallback ALS 仅保险）。

## A-SCF-1 — 独立函数加 ctx 参数 ✓ partial（logic parse-walk done）

logic parse-walk 6 函数加 ctx optional + caller 传 ctx + fallback ALS 保留：
- getJSAbsolutePath / resolveDependencyId / resolveNpmModuleId / resolveModuleIdToExistingPath / resolveRelativeModuleId / resolveBareSiblingModuleId
- caller 链传 ctx（parse-walk 内 + logic/index.ts + registry-impl.ts）

view/style parse-walk 推迟——递归 caller 链 + A2 deviation 阻塞。

## A-SCF-2 — 删 fallback ALS ⏸ 推迟

须 D-SCF-1-1 全迁（view/style parse-walk + 独立函数）。递归 caller 链 + A2 deviation 阻塞。

## A-SCF-3 — resetStoreInfo 退役 ⏸ 推迟

须 D-SCF-1-2 前置。

## A-SCF-4 — storeInfo wrapper 重构 ⏸ 推迟

须 D-SCF-1-2 前置。

## A-SCF-5 — env.ts singleton 删 + src getter caller 迁 + runtime 改候选 b ⏸ 推迟

须 D-SCF-2 前置。scope 极大（几十处 caller + env.ts 重构 + runtime 改候选 b）。

## A-SCF-6 — 行为 0 三件套 ✓ done

tsc 0 + vitest 88/88（3 flaky solo pass）+ 7-diff=0。
