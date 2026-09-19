# FE Tools Bundler Boundaries

- Action: `fe-tools-bundler-boundaries`
- Status: `complete`
- Updated: 2026-09-18
- Status authority: [Action Status](../../../STATUS.md)
- 术语权威：[architecture-notes](../../../../fe-tools/architecture-notes.md)「架构术语：Packer / Scheme」
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 术语

- **Packer**：通用模块打包器（Rollup / webpack 同类）。只处理模块标识、图、transform、模块产出。不知道小程序、页面、WXML。不是包名 `@dimina/bundler`。
- **Scheme**：Dimina 的打包方案。决定编什么、分几条车道、产物长什么样、何时调用 Packer。不是目录 `compiler/logic`（该目录整段是焊点）。

本文件里的 `fe/tools/bundler`、`compiler/logic` 只指路径。

## 问题陈述

包 `@dimina/bundler` 把 Packer 和 Scheme 焊在一起。没有一个可以单独拿走的模块打包器，也没有一层只表达 Dimina 打包方案的边界。

`compiler/core/env.ts` 被 Scheme 与车道同时读取（15 个文件），所以两边的规则堆在同一条总线上。`compiler/logic/**`、`pipeline/emit.ts`、`model/dependency-graph.ts` 都是焊点。view / style 是 Scheme 的车道，不是 Packer 插件。

2026-09-18 对 `src` 的 import 扫描（基线 `31db0c18`）只证明焊点存在。它不能当成「目录上下级」来冻结。那张层表已废止。

## Goal

划清 Packer 与 Scheme 的职责，并把现有模块标到某一侧或标成焊点。

1. **职责**：Packer 只做模块打包；Scheme 做 Dimina 方案并调用 Packer。Packer 不得 import Scheme。
2. **焊点**：`compiler/logic/**`、`emit.ts`、`env.ts`、`dependency-graph.ts` 标成焊点。view / style 留在 Scheme。不单列「Packer 客户」。
3. **落点表**：封口全集内每一行是 Packer、Scheme 或焊点。粒度只到目录或文件，不下到方法。

本 Action 只交付这张边界。不抽 Packer，不改 `fe/tools/bundler/src`，不决定焊点怎么拆到方法。

## Non-goals

- 不实现 Packer，不拆 `env` / `emit` / `dependency-graph`，不搬目录，不改包名
- 不把落点表细化到方法
- 不把 view / style 收成 Packer 插件
- 不按废止的「目录上下级」去禁 import
- 不做 memfs、E7、WXML Document 形状、Module 对象收敛
- 不触碰 `fe/packages`

## 边界

```text
本 Action:  Packer / Scheme 职责 + 目录/文件落点（零产品代码）
另立:       按落点表抽出 Packer；焊点的方法级拆分
不做:       把 view/style 对称塞进 Packer；目录层禁边；方法级落点
```

## 产品门

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **B0** | 职责冻结（Packer 做什么、不做什么；谁可以调用谁） | 与术语节一致；D-BD-1..6 在档 |
| **B1** | 落点表 | 封口全集均标为 Packer / Scheme / 焊点；粒度仅为目录或文件 |

## Status / 授权

- **`complete`**（2026-09-18）。D-BD-1..6 全拍板；落点表封口全集；env.ts 15 处引用核对通过；architecture-notes 回流完毕；零产品 diff 验证通过。A-BD0..3 全 passed。已归档。

## 闭合条件

- B0–B1 交付；A-\* 全 pass；`fe/tools/bundler/src` 零 diff
- 边界表回流 architecture-notes（不改写已交付的 session / CompileTarget 不变量语义）
- STATUS 一致

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-18 | 初稿 `draft`：组织解耦收成刀 0（目录层依赖表） |
| 2026-09-18 | 扫描：169 值 import；6 个层环；`env.ts` 15 处扇入 |
| 2026-09-18 | 术语：**Packer** / **Scheme** |
| 2026-09-18 | **改目标**：废止目录上下级禁边。本门改为 Packer/Scheme 职责与落点表 |
| 2026-09-18 | Readiness：`logic/**` 改为焊点；落点全集封口；去掉「Packer 客户」第四格。D-BD-5 仍待定 |
| 2026-09-18 | **D-BD-5** = 焊点；**D-BD-6** = 落点粒度只到目录或文件，不下到方法。待定清空 |
| 2026-09-18 | Readiness 修文：钉死零 diff baseline = 授权 `in_progress` 的 HEAD；补全 `env.ts` 焊点两侧用途 |
| 2026-09-18 | Review R2 pass：F1（步骤标注区分）+ F3（baseline 区分）修正完毕；升 `ready` |
