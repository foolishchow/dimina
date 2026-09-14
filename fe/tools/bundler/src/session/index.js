/**
 * createBundler — shared bundler session.
 *
 * Action: fe-tools-bundler-session
 * O1 delivers .build only; .watch lands in O2, .dev in O3 (method-per-door
 * incremental exposure — see README door map).
 *
 * Concurrency rules R1–R7 (docs/actions/fe-tools-bundler-session/):
 *   R1 one session → at most one active watch/dev loop (`activeLoop`)
 *   R2 .build() repeatable without watch; concurrent build×build unguarded
 *      (semantics equal today's concurrent default build calls)
 *   R3 a watch handle OCCUPIES activeLoop from CREATION (before start());
 *      release via watcher.stop() (works even if never started) or
 *      devHandle.close(); a FAILED watcher.start() does NOT auto-release —
 *      retry start() or stop() to release
 *   R4 .build() while watch/dev active → throw
 *   R7 (O3) dev startup-failure rollback
 *
 * M-F1: this module imports default `build` from '../index.js' (runBuild is
 * private). src/index.js must NOT re-export this module (ESM cycle, M-K1/B);
 * the public surface is `exports["./session"]` (mirrors the ./watch
 * precedent). KNOWN LIMITATION (accepted, A1 v1): lifecycle has no off();
 * listeners mounted by .dev() (O3) stay after rollback/close — harmless but
 * they accumulate across dev cycles.
 */

import { createBuildWatcher } from '../watch/watch-runner.js'
import { createLifecycle } from '../shared/lifecycle.js'
import { createWebPreviewAdapter } from './preview-adapter.js'
import { createProjectStore } from '../model/project-store.js'
import { createSessionRunner, COMPILE_KEYS } from './runner.js'

/** server on Resolved / session — host/port only (D-R3) */
const SERVER_KEYS = Object.freeze(['host', 'port'])

export { resolveBundlerConfig } from './resolve.js'

