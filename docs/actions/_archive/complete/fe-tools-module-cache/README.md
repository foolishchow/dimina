# FE Tools Module Cache

- Action: `fe-tools-module-cache`
- Status: `complete`
- Updated: 2026-09-12（MC1..MC3 按**缩 scope**闭合；见下方「实际交付摘要」；A-MC01..07 全 pass，消融 ×3）
- Status authority: [Action Status](../../../STATUS.md)
- 关系：独立架构 Action。与 [`fe-tools-build-model`](../fe-tools-build-model/README.md) **并行实施**（各自独立、互不前置）；worker 演进与 FileModule 归属基准依据 [`fe-tools-worker-architecture`](../fe-tools-worker-architecture/README.md)（其协议草案定义 FileModule 归属）。**形态①已拍板**（不拆 view 组合），②（拆结构）属 TS-2 边界。现状证据见 [source-audit](source-audit.md)。

## 实际交付摘要（闭合口径，2026-09-12）

> **读档以本节为准。** 下文 Goal / 门表保留设计期叙述，**不等于**闭合时已落地的运行时能力。证据见 [acceptance](acceptance.md) / [validation](validation.md)。

### 交付了什么

| 项 | 实际内容 | 价值 |
| --- | --- | --- |
| **MC1 失败缓存** | `view-compiler`：`compileModule` 失败写入 `compileResCache`（`{failed:true, errorShape}`）；命中则按保存字段重建并 rethrow | **脚手架**：错误 shape 含 file/line/column/stage；当前单 stage 架构下**行为≈无此缓存**（消融去掉仍绿） |
| **D-MC-3 选项 B** | 明文：**不做** `compileResCache` 内容寻址；保持单 stage / path 生命周期 | 避免空转升级 |
| **MC2 minify key** | `style-compiler` 的 `compileRes` cacheKey 增加 `::minify:…` | **真修复**：minify 变化不再误命中未压缩结果（消融可证） |
| **D-MC-5** | 判定 view 缓存 value **不依赖** compileConfig → key **不加** esTarget/fileTypes/renderer 等 | 避免模型冗余 |
| **MC3 测例** | 新增 `module-cache.spec.js`（同内容命中 / minify miss）；共享「只算一次」复用既有 hotpaths | 把 MC2 钉死；颗粒度靠旁证 |
| **回归护栏** | 相对 ready 基线字节 diff=0；测试 479→481 全绿 | 证明没改产物语义 |
| **代码范围** | 仅 `view-compiler.js` + `style-compiler.js` + 一测例 | 未碰 BuildModel / IR / env / worker 生命周期 |

### 明确没做什么

| 原 Goal / 门表写的 | 实际 |
| --- | --- |
| **ModuleCache / ComposeCache 分层**（新抽象、改名拆分） | **没做**；仍用原有 `compileResCache` / `templateRenderCache` 等 |
| **compileResCache → 内容寻址** | **没做**（选项 B） |
| **三模块模型**（Group / ViewFile / LogicFile + 双向关联） | **没做**（设计叙述，无运行时类型） |
| **D-MC-4「组合前查询层」** | **没做**（组合算法未动，也未加查询层） |
| **key 全维度**（minify + esTarget.view + fileTypes + renderer） | **只做了 style 的 minify**；其余按 D-MC-5 不必加 |
| **失败缓存的可观察收益**（同 key 二次跳过执行） | **当前不可观察**；等阶段 4 常驻 worker |
| **稳定单测触发 view 失败缓存** | **未做**（vue 编译器宽容；acceptance 诚实放过） |
| **跨 build / 跨 stage 缓存持久化** | **非本门**（仍 new/terminate） |

**一句话：** 本门 = 诚实缩 scope 闭合——修了 style minify 错 key + 记下失败缓存脚手架 + 测例钉住；**没有**交付早期宣称的 worker 内颗粒化重构。

## Background

worker 内缓存粒度缺陷（source-audit §1）：没有干净的"单文件 → 单结果"纯 module 缓存——`templateRenderCache` 是组合/entry 级、`compileResCache` 是 path 寻址（跨 build 不安全）、`processedModules` 只记不缓存。且 worker 每次 `new + terminate`（§2），缓存生命周期 = 单次 stage。

**先颗粒化，再谈跨 build 持久化**：颗粒化（本 Action）是未来任何跨 build module 持久化（阶段 4 决策）的前提——先把粗粒度缓存颗粒化，否则 key/失效/注入边界全部返工。**与 build-model 并行**：build-model 的 M1/M2（结果边界/失效）按 entry 粒度即可，不依赖本 Action 的 FileModule 粒度。

## Goal

