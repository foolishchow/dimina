/**
 * @file Dimina bundler — **DRAFT** orchestrator probe (design only)
 *
 * Action: fe-tools-bundler-session
 * Status: NOT frozen · NOT imported by runtime · NOT an implementation
 *
 * Sibling config: ./config.draft.mjs
 * Sibling resolve: ./resolve.draft.mjs  ← load main line (build/dev)
 * Builtin stages: ./stages.draft.md     ← inventory ↔ today’s functions (no plugin API)
 * Narrative index: ./orchestrator.draft.md (thin pointer; this file is the vivid source)
 *
 * Review fixes: round-2 #1–5; round-3 watch.stop / .dev via session.watch / CLI -w;
 * resolve D-R1..D-R4 (D-R2/C hard-fail on mode/platform drift; D-R4 no api.outDir on dev).
 *
 * Intent: show ownership and call shape in code form so we can discuss line-by-line.
 * Anything that throws `draftTodo` is explicitly undecided or later.
 * Plugin / use(): NOT this Action — session exposes NO use(); `api.plugins` reserved only.
 */

/** @typedef {import('./config.draft.types.js').ResolvedBundlerInput} ResolvedBundlerInput */

function draftTodo(message) {
	throw new Error(`[orchestrator.draft] ${message}`)
}

/** Compile profile keys only (config C1) — never treat as free-form bag */
const COMPILE_KEYS = Object.freeze(['mode', 'platform', 'minify', 'sourcemap', 'esTarget'])

/** Pipeline opts allowed beside compile when calling build/watch (not C1) */
const PIPELINE_OPTION_KEYS = Object.freeze([
	'fileTypes',
	'stages',
	'affectedEntries',
	'seedPath',
	'dependencyGraph',
	'prepareConfig',
	'prepareNpm',
])

/** server on Resolved / session — host/port only (D-R3) */
const SERVER_KEYS = Object.freeze(['host', 'port'])

// ---------------------------------------------------------------------------
// #2 config.draft ↔ ResolvedBundlerInput map
// ---------------------------------------------------------------------------
/*
  api layer (config.draft)  ResolvedBundlerInput           today CLI / API
  ----------------------    ---------------------------    -----------------
  root                      workPath                       -c / workPath
  outDir                    targetPath (build only)        -s / targetPath
  useAppIdDir               useAppIdDir                    --no-app-id-dir
  compile.* (C1 only)       compile                        resolveCompileConfig
  fileTypes (top-level)     fileTypes                      build options.fileTypes
  server.host/port          server.host/port (dev)         --host / -p
  (no field)                command                        'build' | 'dev'
  (no field)                lifecycle                      test inject only
  plugins                   — reserved (api.plugins; not loaded)

  D-R1  dev: targetPath ← cli/api targetPath | temp (NO file layer this Action)
  D-R2  dev: seeds mode=dev/platform=web; post-merge drift → hard-fail (C);
        other C1 still overridable; session.dev() uses Resolved as-is
  D-R3  Resolved.server = { host, port } only
  D-R4  dev: api.outDir ignored for targetPath (use api.targetPath)

  resolveBundlerConfig(...)  ← BEFORE createBundler (owns D-R2/C assert)
  createBundler(resolved)    ← does NOT load files
*/

// ---------------------------------------------------------------------------
// #5 facade matrix — ACCEPTED wiring rules (discussion 2026-09-10, round 3)
// ---------------------------------------------------------------------------
/*
  Public today                         Future wiring (ACCEPTED for draft)
  ---------------------------------    ------------------------------------------
  export default build(...)            one-shot: createBundler(resolved).build()
  @dimina/bundler/watch
    createBuildWatcher(...)            KEEP as low-level/compat export for now.
                                       May stay a thin primitive used BY session.watch,
                                       or later deprecate in docs — TBD at O2 impl.
                                       MUST NOT be the path dimina-cli uses.
  dimina-cli build                     resolve → createBundler → .build()
  dimina-cli build -w                  resolve → createBundler → .watch() → start()
                                       *** CLI -w ⊆ session (FROZEN for this draft) ***
  dimina-cli dev                       resolve → createBundler → .dev()  (O3)
                                       .dev MUST call session.watch() (not bypass)

  One-shot default `build()` creates a fresh session each call (no long-lived
  plugins — plugin API deferred). Long-lived orchestration uses an explicit createBundler().
*/

