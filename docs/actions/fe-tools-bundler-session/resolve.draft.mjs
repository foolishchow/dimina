/**
 * @file Dimina bundler — **DRAFT** resolve / load probe (design only)
 *
 * Action: fe-tools-bundler-session
 * Status: NOT frozen · NOT imported by runtime · NOT an implementation
 *
 * Siblings:
 *   ./config.draft.mjs       — knobs
 *   ./orchestrator.draft.mjs — createBundler(resolved)
 *   ./stages.draft.md        — builtin pipeline inventory (no plugin API)
 *   ./config.draft.types.js  — shared typedefs (authoritative ResolvedBundlerInput)
 *
 * Review decisions (2026-09-10):
 *   D-R1  dev targetPath: top-level file.outDir does NOT participate;
 *         only cli/api targetPath or file.server.outDir; else OS temp
 *   D-R2  command:'dev' SEEDS mode:'dev' + platform:'web' as the lowest compile
 *         layer; file / api / cli may still set C1 keys in merge order.
 *         After merge, resolve HARD-FAILS if final mode !== 'dev' OR platform !== 'web'
 *         (discussion 2026-09-10: strategy C). Other C1 keys (minify/sourcemap/esTarget)
 *         remain freely overridable. session.dev() does NOT re-force — uses Resolved as-is.
 *   D-R3  Resolved.server is host/port only; file.server.outDir → targetPath only
 *   D-R4  dev targetPath intentionally omits api.outDir (and file.outDir); API must
 *         use api.targetPath (or cli / file.server.outDir / temp) — decision 2026-09-10
 *
 * Priority (ACCEPTED P1–P6):
 *   CLI argv > API explicit options > config file > built-in defaults / mode presets
 *
 * Real impl should reuse `resolveCompileConfig` for C1 keys (C7).
 */

import os from 'node:os'
import path from 'node:path'

/** @typedef {import('./config.draft.types.js').ResolveBundlerConfigInput} ResolveBundlerConfigInput */
/** @typedef {import('./config.draft.types.js').ResolvedBundlerInput} ResolvedBundlerInput */
/** @typedef {import('./config.draft.types.js').DiminaBundlerConfigDraft} DiminaBundlerConfigDraft */

function draftTodo(message) {
	throw new Error(`[resolve.draft] ${message}`)
}

const COMPILE_KEYS = Object.freeze(['mode', 'platform', 'minify', 'sourcemap', 'esTarget'])
/** Resolved + CLI server surface — no outDir (D-R3) */
const SERVER_RESOLVED_KEYS = Object.freeze(['host', 'port'])

const DEFAULT_ES_TARGET = Object.freeze({ logic: 'es2023', view: 'es2020' })
const MODE_PRESETS = Object.freeze({
	build: Object.freeze({ minify: true }),
	dev: Object.freeze({ minify: false }),
})

/**
 * Load + merge → ResolvedBundlerInput for createBundler(resolved).
 *
 * @param {ResolveBundlerConfigInput} input
 * @returns {ResolvedBundlerInput}
 */
