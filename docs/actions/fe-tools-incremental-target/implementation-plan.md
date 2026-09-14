# Implementation plan — fe-tools-incremental-target

Status: **draft（2026-09-14）** — 决策拍板前不实施；下表为意向触达序

## I0 契约冻结

| Step | 动作 |
| --- | --- |
| 1 | 拍板 design 待定 ①–④；冻结 v1 |
| 2 | 补验收/验证命令与基线规则；升 `ready` |

## I1 watch 路径（意向）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `compile-target.js`（或增量模块） | derive / patch API 显式消费 `affectedEntries` |
| 2 | `build-pipeline.js` | 去掉平行 `filterPagesByEntries` 私算（改道） |
| 3 | `watch-plan.js` / `watch-runner.js` | 生产/透传对齐契约；注释标明权威语义 |
| 4 | `session/runner.js` | 白名单与契约对齐 |
| 5 | 测例 | 结构锚定 + watch 增量行为 0 |

## I2 cache 路径 + S4（意向）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `COMPILE_STAGE_ORDER` 单源 | compile-stages / invalidation / watch 改引用 |
| 2 | `compile-cache.js` / `bin/compile.js` | 与 watch 同契约形状 |
| 3 | 测例 | 双套词汇锚定消失；cache 增量行为 0 |

## 不做

- Listr 剥离、TS-2、真 web、renderer 扩展、PS3
