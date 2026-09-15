# Requirements — fe-tools-wxml-layout

Status: **冻结（2026-09-15）** — D-WL-1..9 已拍板；随 Action `ready`。

## R-WL0（MUST）目录轴

- `view/wxml/` 按 technical-design §1 落位：`common/`、`napi/`、`cheerio/`、`load/`、`renderer/`、根 `parse.js` + **`compile.js`**。
- 删除（或不再作为权威入口）顶层目录：`parser/`、`transform/`、`backends/`。
- 首刀允许 `napi/parse.js`、`cheerio/parse.js`、`renderer/vue/` 内工具单文件（D-WL-9）。

## R-WL1（MUST）阶段边界不混

- **parse 轴**（napi/cheerio）仅「源串 → Document」。
- **load/** 仅 Document → LoadedGraph 及相关工具（paths / include / template 收集接线）。
- **renderer/** 仅 lowering：registry + stub + `vue/`（含原 vue-tools）。
- 根 **`compile.js`** 仅编排 `parse → load → renderer.render`；不承载展开/降级算法体。

## R-WL2（MUST）行为 0

- 不改编译语义、Document 契约字段、`WXML_PARSER` 默认 `napi`、非法值 `[wxml]` 行为。
- 全量 vitest 通过；相对实施前 HEAD（或等价）产物 code+sourcemap diff=0；默认 napi vs cheerio 对拍仍 diff=0。

## R-WL3（MUST）命名：同门删净

- 新公开 API：`registerWxmlRenderer` / `getWxmlRenderer` / `listWxmlRenderers` / `unregisterWxmlRenderer` / `VUE_RENDERER_ID` / `STUB_RENDERER_ID` / `createStubWxmlRenderer` / `vueWxmlRenderer`（及类型 `WxmlRenderer`）。
- **禁止**保留旧名（含 re-export）：`getBackend` / `registerBackend` / `listBackends` / `unregisterBackend` / `VUE_BACKEND_ID` / `STUB_BACKEND_ID` / `createStubBackend` / `vueBackend` / `WxmlBackend`；`view/index.js`、测例、错误文案、文档字符串同门改完。

## R-WL4（MUST）范围与污染

- 主改动限 `fe/tools/bundler` 的 `view/wxml/`、必要 wiring（`view/index.js`）、相关测例、Action/architecture 文档。
- `fe/packages` 零改动；不迁 wxs/asset/expression；不实现第二 renderer 逻辑。

## R-WL5（MUST）证据与回流

- 消融：破坏目录不变量或错误阶段 import（如 load import cheerio）须可观测失败（Experience §6，能消融则消融）。
- 持久目录不变量回流 `fe-tools-sidecar/architecture-notes.md`。
