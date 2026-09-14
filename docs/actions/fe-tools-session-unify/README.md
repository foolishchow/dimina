# FE Tools Session Unify

- Action: `fe-tools-session-unify`
- Status: `in_progress`
- Updated: 2026-09-14（S1 实施已授权开工；基线 SHA 记于 validation.md）
- Status authority: [Action Status](../STATUS.md)
- 前置上下文：[`fe-tools-bundler-session`](../_archive/complete/fe-tools-bundler-session/README.md)（O1–O3 已归档 complete）；[`fe-tools-project-store`](../_archive/complete/fe-tools-project-store/README.md)（PS1+PS2 已归档）；[`fe-tools-build-pipeline`](../_archive/complete/fe-tools-build-pipeline/README.md)（BP1 已归档）；调度设计：[session-scheduling.draft.md](../fe-tools-sidecar/session-scheduling.draft.md)（L1–L4 / W1–W4 已确认）
- 文档集：[requirements](requirements.md) · [design.draft](design.draft.md) · [implementation-plan](implementation-plan.md) · [acceptance](acceptance.md) · [validation](validation.md)
- 工作分支：`feature/fe-tools-sidecar`

## 问题陈述

`session`（`src/session/index.js`，342 行）的公开面是三个独立方法：

| 方法 | 实现 | 差异点 |
| --- | --- | --- |
| `.build()` | 直接调 `build()` 门面，注入 store+lifecycle | one-shot；`assertNoActiveLoop` |
| `.watch()` | 调 `createBuildWatcher`，注入 store+lifecycle | 长活；`assertCanStartLoop`；返回 handle{start,listen,stop}；activeLoop 占用/释放 |
| `.dev()` | `session.watch()` + preview adapter + lifecycle 挂载 | 长活+preview；`assertCanStartLoop`；startup rollback（R7）；close 组装 |

三者**共用部件**（`state.store`、`state.lifecycle`、`state.compile`/`state.fileTypes`、`splitBuildOverrides` 白名单、`resolveBundlerConfig`），但**实现为三套分叉入口**——各自的 activeLoop 断言、错误路径、返回值、lifecycle 挂载逻辑。

**痛点**：新增一个执行入口（如 target 方向的 build 变体）就要复制第三套；调度语义（谁占 activeLoop、错误如何传播、lifecycle 何时挂）散在三个方法里。调度设计（L1–L4/W1–W4）已冻结但落地是"分叉"状态——设计同构、实现未同构。

**代码实锚（分叉病症）**：`.dev()` 经 `session.watch()` 委托导致 dev 运行期间 `state.activeLoop === 'watch'`（非 `'dev'`）——分叉实现的可见伪影，本门按行为 0 约束保留（D-SU-4）。

## Goal

1. 抽出三入口的**公共执行内核**——统一承载 options 组装与 one-shot 编译调用（仅 `.build`；watch/dev 消费组装产物；分工细则见产品门 S1/S2），公开方法降为薄壳
2. **公开 API 零变化**（`.build()`/`.watch()`/`.dev()` 签名与 O1–O3 契约保持）——行为 0
3. **调度语义收口**：activeLoop 占用/释放、错误传播、lifecycle 挂载统一进内核（对齐已冻结的 L1–L4 / W1–W4）

## Non-goals

- 不改公开 API 形状（不 supersede bundler-session 的 O1–O3 契约）
- **不做 compiler target 方向**（产物形态切面）——独立 Action，见讨论
- 不做 PS3（增量装载 applyChanges / subscribe）——deferred 保持
- 不做 TS-2（模板 IR）——deferred 保持
- 不改调度决策本身（L1–L4/W1–W4/R1–R7 已确认，本门只实施不重定）

## 边界（与 compiler target 方向正交）

```text
本 Action（pipeline 方向）: session 同构 + 调度收口 —— 「怎么编译」
compiler target 方向       : 产物形态切面（独立 Action）—— 「编译成什么」
```

两者正交：本门不触碰 mode/platform/renderer/publish 的形态语义。

## 产品门（S1/S2 · 两门 · 判据已操作化）

| 门 | 内容 | 验收判据 |
| --- | --- | --- |
| **S1 内核抽取（机械）** | options 组装（白名单合并 + store/lifecycle 注入）入内核；one-shot 编译调用入内核（仅 `.build`）；watch/dev 消费内核组装的 options | 行为同构断言（spy / 事件序列，规范化 + 入口白名单）；nomap+sourcemap diff=0；全量回归绿；结构判据 ①② |
| **S2 调度收口（语义）** | activeLoop 占用/释放、错误传播、lifecycle 挂载单一化进内核 | R1–R4 / R7 / W4 既有测试不改断言全绿；无重复生命周期挂载；结构判据 ②③ |

两门各自 PR（对齐 P5 禁混）；S1 验证通过后再开 S2。细则见 [design.draft](design.draft.md) §两门切分。

## 设计输入

