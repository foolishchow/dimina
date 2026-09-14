# Acceptance — fe-tools-wxml-ir

Status: **实施完成（2026-09-14）— A-WIR0..9 全 pass；证据见 validation Actual**

| ID | Requirement | Observable condition | Planned evidence | Status |
| --- | --- | --- | --- | --- |
| A-WIR0 | R-WIR0 | 存在 Document parse API；测例覆盖特殊节点分类 | P-WIR01 | **pass** — parseWxml/Document 可单测（wxml-ir.spec 25 用例；特殊节点/分型/loc） |
| A-WIR1 | R-WIR1 | parse 测例中 import/include/wxs 仍为节点；展开仅在 load；cheerio 非产物权威 | P-WIR01 / P-WIR07 | **pass** — parse 零读盘/零展开（测例）；include/import 展开与 wxs 编译在 load（transTagWxs→processWxsContent）；backend 消费 LoadedGraph 投影（非原始串）；cheerio 仅投影（PARSE_OPTIONS） |
| A-WIR2 | R-WIR2 | `registerBackend` 可挂 ≥2（vue + stub）；同 id 抛错；生产默认仅 vue | P-WIR01 / P-WIR06 | **pass** — registry：register/get/unregister/list + 同 id 抛错；vue（backend₀，view-compiler 模块注册）+ stub 测例；生产仅 vue |
| A-WIR3 | R-WIR3 | 全量 vitest 绿；base nomap+sourcemap `diff -rq` = 0 | P-WIR01 / P-WIR02 | **pass** — 550/550（76 suites，+25）；base nomap+sourcemap 严格 diff=0（P-WIR02 实测） |
| A-WIR4 | R-WIR4 | `compiler/wxml` 无 `platform ===` | P-WIR03 | **pass** — wxml/** 六文件无 `platform ===`（P-WIR03 + 结构锚定测试） |
| A-WIR5 | R-WIR5 | diff 无 E7/Listr/PS3/S14；实现为 JS | P-WIR04 | **pass** — diff 限 wxml/** + view-compiler + spec；纯 JS；无 E7/Listr/PS3/S14；fe/packages 无私有 diff |
| A-WIR6 | R-WIR6 | 关键节点 `loc: { start, end }`；sourcemap 对拍；无猜行权威路径 | P-WIR02 / P-WIR05 / P-WIR06 | **pass** — loc 半开（JS string 索引，offset 语义自证用例）；sourceTexts 可追溯；sourcemap diff=0（质量=今日） |
| A-WIR7 | R-WIR7 | parse 为投影；Value `kind` 三态且 expr 为字符串（或审查锚定） | P-WIR01 + 审查 | **pass** — parse 为投影（D-WIR-6）；valueKind 三态且 expr 字符串体（用例锁定） |
| A-WIR8 | R-WIR8 | 归属表与实现一致（抽样：展开 / Wxs 编译 / Vue 降级） | P-WIR07 | **pass** — 展开在 load.js（逐行转录今日序列）；Wxs 编译经 transTagWxs（load）；Vue 降级在 backends/vue.js；过渡注记两处（component-host 源级包装留壳 / compileTemplate 留打包壳——模块落点图注释） |
| A-WIR9 | R-WIR9 | 错误路径可见 `[wxml]` + sourceFile/loc（抽样或测例） | P-WIR07 | **pass** — parse/load/registry/vue 失败路径 [wxml] + sourceFile/loc（用例锁定：parse 非串、include 读盘失败、ctx 缺失、backend 缺句柄/工具） |
