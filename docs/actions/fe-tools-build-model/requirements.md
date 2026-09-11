# Requirements — fe-tools-build-model

Status: `draft`（随讨论修订；ID 前缀 R-BM）

## R-BM1（MUST）Entry 级产物回传与持有

worker 编译产物不再直接写盘：`postMessage` 协议扩展产物字段（code + sourcemap），主线程 `BuildModel` 按 Entry 持有。view/style 为 page/component Entry；logic 为 **app 级单一 Entry**（bundle 产物整体持有，粒度诚实不升格）。

## R-BM2（MUST）统一物化，产物字节不变

`materialize(model)` 是唯一写盘出口：收敛三个 compiler 的 `writeFileSync` 与 `publishToDist`/`createDist(seedPath)` 的 staging/rename 语义。**验收基线：产物与目录结构字节级一致**（nomap 与 `--sourcemap` 双模式，diff=0）；临时目录 rename 优化保留。

## R-BM3（MUST）输入指纹体系

- 文件级：mtime 预筛 + content hash 确认（mtime 未变跳过 hash）
- Entry 级：`inputHash` = 输入文件 hash 的**有序聚合**（输入集排序稳定；view 的输入 = 页 wxml + include 链 + wxs 集，由依赖图给出）
- 首次全量指纹成本可接受（mtime 预筛兜底）

## R-BM4（MUST）指纹失效传播（单实现）

变更集 = `scan(旧指纹, 当前文件)`（纯函数）；受影响 Entry 集 = 依赖图闭包 `closure(变更集)`。**一套实现**服务 watch（事件降级为触发器：事件只标记"去扫描"，不做推导）与后续 cache 路径。

**已知行为变化（有意改进，须记录）**：watch 事件合并（count>1）不再保守退全量——状态对比无合并歧义。`watch-plan.spec` 中对应用例更新，行为变化写入交付说明。

## R-BM5（MUST）编译核心不动

transform 内部（view/logic/style 编译逻辑）、env.js 隐式上下文（ALS/Proxy）、worker 上下文协议段——三不动。Entry 失效即重跑现有直通编译（输入源→产物），不在本 Action 引入任何中间表示。

## R-BM6（SHOULD）依赖图完备性可验证

依赖图为 correctness 基石：漏边 = 漏算。提供 `--verify-incremental`（或等价）全量对拍模式：增量结果与全量结果 diff=0 的机器验证（可归 M3）。

## Non-requirements

- IR（字段/形状/pass 链）——TS-2 战场，本 Action 只留三层判定第 1 层
- 调度↔处理器 facade 化（handler 接口）
- logic 的 module 级增量（esbuild bundle 保持 app 级全量）
- rebuild 全量 storeInfo 的增量化（L0 热点，属调度后续）
- watch scheduler 重写（壳保留，仅 plan 生产段换机制）
- `compile-cache` 落盘格式的对外兼容（M3 若迁移，格式可升级版本号）
