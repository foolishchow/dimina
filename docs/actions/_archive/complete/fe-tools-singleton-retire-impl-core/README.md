# fe-tools-singleton-retire-impl-core

- Status: `complete`
- Type: impl（D-SR-1+2+3 核心迁移——PackerContext 扩 optional + ALS 残留 31 处迁 ctx 读 + successPayload 改 ctx.graph）
- Parent: fe-tools-singleton-retire-research（D-SR-1..6 拆分——A5a 核心 + A5b cleanup）
- Gates: A0+A1（worker-ctx-direct）+ A2（view-parse-walk-migrate）+ A3（style-parse-walk-migrate）+ A4（compat-write-retire-research）+ A5（singleton-retire-research）全 complete

## 目标

实施 D-SR-1（PackerContext 扩 optional）+ D-SR-2（ALS 残留 31 处迁 ctx 读——ctx optional + fallback ALS 渐进）+ D-SR-3（successPayload 3 处改 ctx.graph）。A5b（D-SR-4+5+6 cleanup）后续 formalize。

## 背景

L2/L3 退役第六步（A5-impl 核心）。A5 research 锁定：
- 形状纪律候选 a 锁定（扩 PackerContext optional graph——D-PCS-1/D-PCS-6 放宽）
- graph 可变单例 worker 透传已实施（successPayload + mergeDelta）
- resolveAppAlias 实体化（ctx.resolveAlias 闭包 appInfo——A0 R8 守护）

## scope

- **D-SR-1** PackerContext 扩 optional（graph/appId/component/configInfo/npmResolver + resolveAlias 闭包 appInfo）+ buildPackerContextFromOptions 扩
- **D-SR-2** ALS 残留 31 处迁移到 ctx 读（ctx optional + fallback ALS——渐进，行为 0）
- **D-SR-3** successPayload 3 处改 ctx.graph（签名扩 `{ logger, graph }`）

## 行为 0

- tsc 0 + vitest 全绿 + 7-diff=0
- ctx optional + fallback ALS（同 A0-A3 模式）——ctx 传走 ctx，不传 fallback ALS（原行为）

## 设计门

[design.draft.md](design.draft.md)（**D-SIC-1..3 已 review lock**——R1-R4 全 findings fix + R5 收敛）

## 文档

- [design.draft.md](design.draft.md)
- [requirements.md](requirements.md)
- [acceptance.md](acceptance.md)
- [validation.md](validation.md)
