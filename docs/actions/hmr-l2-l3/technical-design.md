# Technical Design — hmr-l2-l3

## 1. Boundary

```text
DMCC compiler / dev server / ws protocol  (unchanged, container-neutral)
                         │ reloadLevel L2/L3
                         ▼
Web host (container-sdk) ── Web render (Vue/runtime)
                         │
                         ├─ L2: stylesheet replacement
                         └─ L3: module replacement → page remount → data replay

Native containers / bridge / production path: untouched
```

Feature flag is off by default outside `dmcc dev` and must not alter the normal Web path when disabled.

## 2. L2 CSS hot swap

The current loader creates `<link rel="stylesheet">` for app/page CSS. A3 adds a Web dev-only style registry keyed by `{ appId, pagePath, buildId }`:

1. receive a successful style reload for the target page;
2. load the new CSS URL with a cache-busting buildId;
3. wait for the new stylesheet to load;
4. atomically remove/disable the prior target stylesheet;
5. retain the prior stylesheet if loading fails.

The operation must not call service restart, `firstRender`, page remount, or logic reload. If the browser cannot safely replace the stylesheet, report capability failure and use A2's L1 fallback policy only where the host explicitly chooses it; the normal L2 failure keeps the old CSS.

## 3. L3 module replacement

Current facts: `loader.staticModules[path]` is a plain cache and `createModule` returns when the path already exists. A3 adds a dev-only replacement transaction, conceptually:

```js
replaceModule(path, nextModuleInfo, buildId) -> { commit, rollback }
```

Required transaction:

- reject stale `buildId` values;
- validate `nextModuleInfo` and recursively resolve its usingComponents/placeholders;
- keep the old `Module` and active page render until validation succeeds;
- replace the cache entry only at commit;
- rollback to the previous entry if registration/remount/replay fails.

Normal `loadResource`/`createModule` behavior remains unchanged when the feature flag is disabled.

## 4. Page remount and snapshot replay

Current facts: `runtime.setupData` maps `pageId` to reactive data; `updateModule` applies full or path-based setData updates; `firstRender` only remounts the whole app. A3 introduces a page-scoped transaction:

1. identify affected `pageId`/module path and capture a deep, serializable snapshot from the render-side data state;
2. freeze the target page's incoming update queue and retain updates arriving during the transaction;
3. replace the view module in the dev-only loader registry;
4. unmount only the target page subtree, preserving app/service and unrelated page instances;
5. mount the new page view;
6. replay the captured snapshot, then replay queued updates in order;
7. commit the new page only after render and replay complete; otherwise rollback/fallback L1.

The snapshot includes public setData state, not arbitrary Vue internals. `deepToRaw`/equivalent conversion must avoid retaining reactive proxies, DOM nodes, functions, canvas handles, or circular runtime objects.

## 5. Lifecycle and failure semantics

- `service` does not re-run firstRender and does not resend setData for L3.
- Every temporary listener/queue/DOM reference has a cleanup path in success, failure, and cancellation.
- A newer buildId supersedes an in-flight older transaction.
- Module replacement or replay failure emits a dev diagnostic and invokes the A2 L1 relaunch path; old page/service state remains active until fallback begins.
- Feature flag is checked at every new entry point so native/production paths cannot enter the HMR transaction.

## 6. Protocol boundary

A3 consumes A2's existing `{ type: 'reload', appId, changedStages, affectedPages, reloadLevel, buildId }` message without changing its shape. The dev server still synthesizes levels; the Web host executes:

- L2 → CSS transaction;
- L3 → view replace/remount/replay transaction;
- unsupported or failed L2/L3 → documented fallback;
- L0/L1 → A2 behavior unchanged.

## 7. Test strategy

Use Web render/container-sdk unit and integration tests with fake service/bridge boundaries. Required scenario matrix:

- first entry and initial data;
- return/relaunch and page stack;
- one and multiple setData path updates;
- rapid consecutive view/style builds with stale buildId;
- expand/collapse and component lifecycle loops;
- CSS load failure;
- module replacement validation failure;
- replay failure and L1 fallback;
- feature flag off and native/production guard.

## 8. Acceptance mapping

| Requirement | Design point |
| --- | --- |
| R-001/R-009 | §1 feature flag and Web-only boundary |
| R-002 | §2 |
| R-003 | §3 |
| R-004/R-005 | §4 |
| R-006/R-007 | §5 |
| R-008 | §6 |
| R-010/R-011/R-012 | §7 |
