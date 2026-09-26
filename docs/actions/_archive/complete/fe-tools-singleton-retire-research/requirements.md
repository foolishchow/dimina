# Requirements — fe-tools-singleton-retire-research

## R-SR-1 — graph 可变单例 worker 透传机制研究

研究 graph 跨线程 delta 合并机制（successPayload + mergeDelta）+ parse-walk 12 处 graph 写入。

## R-SR-2 — 形状纪律候选 a/b/c 决策

实证候选 a/b/c 可行性——锁定候选 a（扩 PackerContext optional graph）。

## R-SR-3 — resolveAppAlias 实体化路径

研究 A0 R8 行为 0 守护——ctx.resolveAlias 闭包 appInfo 路径。

## R-SR-4 — ALS 残留 31 处精确分布

审计 ALS 残留 31 处（logic 18 + view 8 + style 5）+ successPayload 3 处。

## R-SR-5 — A5 实施拆分规划

产出 D-SR-1..6（PackerContext 扩 + ALS 迁 + successPayload + resetStoreInfo 退役 + 测试迁 + singleton 删）。

## R-SR-6 — 行为 0

研究性——无代码改动（git diff = 0）。
