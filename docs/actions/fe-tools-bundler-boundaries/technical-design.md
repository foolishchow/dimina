# Technical Design — fe-tools-bundler-boundaries

Status: **草案（2026-09-18）** — 职责 D-BD-1..6 已写入。落点表已填完。术语见 [architecture-notes](../fe-tools-sidecar/architecture-notes.md)。

## 1. 职责（本门要冻的）

| ID | 决策 |
| --- | --- |
| **D-BD-1** | **Packer** = 通用模块打包器：模块标识、图、transform、模块产出。不知道页面、`app.json`、WXML、小程序目录形态 |
| **D-BD-2** | **Scheme** = Dimina 打包方案：工程、车道、产物形状、何时调用 Packer。session / pipeline / watch / dev 属于 Scheme 的编排，不是 Packer |
| **D-BD-3** | 调用方向：Scheme → Packer 允许；Packer → Scheme 禁止 |
| **D-BD-4** | view、style 是 Scheme 的车道，不是 Packer 插件。`compiler/logic/**` 整目录是焊点：对外是 Scheme 调用的 JS 车道，对内的模块图与 transform 是未来 Packer 的胚。本门不拆该目录，也不单列「Packer 客户」 |
| **D-BD-5** | `model/dependency-graph.ts` 是**焊点**。类型通用，但今天的一份实例同时扛 Scheme 工程图（`app` / 页面 / 组件、`view`/`style`/`config` 文件 kind、失效与车道选择）与 JS 模块边（`logic` 的 `import`/`require`）。本门不拆成两张图 |
| **D-BD-6** | 落点粒度只到**目录或文件**。焊点只声明「该路径同时扛两侧」，不声明方法怎么切。方法级拆分留给抽 Packer 的下一门 |

废止：按 `bin/session/pipeline/engines/...` 排上下级并禁止「向上 import」。那张表描述的是今天的抽屉，不是 Packer / Scheme。

## 2. 落点

路径相对 `fe/tools/bundler/src`。全集即下表，不得另加行。`*.d.ts` 类型垫片不入表。

- 每一行是目录（`…/**`）或文件，不是方法。
- 焊点 = 该路径自己同时承担两侧职责。被两侧 import 不改变归属。
- 焊点不展开到函数 / 方法；不在本门决定如何拆文件。

| 落点 | 归属 | 依据 |
| --- | --- | --- |
| `index.ts` | Scheme | 包的公开入口，属于 Scheme 编排 |
| `watch.ts` | Scheme | watch 重导出，不是 Packer |
| `bin/**`、`session/**`、`watch/**`、`dev/**` | Scheme | D-BD-2 |
| `compiler/pipeline/**`（除 `emit.ts`） | Scheme | D-BD-2。编排与目标，不是模块打包器 |
| `compiler/pipeline/emit.ts` | **焊点** | view 的整包产出与 JS 的按模块产出共用一个出口。本门不拆到方法 |
| `compiler/view/**`、`compiler/style/**` | Scheme | D-BD-4 |
| `compiler/logic/**` | **焊点** | D-BD-4。对外是 Scheme 调用的 JS 车道；对内的图与 transform 是未来 Packer 的胚。不拆目录、不拆方法 |
| `compiler/worker-runtime/**` | Scheme | 阶段调度与 worker 池。Packer 不负责「编哪些页」 |
| `compiler/core/env.ts` | **焊点** | Scheme 经总线读工程与车道状态（路径、配置、图、npm）；JS 车道（未来 Packer 客户）也经同一总线读写图与路径。15 个文件扇入。不是任一侧的合法内部。本门不拆 |
| `compiler/core/**`（除 `env.ts`） | Scheme | 兼容、npm、sourcemap、表达式等方案设施。`npm-resolver` 若以后归 Packer，另开决策，本门不新增待定 |
| `shared/**` | Scheme | 路径、配置、进度等工具。被两侧 import 也不标成焊点 |
| `model/**`（除 `dependency-graph.ts`） | Scheme | 工程与产物模型。Store 读 `env` 是焊点用法，不改变 Store 归属 |
| `model/dependency-graph.ts` | **焊点** | D-BD-5。Scheme：工程节点与文件 kind → 失效 / 车道。未来 Packer：`logic` 模块边。一份实例两职，本门不拆 |

## 3. 扫描附录（证据，不是决策）

基线 `31db0c18`。`src` 下 78 个 `.ts`：值 import 169，类型 import 31。`env.ts` 的值 import 来自 15 个文件（model、pipeline、core、三个车道、`define-engine`）。

这条扫描说明总线和环存在。它不授权按目录层禁边。

## 待定

无。D-BD-1..6 均已拍板。旧的「层集合 / pipeline 能否 import 引擎 / session 能否 import index / 同层互引」已废止，不阻塞本门。

## 明确不做的设计

- 不设计 Packer 的 API、插件钩子、context 字段。
- 不决定 `emit.ts`、`logic/**`、`dependency-graph.ts` 怎么拆到方法或拆成多文件。只把它们标成焊点。
