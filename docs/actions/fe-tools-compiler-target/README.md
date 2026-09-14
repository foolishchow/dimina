# FE Tools Compiler Target

- Action: `fe-tools-compiler-target`
- Status: `ready`
- Updated: 2026-09-14（D-CT-0..5 拍板；Readiness 五件套成稿；升 ready）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-session-unify`](../_archive/complete/fe-tools-session-unify/README.md)（S1+S2 已归档；其 README 预告本方向为正交 Action）；[`fe-tools-build-pipeline`](../_archive/complete/fe-tools-build-pipeline/README.md)（BP1 已归档；阶段表抽取、Listr 保留）；上游 A4 renderer 抽象边界（`src/compiler/renderers.js` 头注）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

「编译成什么」的**产物形态**（mode / platform / renderer / 启用阶段 / sourcemap 策略 / 产物路径形态）没有单一权威描述，散落在管线阶段组装的闭包里。Source audit 实锚（`src/compiler/build-pipeline.js` 332 行 + 相关模块）：

| # | 病症 | 代码实锚 |
| --- | --- | --- |
| **E1** | **双重解析**：`resolveCompileConfig` 在 session 层（`resolveBundlerConfig`，带 command seeds）与管线层（`_runBuild` 内 `resolveCompileConfig({ apiOptions: runOptions })`）各跑一次 | `session/resolve.js:81` 注释自认 "idempotent…harmless"；直调 `build()` 路径（compile.js 批量、watch-runner rebuild）依赖管线侧自洽。**讨论修正（待定 ④）：同一纯函数、两合法路径，by design 非病症——处置为成文不变量** |
| **E2** | **renderer 以字符串穿参**：`resolveProjectRenderers(workPath)` 读 app.json（文件层）→ `activeRenderer.name` 作为 string 传进 view/style stage → `createStageTask` 内再 `getRenderer(renderer)` 反查 | `build-pipeline.js:90-95, 175-201, 272` |
| **E3** | **阶段启用逻辑三处纠缠**：`enabledStages`（stages 选项）、`!miniGame` 内联条件（view/style 被 mini-game 灭）、`seedPath`-依赖的 `shouldPrepareConfig/Npm`——散在阶段组装处 | `build-pipeline.js:107-110, 175, 199, 116-117` |
| **E4** | **sourcemapTargetPath 内联计算**：logic 阶段的 `path.resolve(process.cwd(), targetPath, useAppIdDir ? getAppId() : '')` 在闭包里现算 | `build-pipeline.js:185-190` |
| **E5** | **workerOptions 三捆手工组装**：view / logic / style 各自内联拼 `{sourcemap, compileConfig, renderer?, pages?, sourcemapTargetPath?}`，部分重叠无单源 | `build-pipeline.js:175-213` |
| **E6** | **形态派生劈成两半**：静态段（run 前：C1/renderer/stages 白名单）与动态段（config 收集后：`isMiniGame()/getAppId()/getPages()` 读 ALS env）——阶段闭包执行时才取动态值 | `env.js:338,688,707`；`build-pipeline.js` 闭包时序 |
| **E7** | **watch-plan 形态耦合**：rebuild 的 `plan.options` 携带 `{stages, affectedEntries}` 回灌 build()，管线侧再重派生 enabledStages | `watch-plan.js:131`；`compile-stages.js` |
| **E8** | **入口组合不对称**：dev 侧有 D-R2/C 组合校验（dev ⇒ web），build 侧无对偶——`build --platform web` 是**无消费者的假自由度**（产物与 native 字节等价；platform 轴唯一派生 `sourcemapStrategy` 注记无下游读者） | `resolve.js:101-117`（assertDevCompileCompatible 单侧）；`platforms.js:42-43`；CLI `--platform` 帮助文本 |

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
- 不动 session 层（session-unify 已交付；本门在其下方正交——**T0 的 resolve 对偶断言为唯一 session 层触碰**）

## 边界（与已完成工作正交）

```text
session-unify（已归档）: 会话/调度层「怎么编译」—— 三入口内核 + loop 收口
本 Action:               形态层「编译成什么」—— target 描述 + 阶段派生
TS-2（deferred）:        模板管线 parse/IR/webview —— 再激活条件不变
```

## 产品门（已冻结 · T0 前置 + T1/T2 两门）

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **T0** 组合校验（前置小门 · **行为变更**） | resolve 层对偶断言：`command:'build'` ⇒ `platform:'native'`，否则结构化报错（镜像 D-R2/C 风格，对齐 A4“不静默”哲学）；CLI help 同步；**不坍缩描述模型**（`sourcemapStrategyFor` web 分支保留） | 报错用例锁定（build+web 拒绝 / dev+native 维持 D-R2/C 消息不变）；现有 `/D-R2\/C/` 测试不破；直调 `build({platform:'web'})` 编程路径自由度不变 |
| **T1** 描述抽取（静态段） | CompileTarget 对象 + 派生函数（enabledStages / renderer / per-stage workerOptions / sourcemapTargetPath）；管线改道消费 | 行为 0（diff=0 + 测试全绿 + lifecycle 序列不变）；结构判据（E2/E4/E5 的散点不再出现于阶段组装处，grep 级锚定） |
| **T2** 动态段 + 收敛 | mini-game / appId / pages 的两段性表达；E1 成文不变量 | 同上 + 消融 |

消融：拔描述回落内联散算 → 结构锚定失败（沿用 session-unify P-SU07 模式）。

## 已确认设计输入（引用，不重定）

- A4 renderer 抽象（renderers.js）：仅 webview、结构化报错、无覆盖——本门在其上收敛，不破其边界
- CF-1（resolveCompileConfig 唯一 C1 语义源）、CF-2（platform native/web）
- M-A / RR4（store 注入链）、L3（无 session 直调 build() 门面——**E1 管线侧解析必须保留**的根因）
- 结构判据纪律（session-unify 已立）：模式名只作词汇，验收以病症反向要求表达
- **入口纪律 ≠ 描述模型坍缩**（2026-09-14 讨论）：组合校验收严的是**用户可见入口**（resolve 层 fail-fast）；CompileTarget 仍为全轴描述，web 分支保留——未来真 web target 是显式重开新能力，非恢复假能力（与 TS-2 延迟纪律同源）

## Status / 授权

- 当前 **`ready`**（2026-09-14）：source audit（E1–E8）+ 组合矩阵讨论 + Readiness 五件套完成；Review 未开展；**未授权实施**。
- **D-CT-0..5 已拍板（2026-09-14，全部照建议）**，见 [design.draft](design.draft.md) §决策记录。
- 升 `in_progress` 需明确授权（届时记基线 SHA，随门递进）。

## 决策记录（已拍板 · 2026-09-14，全部照建议）

| # | 决策点 | 拍板结论 |
| --- | --- | --- |
| **⓪** | build+web 组合处置（E8） | **T0 独立小门**（唯一非行为 0 门）：resolve 对偶断言 + 结构化报错 + CLI help 同步 + 测试锁定；不坍缩 CompileTarget；compile-config 自由度保留 |
| **①** | 门切分 | 三门 T0（前置）/ T1（静态）/ T2（动态），各自 PR |
| **②** | 落点/对象名 | `src/compiler/compile-target.js`；对象名 `CompileTarget`（禁缩写 `target`） |
| **③** | 两段性表达（E6） | 三步显式 API：`createCompileTarget` → `readLoadBindings` → `deriveStagePlan`（纯函数、无突变） |
| **④** | E1 双重解析处置 | 不改代码：成文不变量 + 结构判据 |
| **⑤** | Action 名 | `fe-tools-compiler-target` 转正 |

## 闭合条件

- **三门交付**：T0 + T1 + T2 均完成，A-CT0..06 全 pass，证据回填 acceptance / validation；
- **消融在档**：P-CT08 消融 ×3（T0 拔断言 / T1 拔 create / T2 拔 derive）完成且失败点落在对应断言；
- **行为 0 证据**：全量 vitest 绿 + T1/T2 各基线 nomap/sourcemap diff=0（基线随门递进，P-CT02）；T0 行为变更按验收锁定；
- **持久发现回流**：target 形态单源化 + 「形态条件单源于 compile-target」结构不变量入档（写回 session-unify 已回流的 architecture-notes 或新建段）；
- **一致变更**：STATUS / README / 归档位置随 `complete` 一次同步（→ `_archive/complete/`）；
- **范围守恒**：非目标项（真 web target / renderer 扩展 / Listr / TS-2）确认维持，不新开范围。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-14 | 初稿：source audit（E1–E7 实锚）；产品门草案；5 项待定 |
| 2026-09-14 | 组合矩阵讨论：新增 **E8**（build 侧假自由度）与 **T0 门**（入口收严、模型不坍缩）；E1 定性修正（by design，处置改为成文不变量）；①–⑤ 建议方案入档待拍板 |
| 2026-09-14 | **D-CT-0..5 全部拍板**（照建议）；Readiness 五件套（requirements/design/plan/acceptance/validation）成稿；升 **`ready`**；闭合条件入档；STATUS 同步 |
| 2026-09-14 | Review（Readiness 门 `fail`，健康态）F1–F4 修正：`readLoadBindings` 收窄为**阶段组装侧唯一读取点**（worker/编译器内部读取显式划出范围）；结构锚定范围定界（`'编译项目'` 闭包内 + BUILD_END appId 经 bindings）；`deriveStagePlan` cwd 显式入参；T0 与 compile-config.spec 直测关系明示 |
