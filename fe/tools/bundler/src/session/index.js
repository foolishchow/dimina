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

import build from '../index.js'
import { createLifecycle } from '../common/lifecycle.js'

/** Compile profile keys (config C1) — never treat as a free-form bag */
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
		/** Unique per session; A1 bus — hook rail, not the orchestrator itself */
		lifecycle: resolved.lifecycle ?? createLifecycle(),
		/** @type {null | 'watch' | 'dev'} */
		activeLoop: null,
	}

	const session = {
		/**
		 * Read-only: this session's unique lifecycle (Background gap ③).
		 * Mount listeners with on(); emit is NOT part of the promised surface
		 * (A1 internal contract).
		 */
		lifecycle: state.lifecycle,

		/**
		 * One-shot compile (O1). Delegates to today's public `build()` with the
		 * session's lifecycle injected via options.lifecycle (forced last —
		 * overrides.lifecycle never wins).
		 *
		 * @param {object} [overrides] C1 keys + pipeline keys (whitelist);
		 *   unknown keys throw.
		 */
		async build(overrides = {}) {
			assertNoActiveLoop(state, 'build')
			const { compileOverrides, pipelineExtras } = splitBuildOverrides(overrides)
			const options = {
				...state.compile,
				...compileOverrides,
				...pipelineExtras,
				fileTypes: pipelineExtras.fileTypes ?? state.fileTypes,
				// FORCED last — never allow overrides.lifecycle to win
				lifecycle: state.lifecycle,
			}
			return build(state.targetPath, state.workPath, state.useAppIdDir, options)
		},
	}

	return session
}

// ---------------------------------------------------------------------------
// option helpers
// ---------------------------------------------------------------------------

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

/**
 * Split overrides into compile (C1) vs pipeline keys. Strips lifecycle
 * (session forces its own); unknown keys throw.
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
		throw new TypeError(`build overrides: unknown keys ${unknown.join(', ')}`)
	}
	return { compileOverrides, pipelineExtras }
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
