# Validation — fe-tools-singleton-retire-cleanup-final

Status authority: [Action Status](../../../STATUS.md)

## Scope 决策（partial completion）

D-SCF-1-1 logic parse-walk 完成（6 函数加 ctx optional + caller 传 ctx + fallback ALS 保留——行为 0 三件套 ✓）。
D-SCF-1-1 view/style parse-walk + D-SCF-1-2/2/3b 推迟——递归 caller 链（compileModule → tryModuleCache → mergeWxsModules → collectAllWxsModules）+ A2 deviation D-VPM-dev1 compileModule 撤回 ctx 阻塞 + scope 极大（几十处 caller + env.ts 重构 + runtime 改候选 b）。完全退役不改变行为（ctx 已携带全 data，fallback ALS 仅保险）。

## 需求完整性

| ID | Check | Status |
| --- | --- | --- |
| V-SCF-1 | R-SCF-1..6 覆盖 | partial——R-SCF-1（独立函数迁）logic parse-walk done，view/style 推迟；R-SCF-2/3/4/5 推迟 |
| V-SCF-2 | A-SCF-1..6 done | partial——A-SCF-1 partial（logic done）+ A-SCF-6 done，A-SCF-2/3/4/5 推迟 |

## Design 完整性

| ID | Check | Status |
| --- | --- | --- |
| V-SCF-3 | D-SCF-1..3 lock | D-SCF-1-1 logic parse-walk done，view/style + D-SCF-1-2/2/3b 推迟 |
| V-SCF-4 | 跨权威一致性注记 | done |
| V-SCF-5 | 迁移顺序门控 | D-SCF-1-1 logic done，后续推迟 |
| V-SCF-6 | 行为 0（tsc + vitest + 7-diff） | done——tsc 0 + vitest 88/88（3 flaky solo pass）+ 7-diff=0 |

## 行为 0 三件套（D-SCF-1-1 logic parse-walk）

- **tsc**：0 error
- **vitest**：88/88 pass（3 flaky solo pass——compile-cli-cache/lifecycle-integration/view-selective-stages）
- **7-diff**：air-battle/base/mpx-demo/subpackages/taro-todo/vant/weui 全 diff=0 ✓

## 已完成 commit

- `cb37de9c` D-SCF-1-1 logic parse-walk 6 函数加 ctx optional + caller 传 ctx（行为 0）

## 推迟根因

- **递归 caller 链**：view parse-walk compileModule → tryModuleCache → mergeWxsModules → collectAllWxsModules——每加 ctx 到一个函数，caller 在另一个无 ctx 函数内
- **A2 deviation D-VPM-dev1 阻塞**：compileModule 撤回 ctx（A2 遗留）——compileModule 不加 ctx，但 tryModuleCache/mergeWxsModules/collectAllWxsModules 须 ctx（矛盾）
- **scope 极大**：D-SCF-1-2 删 fallback 几十处 + D-SCF-2 resetStoreInfo 退役 + emit.ts:142 + emit-engine 建 ctx + D-SCF-3 env.ts singleton 删 + 几十处 caller + runtime 改候选 b
