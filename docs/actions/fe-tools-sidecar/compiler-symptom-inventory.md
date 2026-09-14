# Compiler 逻辑现状病症清单

Status: **讨论地图（2026-09-14）**  
Authority: 本文件为梳理地图；不授权实施。下一刀决策见 §下一刀。  
Scope: `@dimina/bundler`（`fe/tools/bundler`）在 [`fe-tools-compiler-target`](../_archive/complete/fe-tools-compiler-target/README.md) 交付之后的残余散点。  
**不做**：第二 renderer、真 web target 产品能力、为空而造的 adapter 接口。

## 已收口（不当作开放病症）

- CompileTarget：`createCompileTarget` / `readLoadBindings` / `deriveStagePlan`
- Session unify、BuildPipeline、ProjectStore PS1+PS2
- A4 webview registry、CF-1/CF-2 platform 枚举
- 管线内联 `MODE_PRESETS` / `sourcemapStrategyFor` / renderer 字符串反查（T1/T2 已清）

## 主链路（残余耦合落点）

```text
watch-plan options bag ──┐
compile-cache options bag ┼─→ build() → CompileTarget → deriveStagePlan
session PIPELINE_OPTION_KEYS ─┘              │
                                             ▼
                                    Listr + createStageTask → workers → vue/cheerio
```

## 病症表

| ID | 锚点 | 病症 | 层 | 严重度 | 已知 deferred |
| --- | --- | --- | --- | --- | --- |
| **S1** | `watch/watch-plan.js` ~128–138 → `watch/watch-runner.js` spread `plan.options` | rebuild 用 `{stages, affectedEntries, seedPath, prepare*}` 回灌，管线再派生，而非消费 CompileTarget/StagePlan | watch 回灌 | high | **E7** |
| **S2** | `session/runner.js` `PIPELINE_OPTION_KEYS`；`dev/dev-reload.js` 同袋 | session 把 E7 options 袋白名单化，锁成跨层契约 | session | high | **E7** |
| **S3** | `model/compile-cache.js` + `bin/compile.js` + `compiler/compile-stages.js` | 批量缓存路径另产同形 `options`；与 watch 的 stage 选择双套词汇 | CLI / model | med | E7 同形 |
| **S4** | `COMPILE_STAGE_ORDER` 三处（compile-target / compile-stages / invalidation） | 阶段序/集合三份拷贝 | 形态 / watch | med | E7 邻 |
| **S5** | `compiler/build-pipeline.js` Listr 树 | 阶段语义与进度 UI 同图 | 阶段组装 | high | **Listr/BP2** |
| **S6** | `compiler/stage-channel.js` | worker API 绑 Listr `task`/`ctx`，难脱离 UI 单测 | worker | high | **Listr/BP2** |
| **S7** | build-pipeline 模块级 register + `createStageTask` view/style 分支 | webview 适配注册与 stage 派发仍糊在 pipeline | 阶段组装 | med | A4 残 |
| **S8** | build-pipeline init：`seedPath`/`prepare*` + CONFIG_COLLECTED 仍 `getPages`/`isMiniGame` | T2 只收了编译组装侧；init 生命周期读取仍散 | 阶段组装 | med | — |
| **S9** | build-pipeline `filterPagesByEntries` | `affectedEntries` 过滤在 pipeline，不在 deriveStagePlan | 组装 / E7 | med | **E7** |
| **S10** | `sourcemapStrategy` 写入 CompileTarget 后无 worker 读者 | platform 轴描述性、无下游 | 形态 | med | **真 web** |
| **S11** | session resolve + createCompileTarget 双调 `resolveCompileConfig` | E1 by design；仍是双入口心智负担 | session/形态 | low | E1 成文 |
| **S12** | `COMPILE_KEYS` / `CONFIG_OPTION_KEYS` 拷贝 | C1 键表未单源 | shared/session | low | — |
| **S13** | `view-compiler.js` / `style-compiler.js` | parse→vue/cheerio 熔断，无 IR 缝 | 模板 | high | **TS-2** |
| **S14** | stage-channel 载荷无 renderer/platform | worker 恒走 webview/vue | worker/模板 | med | TS-2 |
| **S15** | logic/view 内 `isMiniGame`；esbuild `platform:'browser'` | 与 CF-2 native/web 名碰撞、正交未表达 | worker | low | TS-2/web |
| **S16** | pipeline 模块级 `isPrinted` / compat Map | 跨 run 状态落在模块闭包 | 组装 | low | — |

## 按文件索引

| 区域 | IDs |
| --- | --- |
| watch | S1, S4 |
| session | S2, S11, S12 |
| model / bin | S3, S4 |
| compile-target | S4, S10, S11 |
| build-pipeline | S5, S7, S8, S9, S16 |
| stage-channel / \*-compiler | S6, S13–S15 |

## 与「adapter」说法的对齐

目标是**梳理逻辑**；模板 IR 路径额外以「能换 Backend」为硬验收（见 fe-tools-wxml-ir）：

- **优先 / 并列**：E7 簇（S1/S2/S3/S9）— [`fe-tools-incremental-target`](../fe-tools-incremental-target/README.md)（`draft`）；TS-2（S13）— [`fe-tools-wxml-ir`](../fe-tools-wxml-ir/README.md)（**`ready`**；S14 非目标）
- **其次**：Listr 与阶段语义拆缝（S5/S6）— 可测性
- **勿单独做**：为 platform/renderer 造空 adapter；S10 说明 platform 轴还没有真消费者

## 下一刀（2026-09-14）

| 项 | 值 |
| --- | --- |
| 选定（增量） | **E7** — [`fe-tools-incremental-target`](../fe-tools-incremental-target/README.md)（`draft`） |
| 并列（模板） | **TS-2 / S13** — [`fe-tools-wxml-ir`](../fe-tools-wxml-ir/README.md)（**`ready`**；未授权实施） |
| 另立 | Listr/BP2（S5/S6） |

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿：S1–S16；选定 E7 为下一刀；链到 `fe-tools-incremental-target` |
| 2026-09-14 | 并列 TS-2/`fe-tools-wxml-ir`；S14 明确非 wxml-ir 目标；叙事改为「梳理 + 能换 Backend」 |
