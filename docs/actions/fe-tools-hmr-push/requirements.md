# Requirements — fe-tools-hmr-push

Status: **draft（2026-10-09）**

## 问题陈述

dev server 全量 reload（L0-L3，无 HMR level）。H1+H3 后编译侧有增量 payload 数据源。H4 接 dev server 消费，推 per-module hot-swap。

## Goal

dev-reload 加 L_HMR level + dev-server 增量 payload 推送 + materialize 增量化。编译侧 HMR 完成。

## Requirements

### R-PUSH-1（MUST）— L_HMR level
dev-reload RELOAD_LEVELS 加 L_HMR（per-module hot-swap）。语义：增量 payload 推送，runtime per-module update。

### R-PUSH-2（MUST）— 增量 payload 推送
dev-server notifyBuildPublished → 增量 payload broadcast（非全量 reload）。payload = H1 deriveLogicBuckets + H3 per-module cache 增量集。

### R-PUSH-3（MUST）— materialize 增量化
publishToDist 全量 → 增量（只写变更产物）。BuildModel 增量 materialize。

### R-PUSH-4（MUST）— fallback L1
runtime 未就绪时 downgrade L_HMR→L1（page-level reload）。

### R-PUSH-5（MUST）— 行为 0
one-shot 6 项目 diff=0 + tsc 0 + vitest 全绿。one-shot 不受影响（不传 state → no HMR）。

## Constraints

- **runtime 依赖**：per-module push 需 runtime HMR API（运行时侧，非本子门）
- **行为 0 三件套**：vitest + tsc + 6 项目 diff=0
- **one-shot 不受影响**：H4 仅 watch 路径
- **fallback 非阻塞**：编译侧 HMR 完成 = 伞 close 条件，runtime 激活外部时序

## Non-scope

- runtime HMR API 协议定义
- runtime per-module hot-swap 实现
- per-module cache（H3）
- registry 实体化（H2）

## 依赖

- H1 `complete`（deriveFromGraph 接线——增量 emit 数据源）
- H3 `complete`（per-module cache——增量 cache 数据源）
- HMR-compiler 伞 `ready`（D-HMR-5 fallback）
