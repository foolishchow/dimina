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

---

## 架构候选（2026-10-09 · packer 重构轨道）

### Round 0 — packer 目录收敛 —— `draft`（2026-10-09）

packer 架构 retrospect（[F-PA-1..6](../fe-tools/2026-10-09-packer-facade-aspect-retrospect.md)）发现 packer 域 ~27 文件散在 4 处（`packer/` + `model/` + `compiler/pipeline/` + `compiler/worker-runtime/`）+ `core/` 混合袋。散落致 ③a/b/c 跨层 import + D/C 重构缺干净素材 + 北星 6 组件无物理落地。

**Round 0 = 纯搬迁结构轮**（D/C 前置）：packer 域归位 `packer/` 9 子目录（mirror 北星 6 组件形状：graph/store/registry/state/cache/emit/worker/pipeline/aspect）。`model/` + `compiler/pipeline/` + `compiler/worker-runtime/` 解散；`core/` 解体。纯搬迁无逻辑改（D-DC-2 红线）+ 分批行为 0 gate（B1-B5）。消解 ③a/b/c。

后续轮（Round 0 后 checkpoint 再定）：Round 1 D（facade + collaborator）/ Round 2 C（aspect）/ Round 2 后评估 B（ALS 闭合）+ A（renderer 注入点）+ E（dispatch wiring，runtime 就绪后）。

→ [fe-tools-packer-directory-convergence](fe-tools-packer-directory-convergence/README.md)

---

## 近端顺序（2026-09-20 · 已约定）

先收旁路战略伞，再开 Module 中心。**不并行**开 Packer 整包抽取。

### 0. `fe-tools-sidecar` 伞级 closeout —— ✅ complete（2026-09-20）

| Field | Value |
| --- | --- |
| 结果 | [`_archive/complete/fe-tools-sidecar`](_archive/complete/fe-tools-sidecar/README.md)：A-001..010 全 pass；TS-3/PS3 deferred；CI 外部 Uncovered |
| 活真源 | 已迁 [`docs/fe-tools/`](../fe-tools/README.md) |
| 其后 | 可 formalize 下方「1. Module 中心伞」 |

### 1. Module 中心伞 —— ✅ `complete` 已归档

| Field | Value |
| --- | --- |
| Action | [`fe-tools-module-centric`](_archive/complete/fe-tools-module-centric/README.md) **✅ complete 已归档** |
| 北星 | Module 一等公民；图与缓存围着它转；不整包抽 Packer |
| 近端子门 | M1 [`fe-tools-module-invalidation`](_archive/complete/fe-tools-module-invalidation/README.md) **✅ complete 已归档** → M2 [`fe-tools-module-result-cache`](_archive/complete/fe-tools-module-result-cache/README.md) **✅ complete 已归档**；M0 emit W1 deferred |
| D-MF-1 | **已封口**：方案 A（今日 `CompileInfo.path`）；刀 2 仅 logic；view/style 排除；规范形迁移另门 |
| 其后 | 伞级 complete 归档；M0 emit W1 另门可独立先行；后继伞 [`fe-tools-module-convergence`](_archive/complete/fe-tools-module-convergence/README.md) **`complete`**（MC0 graph 正确 + MC3a deriveFromGraph 全 complete；D-MC-0 **A=code 不上图**）；MC3b → [`fe-tools-emit-relocate`](_archive/complete/fe-tools-emit-relocate/README.md) **`complete`**；[`fe-tools-packer-orchestrator`](_archive/complete/fe-tools-packer-orchestrator/README.md) **`complete`**（编排归位）；下一刀 [`fe-tools-packer-context`](_archive/complete/fe-tools-packer-context/README.md)（**`complete`**）；[`fe-tools-style-minify-gate`](_archive/complete/fe-tools-style-minify-gate/README.md)（**`complete`**）；[`fe-tools-style-cssnano-gate`](_archive/complete/fe-tools-style-cssnano-gate/README.md)（**`complete`**）；[`fe-tools-graph-persist`](_archive/complete/fe-tools-graph-persist/README.md)（**`complete`**）；增量前置 G2；[`fe-tools-fingerprints-persist`](_archive/complete/fe-tools-fingerprints-persist/README.md)（**`complete`**）；增量前置 G3；[`fe-tools-invalidation-all-kinds`](_archive/complete/fe-tools-invalidation-all-kinds/README.md)（**`complete`**）

