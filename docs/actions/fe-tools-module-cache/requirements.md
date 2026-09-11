# Requirements — fe-tools-module-cache

Status: `draft`（随讨论修订；ID 前缀 R-MC）

## R-MC1（MUST）ModuleCache / ComposeCache 边界

worker 内缓存分为两层：
- **ModuleCache**：单文件级 `moduleId → { contentHash, result }`，内容寻址（同内容必同结果），**纯函数**；含失败结果缓存
- **ComposeCache**：entry 组合产物（页面 render 等），`inputHash = hash(依赖 module contentHash 集)` 派生

现状缓存归属：`optionalChainingCache` 归 ModuleCache；`compileResCache`/`templateRenderCache` 依 D-MC-1 拆解；`processedModules`（logic）仅作已处理标记，不承担结果缓存职责（不迁移语义）。

## R-MC2（MUST）compileResCache 内容寻址化

`compileResCache` 从 path 寻址升级为内容寻址（key 纳入其真实输入）；若升级成本超支，明确降级为"保持单 build 生命周期"并在文档记录（D-MC-3 二选一，不留模糊态）。

## R-MC3（MUST）失败结果缓存

parse/transform 失败也入缓存（同输入不再重复报错），错误形状与诊断通道可区分（缓存命中时重新 emit 同一错误对象或重新抛出等价错误）。

## R-MC4（MUST）key 维度完备

内容寻址 key 必须包含影响结果的**全部输入维度**，至少：文件内容 hash、`minify`、`esTarget.view`、`fileTypes`（模板扩展名）、`renderer`。维度清单与 build-model 的 inputHash 协议对齐（跨 build 安全的前提）。

## R-MC5（MUST）不改产物字节

缓存结构调整不得改变任何编译产物。验收 = nomap 与 `--sourcemap` 双模式字节级 diff=0（对照改造前 HEAD）。

## R-MC6（SHOULD）可测性

缓存模块可 mock worker 单测：
- 同内容同命中（两次相同输入 → 第二次不重算）
- 失败缓存（失败输入二次进入 → 不重复报错）
- 颗粒度断言（多个 entry 引用同一 module → 该 module 只 parse 一次）

## Non-requirements

- 持有到 main thread / 跨 build 持久化（build-model）
- 失效传播 / 变更传播 / entry 级跳过（build-model M2）
- IR 定义 / 拆 view 组合与编译结构（TS-2；D-MC-1 ② 形态）
- 产物写入路径、publish/materialize 语义（build-model M1）
- worker service 化 / 常驻 worker
