# Implementation plan — fe-tools-compiler-layering

Status: **ready（2026-09-15）** — D-CL + R1/R2 review 已收敛；升 `in_progress` 时记基线 SHA；唯一门 L0

## L0 触达序（目录归位 · 行为 0）

| Step | 动作 | 文件 |
| --- | --- | --- |
| 1 | **域目录创建 + 整文件迁移**（git mv，内容零变更） | `wxml/` → `view/wxml/`；`view-compiler.js` → `view/index.js`；`logic-compiler.js` → `logic/index.js`；`style-compiler.js` → `style/index.js`；`env.js` / `sourcemap.js` / `compatibility.js` / `compatibility-reference.js` / `renderers.js` / `expression-parser.js` / `npm-resolver.js` / `npm-builder.js` → `core/`；`build-pipeline.js` / `compile-target.js` / `compile-stages.js` / `config-compiler.js` / `stage-channel.js` / `publish.js` → `pipeline/` |
| 2 | **view/index.js 函数级拆散**（按归属表穷举，函数体逐字不变） | 编排 4 函数 + worker 协议留 index.js；wxml/transform 10 函数；wxml/backends 工具袋 13 函数；wxs 13 函数；expression 20 函数；asset 1 函数 → 各子域文件 |
| 3 | **WORKER_ENTRY 映射** | `pipeline/stage-channel.js` 的 `./${script}-compiler.js` → 显式 map |
| 4 | **import 更新** | src 内 ~15 文件 + `__tests__/` 12 spec |
| 5 | **验证** | `grep -c '^function'` 新旧对照 = 61；全量 vitest；dist sync → code/sourcemap diff=0 |

## 不做（本 Action）

- ctx.dom / napi parser（TODO 候选）
- 函数体任何变更
- worker 协议重构
- 测试逻辑变更（只改 import）

## 验证

升 `in_progress` 时记基线 SHA → [validation.md](validation.md) P-CL00..（Result 届时回填）