### 1a. M1 模块级失效 —— ✅ complete 已归档

| Field | Value |
| --- | --- |
| Action | [`fe-tools-module-invalidation`](_archive/complete/fe-tools-module-invalidation/README.md) **✅ complete 已归档** |
| 目标 | `getInvalidatedModules`：changed files → logic moduleId 集 |
| 继承 | 伞 D-MF-1 七条 |
| 闭合证据 | tsc 0 错；vitest 9/9 + 全量 594/595（1 flaky retry pass）；diff scope 仅 model/ + spec；A-IV0..4 / P-IV00..04 全 pass |
| 其后 | 已实施 complete；回流 architecture-notes；M2 消费本 API 脏集 |

---

## 架构候选（2026-09-15 · 讨论中，未定稿）

> **2026-09-20**：近端以上方「近端顺序」为准。A / C 保留为背景；正式化走「1. Module 中心伞」，勿绕过 sidecar closeout。

### A. Module 收敛（ProjectStore / worker 分散割裂的彻底化）——候选 · 并入近端顺序 §1

| Field | Value |
| --- | --- |
| 问题 | logic/view worker 各自持有 modules（scriptRes / compileRes / compileResCache），与 ProjectStore 的 DependencyGraph 分散割裂——同一逻辑实体（一个源模块）在多处有不相关的表示：图节点有归属/边但无编译负载，worker 有编译负载但图不感知 |
| 目标 | 统一的 Module 对象 `{ id, kind, code, deps, files[], packageRoot, sourcemap }` 贯穿：图（DependencyGraph node = 它）、编译（worker transform 结果回填）、失效（fingerprint 模块级）、产物（BuildModel 派生）、HMR（热更最小单位） |
| 赢点 | 大部分情况只需存 module 的 parse 结果；最后按 page/subpackage 从图取模块 emit；共享模块不重复编译；失效粒度从 page/package 降到 module |
| 不是新造层 | 是把已有半套资产（图空壳 node + worker 游离编译结果 + BuildModel end-state）收敛成同一对象；PS2「Store 唯一活图权威」在等它彻底化 |
| 待定 | ① Module.code 存 Store 内存（watch 长驻）还是序列化持久（重启复用）——决定 fingerprint 是否下沉模块级；② worker 编译回填 Store = IPC 放大 vs 本地再算——HMR/增量值得，单构建多余 |
| 触发 | sidecar closeout 完成后，由「1. Module 中心伞」formalize；近端先刀 2+3 倒逼形状，不一次收敛全部表示 |

### B. Emit 抽象层（「先从 emit 做一刀」）——✅ complete（`fe-tools-bundler-emit-layer` 已交付归档）

> **2026-09-20 注**：本候选已由 [`fe-tools-bundler-emit-layer`](_archive/complete/fe-tools-bundler-emit-layer/README.md) **complete 交付并归档**（emitEntry + emitOutput 骨架 + 模块集合接口；行为 0 diff=0 + 全量 vitest）。以下为历史需求记录，供后续演进参考。packer-research 评估：如需再演进（如 HMR patch 产物）可独立先行（S 级低风险）。

| Field | Value |
| --- | --- |
| 问题 | view/logic 都有「模块集合 → modDefine 包裹 → transform → 写盘/materialize」产物样板，重复 ~100+ 行（postMessage(M1)/fs.writeFileSync + modDefine 拼接）；产出是手写拼接而非可增量结构 |
| 目标 | `pipeline/emit.js` 通用 emit 骨架：`emitEntry({ entryId, kind, modules, transform, filename, relPrefix, sourcemap, collectOutput })`——输入面向「可迭代模块集合」（现在是 scriptRes/compileRes，S1 后是 ModuleGraph，接口不变 = 与 A 解耦） |
| 真共性 | modDefine 包裹格式 / transform 调用 / 输出出口样板 / mergeSourcemap / relPrefix 物化路径 |
| 真差异（参数化，勿塞 if） | transform 策略 `'bundle'`（view 整包，moduleRanges 行定位）vs `'perModule'`（logic 逐模块，天然定位）；target/platform（esTarget.view/browser vs logic/neutral）；filename/entryId 规则 |
| 收益 | 消样板；renderer/platform 挂点就位（平台差异收敛点）；HMR 轨道（patch 产物从这里出）；行为 0 可守（纯重构同参同产） |
| 风险 | 伪抽象（strategy 若成 if/else = 换皮——需 transform 粒度/错误定位作注入点）；这一刀只搬不优化（勿顺手统一 transform 行为） |
| 前置斟酌 | 是否趁刀统一 transform 粒度——建议不统一（各有原因），差异留参数 |
| 形态 | 小 Action `fe-tools-bundler-emit-layer`（纯重构 + 行为 0），落点 `pipeline/emit.js` |

