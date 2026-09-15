# Action Candidates

本文档存放尚未正式化为 Action 的候选工作。候选不授权实施，也不代表已接受的产品或架构决策。

## 正式化门

将候选移入 `docs/actions/<action-id>/` 之前，需确认：

- 可观察的问题与具体目标；
- 明确的范围与非范围；
- 当前设计输入与依赖；
- 可枚举的交付物；
- 可观察的验收标准；
- 可执行或可复现的验证方法。

任一条件不明确时，条目保留在此处或仓库 Research 区域，并记录缺失的决策或证据。

## Candidates

### FE tools sidecar（旁路工具链）——已 formalize（2026-09-10）

| Field | Value |
| --- | --- |
| 决策 | 战略伞 [`fe-tools-sidecar`](fe-tools-sidecar/README.md)（`draft`）；搬迁 / unvite / session / build-model / module-cache / worker-architecture 均已 **complete** 并归档 |
| 下一步 | [`fe-tools-bundler-typecheck`](fe-tools-bundler-typecheck/README.md)（**`in_progress`**，待 Close）；[`fe-tools-bundler-tsc-dist`](fe-tools-bundler-tsc-dist/README.md)（**`ready`**，待实施授权）；[`fe-tools-incremental-target`](fe-tools-incremental-target/README.md)（E7）仍 `draft`；[`fe-tools-wxml-layout`](_archive/complete/fe-tools-wxml-layout/README.md) **complete 已归档**；病症地图 [compiler-symptom-inventory.md](fe-tools-sidecar/compiler-symptom-inventory.md)；**PS3 deferred** |
| 再激活 / 推进 | project-store PS3（增量装载 applyChanges / subscribe）**deferred**（2026-09-12；见 sidecar README「PS3 deferred」）；伞保持 draft |
| 再激活条件 | ① watch rebuild 全量 load 成为可量化性能瓶颈（需要 applyChanges 增量图更新）；② preview 出现需要 store 内部 metadata 的真实消费方（如依赖图详情展示） |
| 说明 | 长线分支 **`feature/fe-tools-sidecar`** |

### WXML 双 Parser 改造——`fe-tools-wxml-refactor` complete（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-wxml-refactor`](_archive/complete/fe-tools-wxml-refactor/README.md)（**`complete` 已归档**；交付 `13c9c902`） |
| 结果 | W1 23 函数归位；W2 标准 Document + 零 cheerio 泄漏；W3 默认 napi；580/580 + P-WR06 diff=0 |
| 后续候选 | 已 formalize → [`fe-tools-wxml-layout`](_archive/complete/fe-tools-wxml-layout/README.md)（**`complete` 已归档**；交付 `4259ebdd`） |

### WXML 目录轴整理——`fe-tools-wxml-layout` complete（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-wxml-layout`](_archive/complete/fe-tools-wxml-layout/README.md)（**`complete` 已归档**；交付 `4259ebdd`） |
| 结果 | L0 目录轴 + API 同门删净；L1 580/580 + 相对 `0074396c` / napi↔cheerio diff=0；L2 architecture-notes 回流 |
| 待定 | 无（D-WL-1..9 已拍板并交付） |

### Bundler allowJs 类型门禁——已 formalize 为 `fe-tools-bundler-typecheck`（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-bundler-typecheck`](fe-tools-bundler-typecheck/README.md)（**`in_progress`**；S0–S1 已交付，待 Close） |
| 问题 | bundler 无 tsc 门禁；整仓改 .ts 过重 |
| 目标 | allowJs + CI `tsc --noEmit`（fe-tests.yml）；S0+S1（common/load/registry/stub/compile-target）；strict；集中 typedef |
| 待定 | 无（D-TC-1..10 已拍板） |

### Layering 漂移热修（compat sync outputPath）——待先行合入（2026-09-15 · Review R1-F3）

| Field | Value |
| --- | --- |
| 问题 | `scripts/sync-compatibility-reference.js` outputPath 指旧位置 `src/compiler/compatibility-reference.js`（实为 `core/` 下）→ `npm test` pretest 必炸；`npm run build` prebuild 会误生成根级残留文件 |
| 修复 | 一行：outputPath → `../src/compiler/core/compatibility-reference.js`（D-TD-19） |
| 归属 | 建议随 `fe-tools-bundler-tsc-dist` 授权前先行合入（或其 T0a 一并） |

### Bundler tsc dist + 选择性迁 TS——已 formalize 为 `fe-tools-bundler-tsc-dist`（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-bundler-tsc-dist`](fe-tools-bundler-tsc-dist/README.md)（**`ready`**；实施未授权） |
| 问题 | JSDoc 类型不直观；sync 无法安全绿场 `.ts`；决定 B2 全交 tsc emit |
| 目标 | B2 build（emit 全 src；删 sync、留 postbuild）+ 第0/1刀迁 `.ts`；typecheck include 对齐 |
| 待定 | 无（D-TD-1..16 已拍板） |
| 前置 | typecheck Close/合入后再实施（D-TD-12） |

### B 轨道（Rust 宿主，B0–B4）——deferred（2026-09-08）

| Field | Value |
| --- | --- |
| 决策 | umbrella `compiler-improvement` 闭合时终局决策：**deferred** |
| 依据 | A 轨道已交付全部必达目标（G1/G3）；B 轨道为解耦的长期轨道（RFC D4），无外部阻塞但无当前消费者 |
| 再激活条件 | ① 性能/统一诉求有可量化目标（B0 基线先行）；② oxc napi 面确认可覆盖现有 JS 编排；③ D7 多线程陷阱有阶段性规避方案 |
| 再激活方式 | 另立 B0 子 Action，前置为上述条件满足 |

### C1（Lynx PoC）——deferred（2026-09-08）

| Field | Value |
| --- | --- |
| 决策 | umbrella `compiler-improvement` 闭合时终局决策：**deferred** |
| 依据 | A4 renderer 抽象已预留接入点；但 Lynx 需另立 RFC（RFC D3），当前无明确需求方与资源 |
| 再激活条件 | ① 另立 Lynx RFC 并定稿；② wx 组件集子集范围确认；③ 业务侧有真实 Lynx 场景 |
| 再激活方式 | 另立 C1 子 Action，前置为 RFC 定稿与业务需求确认 |