// ---------------------------------------------------------------------------
// Conceptual stage graph (still inside runBuild today).
// Full capability table ↔ today’s functions: ./stages.draft.md
// Extraction / pipeline-as-plugins = later Action — not fe-tools-bundler-session.
// ---------------------------------------------------------------------------

export const STAGE_GRAPH_DRAFT = Object.freeze({
	note: 'Conditional edges are NOT executable — see stages.draft.md; extraction = later Action',
	init: Object.freeze([
		'collect-config',
		'prepare-dist',
		// conditional: skip if seedPath && prepareConfig===false
		'compile-app-config',
		// conditional: skip if seedPath && prepareNpm===false
		'build-npm',
	]),
	compile: Object.freeze({
		concurrent: true,
		stages: Object.freeze(['view', 'logic', 'style']),
		// conditional: mini-game → logic only (omit view/style)
	}),
	publish: Object.freeze(['publish-to-dist']),
})

// ---------------------------------------------------------------------------
// Preview adapter — sequenced by session.dev (D1a); not the orchestrator kernel
// ---------------------------------------------------------------------------

/**
 * @typedef {object} PreviewAdapter
 * @property {(payload: object) => void} setPendingReload
 * @property {(opts: object) => Promise<void> | void} createServer
 * @property {(host: string, port: number) => Promise<{ port: number, host: string }>} listen
 * @property {() => void} [notifyBuildPublished]
 * @property {(err: Error) => void} [notifyBuildError]
 * @property {() => Promise<void> | void} [close]
 */

// ---------------------------------------------------------------------------
// #3 Session lifecycle / concurrency rules (draft)
// ---------------------------------------------------------------------------
/*
  R1  One BundlerSession → at most one active watch/dev loop (`activeLoop`).
  R2  .build() may be called repeatedly on a session without watch (one-shot OK).
      Concurrent build×build is NOT guarded — semantics equal today's concurrent
      default build() calls (lifecycle events interleave; ALS per-build safe).
  R3  A watch handle OCCUPIES `activeLoop` from CREATION (before start()); a second
      .watch()/.dev() throws until released via watcher.stop() (works even if never
      started) or devHandle.close(). A FAILED watcher.start() does NOT auto-release
      — caller may retry start() or call stop() to release.
  R4  .build() while watch/dev is active: throw (no parallel runBuild on same session).
  R5  Plugin use(): absent this Action — session exposes NO use() method; `api.plugins` reserved.
  R6  Session does not load config files; caller passes ResolvedBundlerInput.
  R7  Startup-failure rollback (.dev()): if any internal step fails (watcher.start /
      adapter.createServer / lifecycle wiring / listen), the session MUST roll back —
      stop the started watcher, close the adapter, clear `activeLoop`, rethrow — and
      remain reusable (activeLoop/resources). KNOWN LIMITATION (accepted 2026-09-10):
      lifecycle has no off() (A1 v1); the 3 dev-registered listeners stay mounted
      after rollback/close — harmless (dev-server close clears clients; broadcast
      checks readyState) but they ACCUMULATE across dev cycles. Revisit if A1 adds
      off(); dev should then unmount ONLY its own listeners.
      Bare .watch() is exempt (start failure keeps started=false;
      retry start() or stop() to release).
*/

/**
 * @param {ResolvedBundlerInput} resolved
 */
