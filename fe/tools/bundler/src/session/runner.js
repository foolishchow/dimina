/**
 * Session execution kernel (fe-tools-session-unify · S1).
 *
 * Owns the cross-entry shared logic for the bundler session:
 *   - composeOptions(overrides): C1/pipeline whitelist merge + fileTypes
 *     default + store/lifecycle injection (FORCED last — overrides.lifecycle
 *     never wins);
 *   - runOnce(overrides): one-shot compile invocation through the public
 *     `build()` facade (RR4: options.store injection).
 *
 * Routing (design.draft 职责表):
 *   .build()  → runOnce() (one-shot compile)
 *   .watch()  → composeOptions() output into createBuildWatcher (loop path)
 *   .dev()    → session.watch() composition (no bypass; inherited)
 *
 * S2 adds loop occupation/release (occupyLoop / releaseLoop) and internalizes
 * the R4 idle-check into runOnce — see implementation-plan.
 *
 * Internal module — NOT re-exported from session/index.js and never part of
 * the package exports map (D-SU-2 / P3; exports map is explicit in
 * package.json — absence of ./session/runner keeps it private).
 */

import build from '../index.js'

/** Compile profile keys (config C1) — never treat as a free-form bag.
 * Exported for session state picking (index.js) — single source of the
 * C1 whitelist vocabulary lives in the kernel. */
export const COMPILE_KEYS = Object.freeze(['mode', 'platform', 'minify', 'sourcemap', 'esTarget'])

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

/**
 * @param {object} state bundler session state (compile / fileTypes / store /
 *   lifecycle / targetPath / workPath / useAppIdDir)
 * @returns {{
 *   composeOptions(overrides?: object): object,
 *   runOnce(overrides?: object): Promise<object>,
 * }}
 */
export function createSessionRunner(state) {
	/** Compose session-based build options from user overrides (whitelist). */
	function composeOptions(overrides = {}) {
		const { compileOverrides, pipelineExtras } = splitBuildOverrides(overrides)
		return {
			...state.compile,
			...compileOverrides,
			...pipelineExtras,
			fileTypes: pipelineExtras.fileTypes ?? state.fileTypes,
			// PS1/RR4：session 注入 store（state.store）供 runBuild 使用
			store: state.store,
			// FORCED last — never allow overrides.lifecycle to win
			lifecycle: state.lifecycle,
		}
	}

	/** One-shot compile through the public build() facade (O1 → S1 runner). */
	async function runOnce(overrides = {}) {
		const options = composeOptions(overrides)
		return build(state.targetPath, state.workPath, state.useAppIdDir, options)
	}

	return { composeOptions, runOnce }
}

/**
 * Split overrides into compile (C1) vs pipeline keys. Strips lifecycle
 * (session forces its own); unknown keys throw.
 * Moved from session/index.js — implementation-plan S1 step 1.
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