### C. 三刀细化（2026-09-15 · 讨论收敛：emit 抽取 / 失效查询 / ModuleCache）——候选 · 刀 2+3 并入近端顺序 §1

> 结论：emit 抽取与缓存层通过「**模块集合接口**」耦合（emit 消费、缓存提供同一形状 iterable<{moduleId, code, map}>）。先立契约 → 消费端 → 提供端。分为三刀，各独立验证。packer-research：**优先刀 2+3**；整包 Packer 不立即做。

| 刀 | 内容 | 契约角色 | 验收 |
| --- | --- | --- | --- |
| **刀 1：emit 抽取** ✅ complete | `pipeline/emit.js` 骨架（emitEntry + emitOutput）；**输入 = 模块集合接口（明确契约）**；scriptRes/compileRes 以「提供者 A0」接入 | **定义契约 + 消费端** | diff=0 + 全量 vitest |
| **刀 2：维度 1 失效查询** | DependencyGraph 补模块级失效查询（**以 [`fe-tools-module-centric`](fe-tools-module-centric/technical-design.md) D-MF-1 为准**：仅 logic Module；方案 A = 今日 `CompileInfo.path`；排除 view/style；**不**替换 `getAffectedEntries`）。fileOwners → logic 过滤 → logic dependents 闭包；算法细节在子门 M1 TD | 闭环上游 | 单测：改 JS → 正确 moduleId 集；改 wxml 不进该集 |
| **刀 3：ModuleCache** | 编译结果持久（跨 rebuild）；worker 编译回填；watch 接增量 | **实现契约提供端** | watch 冒烟：改 1 文件只重编该模块 |

**闭环**：文件变更 → 维度 1 `getInvalidatedModules` → Set<moduleId> → 维度 2 清缓存 → 只重编失效模块 → emit 重组产物。

**关键设计点（讨论中）**：
- 契约形状：`{moduleId, code, map}` 够（deps 留图维度1，单一职责）
- ModuleCache 的「家」：主线程 ProjectStore 侧（长驻、IPC 回填）vs worker 内跨任务保留（零 IPC）——影响刀 3 形态
- 维度 2 寿命若仅 stage 内 = 无收益；跨 rebuild 才有价值（watch 长驻）
- 刀 1 必须把「模块集合接口」立成规约（形状+语义），刀 3 守规约——否则刀 3 会让 emit 改接口
- **formalize**：sidecar closeout 完成后，经「1. Module 中心伞」立子门；勿在伞未收口时单独开刀 2

## Candidates

### FE tools sidecar（旁路工具链）——✅ complete 已归档（2026-09-20）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-sidecar`](_archive/complete/fe-tools-sidecar/README.md) **complete** |
| 活真源 | [`docs/fe-tools/`](../fe-tools/README.md)（architecture-notes / sync-rhythm） |
| 书面延后 | PS3 / TS-3 deferred；CI 外部 Uncovered；style 剩余另议 |
| 说明 | 伞级不再授权大实施；近端见「1. Module 中心伞」 |

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
| Action | [`fe-tools-bundler-typecheck`](_archive/complete/fe-tools-bundler-typecheck/README.md)（**complete 已归档**：`eb3b2bc4`） |
| 问题 | bundler 无 tsc 门禁；整仓改 .ts 过重 |
| 目标 | allowJs + CI `tsc --noEmit`（fe-tests.yml）；S0+S1（common/load/registry/stub/compile-target）；strict；集中 typedef |
| 待定 | 无（D-TC-1..10 已拍板） |

### Layering 漂移热修（compat sync outputPath）——已合入（2026-09-15 · Review R1-F3）