export function createBundler(resolved) {
	assertResolved(resolved)

	const state = {
		workPath: resolved.workPath,
		targetPath: resolved.targetPath,
		useAppIdDir: resolved.useAppIdDir !== false,
		compile: pickKeys(resolved.compile, COMPILE_KEYS),
		fileTypes: resolved.fileTypes,
		server: resolved.server ? pickKeys(resolved.server, SERVER_KEYS) : undefined,
		/** Unique per session; A1 bus — hook rail, not the orchestrator itself */
		lifecycle: resolved.lifecycle ?? createLifecycleDraft(),
		/** @type {null | 'watch' | 'dev'} */
		activeLoop: null,
	}

	const session = {
		/** @internal probe */ _state: state,

		/**
		 * Read-only: this session's unique lifecycle (Background gap ③ — "lifecycle 非经会话暴露").
		 * Mount listeners with on(); emit is NOT part of the promised surface (A1 internal).
		 */
		lifecycle: state.lifecycle,

		/**
		 * One-shot compile (O1). Meaningful product door with .watch (O2).
		 * Real impl: today’s runBuild with lifecycle injected.
		 */
		async build(overrides = {}) {
			assertNoActiveLoop(state, 'build')
			const { compileOverrides, pipelineExtras } = splitBuildOverrides(overrides)
			const options = {
				...state.compile,
				...compileOverrides,
				...pipelineExtras,
				fileTypes: pipelineExtras.fileTypes ?? state.fileTypes,
				// #1 FORCED last — never allow overrides.lifecycle to win
				lifecycle: state.lifecycle,
			}
			return runBuildDraft(state.targetPath, state.workPath, state.useAppIdDir, options)
		},

		/**
		 * Watch loop sharing this session’s lifecycle (O2).
		 * Real impl: createBuildWatcher({ ..., options: { ..., lifecycle: state.lifecycle } }).
		 * Returned handle: stop() ALWAYS clears activeLoop (bare watch + used by .dev).
		 */
		watch(watchOpts = {}) {
			assertCanStartLoop(state, 'watch')
			const {
				autoListen,
				beforeBuild,
				onRebuild,
				onError,
				options: watchBuildOptions,
				lifecycle: _ignoredLifecycle,
				...rest
			} = watchOpts

			// Unknown keys: ignore in probe; freeze whitelist at O2 impl (do not draftTodo).
			void rest

			const { compileOverrides, pipelineExtras } = splitBuildOverrides(watchBuildOptions || {})
			const baseOptions = {
				...state.compile,
				...compileOverrides,
				...pipelineExtras,
				fileTypes: pipelineExtras.fileTypes ?? state.fileTypes,
				// FORCED last — never allow overrides.lifecycle to win (same as build path).
				// Real createBuildWatcher takes lifecycle via options.lifecycle (see bin/dev.js),
				// NOT as a top-level param — so it must live inside `options`.
				lifecycle: state.lifecycle,
			}

			const inner = createBuildWatcherDraft({
				targetPath: state.targetPath,
				workPath: state.workPath,
				useAppIdDir: state.useAppIdDir,
				autoListen,
				beforeBuild,
				onRebuild,
				onError,
				options: baseOptions,
			})

			state.activeLoop = 'watch'

			return {
				start: (...args) => inner.start(...args),
				listen: (...args) => inner.listen(...args),
				async stop(...args) {
					try {
						await inner.stop?.(...args)
					}
					finally {
						state.activeLoop = null
					}
				},
			}
		},

		/**
		 * Dev = session.watch(D1a) + preview adapter (O3). Later than O2.
		 * MUST go through session.watch() — no bypass to createBuildWatcher.
		 *
		 * D-R2/C: resolve already guaranteed mode:'dev'+platform:'web'; this
		 * method does not re-assert. Other C1 (minify/…) come from Resolved as-is.
		 *
		 * D1a alignment checklist vs fe/tools/bundler/src/bin/dev.js:
		 *  [x] autoListen:false → start() → createServer → lifecycle.on → listen → watcher.listen
		 *  [x] beforeBuild → setPendingReload
		 *  [x] lifecycle.on(BUNDLE_PUBLISHED | BUILD_ERROR) — today's dev.js has NO warning listener (L-G2)
		 *  [x] default targetPath = OS temp when -s omitted (resolve D-R1)
		 *  [x] buildId counter for synthesizeReloadLevel — ADAPTER state (per .dev() call), NOT session base
		 *  [ ] sdkRoot resolution stays in adapter / existing helper
		 *  note: aligns with today’s bin/dev hard-coded mode/platform (D-R2/C)
		 */
		async dev(devOpts = {}) {
			assertCanStartLoop(state, 'dev')

			// M-C2: server comes ONLY from Resolved.server (D-R3) — no host/port override
			// here; CLI --host/-p go through resolveBundlerConfig's cli layer.
			const {
				previewAdapter,
				onError,
				onRebuild,
				...unknown
			} = devOpts

			void unknown

			const adapter = previewAdapter ?? createWebPreviewAdapterDraft()

			const watcher = session.watch({
				autoListen: false,
				beforeBuild: (ctx) => {
					adapter.setPendingReload(synthesizeReloadLevelDraft(ctx))
				},
				onError,
				onRebuild,
				options: {
					fileTypes: state.fileTypes,
				},
			})
			state.activeLoop = 'dev'

			// R7: startup-failure rollback — on any failure below, stop the started
			// watcher, close the adapter, clear activeLoop, rethrow. Session stays
			// reusable after rollback (activeLoop/resources).
			// KNOWN LIMITATION (accepted): lifecycle has no off() (A1 v1); the 3
			// listeners registered below stay mounted after rollback/close — harmless
			// (dev-server close clears clients; broadcast checks readyState) but they
			// accumulate across dev cycles.
			try {
				const buildResult = await watcher.start()

				// host/port go to adapter.listen (real createDevServer does NOT take them);
				// sdkRoot resolved inside adapter (resolveSdkRoot), not a session param
				await adapter.createServer({
					serveRoot: state.targetPath,
					appId: buildResult.appId,
				})

				state.lifecycle.on('bundle:published', () => adapter.notifyBuildPublished?.())
				state.lifecycle.on('build:error', ({ error }) => adapter.notifyBuildError?.(error))
				// L-G2: NO build:warning listener — today's bin/dev.js mounts only the two above;
				// real dev-server has no notifyBuildWarning method

				await adapter.listen(state.server?.host ?? '127.0.0.1', state.server?.port ?? 8080)
				await watcher.listen()
			}
			catch (error) {
				try {
					await watcher.stop()
					await adapter.close?.()
				}
				catch {
					// best-effort cleanup; original error wins
				}
				state.activeLoop = null
				throw error
			}

			return {
				async close() {
					try {
						await watcher.stop()
						await adapter.close?.()
					}
					finally {
						state.activeLoop = null
					}
				},
			}
		},

		// Plugin API intentionally absent this Action: session does NOT expose use().
		// `api.plugins` is a reserved field only (resolve accepts but does not load).
		// Pipeline-as-plugins (app/page load, etc.) = later Action; see stages.draft.md.
	}

	return session
}

