# Acceptance — fe-tools-packer-lifecycle-audit

## A-PLA-1 — 入口梳理

- [x] `source-audit.md` §1 含 Packer 入口梳理（CLI / session / Packer 创建点 storeInfo）

## A-PLA-2 — 第一 build 全流程

- [x] `source-audit.md` §2 含 pipeline.run 4 阶段 + 逐步读/写/graph/cache 标注表

## A-PLA-3 — Worker 内流程

- [x] `source-audit.md` §3 含 compile worker + emit worker + 三车道 emit 差异

## A-PLA-4 — watch rebuild 流程

- [x] `source-audit.md` §4 含 chokidar → watch-plan → 增量数据流

## A-PLA-5 — graph 生命周期

- [x] `source-audit.md` §5 含创建/变异/合并 + 写权分布表

## A-PLA-6 — cache 生命周期

- [x] `source-audit.md` §6 含创建/读/写 + 写权分布表

## A-PLA-7 — 组件映射现状

- [x] `source-audit.md` §7 含形状假设 vs 现实 gap 表（审计时 5 组件，core-shape 后续演化为 6+）

## A-PLA-8 — 关键发现 F-1..F-6

- [x] `source-audit.md` §8 含 F-1..F-6 关键发现
- [x] F-1..F-6 已回流 `fe-tools-packer-core-shape`（draft.md + technical-design.md）

## A-PLA-9 — 行为 0

- [x] research only，diff=0（不改产品代码）
- [x] 仅新增 `source-audit.md`，无现有文件改动
