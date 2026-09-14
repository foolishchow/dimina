# Design draft — fe-tools-session-unify

Status: **冻结 v1（2026-09-13）** — D-SU-1..5 已拍板；实施中改设计须修订本档并同步 requirements / acceptance

## 职责表（内核 vs 壳）

| 关注点 | 归属 | 说明 |
| --- | --- | --- |
| options 组装（compile/pipeline 白名单合并、fileTypes 缺省、store/lifecycle 注入） | **内核**（S1） | forced-last：`overrides.lifecycle` 永不生效 |
| one-shot 编译调用 | **内核**（S1） | 仅 `.build()` 经内核发起；watch/dev 编译调用在 watch-runner 内部（不改，R-SU6），「共用」指同一 `build()` 门面（RR4），由行为同构断言验证 |
| activeLoop 占用（断言 + 置位） | **内核**（S2） | R3：handle 自创建起占用 |
| activeLoop 释放（stop / close / R7 回滚终态） | **内核**（S2） | 幂等；壳不再各自 `finally` 清环 |
| 错误传播 | **内核**（S2） | one-shot 直接抛；loop 错误经 onError / lifecycle 路径不变 |
| lifecycle 挂载点 | **内核**（S2） | dev 的 published/error 监听挂载点唯一 |
| 入口参数解构 + 白名单校验（unknown keys throw） | **壳** | 消息文本不变 |
| 返回值形状（build result / watch handle / dev handle） | **壳** | O1–O3 契约 |
| dev preview 组装（adapter 创建、R7 回滚、close 组装） | **壳（dev）** | D1a：仍经 `session.watch`；`adapter.close` 属 preview 组装，留壳 |
| Store 持有与生命周期 | session `state`（PS1+PS2 已交付） | 本门不动 |

## 内核形状（终态；各行 `// S1` / `// S2` 标注交付门）

```text
createSessionRunner(state)
  → composeOptions(overrides)   // S1：白名单合并 + 缺省 + store/lifecycle 注入
  → runOnce(overrides)          // S1：one-shot 编译调用
  → occupyLoop(kind)            // S2：断言 + 置位（R3）
  → releaseLoop()               // S2：幂等释放
```

- 落点：`src/session/runner.js`；**不**进公开 exports；`session/index.js` 降薄壳。
- `.watch` 壳：occupy → `createBuildWatcher`（注入 `state.store` + composeOptions 产物）→ handle 的 `stop` 走 releaseLoop。
- `.dev` 壳：occupy（标签处置见 D-SU-4）→ 经 `session.watch` 组装（不绕过）→ R7 回滚终态统一走 releaseLoop + `adapter.close`。

## 两门切分（D-SU-1）

| 门 | 性质 | 交付物 | 禁混 |
| --- | --- | --- | --- |
| **S1 机械抽取** | 行为 0 | runner.js（composeOptions + runOnce）+ 三入口改道 | 不动 loop 语义 |
| **S2 语义收口** | 语义不变 | occupyLoop / releaseLoop 入内核；壳删各自置位 / finally 清环 | 不改 S1 产物路径 |

各自独立 PR（对齐 P5 禁混）；S1 验证（含消融）通过后再开 S2。

## 结构判据（反面条 · 2026-09-13 讨论入档）

设计模式名（门面 / 薄壳 / 内核 / 依赖注入）仅作评审词汇，不进需求与验收；验收以病症反向要求表达：

1. 三入口经同一执行路径**可观测**（spy / 事件序列同构断言）；
2. 无入口各自内联 options 组装 / activeLoop 释放（静态 review + 测试锚定）；
3. 无重复生命周期挂载。

**本门交付后**「新增执行入口（如 target 方向 build 变体）必须经内核，不得另起分叉」成为结构不变量——即 session-unify 问题陈述的镜像，防复发。

## 决策记录（已拍板 · 2026-09-13）

| ID | 建议 | 备注 |
| --- | --- | --- |
| D-SU-1 | 两门 S1/S2，先机械后语义 | 对齐刀 A/刀 B、P5 先例；中间留已验证稳定态，S1 可独立消融 |
| D-SU-2 | 落点 `src/session/runner.js`，不公开导出 | 对齐 P1（build-pipeline.js 独立落点）/ P3（不新增 exports）；index.js 已 342 行不宜再内联；独立文件可直测内核 |
| D-SU-3 | 同构判据三层（行为 / 结构 / 产物） | R-SU5；验疗效不验药名 |
| D-SU-4 | dev 运行期间 activeLoop 标签**保持今日 `'watch'`** | 今日实现因 `.dev` 委托 `session.watch`，`activeLoop='watch'`（源码实锚）；内核化后改 `'dev'` 会改变 R3/R4 错误消息文本 → 违反行为 0（R-SU4）；如要改另立微 Action |
| D-SU-5 | Action 名 `fe-tools-session-unify` 转正 | 或升 ready 前改名，一次定死 |

## 已确认设计输入（引用，不重定）

L1–L4 / W1–W4 / R1–R4 / R7 / M-A / D1a（dev 经 session.watch）/ P3（不新增 exports）/ RR4（`options.store`）

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-13 | v1 成稿：职责表、内核形状、两门切分、结构判据、D-SU-1..5（含 D-SU-4 dev 期 activeLoop 标签实锚） |
| 2026-09-13 | Review F1 修正：职责表「一次编译调用」行收紧——one-shot 仅 `.build` 经内核；watch/dev 调用在 watch-runner 内部（不改），共用 = `build()` 门面（RR4） |
| 2026-09-13 | **D-SU-1..5 拍板（全部照建议）**：两门切分 / `src/session/runner.js` 不导出 / 同构三层 / dev 期标签保持 `'watch'` / 名转正；**冻结 v1**（D-SU-4 补证据：现有测试仅断言 /R3/ /R4/，不改标签系行为 0 纪律而非测试约束） |
| 2026-09-13 | Review 二轮 F-B：内核形状标题去「草案」（与冻结 v1 措辞一致） |