// ---------------------------------------------------------------------------
// Option helpers (#1 / #4)
// ---------------------------------------------------------------------------

function assertResolved(resolved) {
	if (!resolved || typeof resolved !== 'object') {
		draftTodo('createBundler requires ResolvedBundlerInput')
	}
	if (typeof resolved.workPath !== 'string' || typeof resolved.targetPath !== 'string') {
		draftTodo('ResolvedBundlerInput.workPath / targetPath required (from root / outDir)')
	}
}

function assertNoActiveLoop(state, method) {
	if (state.activeLoop) {
		draftTodo(`R4: session.${method}() forbidden while activeLoop=${state.activeLoop}`)
	}
}

function assertCanStartLoop(state, kind) {
	if (state.activeLoop) {
		draftTodo(`R3: cannot start ${kind}; activeLoop=${state.activeLoop}`)
	}
}

function pickKeys(obj, keys) {
	const out = {}
	if (!obj || typeof obj !== 'object') {
		return out
	}
	for (const key of keys) {
		if (Object.hasOwn(obj, key)) {
			out[key] = obj[key]
		}
	}
	return out
}

/**
 * Split overrides: compile (C1) vs allowed pipeline keys.
 * Strips lifecycle / unknown keys (unknown → draftTodo when present).
 */
function splitBuildOverrides(overrides) {
	if (!overrides || typeof overrides !== 'object') {
		return { compileOverrides: {}, pipelineExtras: {} }
	}
	const compileOverrides = {}
	const pipelineExtras = {}
	const unknown = []
	for (const [key, value] of Object.entries(overrides)) {
		if (key === 'lifecycle') {
			continue // never taken from overrides — session forces it
		}
		if (COMPILE_KEYS.includes(key)) {
			compileOverrides[key] = value
		}
		else if (PIPELINE_OPTION_KEYS.includes(key)) {
			pipelineExtras[key] = value
		}
		else {
			unknown.push(key)
		}
	}
	if (unknown.length > 0) {
		draftTodo(`build/watch overrides: unknown keys ${unknown.join(', ')}`)
	}
	return { compileOverrides, pipelineExtras }
}