export function resolveBundlerConfig(input) {
	const command = input.command
	if (command !== 'build' && command !== 'dev') {
		draftTodo(`command must be 'build' | 'dev', got ${JSON.stringify(command)}`)
	}

	const cli = input.cli || {}
	const api = input.api || {}

	const file = loadConfigFileDraft({
		configFile: input.configFile,
		fileConfig: input.fileConfig,
		cli,
		api,
	})

	// Paths — CLI prefers workPath/targetPath; file uses root/outDir
	const root = firstDefined(cli.workPath, api.workPath, api.root, file.root, '.')
	const workPath = path.resolve(root)

	const useAppIdDir = firstDefined(
		cli.useAppIdDir,
		api.useAppIdDir,
		file.useAppIdDir,
		true,
	)

	const targetPath = resolveTargetPath({
		command,
		cli,
		api,
		file,
		workPath,
	})

	const fileCompile = pickKeys(file.compile, COMPILE_KEYS)
	const apiCompile = pickCompileFromApi(api)
	const cliCompile = pickCompileFromCli(cli)
	const commandDefaults = commandCompileDefaults(command)

	const mergedCompileInput = {
		...commandDefaults,
		...fileCompile,
		...apiCompile,
		...cliCompile,
	}

	const compile = normalizeCompileDraft(mergedCompileInput)
	assertDevCompileCompatible(command, compile)

	const fileTypes = firstDefined(api.fileTypes, file.fileTypes, undefined)

	/** @type {import('./config.draft.types.js').DiminaBundlerServerResolved | undefined} */
	let server
	if (command === 'dev') {
		server = resolveServerDraft({ cli, api, file })
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
// targetPath — D-R1
// ---------------------------------------------------------------------------

/**
 * build: cli.targetPath | api.targetPath | api.outDir | file.outDir | workPath
 * dev:   cli.targetPath | api.targetPath | file.server.outDir | OS temp
 *        *** file.outDir does NOT participate (D-R1) ***
 *        *** api.outDir does NOT participate (D-R4) — use api.targetPath ***
 */
function resolveTargetPath({ command, cli, api, file, workPath }) {
	let explicit
	if (command === 'dev') {
		explicit = firstDefined(
			cli.targetPath,
			api.targetPath,
			file.server?.outDir,
		)
	}
	else {
		explicit = firstDefined(
			cli.targetPath,
			api.targetPath,
			api.outDir,
			file.outDir,
		)
	}

	if (explicit !== undefined && explicit !== null && explicit !== '') {
		return path.resolve(workPath, explicit)
	}

	if (command === 'dev') {
		return path.join(os.tmpdir(), 'dmcc-dev-DRAFT')
	}

	return workPath
}

/**
 * D-R2: command:'dev' seeds mode+platform as the LOWEST compile layer.
 * file / api / cli may write the same values (or other C1 keys); after merge,
 * mode/platform MUST remain 'dev'/'web' or hard-fail (strategy C).
 * session.dev() consumes Resolved.compile as-is — no re-force.
 */
function commandCompileDefaults(command) {
	if (command === 'dev') {
		return { mode: 'dev', platform: 'web' }
	}
	return { mode: 'build', platform: 'native' }
}

/** D-R2 strategy C: command:'dev' forbids Resolved mode/platform drift. */
function assertDevCompileCompatible(command, compile) {
	if (command !== 'dev') {
		return
	}
	if (compile.mode !== 'dev') {
		draftTodo(
			`D-R2/C: command:'dev' requires compile.mode:'dev', got ${JSON.stringify(compile.mode)}`,
		)
	}
	if (compile.platform !== 'web') {
		draftTodo(
			`D-R2/C: command:'dev' requires compile.platform:'web', got ${JSON.stringify(compile.platform)}`,
		)
	}
}

/** D-R3: host/port only on Resolved.server */
function resolveServerDraft({ cli, api, file }) {
	const fileServer = pickKeys(file.server, SERVER_RESOLVED_KEYS)
	const apiServer = pickKeys(api.server, SERVER_RESOLVED_KEYS)
	const cliServer = pickDefined({
		host: cli.host,
		port: cli.port !== undefined ? Number(cli.port) : undefined,
	})

	return pickKeys({
		host: '127.0.0.1',
		port: 8080,
		...fileServer,
		...apiServer,
		...cliServer,
	}, SERVER_RESOLVED_KEYS)
}

// ---------------------------------------------------------------------------
// File load (P4)
// ---------------------------------------------------------------------------

function loadConfigFileDraft({ configFile, fileConfig, cli, api }) {
	if (configFile === false) {
		return {}
	}
	if (fileConfig && typeof fileConfig === 'object') {
		assertKnownConfigKeys(fileConfig)
		return fileConfig
	}
	if (typeof configFile === 'string') {
		draftTodo(`load explicit configFile path: ${configFile}`)
	}
	const rootHint = firstDefined(cli.workPath, api.workPath, api.root, '.')
	void rootHint
	return {}
}

function assertKnownConfigKeys(file) {
	const allowed = new Set([
		'root',
		'outDir',
		'useAppIdDir',
		'compile',
		'fileTypes',
		'server',
		'plugins',
	])
	for (const key of Object.keys(file)) {
		if (!allowed.has(key)) {
			draftTodo(`config file unknown top-level key: ${key}`)
		}
	}
	if (file.compile) {
		for (const key of Object.keys(file.compile)) {
			if (!COMPILE_KEYS.includes(key)) {
				draftTodo(`compile unknown key: ${key} (C1)`)
			}
		}
	}
	if (file.server) {
		const serverAllowed = new Set(['host', 'port', 'outDir'])
		for (const key of Object.keys(file.server)) {
			if (!serverAllowed.has(key)) {
				draftTodo(`server unknown key: ${key}`)
			}
		}
	}
	void file.plugins
}

// ---------------------------------------------------------------------------
// Compile normalize (stand-in for resolveCompileConfig)
// ---------------------------------------------------------------------------

function pickCompileFromCli(cli) {
	return pickDefined({
		mode: cli.mode,
		platform: cli.platform,
		minify: cli.minify,
		sourcemap: cli.sourcemap,
		esTarget: cli.esTarget,
	})
}

function pickCompileFromApi(api) {
	const fromNested = pickKeys(api.compile, COMPILE_KEYS)
	const fromFlat = pickDefined({
		mode: api.mode,
		platform: api.platform,
		minify: api.minify,
		sourcemap: api.sourcemap,
		esTarget: api.esTarget,
	})
	return { ...fromNested, ...fromFlat }
}

function normalizeCompileDraft(raw) {
	if (raw.mode !== undefined && raw.mode !== 'build' && raw.mode !== 'dev') {
		draftTodo(`Invalid mode: ${JSON.stringify(raw.mode)}`)
	}
	const mode = raw.mode === 'dev' ? 'dev' : 'build'
	const platform = raw.platform === 'web' ? 'web' : 'native'
	const sourcemap = !!firstDefined(raw.sourcemap, false)
	const minify = !!firstDefined(raw.minify, MODE_PRESETS[mode].minify)
	const esTarget = normalizeEsTargetDraft(raw.esTarget)

	return { mode, platform, minify, sourcemap, esTarget }
}

function normalizeEsTargetDraft(value) {
	if (value === undefined || value === null) {
		return { ...DEFAULT_ES_TARGET }
	}
	if (typeof value !== 'object' || Array.isArray(value)) {
		draftTodo('esTarget must be { logic?, view? }')
	}
	return {
		logic: value.logic || DEFAULT_ES_TARGET.logic,
		view: value.view || DEFAULT_ES_TARGET.view,
	}
}

// ---------------------------------------------------------------------------
// CLI wiring sketch
// ---------------------------------------------------------------------------
/*
  dimina-cli build [-w] [-c] [-s] [--platform] [--sourcemap] [--minify|--no-minify]
    // map --no-app-id-dir → cli.useAppIdDir = false
    resolved = resolveBundlerConfig({
      command: 'build',
      cli: { workPath, targetPath, useAppIdDir, platform, sourcemap, minify },
    })
    createBundler(resolved).build() | .watch().start()

  dimina-cli dev [-c] [-s] [--host] [-p] ...
    resolved = resolveBundlerConfig({ command: 'dev', cli: { workPath, targetPath?, host, port, ... } })
    // targetPath = temp if -s omitted (ignores file.outDir) — D-R1
    // compile seeds mode=dev, platform=web; post-merge must stay so (D-R2/C hard-fail)
    // targetPath: no api.outDir on dev (不加)
    // server = { host, port } only — D-R3
    createBundler(resolved).dev()
*/

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
