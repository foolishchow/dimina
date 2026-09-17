import {
	resolvePlatform,
	sourcemapStrategyFor,
} from './platforms.ts'

const DEFAULT_ES_TARGET = Object.freeze({
	logic: 'es2023',
	view: 'es2020',
})

const MODE_PRESETS = Object.freeze({
	build: Object.freeze({ minify: true }),
	dev: Object.freeze({ minify: false }),
})

const CONFIG_OPTION_KEYS = new Set([
	'mode',
	'platform',
	'minify',
	'sourcemap',
	'esTarget',
])

function normalizeEsTarget(value: unknown, label: string = 'esTarget'): { logic: string; view: string } {
	if (value === undefined || value === null) {
		return { ...DEFAULT_ES_TARGET }
	}
	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new TypeError(`Invalid ${label}: expected { logic, view }, got ${typeof value}`)
	}
	const unknownKeys = Object.keys(value).filter(key => key !== 'logic' && key !== 'view')
	if (unknownKeys.length > 0) {
		throw new TypeError(`Invalid ${label}: unknown key(s) ${unknownKeys.join(', ')}`)
	}
	const v = value as { logic?: unknown; view?: unknown }
	const logic = v.logic === undefined ? DEFAULT_ES_TARGET.logic : v.logic
	const view = v.view === undefined ? DEFAULT_ES_TARGET.view : v.view
	if (typeof logic !== 'string' || !logic) {
		throw new TypeError(`Invalid ${label}.logic: expected non-empty string`)
	}
	if (typeof view !== 'string' || !view) {
		throw new TypeError(`Invalid ${label}.view: expected non-empty string`)
	}
	return { logic, view }
}

interface CliConfig { mode?: string; platform?: unknown; minify?: boolean; sourcemap?: boolean; esTarget?: unknown }
interface ApiOptions { mode?: string; platform?: unknown; minify?: boolean; sourcemap?: boolean; esTarget?: unknown }
interface CompileConfigInput { mode?: 'build' | 'dev'; platform?: unknown; cli?: CliConfig; apiOptions?: ApiOptions }

/**
 * 合并 compile configuration（CF-1 + CF-2）。
 *
 * 优先级：cli > apiOptions > mode preset > platform defaults（仅派生 sourcemapStrategy）> 内部缺省
 */
export function resolveCompileConfig(input: CompileConfigInput = {}): { mode: string; platform: 'native' | 'web'; sourcemapStrategy: string; minify: boolean; sourcemap: boolean; esTarget: { logic: string; view: string } } {
	const cli: CliConfig = input.cli ?? {}
	const apiOptions: ApiOptions = input.apiOptions ?? {}

	const mode = cli.mode ?? apiOptions.mode ?? input.mode ?? 'build'
	if (mode !== 'build' && mode !== 'dev') {
		throw new TypeError(`Invalid mode: expected 'build' | 'dev', got ${JSON.stringify(mode)}`)
	}

	const platform = resolvePlatform(cli.platform ?? apiOptions.platform ?? input.platform)

	if (Object.hasOwn(apiOptions, 'esTarget')) {
		normalizeEsTarget(apiOptions.esTarget, 'options.esTarget')
	}
	if (Object.hasOwn(cli, 'esTarget')) {
		normalizeEsTarget(cli.esTarget, 'cli.esTarget')
	}

	const modePreset = MODE_PRESETS[mode as keyof typeof MODE_PRESETS]
	const esTarget = normalizeEsTarget(
		(cli.esTarget ?? apiOptions.esTarget) as unknown,
		cli.esTarget !== undefined ? 'cli.esTarget' : 'options.esTarget',
	)

	const sourcemap = cli.sourcemap ?? apiOptions.sourcemap ?? false
	const minify = cli.minify ?? apiOptions.minify ?? modePreset.minify

	return {
		mode,
		platform,
		sourcemapStrategy: sourcemapStrategyFor(platform),
		minify: !!minify,
		sourcemap: !!sourcemap,
		esTarget,
	}
}

export function splitBuildOptions(options: Record<string, unknown> = {}): { apiConfigInput: Record<string, unknown>; rest: Record<string, unknown> } {
	const apiConfigInput: Record<string, unknown> = {}
	const rest: Record<string, unknown> = { ...options }
	for (const key of CONFIG_OPTION_KEYS) {
		if (Object.hasOwn(options, key)) {
			apiConfigInput[key] = options[key]
			delete rest[key]
		}
	}
	return { apiConfigInput, rest }
}

export function effectiveJsMinify(config: { minify: boolean; sourcemap: boolean }): boolean {
	return !!config.minify && !config.sourcemap
}

export {
	CONFIG_OPTION_KEYS,
	DEFAULT_ES_TARGET,
	MODE_PRESETS,
}
