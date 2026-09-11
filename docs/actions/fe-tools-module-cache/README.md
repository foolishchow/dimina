# FE Tools Module Cache

- Action: `fe-tools-module-cache`
- Status: `draft`
- Updated: 2026-09-10
- Status authority: [Action Status](../STATUS.md)
- 关系：独立架构 Action。是 [`fe-tools-build-model`](../fe-tools-build-model/README.md) 的**前置地基**（先固 module 粒度，再谈主线程持久化）；形态①已拍板（不拆 view 组合），演进路径依据 [`fe-tools-worker-architecture`](../fe-tools-worker-architecture/README.md) 阶段 3（模型层）。现状证据见 [source-audit](source-audit.md)。

## Background

worker 内缓存粒度缺陷（source-audit §1）：没有干净的"单文件 → 单结果"纯 module 缓存——`templateRenderCache` 是组合/entry 级、`compileResCache` 是 path 寻址（跨 build 不安全）、`processedModules` 只记不缓存。且 worker 每次 `new + terminate`（§2），缓存生命周期 = 单次 stage。

**先颗粒化，再持久化**：主线程 BuildModel（build-model Action）需要 module 粒度才能做 entry 级失效与注入；若先把粗粒度缓存持久化，key/失效/注入边界全部返工。

## Goal

1. **三模块模型**（GroupModule / ViewFileModule / LogicFileModule）：GroupModule 为 owner 级主线程权威索引（page/component/npm）；ViewFileModule 为 wxml 单文件→DOM 中间结果；LogicFileModule 为 js 单文件→AST（缓存价值单独评估）。**FileModule 内携带所属 Group 引用（双向关联）**，见 technical-design §1
2. **ModuleCache / EntryCache 边界划分**（worker 内）：单文件级 module 结果缓存（内容寻址）与 entry 组合产物缓存分层
3. **compileResCache 升级**：path 寻址 → 内容寻址（或明确弃用跨 build）
4. **失败结果也缓存**（防重复报错）
5. **key 维度补齐**：minify / esTarget.view / fileTypes / renderer（跨 build 安全前提）
6. **可测**：缓存模块可 mock worker 单测（同内容同命中、失败缓存、颗粒度断言）

## Non-goals（四不碰）

- **不持有到 main thread**（build-model M1）
- **不做失效传播 / 变更传播**（build-model M2）
- **不定义 IR / 不拆 view 组合编译结构**（TS-2 边界）
- **不改产物字节**（验收 = 字节等价 + 既有 479+ 测试全绿）

## 门（实施计划，待 ready 冻结）

| 门 | 交付 | 性质 | 验收核心 |
| --- | --- | --- | --- |
| **MC1 边界与寻址** | ModuleCache/EntryCache 分层；compileResCache 内容寻址化；失败缓存 | 等价重构（缓存结构，不改产物） | 字节级 diff=0（nomap+sourcemap 双模式）；479+ 测试全绿 |
| **MC2 key 维度** | key 纳入 minify/esTarget.view/fileTypes/renderer | key 协议 | 缓存单测（配置变化 → 不命中旧 key）；key 维度清单对齐 inputHash 规范 |
| **MC3 可测性** | mock worker 单测集：同内容同命中 / 失败缓存 / 并发引用单文件只 parse 一次 | 新增测例 | 颗粒度断言 + 既有回归 |

## 关键决策（D-MC-1..3，倾向已记录、待 ready 冻结）

| ID | 决策点 | 倾向 |
| --- | --- | --- |
| D-MC-1 | module 中间结果形态 | ① 缓存"单文件级 parse/中间结果"（不定义 formal IR，不拆组合）——已拍板；② 拆组合/编译结构 → TS-2 |
| D-MC-2 | 失败缓存 | 缓存失败结果（parse/transform 异常），同输入不再重复报错 |
| D-MC-3 | compileResCache 处置 | 升级为内容寻址；若成本超支则明确"保持单 build 生命周期、放弃跨 build"（记录在案） |
| D-MC-4（新增） | 组合前缓存查询层 vs 拆组合算法 | **垫查询层**：ModuleGraph 的 fileOwners 反查组合输入集，只加“单文件 hash + 组合前查缓存，miss 走现场”；**组合算法不拆不改**（2026-09-10 纠偏：早期“触碰组合结构”判断不成立） |

## Readiness gaps

1. D-MC-1..3 待 ready 评审（尤其 MC3 的"颗粒度断言"验收口径）
2. view "组合型编译"的 module 切点探针：templateRenderCache 现有 key 拆解为 module 层 / entry 层的精确边界
3. key 维度清单（minify/esTarget/fileTypes/renderer）与 build-model 的 inputHash 协议对齐方式

## Closure conditions

① MC1..3 交付；R-MC 全 pass 且 P-MC 填实际证据
② 消融：MC1 内容寻址化（去内容 key 应使缓存单测失败）/ MC2 key 维度（去 esTarget 维度应使配置切换测例失败）
③ Backflow：build-model README 前置关系确认（module 粒度已冻）；TS-2 无涉及（未碰组合/IR）
④ STATUS/归档/指针一致变更

## Documents

| 文档 | 作用 |
| --- | --- |
| [source-audit](source-audit.md) | worker 缓存粒度现状证据（§1 核心） |
| [requirements](requirements.md) | R-MC-* |
| [technical-design](technical-design.md) | ModuleCache/EntryCache 边界 + key 协议 |
| [acceptance](acceptance.md) / [validation](validation.md) | 验收与验证（draft） |