- **已确认的调度设计（引用，不重定）**：L1（one-shot 每次全量 load）/ L2（rebuild 全量 load+merge）/ L3（保留 `build()` 门面 + 临时 store）/ L4（stop 后保留 Store）；W1–W4（session 持有 store 注入 watcher；无 store 临时 create；PS2 起 Store 唯一活图；dev ctx 不含 store）；R1–R4 / R7（activeLoop 单环 + dev startup rollback）；M-A；D1a（dev 必经 session.watch）。
- **结构判据（反面条 · 2026-09-13 讨论入档）**：设计模式名（门面/薄壳/内核/依赖注入）只作评审词汇；验收以可观察病症的反向要求表达——① 三入口经同一执行路径可观测；② 无入口各自内联 options 组装 / activeLoop 释放；③ 无重复生命周期挂载。本门交付后「新增执行入口必须经内核」成为结构不变量。详见 [design.draft](design.draft.md) §结构判据。

## Status / 授权

- 当前 **`in_progress`**（2026-09-14）：Readiness 六轮收敛完成（`ready`）；**S1 实施已授权开工**；基线 SHA 记于 [validation.md](validation.md)。
- **D-SU-1..5 已拍板（2026-09-13，全部照建议）**：
  1. S1/S2 两门切分（先机械后语义）—— D-SU-1
  2. 内核落点 `src/session/runner.js`、不公开导出 —— D-SU-2
  3. 同构判据三层操作化（行为/结构/产物）—— D-SU-3
  4. dev 期间 activeLoop 标签保持今日 `'watch'`（行为 0；现有测试仅断言 /R3/ /R4/，不改系纪律而非测试约束）—— D-SU-4
  5. Action 名 `fe-tools-session-unify` 转正 —— D-SU-5
- S1 已授权实施；S2 待 S1 验证通过后另行授权。
- Review 残留：六轮 findings（R1 F1/F2、R2 F-A/B/C、R3 F-E/F、R4 F-G/H/I、R6 F-J）均已清；仅 **F-D**（伞文档 / TODO 导航指针，可选便利项）开放；F3/F4 已落 plan 触达序；F5 无需动作。

## 闭合条件

- **两门交付**：S1 + S2 均完成，A-SU01..06 全 pass，证据回填 acceptance / validation；
- **消融在档**：P-SU07 消融 ×2（S1 拔内核 / S2 拔收口）完成且失败点落在对应断言，恢复后全绿；
- **行为 0 证据**：全量 vitest 绿 + nomap/sourcemap diff=0（基线随门递进，P-SU02）；
- **持久发现回流**：结构不变量「新增执行入口必须经内核」写入 [`fe-tools-sidecar/architecture-notes.md`](../fe-tools-sidecar/architecture-notes.md)（或伞 README）；
- **一致变更**：STATUS / README / 归档位置随 `complete` 一次同步（→ `_archive/complete/`）；
- **范围守恒**：已知限制（lifecycle `off()` 等）确认维持 Non-requirements，不新开范围。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-13 | 初稿；边界讨论（三门待定：门切分 / 落点 / 同构判据操作化） |
| 2026-09-13 | Readiness 文档成稿（requirements/design/plan/acceptance/validation）；结构判据入设计输入；STATUS.md 登记 `draft`；新增 D-SU-4（dev 期 activeLoop 标签实锚） |
| 2026-09-13 | Review（Readiness 门 `fail`，健康态）后 F1/F2 修正：R-SU1 / 职责表 / A-SU01 收紧内核职责措辞（one-shot 调用仅 `.build`；watch/dev 经组装产物，共用 = `build()` 门面）；P-SU03 / A-SU05 补规范化规则与白名单口径 |
| 2026-09-13 | D-SU-1..5 全部拍板（照建议）；design 冻结 v1；F4 定 spec 独立文件、F3 记入 S1；Readiness 完成升 **`ready`**；STATUS 同步 |
| 2026-09-13 | Review 二轮 F-A/F-B/F-C：R-SU5① 白名单口径三文同步（基线捕获为准）；design 内核形状标题去「草案」；Goal 1 收紧与 S1/S2 门一致 |
| 2026-09-13 | Review 三轮 F-E/F-F：validation 增 **P-SU00**（dist 镜像同步前置，堵 exports 校验对旧镜像空转的假阳性）+ P-SU02/P-SU05 前置标注；plan S2 定 `runOnce` 内化 `assertNoActiveLoop`（消息文本不变） |
| 2026-09-13 | Review 四轮 F-G/F-H/F-I：P-SU00 映射修正（→ A-SU05③）；Status 残留行更新至四轮态（仅 F-D 开放）；P-SU02 补**基线随门递进**规则（S2 基线 = S1 合入后 HEAD）；plan 验证范围改 P-SU00..07 |
| 2026-09-13 | Review 六轮 F-J：README 补「闭合条件」节（对齐仓库内容规范：两门交付 / 消融在档 / 行为 0 证据 / 结构不变量回流 / 一致变更 / 范围守恒） |
| 2026-09-14 | 升 **`in_progress`**：S1 实施授权开工；基线 SHA 记于 validation.md（P-SU02 随门递进：S1 基线 = 升 in_progress 时 HEAD） |
