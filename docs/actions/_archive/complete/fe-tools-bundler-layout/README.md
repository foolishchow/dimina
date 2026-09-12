# FE Tools Bundler Layout

- Action: `fe-tools-bundler-layout`
- Status: `complete`
- Updated: 2026-09-12（L0–L3 闭合；归档）
- Authorized: 2026-09-12
- Status authority: [Action Status](../../../STATUS.md)
- 关系：独立卫生 / 结构 Action（**不是** umbrella 子门）。背景见 [`fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)；与已归档 [`fe-tools-bundler-session`](../fe-tools-bundler-session/README.md) 互补。
- 工作分支：[`feature/fe-tools-sidecar`](../../../fe-tools-sidecar/README.md)
- 设计权威：[layout.draft.md](./layout.draft.md)（归属表已冻）+ 本 README **D-BL-***。

## 实际交付摘要（闭合口径，2026-09-12）

| 项 | 内容 |
| --- | --- |
| 目标树 | `bin/` · `session/` · `compiler/` · `model/` · `watch/` · `dev/` · `shared/` + 根 `index.js` / `watch.js` |
| 移除 | `src/common/`、`src/core/`、根 `src/env.js`（无 L2 垫片残留） |
| 公开 exports | `./view-compiler` 等 → `dist/compiler/*`（原 `dist/core/*`） |
| 行为 | **0 变化**：481 tests 绿；相对 `85ebb05a` nomap 94 / sourcemap 185 文件 `diff -rq` exit=0；CLI build/dev 冒烟通过 |
| 未做 | `runBuild` 阶段化；TS-2 IR；新 npm 包 / 新 exports 子路径 |

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
| D-BL-4 | **禁止**再往 `common/` 新增实现文件（目录已不存在） |
| D-BL-5 | 产品门 **L0→L1→L2→L3**；**L1 试点簇 = `dev/`** |
| D-BL-6 | 验证：全量 vitest + `check-package-exports` + CLI build/dev 冒烟；**nomap MUST**；sourcemap SHOULD |
| D-BL-7 | 公开 `exports` 面保持；本门 **不** 新增稳定子路径 |
| D-BL-8 | 与阶段化边界：本门 **只搬家**；`runBuild` 阶段表抽出属未来独立 Action |

## 产品门（闭合）

| 门 | 交付 | 结果 |
| --- | --- | --- |
| **L0** | 设计冻结 | ready 时完成 |
| **L1** | `dev/` 簇 | 与 L2 同会话交付（无独立 commit；见 A-BL06） |
| **L2** | 全表归置；删垫片；移除 `common/` | **pass** |
| **L3** | validation 证据 | **pass** — A-BL01..06 / P-BL01..06 |

## Closure conditions

- ✅ A-BL01..06 pass；P-BL 实际证据已填  
- ✅ `common/` 已移除  
- ✅ STATUS 更新并归档  

## Documents

| 文档 | 作用 |
| --- | --- |
| [layout.draft.md](./layout.draft.md) | 冻结归属表 |
| [requirements](./requirements.md) | MUST |
| [acceptance](./acceptance.md) | 验收 |
| [validation](./validation.md) | 验证证据 |
