# Implementation Plan — fe-tools-ts-migration

## 步骤表（D-TM-3 分阶段，待拍板）

| ID | 阶段 | 前置 | 验证点 |
| --- | --- | --- | --- |
| P-TM00 | baseline 记录 | — | digest + 584/584 |
| P-TM01 | core/ 8 文件 .js→.ts | P-TM00 | grep 零 .js in core + 4 组 diff=0 |
| P-TM02 | worker-runtime/ 6 文件 | P-TM01 | grep 零 .js in worker-runtime + worker 跑通 |
| P-TM03 | pipeline/ 6 文件 | P-TM02 | grep 零 .js in pipeline + 4 组 diff=0 |
| P-TM04 | view/ + view/wxml/ 14 文件 | P-TM03 | grep 零 .js in view + 4 组 diff=0 |
| P-TM05 | logic/ + style/ 4 文件 | P-TM04 | grep 零 .js in compiler + 4 组 diff=0 |
| P-TM06 | __tests__/ import 后缀（D-TM-2 待拍板）| P-TM05 | vitest 584/584 |
| P-TM07 | 全量验证 | P-TM06 | 4 组 diff=0 + 584/584 + tsc + grep 零 .js |

## P-TM01 — core/ 8 文件

改名 + import 后缀修正：
- env.js → env.ts（被 34 处 import，全改 .ts 后缀）
- compatibility.js / sourcemap.js / renderers.js / expression-parser.js / npm-builder.js / npm-resolver.js / compatibility-reference.js

## P-TM02 — worker-runtime/ 6 文件

- context.ts / runtime.ts / executor.ts / sinks.ts / loggers.ts / define-engine.ts
- worker strip-types 已注入

## P-TM03 — pipeline/ 6 文件

- build-pipeline.ts / compile-stages.ts / config-compiler.ts / emit.ts / publish.ts / stage-channel.ts
- build-pipeline import compile-target.ts（已是 .ts，后缀不变）

## P-TM04 — view/ 14 文件

- index.ts / worker-entry.ts
- wxml/parse.ts / compile.ts / cheerio/parse.ts / napi/parse.ts
- wxml/common/document.ts / document-ops.ts
- wxml/load/index.ts / include.ts / orchestrator-live.ts / paths.ts / template.ts
- wxml/renderer/vue/index.ts / live.ts / state.ts / tools.ts

## P-TM05 — logic/ + style/ 4 文件

- logic/index.ts / worker-entry.ts
- style/index.ts / worker-entry.ts
