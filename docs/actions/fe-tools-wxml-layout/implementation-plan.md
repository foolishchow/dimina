# Implementation Plan — fe-tools-wxml-layout

Status: **`in_progress`（L0–L2 已交付，待 Close）**

## 基线与纪律

- 实施起点 HEAD：`0074396c`（validation Actual）；`fe/packages` 零触碰。
- **行为 0**：`git mv` + import + 符号改名（D-WL-6 删净旧 Backend 名）；不改算法体。
- 首刀允许 `napi`/`cheerio`/`renderer/vue/tools` 单文件（D-WL-9）。
- 与 `fe-tools-incremental-target` 分 PR（Experience §8）。

## 建议顺序

1. **common/**：搬 `document.js` / `document-ops.js` / `parity.js`；更新 import。 ✅
2. **napi/ + cheerio/**：搬 parse 实现；根 `parse.js` 收开关；删 `parser/` 权威入口。 ✅
3. **load/**：搬 `load.js` + paths + include/template 工具 + orchestrator-live；从原 `transform/` 抽出非编排符号。 ✅
4. **compile.js**：迁 `toCompileTemplate`；删顶层 `transform/`。 ✅
5. **renderer/**：registry/stub + `vue/{index,tools,live,state}.js`；按 §4 全库替换；删 `backends/`。 ✅
6. **测例 + sync-dist + 全量 vitest + 产物对拍**。 ✅
7. **回流** architecture-notes；回填 acceptance/validation。 ✅

## 门禁

| 门 | Gate | Result |
| --- | --- | --- |
| L0 | 树对照 §1；无生产路径 import 旧目录；无旧 Backend 符号残留 | **pass** |
| L1 | P-WL05 绿 + P-WL06 diff=0 | **pass**（580/580；nomap/sm + napi↔cheerio diff=0） |
| L2 | architecture-notes 已更新 | **pass** |
