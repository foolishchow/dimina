# FE Tools Compiler Target

- Action: `fe-tools-compiler-target`（暂名，转正见待定 ⑤）
- Status: `draft`
- Updated: 2026-09-14（source audit 完成后初稿；边界讨论中）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-session-unify`](../_archive/complete/fe-tools-session-unify/README.md)（S1+S2 已归档；其 README 预告本方向为正交 Action）；[`fe-tools-build-pipeline`](../_archive/complete/fe-tools-build-pipeline/README.md)（BP1 已归档；阶段表抽取、Listr 保留）；上游 A4 renderer 抽象边界（`src/compiler/renderers.js` 头注）
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

「编译成什么」的**产物形态**（mode / platform / renderer / 启用阶段 / sourcemap 策略 / 产物路径形态）没有单一权威描述，散落在管线阶段组装的闭包里。Source audit 实锚（`src/compiler/build-pipeline.js` 332 行 + 相关模块）：

| # | 病症 | 代码实锚 |
| --- | --- | --- |
| **E1** | **双重解析**：`resolveCompileConfig` 在 session 层（`resolveBundlerConfig`，带 command seeds）与管线层（`_runBuild` 内 `resolveCompileConfig({ apiOptions: runOptions })`）各跑一次 | `session/resolve.js:81` 注释自认 "idempotent…harmless"；直调 `build()` 路径（compile.js 批量、watch-runner rebuild）依赖管线侧自洽 |
| **E2** | **renderer 以字符串穿参**：`resolveProjectRenderers(workPath)` 读 app.json（文件层）→ `activeRenderer.name` 作为 string 传进 view/style stage → `createStageTask` 内再 `getRenderer(renderer)` 反查 | `build-pipeline.js:90-95, 175-201, 272` |
| **E3** | **阶段启用逻辑三处纠缠**：`enabledStages`（stages 选项）、`!miniGame` 内联条件（view/style 被 mini-game 灭）、`seedPath`-依赖的 `shouldPrepareConfig/Npm`——散在阶段组装处 | `build-pipeline.js:107-110, 175, 199, 116-117` |
| **E4** | **sourcemapTargetPath 内联计算**：logic 阶段的 `path.resolve(process.cwd(), targetPath, useAppIdDir ? getAppId() : '')` 在闭包里现算 | `build-pipeline.js:185-190` |
| **E5** | **workerOptions 三捆手工组装**：view / logic / style 各自内联拼 `{sourcemap, compileConfig, renderer?, pages?, sourcemapTargetPath?}`，部分重叠无单源 | `build-pipeline.js:175-213` |
| **E6** | **形态派生劈成两半**：静态段（run 前：C1/renderer/stages 白名单）与动态段（config 收集后：`isMiniGame()/getAppId()/getPages()` 读 ALS env）——阶段闭包执行时才取动态值 | `env.js:338,688,707`；`build-pipeline.js` 闭包时序 |
| **E7** | **watch-plan 形态耦合**：rebuild 的 `plan.options` 携带 `{stages, affectedEntries}` 回灌 build()，管线侧再重派生 enabledStages | `watch-plan.js:131`；`compile-stages.js` |

**痛点**：新增一个形态轴（第二个 renderer、新平台、publish 变体）要在闭包丛林里改 N 处条件；session-unify 治的是「怎么编译」（会话/调度层），本门治「编译成什么」（形态层）——两轴正交，session-unify README 已预告。

## Goal

1. 抽出**单一显式的编译目标描述**（暂名 CompileTarget/TargetSpec）：一次性承载 mode / platform / renderer（已验证）/ 启用阶段（含 mini-game 过滤语义）/ sourcemap 策略 / esTarget / 产物路径形态
2. 管线阶段组装从描述**派生**：workerOptions / stage 启用 / sourcemapTargetPath 不再内联散算
3. **行为 0**：产物字节等价、CLI 输出、lifecycle 事件序列、公开 API 全不变

## Non-goals

- 不新增 renderer（仍仅 webview；A4 抽象边界不动）
- 不加 CLI / API 的 renderer 覆盖能力（无第二 renderer，无切换需求——同 TS-2 延迟纪律）
- 不剥 Listr（渲染即用户可见输出，非行为 0；留待 CI 消费方出现）
- 不做 TS-2 模板 IR（deferred 保持）
- 不改公开 API / `build()` 门面 / watch-runner 内部（除接线必需）
- 不动 session 层（session-unify 已交付；本门在其下方正交）

## 边界（与已完成工作正交）

```text
session-unify（已归档）: 会话/调度层「怎么编译」—— 三入口内核 + loop 收口
本 Action:               形态层「编译成什么」—— target 描述 + 阶段派生
TS-2（deferred）:        模板管线 parse/IR/webview —— 再激活条件不变
```

## 产品门（草案，切分见待定 ①）

| 门 | 内容 | 验收判据（草案） |
| --- | --- | --- |
| **T1** 描述抽取（静态段） | CompileTarget 对象 + 派生函数（enabledStages / renderer / per-stage workerOptions / sourcemapTargetPath）；管线改道消费 | 行为 0（diff=0 + 测试全绿 + lifecycle 序列不变）；结构判据（E2/E4/E5 的散点不再出现于阶段组装处，grep 级锚定） |
| **T2** 动态段 + 收敛（若两门） | mini-game / appId / pages 的两段性表达；E1 双重解析处置 | 同上 + 消融 |

消融：拔描述回落内联散算 → 结构锚定失败（沿用 session-unify P-SU07 模式）。

## 已确认设计输入（引用，不重定）

- A4 renderer 抽象（renderers.js）：仅 webview、结构化报错、无覆盖——本门在其上收敛，不破其边界
- CF-1（resolveCompileConfig 唯一 C1 语义源）、CF-2（platform native/web）
- M-A / RR4（store 注入链）、L3（无 session 直调 build() 门面——**E1 管线侧解析必须保留**的根因）
- 结构判据纪律（session-unify 已立）：模式名只作词汇，验收以病症反向要求表达

## Status / 授权

- 当前 **`draft`**：source audit 完成，边界讨论中；**未授权实施**
- 升 `ready` 前需拍板 5 项待定并补 Readiness 文档（requirements / design / plan / acceptance / validation）

## 待定（Readiness 前需确认）

1. **门切分**：单门（332 行文件，规模可能一步到位）vs 两门（T1 静态 / T2 动态——对齐 S1/S2 先例）
2. **落点与命名**：`src/compiler/compile-target.js`（建议，P1 先例）vs 扩展 renderers.js vs shared/
3. **两段性设计**（核心难点，E6）：静态段 + 动态段的表达——一个对象两段补全（`completeWith(env)`）vs 两个显式对象（StaticTarget + LoadBindings）；动态段的取值时机必须保持在 collect-config 之后（ALS 时序不可提前）
4. **E1 双重解析处置**：最小案（两层各自保留，描述只在管线侧建——直调路径自洽）vs 收敛案（session 侧透传已解析 compile 进 options——触碰 RR 边界，需评估直调/watch-rebuild 等价性）
5. **Action 名转正**：`fe-tools-compiler-target` 或改名（如 `fe-tools-compile-target`），一次定死

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿：source audit（E1–E7 实锚）；产品门草案；5 项待定 |
