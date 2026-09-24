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
 * S2 (fe-tools-session-unify): R3/R4 assertion + activeLoop occupy/release
 *   are kernel-owned (runner.js: assertLoopFree / occupyLoop / releaseLoop;
 *   runOnce internalizes the R4 idle-check). Shells hold no direct
 *   `state.activeLoop` access.
 *
 * M-F1: this module imports default `build` from '../index.ts' (runBuild is
 * private). src/index.js must NOT re-export this module (ESM cycle, M-K1/B);
 * the public surface is `exports["./session"]` (mirrors the ./watch
 * precedent). KNOWN LIMITATION (accepted, A1 v1): lifecycle has no off();
 * listeners mounted by .dev() (O3) stay after rollback/close — harmless but
 * they accumulate across dev cycles.
 */

import { createBuildWatcher } from '../watch/watch-runner.ts'
import { createLifecycle } from '../shared/lifecycle.ts'
import { createWebPreviewAdapter } from './preview-adapter.ts'
import { createProjectStore } from '../packer/store/project-store.ts'
import { createSessionRunner, COMPILE_KEYS } from './runner.ts'
import type { ResolvedBundlerInput } from './resolve.ts'
import type { ReloadContext } from './preview-adapter.ts'
import type { BuildModel } from '../model/build-model.ts'

/** server on Resolved / session — host/port only (D-R3) */
const SERVER_KEYS = Object.freeze(['host', 'port'])

export { resolveBundlerConfig } from './resolve.ts'

type Lifecycle = ReturnType<typeof createLifecycle>
type ProjectStore = ReturnType<typeof createProjectStore>

export interface SessionState {
	workPath: string
	targetPath: string
	useAppIdDir: boolean
	compile: Record<string, unknown>
	fileTypes?: Record<string, unknown>
	server?: Record<string, unknown>
	lifecycle: Lifecycle
	activeLoop: null | 'watch' | 'dev'
	store: ProjectStore
	buildModel?: BuildModel
}

export interface WatchOpts {
	autoListen?: boolean
	beforeBuild?: (ctx: ReloadContext) => void | Promise<void>
	onRebuild?: (ctx: Record<string, unknown>) => void
	onError?: (error: Error) => void
	options?: Record<string, unknown>
	lifecycle?: unknown
}

export interface DevOpts {
	previewAdapter?: ReturnType<typeof createWebPreviewAdapter>
	onError?: (error: Error) => void
	onRebuild?: (ctx: Record<string, unknown>) => void
	hmr?: boolean
}

/**
 * @param {object} resolved ResolvedBundlerInput (from resolveBundlerConfig)
 * @returns {object} BundlerSession
 */