> 设计期意图。**闭合是否达成以下各项 → 见 [实际交付摘要](#实际交付摘要闭合口径2026-09-12)。**

1. **三模块模型**（GroupModule / ViewFileModule / LogicFileModule）：GroupModule 为 owner 级主线程权威索引（page/component/npm）；ViewFileModule 为 wxml 单文件→DOM 中间结果；LogicFileModule 为 js 单文件→AST（缓存价值单独评估）。**FileModule 内携带所属 Group 引用（双向关联）**，见 technical-design §1
2. **ModuleCache / ComposeCache 边界划分**（worker 内）：单文件级 module 结果缓存（内容寻址）与 entry 组合产物缓存分层。**术语澄清（L-M-10）**：`ComposeCache` 指 worker 内组合产物缓存——与 build-model 的主线程 `Entry`（产物权威单元）同名不同物，已改名避免冲突
3. **compileResCache 升级**：path 寻址 → 内容寻址（或明确弃用跨 build）
4. **失败结果也缓存**（防重复报错）
5. **key 维度补齐**：minify / esTarget.view / fileTypes / renderer（跨 build 安全前提）
6. **可测**：缓存模块可 mock worker 单测（同内容同命中、失败缓存、颗粒度断言）

## Non-goals（四不碰）

- **不持有到 main thread**（build-model M1）
- **不做失效传播 / 变更传播**（build-model M2）
- **不定义 IR / 不拆 view 组合编译结构**（TS-2 边界）
- **不改产物字节**（验收 = 字节等价 + 完整回归套件通过，当时数量记入实施证据）

## Worker 生命周期边界（D-WA-1 / MC scope）

本 Action **不把 worker 改为持久化 service**：前 3 阶段仍是 `new Worker → stage → terminate`。
因此 MC1..3 的 FileModule cache 是 **worker-local / 单 stage 生命周期**，不承诺跨 build
持久化；跨 build 的 entry 产物持有归 `fe-tools-build-model`。

若未来性能测量证明“变化 Entry 内部的未变 FileModule 重算”是主要瓶颈，另立阶段 4
决策：选择持久化 worker service，或选择 main-thread FileModuleStore（DOM/AST 跨线程
传递成本需实测）。本 Action 不预设两者之一，也不提前引入共享缓存实例。

## 与并行 Action 的实施协调（M-11）

build-model M1 与本门 MC1 均改动 `view-compiler.js`（M1 改产物输出路径为流式回传，MC1 改 templateRenderCache/compileResCache 为内容寻址 + 拆分 ModuleCache/ComposeCache），存在**同文件冲突**风险。建议实施顺序：**M1 先行**（产物边界外框），**MC1 随后**（缓存结构内层）。若并行实施，view-compiler.js 变更需手动协调：MC1 拆出的 ComposeCache 的 output 写入路径应对接 M1 的流式回传通道（`postMessage type:'output'`）而非直接写盘。

## 门（实施计划，待 ready 冻结）

| 门 | 交付 | 性质 | 验收核心 |
| --- | --- | --- | --- |
| **MC1 边界与寻址**（= 演进阶段 3） | ModuleCache/ComposeCache 分层；compileResCache 内容寻址化；失败缓存 | 等价重构（缓存结构，不改产物） | 字节级 diff=0（nomap+sourcemap 双模式）；完整回归套件通过（当时数量记入实施证据） |
| **MC2 key 维度**（= 演进阶段 3） | key 纳入 minify/esTarget.view/fileTypes/renderer | key 协议 | 缓存单测（配置变化 → 不命中旧 key）；key 维度清单对齐 inputHash 规范 |
| **MC3 可测性**（= 演进阶段 3） | mock worker 单测集：同内容同命中 / 失败缓存 / 并发引用单文件只 parse 一次 | 新增测例 | 颗粒度断言 + 既有回归 |

## 关键决策（D-MC-1..3，倾向已记录、待 ready 冻结）

| ID | 决策点 | 倾向 |
| --- | --- | --- |
| D-MC-1 | module 中间结果形态 | ① 缓存"单文件级 parse/中间结果"（不定义 formal IR，不拆组合）——已拍板；② 拆组合/编译结构 → TS-2 |
| D-MC-2 | 失败缓存 | 缓存失败结果（parse/transform 异常），同输入不再重复报错 |
| D-MC-3 | compileResCache 处置 | **保持单 build 生命周期（选项 B，MC1 拍板）**：内容寻址化在单 stage worker 下无行为收益（path 唯一决定 content，worker 每 stage new/terminate 不跨 build）——不升级，文档记录；失败缓存（R-MC3）已实现（read+write），非承重（消融验证） |
| D-MC-4（新增） | 组合前缓存查询层 vs 拆组合算法 | **垫查询层**：ModuleGraph 的 fileOwners 反查组合输入集，只加“单文件 hash + 组合前查缓存，miss 走现场”；**组合算法不拆不改**（2026-09-10 纠偏：早期“触碰组合结构”判断不成立） |
| D-MC-5（新增） | 各缓存 compileConfig 依赖判定（MC2 拍板） | **style `compileRes`：value 依赖 minify（transform 在 set 前）→ key 加 `minify:` 维度**（已实施）；**view `compileResCache`/`templateRenderCache`：value 独立于 compileConfig（esTarget/minify 在 compileML 最终 transform，不在缓存内）→ key 不加 compileFingerprint（模型冗余）；logic `processedModules`：非 value 缓存 → 不适用** |

## Readiness gaps

1. D-MC-1..4 待 ready 评审（尤其 MC3 的"颗粒度断言"验收口径）
2. ~~view "组合型编译"的 module 切点探针~~ — **已沉淀为 technical-design §5.1**（ModuleCache/ComposeCache 拆分边界 + 拦截点 + 维度补齐）
3. key 维度清单（minify/esTarget/fileTypes/renderer）与 build-model 的 inputHash 协议对齐方式

## Closure conditions

① MC1..3 交付；R-MC 全 pass 且 P-MC 填实际证据
② 消融（原则 6：每项独立机制分别消融）：
- MC1 内容寻址化：去内容 key → 缓存单测失败
- MC1 失败缓存：去失败缓存 → A-MC03 失败
- MC2 key 维度：去 esTarget 维度 → 配置切换测例失败
③ Backflow：协议基准对齐（worker-architecture 的 FileModule 归属定义）+ TS-2 无涉及（未碰组合/IR）
④ STATUS/归档/指针一致变更

## Documents

| 文档 | 作用 |
| --- | --- |
| [source-audit](source-audit.md) | worker 缓存粒度现状证据（§1 核心） |
| [requirements](requirements.md) | R-MC-* |
| [technical-design](technical-design.md) | ModuleCache/ComposeCache 边界 + key 协议 |
| [acceptance](acceptance.md) / [validation](validation.md) | 验收与验证（draft） |
