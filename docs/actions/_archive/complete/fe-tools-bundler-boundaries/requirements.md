# Requirements — fe-tools-bundler-boundaries

Status: **草案（2026-09-18）** — 目标已改为 Packer / Scheme 边界。随 Action `draft`。

## R-BD0（MUST）职责

- **Packer** 只负责：模块标识、模块图、transform、模块产出。不得包含页面、`app.json`、WXML、小程序产物形状。
- **Scheme** 负责：Dimina 工程、车道、产物形状，以及何时调用 Packer。
- 依赖方向：Scheme 可以调用 Packer。Packer 禁止 import Scheme。
- view 车道与 style 车道属于 Scheme。不得在本门把它们定义成 Packer 插件。
- `compiler/logic/**` 整目录是焊点：对外是 Scheme 调用的 JS 车道，对内的模块图与 transform 是未来 Packer 的胚。本门不拆该目录，也不单列「Packer 客户」。
- `model/dependency-graph.ts` 是焊点（D-BD-5）：同时扛 Scheme 工程图与 JS 模块边。本门不拆成两张图。

## R-BD1（MUST）落点表

路径相对 `fe/tools/bundler/src`。全集封死，不得另加行：

- `index.ts`、`watch.ts`
- `bin/**`、`session/**`、`watch/**`、`dev/**`
- `model/**`（`dependency-graph.ts` 单独一行）
- `shared/**`
- `compiler/pipeline/**`（`emit.ts` 单独一行）
- `compiler/core/**`（`env.ts` 单独一行）
- `compiler/view/**`、`compiler/logic/**`、`compiler/style/**`、`compiler/worker-runtime/**`

不含仅作类型垫片的 `*.d.ts`（`less.d.ts`、`dev/ws-types.d.ts`），它们不单独成行。

- **粒度**（D-BD-6）：每一行是目录或文件，不是方法 / 函数。焊点只声明该路径同时扛两侧，不声明如何拆到方法。
- 每一行恰为：**Packer**、**Scheme** 或 **焊点**。不允许第四格，不允许「待定」行。
- **焊点**只表示该路径自己同时承担两侧职责。两侧都 import 一个工具文件，不因此把该文件标成焊点。
- 焊点必须写清两侧各用它的什么，不得标成某一侧的合法内部。
- 表是后续「抽出 Packer」的范围权威。本 Action 不授权按表改代码。方法级拆分不在本门。

## R-BD2（MUST）零产品改动

- `fe/tools/bundler/src`、`fe/packages` 零 diff。
- 不改公开 `build()` 行为。

## R-BD3（MUST）回流

- architecture-notes 写明本边界表的指针。
- 不改写 session / CompileTarget / worker-runtime 已交付不变量的语义。

## Non-requirements

- 不实现 Packer API，不设计 context 字段，不拆 `emit.ts` / `logic/**` / `dependency-graph.ts`。
- 不把落点表细化到方法。
- 不把 2026-09-18 的目录层扫描冻结成允许/禁止矩阵。该扫描只作焊点证据。
