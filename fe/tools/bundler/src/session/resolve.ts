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
import { resolveCompileConfig } from '../shared/compile-config.ts'

const COMPILE_KEYS = Object.freeze(['mode', 'platform', 'minify', 'sourcemap', 'esTarget'])
/** Resolved server surface — host/port only (D-R3) */
const SERVER_RESOLVED_KEYS = Object.freeze(['host', 'port'])

export interface ResolvedCompileProfile {
	mode: string
	platform: 'native' | 'web'
	sourcemapStrategy: string
	minify: boolean
	sourcemap: boolean
	esTarget: { logic: string; view: string }
}
export interface ResolvedServer { host: string; port: number }
export interface ResolvedBundlerInput {
	workPath: string
	targetPath: string
	useAppIdDir: boolean
	compile: ResolvedCompileProfile
	fileTypes?: Record<string, unknown>
	server?: ResolvedServer
	command: 'build' | 'dev'
}

export interface ResolveBundlerConfigInput {
	command: 'build' | 'dev'
	cli?: Record<string, unknown>
	api?: Record<string, unknown>
}

/**
 * Load + merge → ResolvedBundlerInput for createBundler(resolved).
 */
export function resolveBundlerConfig(input: ResolveBundlerConfigInput): ResolvedBundlerInput {
	const command = input.command
	if (command !== 'build' && command !== 'dev') {
		throw new TypeError(`command must be 'build' | 'dev', got ${JSON.stringify(command)}`)
	}

	const cli = input.cli || {}
	const api = input.api || {}

	// Paths — CLI prefers workPath/targetPath
	const root = firstDefined(cli.workPath, api.workPath, api.root, '.') as string
	const workPath = path.resolve(root)

	const useAppIdDir = (firstDefined(cli.useAppIdDir, api.useAppIdDir, true) as boolean) !== false

	const targetPath = resolveTargetPath({ command, cli, api, workPath })

	// D-R2: command seeds mode+platform as the LOWEST compile layer
	// (input.mode / input.platform of resolveCompileConfig). cli/api may still
	// write the same values (or other C1 keys); on dev, post-merge drift from
	// mode:'dev' / platform:'web' hard-fails below (strategy C).
	const seeds: { mode: 'build' | 'dev'; platform: 'native' | 'web' } = command === 'dev'
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
	assertBuildCompileCompatible(command, compile)

	const fileTypes = firstDefined(api.fileTypes, undefined) as Record<string, unknown> | undefined

	let server
	if (command === 'dev') {
		server = resolveServer({ cli, api })
	}

	return {
		workPath,
		targetPath,
		useAppIdDir,
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
function resolveTargetPath({ command, cli, api, workPath }: { command: 'build' | 'dev'; cli: Record<string, unknown>; api: Record<string, unknown>; workPath: string }): string {
	let explicit
	if (command === 'dev') {
		explicit = firstDefined(cli.targetPath, api.targetPath)
	}
	else {
		explicit = firstDefined(cli.targetPath, api.targetPath, api.outDir)
	}

	if (explicit !== undefined && explicit !== null && explicit !== '') {
		return path.resolve(workPath, explicit as string)
	}

	// PURE-API fallbacks only (M-G1). dev uses a per-run unique dir — matching
	// today's bin/dev.js mkdtempSync behavior.
	if (command === 'dev') {
		return fs.mkdtempSync(path.join(os.tmpdir(), 'dmcc-dev-'))
	}

	return workPath
}

/** D-R2 strategy C: command:'dev' forbids Resolved mode/platform drift. */
function assertDevCompileCompatible(command: 'build' | 'dev', compile: ResolvedCompileProfile) {
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

/**
 * D-R2/C 双侧对称（fe-tools-compiler-target T0）：command:'build' 要求
 * platform:'native'。E8 处置——build+web 是无消费者的假自由度（产物与
 * native 字节等价），入口收严为结构化报错；compile-config 层自由度保留
 * （直调 build({platform:'web'}) 不经 resolve，仍可编译）。
 */
function assertBuildCompileCompatible(command: 'build' | 'dev', compile: ResolvedCompileProfile) {
	if (command !== 'build') {
		return
	}
	if (compile.platform !== 'native') {
		throw new TypeError(
			`D-R2/C: command:'build' requires compile.platform:'native', got ${JSON.stringify(compile.platform)}`,
		)
	}
}

/** D-R3: host/port only on Resolved.server */
function resolveServer({ cli, api }: { cli: Record<string, unknown>; api: Record<string, unknown> }): ResolvedServer {
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
	}, SERVER_RESOLVED_KEYS) as unknown as ResolvedServer
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** api compile layer: nested `api.compile` ⊕ flat `api.<C1>` (flat wins) */
function pickCompileFromApi(api: Record<string, unknown>): Record<string, unknown> {
	const fromNested = pickKeys(api.compile, COMPILE_KEYS)
	const fromFlat = pickKeys(api, COMPILE_KEYS)
	return { ...fromNested, ...fromFlat }
}

function firstDefined(...values: unknown[]): unknown {
	for (const v of values) {
		if (v !== undefined && v !== null) {
			return v
		}
	}
	return undefined
}

function pickKeys(obj: unknown, keys: readonly string[]): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	if (!obj || typeof obj !== 'object') {
		return out
	}
	for (const key of keys) {
		if (Object.hasOwn(obj, key)) {
			out[key] = (obj as Record<string, unknown>)[key]
		}
	}
	return out
}

function pickDefined(obj: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(obj || {})) {
		if (v !== undefined) {
			out[k] = v
		}
	}
	return out
}