| Field | Value |
| --- | --- |
| 问题 | `scripts/sync-compatibility-reference.js` outputPath 指旧位置 `src/compiler/compatibility-reference.js`（实为 `core/` 下）→ `npm test` pretest 必炸；`npm run build` prebuild 会误生成根级残留文件 |
| 修复 | 一行：outputPath → `../src/compiler/core/compatibility-reference.js`（D-TD-19）✅ 已合入；`npm test` 整链 exit 0（pretest In sync + 580/580） |

### Bundler tsc dist + 选择性迁 TS——已 formalize 为 `fe-tools-bundler-tsc-dist`（2026-09-15）

| Field | Value |
| --- | --- |
| Action | [`fe-tools-bundler-tsc-dist`](_archive/complete/fe-tools-bundler-tsc-dist/README.md)（**complete 已归档**） |
| 问题 | JSDoc 类型不直观；sync 无法安全绿场 `.ts`；决定 B2 全交 tsc emit |
| 目标 | B2 build（emit 全 src；删 sync、留 postbuild）+ 第0/1刀迁 `.ts`；typecheck include 对齐 |
| 待定 | 无（D-TD-1..16 已拍板） |
| 前置 | ~~typecheck Close/合入后再实施（D-TD-12）~~ — 已满足（typecheck complete） |

### napi parser 产标准 Document 形状（删 documentFromSpanView 翻译器）——候选（2026-09-15 · 讨论收敛）

| Field | Value |
| --- | --- |
| 问题 | 双形状：Rust 产 SpanView（byte span/struct 语义）→ JS `documentFromSpanView` 翻译成标准 Document（char loc/attrs[]/directives/slot）；~300+ 行翻译器 + 双形状维护 |
| 方向（C） | **Rust 直接序列化标准 Document 形状**（char loc 用 `char_indices`、attrs[].raw 补齐、特殊节点标准化）——parse 结果即 Document，删翻译器；cheerio 路径本就产标准形状 → 双 parser 同构不变量依然成立（D-WR-4 ✓） |
| 否决（B） | Document = value 访问封装（接口层包两层）——复活 D-WR-1 否决的 ctx.dom 抽象层；cheerio 侧要造等价翻译器，工作量转移非消失 |
| 最大风险 | `attrs[i].raw` 语义与现状一致（现翻译器有时从 opening tag 文本再解析）→ 需专项 raw 对拍 + 全量回归守行为 0 |
| 收益 | 删整翻译器；形状唯一（Standard 契约）；Rust 权威一次产出；少一次 JS 遍历/对象构建 |
| 形态（若做） | 小 Action `fe-tools-wxml-spanview-standardize`；门 = Rust 重写 + 删翻译器 + parity/switch 对拍扩量 + 行为 0 |

### Bundler 全量 TS 迁移——候选（2026-09-15 · 讨论后暂缓）

| Field | Value |
| --- | --- |
| 内容 | 62 文件 / 13,468 行 .js → .ts；supersede tsc-dist 的 D-TD-2（compiler/view 全量迁的 non-goal） |
| 收益 | 类型安全全量覆盖；@ts-check 白名单制度退役；JSDoc→TS 语法 |
| 成本（决定性） | 3-5 周人力；strict 存量错（56 文件从未被 strict 检查）；oxc-parser/walker 无 @types 需自写 |
| 形态（若做） | umbrella 5 刀（shared → core/pipeline → view/wxml → 三引擎 → 外围），每刀行为 0 + diff=0 |
| 前置 | 刀 0：oxc .d.ts + wxml-parser-napi .d.ts + cheerio/htmlparser2 @types devDeps |
| 触发条件 | 类型问题密度开始显著拖慢开发，或团队确认 3-5 周投入 |

### wxml parser crate：`<template name is>` 双属性 → UnclosedTag——pre-existing（2026-09-15）

| Field | Value |
| --- | --- |
| 问题 | `wxml_parses_template_name_before_is` 失败：`<template name="card" is="base">Content</template>` 解析为 UnclosedTag（`dimina-wxml-parser`，基线 `3ff54de3` 同败——与 napi3 升级无关） |
| 备注 | 测试注释自称"documents actual parser behavior"但期望 parse 成功——行为与注释矛盾；需判 parser 修复还是测试期望修正（spec：name 优先） |
| 发现 | fe-tools-wxml-parser-dist P1 实施期（stash + worktree 双证 pre-existing） |

