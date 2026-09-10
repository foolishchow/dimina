/**
 * resolveBundlerConfig — tool-layer config resolve for createBundler.
 *
 * Action: fe-tools-bundler-session (O1)
 * Layers (P1–P3): CLI argv > API explicit options > defaults/presets.
 * NO file layer this Action (`project.config.json` is a mini-program project
 * file read by `env.storeInfo`, not a bundler tool config).
 *
 * R-BC7 / C7: this module does layer merge + priority ONLY — NO C1 semantic
 * normalization (minify preset, esTarget defaults, mode/platform legality);
 * `resolveCompileConfig` owns those. D-R2 command seeds map to its third
 * input (`input.mode` / `input.platform` — the lowest layer), so no manual
 * spread merging is needed.
 *
 * Decisions D-R1..D-R4 (docs/actions/fe-tools-bundler-session/):
 *   D-R1  dev targetPath ← cli/api targetPath | temp — never api.outDir
 *   D-R2  command:'dev' seeds mode+platform; post-merge drift → hard-fail (C)
 *   D-R3  Resolved.server = { host, port } only
 *   D-R4  dev targetPath omits api.outDir — API uses api.targetPath
 *
 * M-G1 — argv defaults stay in bin: dimina-cli ALWAYS passes explicit
 * cli.targetPath (build: ?? process.cwd(); dev: ?? mkdtempSync). The
 * fallbacks below serve PURE-API callers only — relying on them from CLI
 * wiring would change today's cwd-default behavior (R-BC3 violation).
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveCompileConfig } from '../common/compile-config.js'

const COMPILE_KEYS = Object.freeze(['mode', 'platform', 'minify', 'sourcemap', 'esTarget'])
/** Resolved server surface — host/port only (D-R3) */
const SERVER_RESOLVED_KEYS = Object.freeze(['host', 'port'])

/**
 * Load + merge → ResolvedBundlerInput for createBundler(resolved).
 *
 * @param {{ command: 'build' | 'dev', cli?: object, api?: object }} input
 * @returns {object} ResolvedBundlerInput
 */
export function resolveBundlerConfig(input) {
	const command = input.command
	if (command !== 'build' && command !== 'dev') {
		throw new TypeError(`command must be 'build' | 'dev', got ${JSON.stringify(command)}`)
	}

	const cli = input.cli || {}
	const api = input.api || {}

	// Paths — CLI prefers workPath/targetPath
	const root = firstDefined(cli.workPath, api.workPath, api.root, '.')
	const workPath = path.resolve(root)

	const useAppIdDir = firstDefined(cli.useAppIdDir, api.useAppIdDir, true)

	const targetPath = resolveTargetPath({ command, cli, api, workPath })

	// D-R2: command seeds mode+platform as the LOWEST compile layer
	// (input.mode / input.platform of resolveCompileConfig). cli/api may still
	// write the same values (or other C1 keys); on dev, post-merge drift from
	// mode:'dev' / platform:'web' hard-fails below (strategy C).
	const seeds = command === 'dev'
		? { mode: 'dev', platform: 'web' }
		: { mode: 'build', platform: 'native' }

	// R-BC7 implementation shape: delegate C1 semantics to resolveCompileConfig.
	// Its result carries a derived `sourcemapStrategy` — harmless: session.build
	// passes only C1 keys onward and runBuild re-resolves (idempotent).
	const compile = resolveCompileConfig({
		cli: pickKeys(cli, COMPILE_KEYS),
		apiOptions: pickCompileFromApi(api),
		mode: seeds.mode,
		platform: seeds.platform,
	})
	assertDevCompileCompatible(command, compile)

	const fileTypes = firstDefined(api.fileTypes, undefined)

	let server
	if (command === 'dev') {
		server = resolveServer({ cli, api })
	}

	return {
		workPath,
		targetPath,
		useAppIdDir: useAppIdDir !== false,
		compile,
		...(fileTypes !== undefined ? { fileTypes } : {}),
		...(server ? { server } : {}),
		command,
	}
}

// ---------------------------------------------------------------------------
// targetPath — D-R1 / D-R4
// ---------------------------------------------------------------------------

/**
 * build: cli.targetPath | api.targetPath | api.outDir | workPath (fallback)
 * dev:   cli.targetPath | api.targetPath | mkdtemp (fallback)
 *        *** api.outDir does NOT participate on dev (D-R4) — use api.targetPath ***
 */
function resolveTargetPath({ command, cli, api, workPath }) {
	let explicit
	if (command === 'dev') {
		explicit = firstDefined(cli.targetPath, api.targetPath)
	}
	else {
		explicit = firstDefined(cli.targetPath, api.targetPath, api.outDir)
	}

	if (explicit !== undefined && explicit !== null && explicit !== '') {
		return path.resolve(workPath, explicit)
	}

	// PURE-API fallbacks only (M-G1). dev uses a per-run unique dir — matching
	// today's bin/dev.js mkdtempSync behavior.
	if (command === 'dev') {
		return fs.mkdtempSync(path.join(os.tmpdir(), 'dmcc-dev-'))
	}

	return workPath
}

/** D-R2 strategy C: command:'dev' forbids Resolved mode/platform drift. */
function assertDevCompileCompatible(command, compile) {
	if (command !== 'dev') {
		return
	}
	if (compile.mode !== 'dev') {
		throw new TypeError(
			`D-R2/C: command:'dev' requires compile.mode:'dev', got ${JSON.stringify(compile.mode)}`,
		)
	}
	if (compile.platform !== 'web') {
		throw new TypeError(
			`D-R2/C: command:'dev' requires compile.platform:'web', got ${JSON.stringify(compile.platform)}`,
		)
	}
}

/** D-R3: host/port only on Resolved.server */
function resolveServer({ cli, api }) {
	const apiServer = pickKeys(api.server, SERVER_RESOLVED_KEYS)
	const cliServer = pickDefined({
		host: cli.host,
		port: cli.port !== undefined ? Number(cli.port) : undefined,
	})

	return pickKeys({
		host: '127.0.0.1',
		port: 8080,
		...apiServer,
		...cliServer,
	}, SERVER_RESOLVED_KEYS)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** api compile layer: nested `api.compile` ⊕ flat `api.<C1>` (flat wins) */
function pickCompileFromApi(api) {
	const fromNested = pickKeys(api.compile, COMPILE_KEYS)
	const fromFlat = pickKeys(api, COMPILE_KEYS)
	return { ...fromNested, ...fromFlat }
}

function firstDefined(...values) {
	for (const v of values) {
		if (v !== undefined && v !== null) {
			return v
		}
	}
	return undefined
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
	for (const [k, v] of Object.entries(obj || {})) {
		if (v !== undefined) {
			out[k] = v
		}
	}
	return out
}
