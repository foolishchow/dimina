# Bundler session orchestration — DRAFT (index)

Action: **`fe-tools-bundler-session`** (renamed from `fe-tools-bundler-core`)

**Vivid source:** [orchestrator.draft.mjs](./orchestrator.draft.mjs)

| Sibling | Role |
| --- | --- |
| [config.draft.mjs](./config.draft.mjs) | tool config knobs |
| [resolve.draft.mjs](./resolve.draft.mjs) | `resolveBundlerConfig` |
| [config.draft.types.js](./config.draft.types.js) | `ResolvedBundlerInput` |
| [stages.draft.md](./stages.draft.md) | **Builtin 阶段/能力表** ↔ 今日函数（无 plugin API） |

## Resolve decisions (D-R1..D-R4)

| ID | Rule |
| --- | --- |
| D-R1 | dev `targetPath`: cli/api `targetPath` / temp（NO file layer this Action） |
| D-R2 | `command:'dev'` seeds `mode`/`platform`; post-merge **must** stay `dev`+`web` else **hard-fail (C)**; other C1 free; session uses Resolved as-is |
| D-R3 | `Resolved.server` = `{ host, port }` only — **唯一来源**；`.dev()` 无 host/port 覆盖入口（CLI `--host`/`-p` 走 cli 层） |
| D-R4 | dev `targetPath` **omits** `api.outDir` — use `api.targetPath` |

## Session wiring (accepted for draft)

| Item | Decision |
| --- | --- |
| Bare `watch().stop()` | clears `activeLoop` (R3) |
| `.dev()` | **must** call `session.watch()` — no bypass |
| CLI `build -w` | **⊆ session** |
| `createBuildWatcher` export | keep as low-level/compat; CLI must not use it |
| Pipeline stages | stay in `runBuild`; see [stages.draft.md](./stages.draft.md) |
| Plugin / `use` | **absent this Action** — session exposes NO `use()`; `api.plugins` reserved |

## Product doors (this Action)

O1 build → O2 watch → O3 dev  

Later Actions: extract stage graph · pipeline-as-plugins (app/page load, etc.)