### WXML parser wasm target（B 路线）——观察项（2026-09-15）

| Field | Value |
| --- | --- |
| 内容 | dimina-wxml-parser 编 wasm（wasi/component，非 swc plugin 机制——那是 JS/TS transform 宿主，我们是 parser 宿主） |
| 独占收益 | 浏览器端 WXML parse（web 容器 dev/预览场景：高亮/诊断/预览） |
| 触发条件 | web 端 WXML parse 消费需求落地；此前 YAGNI（A 路线 napi 矩阵已覆盖分发，见 `fe-tools-wxml-parser-dist`） |
| 可行性 | @swc/wasm 先例证明 swc 全家（含 swc_ecma_parser）可编 wasm，无硬阻塞 |

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

### Bundler lint 增强——部分完成（2026-09-19）

| Field | Value |
| --- | --- |
| 背景 | ts-migration 深度类型化阶段完成：274→29 硬类型（89.4% 消除）；tsconfig 已启用 6 类 strict lint（`strict` / `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noImplicitReturns` / `noImplicitOverride`，35 处存量 lint 修复完毕，commit `b27ea8a3`） |
| 已拍板 | tsc 基础 lint 已达标（0 错含 lint）；`==` 全部是 `== null` 惯用法（同时查 null+undefined），**不**应禁（eqeqeq 若引入需 `{"null": "ignore"}`）；`no-debugger` / `no-throw-literal` 已 0 错 |
| ✅ 候选 1（已完成） | `forceConsistentCasingInFileNames: true` + `allowUnusedLabels: false` — 已在 [`fe-tools-bundler-strict-access`](_archive/complete/fe-tools-bundler-strict-access/README.md) 中交付（commit `b2757f9f`，零成本，0 错） |
| ✅ 候选 2（已完成） | `noUncheckedIndexedAccess: true` — 63 错全修复（18 文件，`!`/`??`/typeof 守卫），行为 0（4 组 diff=0 + 584/584）；已在 [`fe-tools-bundler-strict-access`](_archive/complete/fe-tools-bundler-strict-access/README.md) 中交付 |
| 候选 3（语义规则，需引 ESLint） | 引 `@typescript-eslint`：`no-console`（43 处：14 log + 21 warn + 13 error，半数 CLI 输出 intentional，半数调试残留如 `utils.ts:144 console.log(error)` 应为 `console.error`）/ `prefer-const`（~10 处 `let` 可改 `const`）/ `no-floating-promise`（2 处 `.then()` 无 `.catch()`）/ `require-await`；成本 = 整套工具链（配置文件+插件+runner），建议单独立 Action |
| 否决（不开） | `exactOptionalPropertyTypes`（49 错，第三方库类型几乎不兼容，日常摩擦大）；`noPropertyAccessFromIndexSignature`（175 错，纯噪音，可读性反降） |
| 形态 | 候选 1+2 已完成（`fe-tools-bundler-strict-access` complete 已归档）；候选 3 独立 Action `fe-tools-bundler-eslint`（待触发） |
| 触发条件 | 候选 3 需团队确认引入 ESLint 工具链 |

## Packer 落地（2026-09-21 · 已 formalize）

`fe-tools-packer-core-shape`（complete 归档）定义了 Packer core 6 组件形状（D-PCS-1..10 北星契约）。落地工作已 formalize 为以下 draft Action：

| 顺序 | Action | 做什么 | 状态 |
| --- | --- | --- | --- |
| 1 | [`fe-tools-als-store`](_archive/complete/fe-tools-als-store/README.md) | 通用 ALS 工具类 `AsyncContextStore<T>`——统一 worker-runtime abilityContext + env.ts compilerContextStorage | `complete` 已归档 |
| 2 | [`fe-tools-graph-bootstrap`](_archive/complete/fe-tools-graph-bootstrap/README.md) | storeInfo config fixpoint 迁入 PackerGraph（D-GB-1..4） | `complete` |
| ↘ | [`fe-tools-incremental-unify`](_archive/deferred/fe-tools-incremental-unify/README.md) | view/style 模块级增量（D-IU-1..5） | `deferred` — 等 Packer Orchestrator 落地后统一规划 |
| 3 | [`fe-tools-orchestrator-state`](_archive/complete/fe-tools-orchestrator-state/README.md) | graph + cache + invalidated 收敛为 session-scoped OrchestratorState（D-OS-1..5） | `complete` 已归档 |

