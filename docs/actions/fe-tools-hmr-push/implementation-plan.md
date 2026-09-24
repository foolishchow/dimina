# Implementation Plan — fe-tools-hmr-push

Status: **ready（2026-10-09）**

> 待 design.draft §5 实证 + D-PUSH-1/2/3 锁后填实。

## Step 0 — 实证（design.draft §5）— **DONE ✓**

- [x] payload 格式：design def——L_HMR payload = moduleId→code/map
- [x] BuildModel dirty tracking：F-H4-1——须加 dirtyEntries set（add 时加入，materialize 后清）
- [x] publishToDist 增量边界：F-H4-2（low-med）——atomic full move ≠ 增量，须重构（keep dist + update changed only）
- [x] runtime fallback 协议：out of scope（运行时侧）

**实证结果**：D-PUSH-3 materialize 增量可行（加 dirty set）；publishToDist 须重构（atomic move → incremental copy）。待升 ready 前重评 publish 重构规模。

## Step 1 — L_HMR level（R-PUSH-1, D-PUSH-1）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `dev/dev-reload.ts:22` | RELOAD_LEVELS 加 L_HMR | pending |

## Step 2 — 增量 payload 推送（R-PUSH-2, D-PUSH-1）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `dev/dev-server.ts:195` | notifyBuildPublished → 增量 payload broadcast | pending |

## Step 3 — materialize 增量化（R-PUSH-3, D-PUSH-3）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `compiler/pipeline/publish.ts` | publishToDist 增量发布 | pending |
| `model/build-model.ts` | materialize 增量（dirty set tracking） | pending |

## Step 4 — fallback L1（R-PUSH-4, D-PUSH-2）

| 文件 | 改动 | 状态 |
| --- | --- | --- |
| `dev/dev-reload.ts` | L_HMR fallback → L1（runtime-side downgrade） | pending |

## Step 5 — 验证（行为 0 三件套）

- [ ] tsc 0 errors
- [ ] vitest 全绿
- [ ] one-shot 6 项目 diff=0
- [ ] watch L_HMR payload 正确推送
- [ ] V-PC-5: 0 新 as any / 索引签名

## Step 6 — 回流

- [ ] architecture-notes: H4 条目 + runtime 依赖状态
- [ ] docs/fe-tools/README.md 导航补 H4 链
