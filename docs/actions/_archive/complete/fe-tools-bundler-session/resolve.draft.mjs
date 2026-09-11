/**
 * @file Dimina bundler — **DRAFT** resolve probe (design only)
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
 * Review decisions (2026-09-10, scope-boundary review):
 *   D-R1  dev targetPath: cli.targetPath | api.targetPath | OS temp
 *         (NO file layer this Action; api.outDir excluded on dev — use api.targetPath)
 *   D-R2  command:'dev' SEEDS mode:'dev' + platform:'web' as the lowest compile
 *         layer; api / cli may still set C1 keys in merge order.
 *         After merge, resolve HARD-FAILS if final mode !== 'dev' OR platform !== 'web'
 *         (strategy C). Other C1 keys (minify/sourcemap/esTarget) remain freely
 *         overridable. session.dev() does NOT re-force — uses Resolved as-is.
 *   D-R3  Resolved.server is host/port only
 *   D-R4  dev targetPath intentionally omits api.outDir — API must use api.targetPath
 *
 * File layer (configFile / fileConfig): NOT in this Action. Today's bundler has no
 * tool-config file layer (project.config.json is a mini-program project file read by
 * env.storeInfo, not a bundler tool config). Introducing one is a separate concern and
 * out of scope for a session/facade Action. See requirements.md Non-requirements.
 *
 * Priority (ACCEPTED P1–P3 this Action; P4–P6 reserved for future file/plugin layers):
 *   CLI argv > API explicit options > built-in defaults / mode presets
 *
 * Real impl should reuse `resolveCompileConfig` for C1 keys (C7 / R-BC7): resolveBundlerConfig
 * does layer merge + priority only — NO C1 semantic normalization (minify/esTarget defaults,
 * mode/platform legality) in this Action; that stays in resolveCompileConfig.
 */

import os from 'node:os'
import path from 'node:path'

/** @typedef {import('./config.draft.types.js').ResolveBundlerConfigInput} ResolveBundlerConfigInput */
/** @typedef {import('./config.draft.types.js').ResolvedBundlerInput} ResolvedBundlerInput */

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
 * Resolve → ResolvedBundlerInput for createBundler(resolved).
 * Two layers only this Action: cli (argv) + api (explicit programmatic options).
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

	// Paths — CLI prefers workPath/targetPath
	const root = firstDefined(cli.workPath, api.workPath, api.root, '.')
	const workPath = path.resolve(root)

	const useAppIdDir = firstDefined(
		cli.useAppIdDir,
		api.useAppIdDir,
		true,
	)

	const targetPath = resolveTargetPath({ command, cli, api, workPath })

	const apiCompile = pickCompileFromApi(api)
	const cliCompile = pickCompileFromCli(cli)
	const commandDefaults = commandCompileDefaults(command)

	const mergedCompileInput = {
		...commandDefaults,
		...apiCompile,
		...cliCompile,
	}

	const compile = normalizeCompileDraft(mergedCompileInput)
	assertDevCompileCompatible(command, compile)

	const fileTypes = firstDefined(api.fileTypes, undefined)

	/** @type {import('./config.draft.types.js').DiminaBundlerServerResolved | undefined} */
	let server
	if (command === 'dev') {
		server = resolveServerDraft({ cli, api })
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
 * dev:   cli.targetPath | api.targetPath | OS temp (fallback)
 *        *** api.outDir does NOT participate on dev (D-R4) — use api.targetPath ***
 *
 * M-G1 — argv defaults stay in bin: dimina-cli ALWAYS passes explicit cli.targetPath
 * (build: options.targetPath ?? process.cwd(); dev: options.targetPath ?? mkdtempSync(...)).
 * The fallbacks below (build→workPath, dev→temp) serve PURE-API callers only — relying
 * on them from CLI wiring would change today's cwd-default behavior (R-BC3 violation).
 *
 * Relative-path note: explicit RELATIVE values resolve against workPath here; CLI always
 * passes absolute (bin path.resolve) so no divergence — pure-API semantics only.
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

	if (command === 'dev') {
		// impl: fs.mkdtempSync(path.join(os.tmpdir(), 'dmcc-dev-')) — per-run unique dir,
		// matching today's bin/dev.js; the fixed name below is PROBE-ONLY shorthand (L-F2)
		return path.join(os.tmpdir(), 'dmcc-dev-DRAFT')
	}

	return workPath
}

/**
 * D-R2: command:'dev' seeds mode+platform as the LOWEST compile layer.
 * api / cli may write the same values (or other C1 keys); after merge,
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
function resolveServerDraft({ cli, api }) {
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
// Compile normalize — DESIGN-TIME SHAPE ONLY (R-BC7 / C7)
// 本节为形状演示；实施时 resolveBundlerConfig 仅做层合并，C1 语义归一
// (minify preset / esTarget 默认 / mode·platform 合法性) 交给 resolveCompileConfig。
// 见 requirements.md R-BC7 与 acceptance.md A-BS07。
//
// 实施形状（M-B2，见 R-BC7）：直接调用现有函数，替代本节的 spread 演示：
//   const compile = resolveCompileConfig({
//     cli: pickCompileFromCli(cli),
//     apiOptions: pickCompileFromApi(api),
//     mode: seedMode,      // D-R2: command seed → input.mode（现有第三入口，天然最低层）
//     platform: seedPlatform,
//   })
//   assertDevCompileCompatible(command, compile)  // D-R2 hard-fail 在归一结果上检查
// runBuild 内部会再次 resolveCompileConfig({ apiOptions: options })——已归一值幂等。
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
    // bin ALWAYS passes targetPath explicitly (argv default: cwd) — M-G1
    resolved = resolveBundlerConfig({
      command: 'build',
      cli: { workPath, targetPath, useAppIdDir, platform, sourcemap, minify },
    })
    createBundler(resolved).build() | .watch().start()

  dimina-cli dev [-c] [-s] [--host] [-p] ...
    // bin passes targetPath explicitly when -s given; else bin-side mkdtempSync (M-G1)
    resolved = resolveBundlerConfig({ command: 'dev', cli: { workPath, targetPath?, host, port, ... } })
    // targetPath = temp if -s omitted — D-R1
    // compile seeds mode=dev, platform=web; post-merge must stay so (D-R2/C hard-fail)
    // targetPath: no api.outDir on dev — D-R4
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
