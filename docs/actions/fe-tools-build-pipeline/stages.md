# Builtin stages / capabilities

Action: `fe-tools-build-pipeline`  
Status: **inventory authority（RR1 · 2026-09-12）** — **not** a plugin API · **not yet** extracted from `runBuild`（extraction = BP1）  
Migrated from archived [`fe-tools-bundler-session/stages.draft.md`](../_archive/complete/fe-tools-bundler-session/stages.draft.md); paths updated for post-layout tree.

Purpose: name today’s hardwired pipeline pieces so BP1 can extract equivalently. Session **delegates** to `build()` / Pipeline；**不**拥有这些 stage 实现。

Authoritative code today:

- [`fe/tools/bundler/src/index.js`](../../../fe/tools/bundler/src/index.js) (`runBuild`)
- [`compiler/env.js`](../../../fe/tools/bundler/src/compiler/env.js) (`storeInfo` / ALS)
- [`compiler/*`](../../../fe/tools/bundler/src/compiler/)（阶段与 publish / npm）
- [`model/dependency-graph.js`](../../../fe/tools/bundler/src/model/dependency-graph.js)

Stage id 字符串 **未**冻结为公开 API；BP1 首刀等价抽取，可微调 id。

---

## Pre-pipeline (before Listr / outside stage graph)

| Capability (id) | Today | Notes |
| --- | --- | --- |
| `resolve-compile-options` | `resolveCompileConfig({ apiOptions })` in `runBuild` | CF-1; hard-fail before `build:start` |
| `resolve-renderers` | `resolveProjectRenderers(workPath)` + `getRenderer` / `assertRendererSupportsPlatform` | Light re-read of `app.json` / page json **before** `storeInfo` / Store.load |

These are **not** session responsibilities beyond passing `workPath` + compile options. `resolveBundlerConfig` remains tool-layer.

---

## Init (`runBuild` → Listr「初始化项目」)

| Stage id | Listr title (today) | Today entry | Module / notes | Lifecycle emit |
| --- | --- | --- | --- | --- |
| `collect-config` | 收集配置信息 | `storeInfo(workPath, { fileTypes, dependencyGraph })` 然后 `new DependencyGraph(...)` | `compiler/env.js`；**PS1 后**：`store.load` + **M-A** 挂 `ctx.dependencyGraph = store.getDependencyGraph()`（禁止再 `new` 一份挂 ctx） | `config:collected` |
| `prepare-dist` | 准备产物目录 | `createDist(seedPath)` | `compiler/publish.js` | `dist:prepared` |
| `compile-app-config` | 编译配置信息 | `compileConfig()` | `compiler/config-compiler.js` | `config:compiled` |
| `build-npm` | 构建 npm 包 | `npmBuilder.buildNpmPackages()` | `compiler/npm-builder.js` | `npm:built` |

Conditional (today): `compile-app-config` / `build-npm` skipped when `seedPath` set and `prepareConfig` / `prepareNpm` === `false`.

### `collect-config` breakdown (`storeInfo` / future `store.load`)

| Capability (id) | Today function | Role |
| --- | --- | --- |
| `normalize-file-types` | `normalizeFileTypes` (via `storeInfo`) | wx/dd builtins + optional append |
| `store-path-info` | `storePathInfo` | `workPath` (+ legacy env paths) |
| `load-project-config` | `storeProjectConfig` | `project.config.json` ⊕ `project.private.config.json` |
| `detect-runtime-type` | `detectRuntimeType` | miniprogram vs mini-game |
| `load-app-config` | `storeAppConfig` | **`app.json`** or **`game.json`** → `configInfo.appInfo` |
| `load-page-config` | `storePageConfig` | pages / subpackages json + `usingComponents` walk; mini-game no-op |
| `load-component-tree` | `storeComponentConfig` / `collectionPageJson` | component graph into `configInfo` |
| `seed-dependency-graph` | `createInitialDependencyGraph` + merge option | initial graph；L2 旧图经 `options.dependencyGraph`（RR10） |

**Ownership：** 装载/图 → **ProjectStore**（兄弟门）；阶段顺序与 Listr → **BuildPipeline**（本门 BP1）。Session 只供 `workPath` / options / `state.store`。

---

## Compile (`runBuild` → Listr「编译项目」· concurrent)

| Stage id | Listr title (today) | Today entry | Module | Notes |
| --- | --- | --- | --- | --- |
| `compile-view` | 编译视图 | `createStageTask('view', …)` | `compiler/view-compiler.js` (worker) | skipped if mini-game or stage disabled |
| `compile-logic` | 编译逻辑 | `createStageTask('logic', …)` | `compiler/logic-compiler.js` (worker) | |
| `compile-style` | 编译样式 | `createStageTask('style', …)` | `compiler/style-compiler.js` (worker) | skipped if mini-game; synthetic `app` style |

Each stage: `stage:before` / `stage:after` / `stage:error`（A1；**RR9**：零改语义）。

---

## Publish

| Stage id | Listr title (today) | Today entry | Module | Lifecycle |
| --- | --- | --- | --- | --- |
| `publish-to-dist` | 写入编译产物 | `publishToDist(targetPath, useAppIdDir)` | `compiler/publish.js` | `bundle:published` |

Then `build:end` (success) or `build:error` (failure path).

---

## Outside `runBuild` (session / CLI — not Pipeline stages)

| Capability | Today | Session role |
| --- | --- | --- |
| one-shot build | `build` / `runBuild` | `session.build()` → `build({ store: state.store, … })`（**RR4/RR5**） |
| watch loop | `createBuildWatcher` | `session.watch()` 注入 store；CLI `-w` ⊆ session |
| dev preview | `dev/` + preview-adapter | `session.dev()`；编译路径同构 |
| tool config resolve | `session/resolve.js` | `resolveBundlerConfig` |

---

## Explicit non-goals of this table

- Not a **plugin** / `apply` / `replaceStage` API（BP1 Non-goal）。
- Ids **not** frozen public names。
- Migrating this doc **≠** BP1 已交付（抽取仍须实施授权）。
- lifecycle `on` remains orthogonal hook rail（RR9）。
