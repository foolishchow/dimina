# Requirements — fe-tools-compiler-layering

Status: **冻结（2026-09-15）** — 与 design v1 / acceptance 对齐；D-CL-1..3 已拍板；改契约须同步三文

## R-CL0（MUST）目录归位

`src/compiler/` 从平铺（14 .js + wxml/，7112 行）迁移到方案 A 两轴结构：

- **轴一编译域**：`view/`（含 wxml / wxs / expression / asset / template 子域）、`logic/`、`style/`
- **轴二基建与编排**：`core/`（env / npm-resolver / npm-builder / sourcemap / compatibility / compatibility-reference / renderers / expression-parser）、`pipeline/`（build-pipeline / compile-target / compile-stages / config-compiler / stage-channel / publish）
- 现有 `wxml/` → `view/wxml/`（域名修正，D-CL-2 前置）
- `expression-parser.js` → `core/`（D-CL-1）
- 编排入口（compileML 等）→ `view/index.js`（D-CL-2）

## R-CL1（MUST）函数穷举迁移

view-compiler.js 61 个函数 + worker 协议按 README 归属表**穷举迁移**，零函数体变更：

- 归属表为唯一权威（7 组：view/index.js 4+协议 / wxml/transform 10 / wxml/backends 工具袋 13 / wxs 13 / expression 20 / asset 1）
- 迁移后 view-compiler.js **消失**（全部函数迁走，不留残余文件）
- 核对方法：迁移前后 `grep -c '^function\|^async function'` = 61

## R-CL2（MUST）纯移动例外（行为 0 保持）

两处必要路径修正（spawn/import **目标不变**，仅路径计算变）：

- **worker spawn 显式映射**：`stage-channel.js` 的 `./${script}-compiler.js` 同目录约定改为 `WORKER_ENTRY` 映射表（view → view/index.js 等）
- **测试 import 更新**：12 个 spec 文件的编译器 import 路径更新到新位置

## R-CL3（MUST）行为 0

- 全量 vitest 绿（559+，含既有全部断言不改）
- `examples/miniprogram/base` nomap + sourcemap 产物 `diff -rq` = 0（纯移动不产生任何产物差异）
- `fe/packages` 零触碰

## R-CL4（MUST）范围切割

- 不改任何函数体逻辑（含 transHtmlTag / normalizeTemplateDom / processWxsContent / stage-channel 协议）
- 不做 wxml 双 parser 改造（TODO 候选，前置 = 本门合入）
- 不做 logic / style / wxs 的 parser/transform 内部细分
- 不向 didi 推送

## Non-requirements

- ctx.dom 抽象 / napi parser（下一 Action）
- worker 协议重构 / worker-pool 改动
- 测试用例逻辑变更（只改 import 路径）
- dist 额外处理（sync-dist 全树镜像自动跟随）