export function createBundler(resolved: ResolvedBundlerInput) {
	assertResolved(resolved)

	const state: SessionState = {
		workPath: resolved.workPath,
		targetPath: resolved.targetPath,
		useAppIdDir: resolved.useAppIdDir !== false,
		compile: pickKeys(resolved.compile, COMPILE_KEYS),
		fileTypes: resolved.fileTypes,
		server: resolved.server ? pickKeys(resolved.server, SERVER_KEYS) : undefined,
		/** Unique per session; A1 bus — hook rail, not the orchestrator itself */
		lifecycle: (resolved as ResolvedBundlerInput & { lifecycle?: Lifecycle }).lifecycle ?? createLifecycle(),
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
		 * the session runner — runOnce composes options (C1/pipeline whitelist
		 * merge + fileTypes default + store/lifecycle injection, forced last)
		 * and enforces the R4 idle-check (S2).
		 *
		 * @param {object} [overrides] C1 keys + pipeline keys (whitelist);
		 *   unknown keys throw.
		 */
		async build(overrides: Record<string, unknown> = {}) {
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
		watch(watchOpts: WatchOpts = {}) {
			// R3 check first (message/text order preserved — R-SU4); occupyLoop
			// below re-asserts, a no-op in the sync flow after creation succeeds.
			runner.assertLoopFree('watch')
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
				beforeBuild: beforeBuild as (() => void | Promise<void>) | undefined,
				onRebuild: onRebuild as (() => void) | undefined,
				onError,
				options: baseOptions,
			})

			// R3: occupy from CREATION — only after creation succeeded (a creation
			// failure must NOT leave the loop occupied).
			runner.occupyLoop('watch')

			// waitForIdle is @internal (test-only via direct createBuildWatcher) —
			// deliberately NOT forwarded on this handle.
			return {
				start: (...args: Parameters<typeof inner.start>) => inner.start(...args),
				listen: (...args: Parameters<typeof inner.listen>) => inner.listen(...args),
				async stop(...args: Parameters<typeof inner.stop>) {
					try {
						await inner.stop(...args)
					}
					finally {
						runner.releaseLoop()
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
		async dev(devOpts: DevOpts = {}) {
			// R3 check with the dev flavor (message preserved — R-SU4); the actual
			// occupy happens via session.watch below with label 'watch' (D-SU-4).
			runner.assertLoopFree('dev')
			const {
				previewAdapter,
				onError,
				onRebuild,
				hmr,
				...unknown
			} = devOpts
			const unknownKeys = Object.keys(unknown)
			if (unknownKeys.length > 0) {
				throw new TypeError(`dev opts: unknown keys ${unknownKeys.join(', ')}`)
			}

			const adapter = previewAdapter ?? createWebPreviewAdapter({ hmr: hmr ?? false })

			const watcher = session.watch({
				autoListen: false,
				beforeBuild: (ctx) => adapter.setPendingReload(ctx),
				onError,
				onRebuild: onRebuild as WatchOpts['onRebuild'],
				options: {
					fileTypes: state.fileTypes,
					skipMaterialize: !previewAdapter,
				},
			})

			// R7: startup-failure rollback — on any failure below, stop the
			// started watcher, close the adapter, clear activeLoop, rethrow.
			try {
				const buildResult = await watcher.start()

				state.buildModel = (buildResult as { buildModel?: BuildModel }).buildModel

				await adapter.createServer({
					serveRoot: state.targetPath,
					appId: (buildResult as { appId: string }).appId,
					artifactResolver: (path: string) => state.buildModel?.getArtifact(path) ?? null,
				})

				// KNOWN LIMITATION (A1 v1, no off()): these stay mounted after
				// rollback/close — accumulate, but harmless (see above).
				state.lifecycle.on('bundle:published', () => adapter.notifyBuildPublished())
				state.lifecycle.on('build:end', (({ result }: { result?: { buildModel?: BuildModel } }) => {
					state.buildModel = result?.buildModel
				}) as (payload: unknown) => void)
				state.lifecycle.on('build:error', (({ error }: { error?: { message?: string } }) => {
					adapter.notifyBuildError(error?.message || 'build failed')
				}) as (payload: unknown) => void)

				const { port, host } = await adapter.listen(
					(state.server?.port as number) ?? 8080,
					(state.server?.host as string) ?? '127.0.0.1',
				)
				await watcher.listen()

				return {
					appId: (buildResult as { appId: string }).appId,
					server: { host, port },
					async close() {
						try {
							await watcher.stop()
							await adapter.close()
						}
						finally {
							runner.releaseLoop()
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
				runner.releaseLoop()
				throw error
			}
		},
	}

	return session
}

function assertResolved(resolved: ResolvedBundlerInput) {
	if (!resolved || typeof resolved !== 'object') {
		throw new TypeError('createBundler requires a ResolvedBundlerInput object')
	}
	if (typeof resolved.workPath !== 'string' || typeof resolved.targetPath !== 'string') {
		throw new TypeError('ResolvedBundlerInput.workPath / targetPath must be strings')
	}
}

function pickKeys(obj: unknown, keys: readonly string[]): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	if (!obj || typeof obj !== 'object') {
		return out
	}
	const record = obj as Record<string, unknown>
	for (const key of keys) {
		if (Object.hasOwn(record, key)) {
			out[key] = record[key]
		}
	}
	return out
}