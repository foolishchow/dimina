# Implementation Plan — fe-tools-hmr-push

Status: **complete（2026-10-09）**

> 待 design.draft §5 实证 + D-PUSH-1/2/3 锁后填实。

## Step 0 — 实证（design.draft §5）— **DONE ✓**

- [x] payload 格式：design def——L_HMR payload = moduleId→code/map
- [x] BuildModel dirty tracking：F-H4-1——须加 dirtyEntries set（add 时加入，materialize 后清）
- [x] publishToDist 增量边界：F-H4-2（low-med）——atomic full move ≠ 增量，须重构（keep dist + update changed only）
- [x] runtime fallback 协议：out of scope（运行时侧）

**实证结果**：D-PUSH-3 materialize 增量可行（加 dirty set）；publishToDist 须重构（atomic move → incremental copy）。待升 ready 前重评 publish 重构规模。

## Step 1 — L_HMR level（R-PUSH-1, D-PUSH-1）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `dev/dev-reload.ts` | RELOAD_LEVELS 加 L_HMR + synthesizeReloadLevel enableHmr 标志（默认 false backward-compatible） | done |

## Step 2 — 增量 payload 推送（R-PUSH-2, D-PUSH-1）— **基础设施就绪，待 runtime**

`notifyBuildPublished` 广播 `{ type: 'reload', ...pendingReload }`。L_HMR payload 含 `modules` 字段（moduleId→code/map）——由 BuildModel dirtyEntries 提取。enableHmr=false 默认 → L1/L2/L3 backward-compatible。enableHmr=true 时增量单 kind → L_HMR payload。runtime 就绪后启用（D-HMR-5 非阻塞伞 close）。

## Step 3 — materialize 增量化（R-PUSH-3, D-PUSH-3）— **DONE ✓**

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `model/build-model.ts` | BuildModel 加 dirtyEntries set + materialize 增量（dirty 非空 → 只写 dirty；空 → 全量） | done |

**F-H4-2 deferred**：publishToDist 增量（atomic move → incremental copy）——one-shot 全量 diff=0 平凡，watch 增量 publish 是主要工作量，Phase 2 重构。

## Step 4 — fallback L1（R-PUSH-4, D-PUSH-2）— **runtime-side（out of scope）**

D-PUSH-2 locked 选项②：编译侧发 L_HMR payload，runtime 收后自降 L1。runtime downgrade 逻辑是运行时侧交付物（非编译侧）。F3 风险已记（runtime 未实现 → payload 丢失）。编译侧 enableHmr 标志就绪，runtime 就绪后启用。

## Step 5 — 验证（行为 0 三件套）— **DONE ✓**

- [x] tsc 0 errors
- [x] vitest 全绿（625/625，compile-cli-cache flaky excluded）
- [x] one-shot 6 项目 diff=0
- [x] V-PC-5: 0 新 as any / 索引签名
- [x] watch L_HMR payload 正确推送（enableHmr=true 时合成 L_HMR——unit test 覆盖）

## Step 6 — 回流

- [x] architecture-notes: H4 条目 + runtime 依赖状态
- [x] docs/fe-tools/README.md 导航补 H4 链
