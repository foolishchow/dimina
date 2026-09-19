# FE Tools Module Result Cache（M2 / 刀 3）

- Action: `fe-tools-module-result-cache`
- Status: `ready`
- Updated: 2026-09-20
- Status authority: [Action Status](../STATUS.md)
- 伞：[fe-tools-module-centric](../fe-tools-module-centric/README.md)（`ready`；D-MF-1 已封口）
- 文档集：[requirements](requirements.md) · [technical-design](technical-design.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`
- 前置：[M1 fe-tools-module-invalidation](../_archive/complete/fe-tools-module-invalidation/README.md)（**complete**；`computeInvalidatedModules` 脏集 API 已交付）；[`project-store`](../_archive/complete/fe-tools-project-store/README.md)（Store 唯一活图权威）；[`incremental-target`](../_archive/complete/fe-tools-incremental-target/README.md)（Entry 级增量）

## 问题陈述

logic 模块变换结果（`CompileInfo = {path, code, map, extraInfoCode}`）每次 build 全量重算：

- `buildJSByPath` 递归收集 `compileRes[]`，无跨 rebuild 缓存
- M1 交付了模块级脏集查询（`computeInvalidatedModules`），但**无消费方**——脏集有了，没人清缓存 / 跳过重编
- 旧 [`fe-tools-module-cache`](../_archive/complete/fe-tools-module-cache/README.md)（已归档）显式 **不做** logic `compileResCache` 内容寻址（D-MC-3 选项 B）；M2 是另立新 Action

伞 D-MF-2：缓存宿主另定（不挂图节点）；D-MF-1 条款 2：moduleId = `CompileInfo.path`（= M1 返回集 / cache key）。

## Goal

交付 **Module 变换结果缓存**（刀 3）：

- 缓存 logic 完整 `CompileInfo`（`{path, code, map?, sourceFile, extraInfoCode?, component?, usingComponents?}`），key = `moduleId`（= `CompileInfo.path`）
- 跨 rebuild 复用：rebuild 时 `computeInvalidatedModules(graph, changedFiles)` → 脏集 → 清缓存 → 只重编脏模块 → clean 模块命中缓存
- worker cache snapshot 经 IPC 回填（D-RC-3 冻结 I）；响应含 `compileRes` → 主线程更新 cache
- watch 增量接线：改 1 JS 文件 → 只重编该模块 + 其 logic dependents

## Non-goals

- view / style Module 结果缓存（另议；旧 module-cache 的 view 失败缓存 + style minify key 已归档）
- `fingerprint` 下沉模块级（依赖 Module 大对象统一，属另门；M2 用文件级 fingerprint 串）
- HMR patch 产物（热更最小单位，另门）
- 改 `modDefine` / emit 字符串（行为 0 同 M1）
- 拆 `DependencyGraph` node 表；PackerContext / 拆 env·logic
- 改 `fe/packages`；在本 Action 未授 `in_progress` 前改 `src`（`draft`/`ready` 仅文档）
- 复活旧 `fe-tools-module-cache` 的缩 scope（D-MF-3）

## 边界

```text
伞 module-centric:  词汇 + D-MF-1/D-MF-2 + 子门顺序
M1 invalidation:    模块级失效查询（complete；提供 computeInvalidatedModules 脏集）
本 Action (M2):      Module 变换结果缓存 + 跨 rebuild 复用 + watch 接线
Entry 路径:         getAffectedEntries / computeAffectedEntries 保留（page 级）
```

## 产品门

| 门 | 内容 | 验收 |
| --- | --- | --- |
| **RC0** | 缓存宿主 + 持久策略 + worker回填方式 + 失效触发 拍板 | D-RC-* 冻结 |
| **RC1** | 实现 + 单测 + watch 冒烟 | A-* / P-* pass；行为 0 |

## Status / 授权

- 当前 **`ready`**（2026-09-20 用户授权）。**D-RC-1..4 已冻结**。升 `in_progress` 另授。
- 仍未授权改产品代码（`ready` 仅文档门；`in_progress` 才授权实施）。

## 闭合条件

- RC0+RC1 交付；A-* 全 pass；证据入 validation Actual
- 持久要点回流 `docs/fe-tools/architecture-notes.md`
- STATUS / 伞 roadmap 一致

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-20 | 立项 `draft`：承接伞 D-MF-2 / 刀 3；M1 complete 后 formalize |
| 2026-09-20 | **冻结** D-RC-1..4 → 升 `ready`：B（独立 ModuleResultCache）/ α（session-only）/ I（IPC 回填）/ watch-plan 触发 |
| 2026-09-20 | R1 readiness review 修正：F1 CompileInfo 7 字段；F2 ephemeral worker cache snapshot IPC；F3 stale「待拍板」；F4 注释归属 |
| 2026-09-20 | R2 readiness review 修正：F5 cache 更新路径协议变更（响应含 compileRes）；F6 Goal stale「待定」；F7 类型引用 type-only import |
| 2026-09-20 | R3 readiness review 修正：F8 §3.3 bullet 对齐 §3.5（snapshot.has/compileRes.push）；F9 IPC 成本措辞（EmitEntry+compileRes） |
| 2026-09-20 | 二轮 R1 修正：F10 cache hit 依赖发现（graph.getDirectDependencies）；F11 main+sub flat merge；F12 toJSON() class shape |
