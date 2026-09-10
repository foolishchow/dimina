# Technical Design — hmr-l2-l3

## 1. Boundary and HMR command channel

```text
DMCC compiler / dev server / ws protocol  (unchanged, container-neutral)
                         │ reloadLevel L2/L3 (ws, main thread)
                         ▼
Web host page (dev-host.js)          [main thread]
   └─ container.sendDevCommand({ type:'hmr', level, affectedPages, buildId })
        │ container-sdk bridge (target:'render')   ── F-A2 定案
        ▼
Web render runtime (pageFrame iframe) [Vue runtime]
   ├─ L2: stylesheet replacement (scoped app/page)
   └─ L3: module replacement → page remount → data replay

Native containers / bridge contract / production path: untouched
```

**Feature flag（F-A1 定案，运行时机制）**：dmcc dev 消费的是 container-sdk 的**生产构建 dist**（A2.0），`import.meta.env.DEV` 在该 dist 中已固化为 `false`，构建期条件不可用。因此 L2/L3 的开关是**运行时 opt-in**：

1. 宿主页 ws 订阅成功后，经 bridge 向 render 注入 dev 标志（如 `enableDevHmr(buildId)` 消息）；
2. render 侧 HMR 事务仅在标志开启**且**收到显式 `hmr` 指令时可达；
3. 原生四端与生产路径没有该消息类型与标志注入，天然隔离——不需要也不得依赖构建期 tree-shake 来移除能力。

**HMR 指令通道（F-A2 定案，P-006a 细化）**：宿主页 ws client 收到 `reloadLevel ∈ {L2, L3}` 的 reload 消息后，先调用 `container.sendDevCommand('enableDevHmr', {})`，再调用 `container.sendDevCommand('hmr', { level, affectedPages, changedStages, buildId })`；container-sdk 经现有 bridge（`target:'render'`）转发到 pageFrame iframe；render `message.on('enableDevHmr')` / `message.on('hmr')` 驱动 §2/§4 事务。该 API 仅在宿主页持有 ws 连接时被调用，不进入任何原生或生产调用图。

**P-006a 内部 envelope 与回传（定稿）**：A2 的 ws reload envelope 不变；以上 `hmr` body 是 Web 容器内部 envelope，字段固定为 `{ level: 'L2'|'L3', changedStages: string[], affectedPages: string[], buildId: positive integer }`。render 完成或拒绝后经 bridge 回传 `{ type:'hmr:result', body:{ buildId, level, status:'accepted'|'applied'|'fallback', reason? }, target:'container' }`；宿主页只在 `status:'fallback'` 或 `sendDevCommand()` 返回 false 时执行 A2 L1 `openApp({ destroy:true })`。`buildId` 必须单调，回传仅供诊断/控制确认，不修改 A2 `/ws` 消息形状。

Runtime flag stays off by default; no flag injection path exists outside `dmcc dev`.

## 2. L2 CSS hot swap

The current loader creates `<link rel="stylesheet">` for both the global `app.css` and per-page CSS (`loader.js:21-23`). A3 adds a Web dev-only style registry keyed by `{ scope: 'app' | 'page', appId, pagePath?, buildId }`（F-A3 定案：`app.wxss` 变更影响所有页面，走 `scope:'app'` 替换；页面样式走 `scope:'page'`）:

1. receive a successful style reload with its scope and target;
2. load the new CSS URL with a cache-busting buildId;
3. wait for the new stylesheet to load;
4. atomically remove/disable the prior stylesheet of the same scope+target;
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

1. identify affected `pageId`/module path and capture a deep **raw copy** of the render-side data state（F-A4 定案：快照 = `deepToRaw` 式深拷贝，**保留函数引用与 WXS dataFunction proxy 引用**（见 `render/src/core/data-function.js` 的引用 id 映射），**不是 JSON/structuredClone 序列化**——序列化会丢失 dataFunction 导致模板函数失效）；
2. freeze the target page's incoming update queue and retain updates arriving during the transaction;
3. replace the view module in the dev-only loader registry;
4. unmount only the target page subtree, preserving app/service and unrelated page instances;
5. mount the new page view;
6. replay the captured snapshot, then replay queued updates in order;
7. commit the new page only after render and replay complete; otherwise rollback/fallback L1.

The snapshot includes public setData state, not arbitrary Vue internals. The raw-copy conversion must strip reactive proxies, DOM nodes, and canvas handles, and handle circular references; function references are intentionally preserved where they are legitimate setData values（dataFunction proxies 经引用 id 机制保持映射，回放后仍可被模板调用）。

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
