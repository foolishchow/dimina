# Builtin stages / capabilities — DRAFT

Action: `fe-tools-bundler-session`  
Status: inventory only — **not** a plugin API · **not** extracted from `runBuild`

Purpose: name today’s hardwired pipeline pieces so later “pipeline as plugins” discussions have a shared table. Session **delegates** to `runBuild`; it does **not** own these stages in this Action.

Authoritative code today: [`fe/tools/bundler/src/index.js`](../../../../../fe/tools/bundler/src/index.js) (`runBuild`), [`env.js`](../../../../../fe/tools/bundler/src/env.js), [`core/*`](../../../../../fe/tools/bundler/src/core/).

Related probe constant: `STAGE_GRAPH_DRAFT` in [orchestrator.draft.mjs](./orchestrator.draft.mjs) (names only; O5 / future Action extracts).

---

## Pre-pipeline (before Listr / outside stage graph)

| Capability (draft id) | Today | Notes |
| --- | --- | --- |
| `resolve-compile-options` | `resolveCompileConfig({ apiOptions })` in `runBuild` | CF-1; hard-fail before `build:start` |
| `resolve-renderers` | `resolveProjectRenderers(workPath)` + `getRenderer` / `assertRendererSupportsPlatform` | Light re-read of `app.json` / page json **before** `storeInfo` |

These are **not** session responsibilities beyond passing `workPath` + compile options. Future bundler-config resolve (`resolveBundlerConfig`) is a **tool** layer, separate from mini-program load.

---

## Init (`runBuild` → Listr「初始化项目」)

| Stage id (draft) | Listr title (today) | Today entry | Sub-capabilities (today functions) | Lifecycle emit |
| --- | --- | --- | --- | --- |
| `collect-config` | 收集配置信息 | `storeInfo(workPath, { fileTypes, dependencyGraph })` | See **collect-config breakdown** below; then `DependencyGraph` wrap | `config:collected` |
| `prepare-dist` | 准备产物目录 | `createDist(seedPath)` | `common/publish.js` | `dist:prepared` |
| `compile-app-config` | 编译配置信息 | `compileConfig()` | `core/config-compiler.js` (default export) | `config:compiled` |
| `build-npm` | 构建 npm 包 | `npmBuilder.buildNpmPackages()` | `common/npm-builder.js` | `npm:built` |

Conditional (today): `compile-app-config` / `build-npm` skipped when `seedPath` set and `prepareConfig` / `prepareNpm` === `false`.

### `collect-config` breakdown (`storeInfo`)

| Capability (draft id) | Today function | Role |
| --- | --- | --- |
| `normalize-file-types` | `normalizeFileTypes` (via `storeInfo`) | wx/dd builtins + optional append |
| `store-path-info` | `storePathInfo` | `workPath` (+ legacy env `TARGET_PATH` / temp side path) |
| `load-project-config` | `storeProjectConfig` | `project.config.json` ⊕ `project.private.config.json` |
| `detect-runtime-type` | `detectRuntimeType` | miniprogram vs mini-game |
| `load-app-config` | `storeAppConfig` | **`app.json`** or **`game.json`** → `configInfo.appInfo` |
| `load-page-config` | `storePageConfig` | pages / subpackages json + `usingComponents` walk; mini-game no-op |
| `load-component-tree` | `storeComponentConfig` / `collectionPageJson` (callees of page load) | component graph into `configInfo` |
| `seed-dependency-graph` | `createInitialDependencyGraph` + merge option | initial graph JSON |

**Ownership (this Action):** still **pipeline / `env.js`**. Session only supplies `workPath` (+ optional `fileTypes`). No second project loader in session.

---

## Compile (`runBuild` → Listr「编译项目」· concurrent)

| Stage id (draft) | Listr title (today) | Today entry | Module | Notes |
| --- | --- | --- | --- | --- |
| `compile-view` | 编译视图 | `createStageTask('view', …)` | `core/view-compiler.js` (worker) | skipped if mini-game or stage disabled |
| `compile-logic` | 编译逻辑 | `createStageTask('logic', …)` | `core/logic-compiler.js` (worker) | |
| `compile-style` | 编译样式 | `createStageTask('style', …)` | `core/style-compiler.js` (worker) | skipped if mini-game; injects synthetic `app` style page |

Each stage: `stage:before` / `stage:after` / `stage:error` (A1).

---

## Publish

| Stage id (draft) | Listr title (today) | Today entry | Module | Lifecycle |
| --- | --- | --- | --- | --- |
| `publish-to-dist` | 写入编译产物 | `publishToDist(targetPath, useAppIdDir)` | `common/publish.js` | `bundle:published` |

Then `build:end` (success) or `build:error` (failure path).

---

## Outside `runBuild` (session / CLI orchestration — this Action)

| Capability | Today | Session draft role |
| --- | --- | --- |
| one-shot build | `build` / `runBuild` | `session.build()` → delegate |
| watch loop | `createBuildWatcher` | `session.watch()` → delegate; CLI `-w` ⊆ session |
| dev preview | `bin/dev.js` + `createDevServer` | `session.dev()` + preview adapter (D1a) |
| tool config resolve | *(none today)* | `resolveBundlerConfig` probe (paths/compile/server) |

---

## Explicit non-goals of this table

- Not a **plugin** / `apply` / `replaceStage` API.
- Not claiming these ids are frozen public names.
- Not requiring extraction in `fe-tools-bundler-session` (extraction = later Action; was BC-2).
- lifecycle `on` remains an **orthogonal hook rail**, not “the” plugin model.
