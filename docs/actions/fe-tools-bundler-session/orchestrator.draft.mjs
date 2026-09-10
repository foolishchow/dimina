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
 * Plugin / use(): NOT this Action’s primary delivery — OPEN / deferred.
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
  config.draft.mjs          ResolvedBundlerInput           today CLI / API
  ----------------------    ---------------------------    -----------------
  root                      workPath                       -c / workPath
  outDir                    targetPath (build only)        -s / targetPath
  server.outDir (file)      targetPath (dev only, D-R1)    -s overrides
  useAppIdDir               useAppIdDir                    --no-app-id-dir
  compile.* (C1 only)       compile                        resolveCompileConfig
  fileTypes (top-level)     fileTypes                      build options.fileTypes
  server.host/port          server.host/port (dev)         --host / -p
  (no field)                command                        'build' | 'dev'
  (no field)                lifecycle                      test inject only
  plugins                   — OPEN

  D-R1  dev: file.outDir ignored for targetPath
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
 * @property {(host: string, port: number) => Promise<void>} listen
 * @property {() => void} [notifyBuildPublished]
 * @property {(err: Error) => void} [notifyBuildError]
 * @property {(msg: string) => void} [notifyBuildWarning]
 * @property {() => Promise<void> | void} [close]
 */

// ---------------------------------------------------------------------------
// #3 Session lifecycle / concurrency rules (draft)
// ---------------------------------------------------------------------------
/*
  R1  One BundlerSession → at most one active watch/dev loop (`activeLoop`).
  R2  .build() may be called repeatedly on a session without watch (one-shot OK).
  R3  After .watch() or .dev() has started, a second .watch()/.dev() throws until
      the loop is released: watcher.stop() or devHandle.close() clears `activeLoop`.
  R4  .build() while watch/dev is active: throw (no parallel runBuild on same session).
  R5  Plugin use(): deferred / not this Action’s primary delivery — probe always throws OPEN.
  R6  Session does not load config files; caller passes ResolvedBundlerInput.
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
		 * Real impl: createBuildWatcher({ ..., lifecycle: state.lifecycle }).
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
				lifecycle: state.lifecycle,
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
		 *  [x] lifecycle.on(BUNDLE_PUBLISHED | BUILD_ERROR | BUILD_WARNING)
		 *  [x] default targetPath = OS temp when -s omitted (resolve D-R1)
		 *  [ ] buildId counter for synthesizeReloadLevel (impl detail)
		 *  [ ] sdkRoot resolution stays in adapter / existing helper
		 *  note: aligns with today’s bin/dev hard-coded mode/platform (D-R2/C)
		 */
		async dev(devOpts = {}) {
			assertCanStartLoop(state, 'dev')

			const {
				previewAdapter,
				onError,
				onRebuild,
				host,
				port,
				...unknown
			} = devOpts

			void unknown

			const adapter = previewAdapter ?? createWebPreviewAdapterDraft()
			const serverCfg = {
				...state.server,
				...pickDefined({ host, port }),
			}

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

			const buildResult = await watcher.start()

			await adapter.createServer({
				serveRoot: state.targetPath,
				appId: buildResult.appId,
				host: serverCfg.host,
				port: serverCfg.port,
			})

			state.lifecycle.on('bundle:published', () => adapter.notifyBuildPublished?.())
			state.lifecycle.on('build:error', ({ error }) => adapter.notifyBuildError?.(error))
			state.lifecycle.on('build:warning', ({ message }) => adapter.notifyBuildWarning?.(message))

			await adapter.listen(serverCfg.host ?? '127.0.0.1', serverCfg.port ?? 8080)
			await watcher.listen()

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

		/**
		 * Plugin API deferred — not this Action’s primary delivery.
		 * Pipeline-as-plugins (app/page load, etc.) = later Action; see stages.draft.md.
		 */
		use(_plugin) {
			draftTodo('plugins deferred — not fe-tools-bundler-session primary delivery')
		},
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

function pickDefined(obj) {
	const out = {}
	for (const [k, v] of Object.entries(obj)) {
		if (v !== undefined) {
			out[k] = v
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
		notifyBuildWarning() {},
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
  resolveBundlerConfig           = BEFORE session (config.draft P1–P6)
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
