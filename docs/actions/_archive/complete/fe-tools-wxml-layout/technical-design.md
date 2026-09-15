# Technical Design — fe-tools-wxml-layout

Status: **冻结 v1（2026-09-15）** — D-WL-1..9；与 requirements / plan / acceptance 同步。

## 1. 目标树（权威）

```text
fe/tools/bundler/src/compiler/view/wxml/
│
├── parse.js                 # 对外稳定入口：开关 + re-export
├── compile.js               # toCompileTemplate 编排（parse→load→renderer）
│
├── common/
│   ├── document.js
│   ├── document-ops.js
│   └── parity.js
│
├── napi/
│   └── parse.js             # SpanView → Document（D-WL-9：首刀单文件 OK）
│
├── cheerio/
│   └── parse.js             # cheerio 投影 → Document（首刀单文件 OK）
│
├── load/
│   ├── index.js             # 今 load.js
│   ├── paths.js
│   ├── include.js           # processIncludeConditionalAttrs / collectIncluded…
│   ├── template.js          # transTagTemplate
│   └── orchestrator-live.js # bind transTagWxs / transAsses
│
└── renderer/                # ≠ 平台 app.json.renderer
    ├── registry.js          # registerWxmlRenderer / getWxmlRenderer / listWxmlRenderers
    ├── stub.js
    └── vue/
        ├── index.js         # .render + lineOrigins（今 backends/vue.js）
        └── tools.js         # 首刀：原 vue-tools 整袋（D-WL-9 允许单文件）
            # 可选细拆（非本门 MUST）：normalize.js / emit.js / compile-options.js / live.js / state.js
```

**删除权威入口：** `parser/`、`transform/`、`backends/`（搬迁完成后不得再被生产路径 import；旧 Backend 符号名同门删净，D-WL-6）。

## 2. 阶段与目录对应

```text
源串
  ├─ napi/parse.js ──────┐
  └─ cheerio/parse.js ───┴─► common/document(+ops)
                                    │
                                    ▼
                              load/index.js
                         (+ include|template|paths)
                                    │
                                    ▼
                              LoadedGraph
                                    │
                              compile.js
                                    │
                                    ▼
                         renderer/vue/index.js
                      (+ tools: normalize / emit)
                                    │
                                    ▼
                           Vue 模板串 + meta
```

| 目录 | 输入 | 输出 | 目标相关？ |
| --- | --- | --- | --- |
| `napi/` `cheerio/` | 源串 | Document | parse 引擎 |
| `common/` | — | 契约/操作面 | 否 |
| `load/` | Document | LoadedGraph | 否（应保持） |
| `compile.js` | 模块元数据 | 编排结果 | 否 |
| `renderer/vue/` | LoadedGraph | 模板串 | **是（Vue）** |

**不为「通用 IR transform」建目录**（D-WL-8）。若未来纯化，另立 `passes/` 或等价，不塞进 load/renderer。

## 3. 文件映射（现状 → 目标）

| 现状 | 目标 |
| --- | --- |
| `parser/index.js` | 并入 `parse.js` |
| `parser/napi.js` | `napi/parse.js` |
| `parser/cheerio.js` | `cheerio/parse.js` |
| `parser/parity.js` | `common/parity.js` |
| `document.js` / `document-ops.js` | `common/` |
| `load.js` | `load/index.js` |
| `transform/paths.js` | `load/paths.js` |
| `transform/index.js` 中 load 工具 | `load/include.js` / `load/template.js` |
| `transform/index.js` → `toCompileTemplate` | **`compile.js`** |
| `transform/orchestrator-live.js` | `load/orchestrator-live.js` |
| `backends/vue.js` | `renderer/vue/index.js` |
| `backends/vue-tools.js` + live/state | 首刀：`renderer/vue/tools.js`（可内联 live/state）；细拆非 MUST |
| `backends/registry.js` / `stub.js` | `renderer/` |

## 4. API 命名（D-WL-6 · 同门删净）

| 新名 | 旧名（删除，无 re-export） |
| --- | --- |
| `registerWxmlRenderer` | `registerBackend` |
| `unregisterWxmlRenderer` | `unregisterBackend` |
| `getWxmlRenderer` | `getBackend` |
| `listWxmlRenderers` | `listBackends` |
| `VUE_RENDERER_ID` | `VUE_BACKEND_ID` |
| `STUB_RENDERER_ID` | `STUB_BACKEND_ID` |
| `createStubWxmlRenderer` | `createStubBackend` |
| `vueWxmlRenderer` | `vueBackend` |
| `WxmlRenderer`（类型/接口名） | `WxmlBackend` |

`view/index.js`、全部测例、注释/错误文案中的 Backend 用语随迁更新。错误消息前缀可从 `registerBackend:` 改为 `registerWxmlRenderer:`（测例断言同步）。`meta.backend` 等产物字段若属公开字节契约，本门保持字段名不变（行为 0）；仅改 JS 符号与文案。

## 5. 行为 0 纪律

- 函数体语义不变；允许因路径/导出改写的 import 行与符号改名。
- `vue-tools` 若保持单文件：仅搬迁+改名；拆多文件不阻塞本门。
- 测例中硬编码路径（如 `view/wxml/transform/...`）随搬迁更新。

## Residual

目录整理不改变「行为 0 锚定当前 Vue 降级产物」的 Residual（见 wxml-refactor）。