als-store 和 graph-bootstrap 都改 env.ts——als-store 先落地（改 ALS 机制），graph-bootstrap 基于更新后的 env.ts（改 storeInfo 逻辑）。incremental-unify deferred——等 Packer Orchestrator 落地后统一规划。orchestrator-state 是 graph-bootstrap 的直接续接——D-PCS-3（graph session-scoped）。implemented：PackerSessionState 落地，watch rebuild 增量路径生效（修复空 defaultCompilerContext）。

Packer 下一刀（当前 draft）：
- [`fe-tools-invalidation-all-kinds`](_archive/complete/fe-tools-invalidation-all-kinds/README.md)（**`complete`**）— 增量前置 G3：`getInvalidatedModules` 泛化全 kind（D-IU-1）；D-IV-6/7 反转。行为 0 三件套。
- [`fe-tools-packer-context`](_archive/complete/fe-tools-packer-context/README.md)（**`complete`**）— PackerContext 真 I/O + Graph 路 2（D-PC-0..11 已实施；行为 0 全量 7 项目 diff=0）
- [`fe-tools-style-minify-gate`](_archive/complete/fe-tools-style-minify-gate/README.md)（**`complete`**）— style minifyCss gate `DIMINA_COMPILER_DIFF_VERIFY`（设置→parse-walk diff=0；未设→emit）
- [`fe-tools-style-cssnano-gate`](_archive/complete/fe-tools-style-cssnano-gate/README.md)（**`complete`**）— cssnano gate `DIMINA_COMPILER_DIFF_VERIFY`（loader 迁 emit 正本；parse-walk legacy fallback）
- [`fe-tools-graph-persist`](_archive/complete/fe-tools-graph-persist/README.md)（**`complete`**）— storeInfo state 路径走 reconcile（非 build），保留旧图 source-level edges。增量前置 G1。
- [`fe-tools-fingerprints-persist`](_archive/complete/fe-tools-fingerprints-persist/README.md)（**`complete`**）— watch-plan 持久化 fingerprints 到 PackerSessionState，content-based dedup。增量前置 G2。
- [`fe-tools-view-style-compile-res`](_archive/complete/fe-tools-view-style-compile-res/README.md)（**`complete`**）— 增量前置 G4：view/style worker 返回 ViewCompiledModule/StyleCompiledModule（D-PCS-10 类型已存在）+ stage-channel 写 ctx.viewCache/styleCache（guarded no-op）。设计输入 = incremental-unify D-IU-2/3/4/5。8 轮 review 36 findings 全清。行为 0 三件套（617/617 + 6 项目 diff=0）。为 G5 cache-hit skip 备数据源。
- [`fe-tools-view-style-cache-skip`](_archive/complete/fe-tools-view-style-cache-skip/README.md)（**`complete`**）— 增量前置 G5（incremental-unify 重激活）：A-IU-3 剩余（PackerSessionState 字段 + orchestrator plumbing + worker input 快照）+ A-IU-4 cache-hit skip。闭合 incremental-unify（A-IU-1..5 全 complete）。设计输入 = D-IU-2/3/4/5 + G4 D-G4-1..9。**实施期 P-G506 反转 D-G5-4 F6→D-G5-4' per-page-bundle**（graph direct-only+无 wxs+序不一致→存原序 bundle，cache-hit re-emit 字节一致）。RG5-1..4 全 ✅。18 轮 review 12 findings 全清（含 F12 bare Map）。行为 0（one-shot 6 项目 diff=0；watch view 0 pages_* diff + style 0 .wxss diff）。residual（out-of-scope pre-existing）：logic cache + static-copy 需独立 Action。