/**
 * @param {object} resolved ResolvedBundlerInput (from resolveBundlerConfig)
 * @returns {object} BundlerSession
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
		lifecycle: resolved.lifecycle ?? createLifecycle(),
		/** @type {null | 'watch' | 'dev'} */
		activeLoop: null,
		/** PS1/RR5：session 创建即持有 ProjectStore（非可选；load 按需） */
		store: createProjectStore(),
	}

	  const runner = createSessionRunner(state)

	const session = {
		/**
		 * Read-only: this session's unique lifecycle (Background gap ③).
		 * Mount listeners with on(); emit is NOT part of the promised surface
		 * (A1 internal contract).
		 */
		lifecycle: state.lifecycle,

		/**
		 * One-shot compile (O1). Delegates to the public `build()` facade via
		 * the session runner (S1 kernel: runOnce composes options — C1/pipeline
		 * whitelist merge + fileTypes default + store/lifecycle injection,
		 * forced last — overrides.lifecycle never wins).
		 *
		 * @param {object} [overrides] C1 keys + pipeline keys (whitelist);
		 *   unknown keys throw.
		 */
		async build(overrides = {}) {
			assertNoActiveLoop(state, 'build')
			return runner.runOnce(overrides)
		},

		/**
		 * Watch loop sharing this session's lifecycle (O2). Delegates to
		 * createBuildWatcher with lifecycle injected via options.lifecycle
		 * (NOT a top-level param — watch-runner reads it from options, matching
		 * bin/dev.js wiring). The handle occupies activeLoop from CREATION (R3);
		 * stop() releases it (finally), even if start() was never called.
		 *
		 * @param {object} [watchOpts] whitelist: autoListen / beforeBuild /
		 *   onRebuild / onError / options (C1 + pipeline keys); unknown keys
		 *   throw; watchOpts.lifecycle is ignored (session forces its own).
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
			const unknownKeys = Object.keys(rest)
			if (unknownKeys.length > 0) {
				throw new TypeError(`watch opts: unknown keys ${unknownKeys.join(', ')}`)
			}

			// S1 (runner): shared options assembly (whitelist merge + fileTypes
			// default + maybe store; lifecycle forced via options.lifecycle, NOT a
			// top-level param — watch-runner reads it from options, matching
			// bin/dev.js wiring).
			const baseOptions = runner.composeOptions(watchBuildOptions || {})

			const inner = createBuildWatcher({
				targetPath: state.targetPath,
				workPath: state.workPath,
				useAppIdDir: state.useAppIdDir,
				// PS2：watch 与 build 共用同一 Store（state.store）——活图唯一权威
				store: state.store,
				autoListen,
				beforeBuild,
				onRebuild,
				onError,
				options: baseOptions,
			})

			state.activeLoop = 'watch'

			// waitForIdle is @internal (test-only via direct createBuildWatcher) —
			// deliberately NOT forwarded on this handle.
			return {
				start: (...args) => inner.start(...args),
				listen: (...args) => inner.listen(...args),
				async stop(...args) {
					try {
						await inner.stop(...args)
					}
					finally {
						state.activeLoop = null
					}
				},
			}
		},

		/**
		 * Dev = session.watch(D1a) + preview adapter (O3). MUST go through
		 * session.watch() — no bypass to createBuildWatcher.
		 *
		 * M-C2: server comes ONLY from Resolved.server (D-R3 as unique source);
		 * there is no host/port override here — CLI --host/-p go through
		 * resolveBundlerConfig's cli layer, API via api.server.
		 *
		 * R7 (accepted limitation): on any startup failure below, stop the
		 * started watcher, close the adapter, clear activeLoop, rethrow — the
		 * session stays reusable (activeLoop/resources). The 2 lifecycle
		 * listeners registered here stay mounted after rollback/close —
		 * harmless (dev-server close clears clients; broadcast checks
		 * readyState) but they accumulate across dev cycles.
		 *
		 * @param {object} [devOpts] whitelist: previewAdapter / onError /
		 *   onRebuild; unknown keys throw.
		 * @returns {Promise<{ appId: string, server: { host: string, port: number }, close(): Promise<void> }>}
		 */
		async dev(devOpts = {}) {
			assertCanStartLoop(state, 'dev')
			const {
				previewAdapter,
				onError,
				onRebuild,
				...unknown
			} = devOpts
			const unknownKeys = Object.keys(unknown)
			if (unknownKeys.length > 0) {
				throw new TypeError(`dev opts: unknown keys ${unknownKeys.join(', ')}`)
			}

			const adapter = previewAdapter ?? createWebPreviewAdapter()

			const watcher = session.watch({
				autoListen: false,
				beforeBuild: (ctx) => adapter.setPendingReload(ctx),
				onError,
				onRebuild,
				options: {
					fileTypes: state.fileTypes,
				},
			})

			// R7: startup-failure rollback — on any failure below, stop the
			// started watcher, close the adapter, clear activeLoop, rethrow.
			try {
				const buildResult = await watcher.start()

				await adapter.createServer({
					serveRoot: state.targetPath,
					appId: buildResult.appId,
				})

				// KNOWN LIMITATION (A1 v1, no off()): these stay mounted after
				// rollback/close — accumulate, but harmless (see above).
				state.lifecycle.on('bundle:published', () => adapter.notifyBuildPublished())
				state.lifecycle.on('build:error', ({ error }) => {
					adapter.notifyBuildError(error?.message || 'build failed')
				})

				const { port, host } = await adapter.listen(
					state.server?.port ?? 8080,
					state.server?.host ?? '127.0.0.1',
				)
				await watcher.listen()

				return {
					appId: buildResult.appId,
					server: { host, port },
					async close() {
						try {
							await watcher.stop()
							await adapter.close()
						}
						finally {
							state.activeLoop = null
						}
					},
				}
			}
			catch (error) {
				try {
					await watcher.stop()
					await adapter.close()
				}
				catch {
					// best-effort cleanup; original error wins
				}
				state.activeLoop = null
				throw error
			}
		},
	}

	return session
}

function assertResolved(resolved) {
	if (!resolved || typeof resolved !== 'object') {
		throw new TypeError('createBundler requires a ResolvedBundlerInput object')
	}
	if (typeof resolved.workPath !== 'string' || typeof resolved.targetPath !== 'string') {
		throw new TypeError('ResolvedBundlerInput.workPath / targetPath must be strings')
	}
}

/** R4: .build() is forbidden while a watch/dev loop is active. */
function assertNoActiveLoop(state, method) {
	if (state.activeLoop) {
		throw new Error(`R4: session.${method}() forbidden while activeLoop=${state.activeLoop}`)
	}
}

/** R3: a second .watch()/.dev() throws until the loop is released. */
function assertCanStartLoop(state, kind) {
	if (state.activeLoop) {
		throw new Error(`R3: cannot start ${kind}; activeLoop=${state.activeLoop}`)
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