// ---------------------------------------------------------------------------
// Stubs — stand-ins for today’s modules (not real imports)
// ---------------------------------------------------------------------------

function createLifecycleDraft() {
	const listeners = new Map()
	return {
		on(event, fn) {
			const bucket = listeners.get(event) || []
			bucket.push(fn)
			listeners.set(event, bucket)
		},
		async emit(event, payload) {
			for (const fn of listeners.get(event) || []) {
				await fn(payload)
			}
		},
	}
}

async function runBuildDraft(_targetPath, _workPath, _useAppIdDir, _options) {
	draftTodo('delegate to real runBuild — probe only')
}

function createBuildWatcherDraft(_params) {
	return {
		async start() {
			draftTodo('delegate to createBuildWatcher — probe only')
		},
		async listen() {
			draftTodo('delegate to createBuildWatcher.listen — probe only')
		},
		async stop() {
			draftTodo('delegate to createBuildWatcher.stop — probe only')
		},
	}
}

function createWebPreviewAdapterDraft() {
	return {
		setPendingReload() {},
		async createServer() {
			draftTodo('wrap createDevServer — probe only')
		},
		async listen() {
			draftTodo('devServer.listen — probe only')
		},
		notifyBuildPublished() {},
		notifyBuildError() {},
		async close() {},
	}
}

function synthesizeReloadLevelDraft(_ctx) {
	return { reloadLevel: 0 }
}

// ---------------------------------------------------------------------------
// Layer legend
// ---------------------------------------------------------------------------
/*
  BundlerSession (this file)     = orchestration ENTRY
  resolveBundlerConfig           = BEFORE session (config.draft P1–P3)
  runBuild / workers / renderer  = PIPELINE (see stages.draft.md)
  lifecycle                      = HOOK RAIL (A1); orthogonal — not primary plugin model
  preview adapter / dev-*        = PREVIEW; sequenced by .dev()
  STAGE_GRAPH_DRAFT              = name sketch only; extraction = later Action
  plugins / use                  = NOT this Action’s primary delivery

  Product doors (this Action):
    O1  createBundler + .build + shared lifecycle
    O2  + .watch (+ CLI build -w ⊆ session)
    O3  + .dev + D1a adapter
  Later / other Actions:
    extract stage graph · pipeline plugins (app/page load as plugins)
*/