- [`fe-tools-incremental-chain-residuals-closeout`](_archive/complete/fe-tools-incremental-chain-residuals-closeout/README.md)（**`complete`**）— 三轮回顾（9-24/10-09 G5/10-09 G1-G5）consolidate 的 residual closeout：**R1（high）** watch-runner 实例化 view/style cache → 闭合 G5 生产效能路径（当前空转）+ R6/R7/R8/R4/R9 低风险小修。Non-acceptance: R3（HMR 前）/R5（非缺陷）/X1（归档不可变）/R2（已降级）。行为 0（one-shot diff=0 不变；watch cache 启用字节恒等）。[residuals tracker](../fe-tools/incremental-chain-residuals.md)。

后续未 formalize 的候选：
- load/compile 分离（三车道 parse-walk 拆 Loader + Compiler）— 不急；当前交织不影响功能/增量/正确性；等 HMR 立项时需求驱动再做
- **worker-runtime 独立 package** — 5/7 文件已纯（零耦合）；2 处耦合待解：①`define-engine.ts` 默认 `successPayload` 读 `env.ts getDependencyGraph`（改默认 `() => ({})`，style 显式写）；②`executor.ts` 硬编码 4 个 entry 路径 + import `worker-pool.ts`（加 `entryPath` + `workerPool` 参数）。解耦后可 `mv` 提取，零代码改。**触发条件：有外部消费者时**
- Orchestrator 实现 → [`fe-tools-packer-orchestrator`](_archive/complete/fe-tools-packer-orchestrator/README.md)（**`complete`**；D-OR-0..8）
- **单次 / Bundler Session 级持久 `PackerSessionState`**（跨多次 `.build()` 复用 graph·cache；今日单次短命保现状）——前置：packer-orchestrator complete；触发：有可量化复用收益或产品要求 Session 级缓存
- **`orchestrate` 返回值收敛为形状 `EmitEntry[]`**（本门 D-OR-7 返回 buildResult）——前置：packer-orchestrator complete
- HMR patch 产物（前置：watch 增量闭环）
- deriveFromGraph 接入 production（前置：watch 增量 + HMR）

- [`fe-tools-hmr-compiler`](_archive/complete/fe-tools-hmr-compiler/README.md)（**`complete`**）— 编译侧 HMR 伞（H1-H4 全 complete + Phase 2 全交付）：load/compile 分离 + deriveFromGraph 接线 + registry 实体化 + per-module HMR push，使 dev server 增量推送（非全量 reload）。前置：增量链 G1-G5+IRC+SMPU complete。Non-scope: runtime HMR API（运行时侧）+ 整包 Packer extraction（已否决）。4 子门预判（H1-H4）；design.draft 规模评估待做。目录 cycle 消解（①②③）为副产品。

- [`fe-tools-hmr-registry-materialize`](_archive/complete/fe-tools-hmr-registry-materialize/README.md)（**`complete`**）— HMR-compiler H2 子门：emptyRegistry → 实体化（Loader/Compiler/Emitter 替代 compile-target）。D-REG-1/2/3 locked + F-H2-1 viewParseWalk 拆分（规模 L+）。
- [`fe-tools-hmr-per-module-cache`](_archive/complete/fe-tools-hmr-per-module-cache/README.md)（**`complete`**）— HMR-compiler H3 子门：G5 per-page-bundle → per-module。D-PMC-1 stored order metadata locked（actual probe PASS 3 项目 + vant 4.86x dedup 实证）。
- [`fe-tools-hmr-push`](_archive/complete/fe-tools-hmr-push/README.md)（**`complete`**）— HMR-compiler H4 子门：dev-reload L_HMR + 增量 payload + materialize 增量化。runtime fallback L1。design.draft 实证待做。

### HMR 血缘 residuals（2026-10-09 · draft 已立项）

- [`fe-tools-hmr-chain-residuals`](_archive/complete/fe-tools-hmr-chain-residuals/README.md)（**`complete`**）— 伞 close 后复盘浮出"三档证据分级"（代码/接线/证据）：F-HR-1 loaderRegistry 注册零消费、F-HR-2 enableHmr 无生产设值点（与 D-PUSH-2 locked 不符）、F-HR-3 selective 仅 compileML 直调无链路证据；+ R3（条件过期）+ ③ 下沉。design gates：D-HR-1 locked B（首消费点渐进）、D-HR-2 locked b（flag-gated 默认关）、D-HR-3 locked stage-channel 边界级。**交付**：R-HR-2/3/4/5 done + D-HR-1 (a) done（(b)/(c) blocked Non-scope 接口演进 deferred）。
