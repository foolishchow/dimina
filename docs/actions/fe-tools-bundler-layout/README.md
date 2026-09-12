# FE Tools Bundler Layout

- Action: `fe-tools-bundler-layout`
- Status: `ready`
- Updated: 2026-09-12（归属表 ACCEPTED + ready 评审；D-BL-1..8 冻结）
- Status authority: [Action Status](../STATUS.md)
- 关系：独立卫生 / 结构 Action（**不是** umbrella 子门）。背景见 [`fe-tools-sidecar`](../fe-tools-sidecar/README.md)；与已归档 [`fe-tools-bundler-session`](../_archive/complete/fe-tools-bundler-session/README.md) 互补。
- 工作分支建议：长线 [`feature/fe-tools-sidecar`](../fe-tools-sidecar/README.md)
- 设计权威：[layout.draft.md](./layout.draft.md)（归属表已冻）+ 本 README **D-BL-***。

## Background

`fe/tools/bundler/src/common/` 约 30 个文件平铺：构建模型、watch、dev 预览、npm、lifecycle 等混在同一桶。扫一眼无法快速判断 **build vs dev**、**session vs compiler**。

本门只解决 **目录归置**。不抽 `runBuild` 阶段图、不做模板 IR、不扩大 session 职责。

## Goal

1. 按冻结目标树归置源码，口诀可定位：`session/` · `compiler/`（build）· `dev/` · `watch/` · `model/` · `shared/`  
2. 收敛并最终移除 `common/` 实现平铺（N3/L2）  
3. **行为 0 变化**（搬家 + import/dist/exports）  
4. 归属表作为后续「runBuild 阶段化」导航基底（本门不实施阶段化）

## Non-goals

- TS-2 IR；`runBuild` 控制流抽出；拆巨石编译器算法；新 npm 包；改 `packages/*`；插件 / 通用 core；默认不新增 `exports` 子路径。

## 双轴（冻结）

| 轴 | 取值 | 含义 |
| --- | --- | --- |
| **产品路径** | `build` \| `dev` | 编译发布（含 watch）vs 预览 / reload |
| **层级** | `session` \| `compiler` \| `shared` | 编排 vs 编译/工程 vs 真跨域 |

Watch ∈ **build + compiler**。`preview-adapter` ∈ **dev + session**；`dev-server` 等 ∈ **dev 实现**。

## 冻结决策（D-BL-1..8）

| ID | 决策 |
| --- | --- |
| D-BL-1 | 目标树与全量归属表以 [layout.draft.md](./layout.draft.md) **ACCEPTED** 为准（N1–N3、O1–O6） |
| D-BL-2 | 原 `core/` → **`compiler/`**；预览实现 → **`dev/`** |
| D-BL-3 | 垫片：**L1** 允许 `common/*` 与根 `env.js` re-export；**L2** 删除垫片并移除空 `common/` |
| D-BL-4 | **禁止**再往 `common/` 新增实现文件（文档约定；L2 后目录不存在） |
| D-BL-5 | 产品门 **L0→L1→L2→L3**（见下）；**L1 试点簇 = `dev/`**（触面相对独立） |
| D-BL-6 | 验证：全量 vitest + `check-package-exports`（或现行等价）+ CLI build/dev 冒烟；**nomap 产物字节等价 MUST**；sourcemap 对拍 SHOULD |
| D-BL-7 | 公开 `exports` 面保持；本门 **不** 新增稳定子路径 |
| D-BL-8 | 与阶段化边界：本门 **只搬家**；`runBuild` 阶段表抽出属未来独立 Action，互不阻塞 |

## 产品门

| 门 | 交付 | acceptance | validation |
| --- | --- | --- | --- |
| **L0** | 本文 + layout 表冻结（已完成于 ready） | A-BL05 | — |
| **L1** | 整夹搬 `dev/` + import/dist + 必要垫片 | A-BL01 子集 / A-BL06 | P-BL01..04 冒烟级 |
| **L2** | 其余簇按表搬完；删垫片；`common/` 清空移除 | A-BL01 / A-BL03 | 全套 P-BL |
| **L3** | 证据写入 validation（回归 + 字节等价 + exports + 口诀抽检） | A-BL02 / A-BL04 | P-BL01..06 |

## Readiness review（2026-09-12）

| 维度 | 结论 |
| --- | --- |
| 边界 | Goal/Non-goals/D-BL-8 清晰；不越 IR/阶段化 |
| 设计 | 归属表无 OPEN；命名已冻 |
| 计划 | L0–L3 + L1=`dev/` 已冻 |
| 需求/验收/验证 | R-BL / A-BL / P-BL 可执行 |
| 残留 | 实施需授权 `in_progress`；阶段化 Action 尚未立（不阻塞本门） |

**Verdict：`ready`。** 实施仍须明确授权后再改代码。

## Closure conditions

- A-BL01..06 pass；P-BL 填实际证据  
- `common/` 无实现文件（已移除或仅无）  
- STATUS 更新；complete 后归档  

## Documents

| 文档 | 作用 |
| --- | --- |
| [layout.draft.md](./layout.draft.md) | 冻结归属表 |
| [requirements](./requirements.md) | MUST |
| [acceptance](./acceptance.md) | 验收 |
| [validation](./validation.md) | 验证（实施时填） |
