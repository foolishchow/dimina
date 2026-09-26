# fe-tools-singleton-retire-impl-cleanup

- Status: `ready`
- Type: impl（D-SR-4+5+6 cleanup——resetStoreInfo 退役 + 测试迁 + env.ts singleton 删）
- Parent: fe-tools-singleton-retire-research（D-SR-4+5+6）+ fe-tools-singleton-retire-impl-core（A5a 核心完成）
- Gates: A0-A4 + A5 research + A5a 核心 全 complete

## 目标

实施 D-SR-4（worker resetStoreInfo 4 处退役——ctx 必传完全迁移）+ D-SR-5（__tests__ 107 caller + getPages 21 caller 迁移）+ D-SR-6（storeInfo wrapper 重构 + env.ts singleton 删 20 getters）。

## 背景

L2/L3 退役第七步（A5-impl cleanup）。A5a 已完成核心 migration（PackerContext 扩 + ALS 迁 ctx optional + fallback ALS + successPayload）。A5b cleanup：
- **D-SR-4**：worker ctx 建立传全 optional（graph/appId/component/configInfo/npmResolver/runtimeType）+ runtime caller 传 graph + 删 fallback ALS（完全迁移）→ resetStoreInfo 4 处退役
- **D-SR-5**：107 __tests__ caller 改 ctx 直传 + 21 getPages caller 迁移
- **D-SR-6**：storeInfo wrapper 删 compat 写 6 条 + env.ts 删 singleton + Proxy + 20 getters

## scope

- **D-SR-4** resetStoreInfo 4 处退役（logic/view/style/emit-engine）+ worker ctx 建立传全 optional + runtime caller 传 graph + 删 fallback ALS
- **D-SR-5** 107 __tests__ caller + 21 getPages caller 迁移
- **D-SR-6** storeInfo wrapper 重构 + env.ts singleton 删（20 getters + L34 re-export 保留）

## 行为 0

- tsc 0 + vitest 全绿 + 7-diff=0
- ctx 必传（完全迁移——无 fallback ALS）

## 设计门

[design.draft.md](design.draft.md)（**D-SRC-1..3 已 review lock**——R1-R4 全 findings fix + R5 收敛）

## 文档

- [design.draft.md](design.draft.md)
- [requirements.md](requirements.md)
- [acceptance.md](acceptance.md)
- [validation.md](validation.md)
