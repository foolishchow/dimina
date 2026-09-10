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

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {{ logic: string, view: string }}
 */
function normalizeEsTarget(value, label = 'esTarget') {
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
	const logic = value.logic === undefined ? DEFAULT_ES_TARGET.logic : value.logic
	const view = value.view === undefined ? DEFAULT_ES_TARGET.view : value.view
	if (typeof logic !== 'string' || !logic) {
		throw new TypeError(`Invalid ${label}.logic: expected non-empty string`)
	}
	if (typeof view !== 'string' || !view) {
		throw new TypeError(`Invalid ${label}.view: expected non-empty string`)
	}
	return { logic, view }
}

/**
 * 合并 compile configuration（CF-1 冻结契约 v1）。
 *
 * 优先级：cli > apiOptions > mode preset > platform defaults（CF-1 空）> 内部缺省
 *
 * @param {object} [input]
 * @param {'build'|'dev'} [input.mode]
 * @param {object} [input.cli]
 * @param {object} [input.apiOptions]
 */
export function resolveCompileConfig(input = {}) {
	const { cli = {}, apiOptions = {} } = input

	const mode = cli.mode ?? apiOptions.mode ?? input.mode ?? 'build'
	if (mode !== 'build' && mode !== 'dev') {
		throw new TypeError(`Invalid mode: expected 'build' | 'dev', got ${JSON.stringify(mode)}`)
	}

	const platform = cli.platform ?? apiOptions.platform ?? input.platform
	if (platform !== undefined && platform !== 'native' && platform !== 'web') {
		throw new TypeError(`Invalid platform: expected 'native' | 'web' | undefined, got ${JSON.stringify(platform)}`)
	}

	if (Object.hasOwn(apiOptions, 'esTarget')) {
		normalizeEsTarget(apiOptions.esTarget, 'options.esTarget')
	}
	if (Object.hasOwn(cli, 'esTarget')) {
		normalizeEsTarget(cli.esTarget, 'cli.esTarget')
	}

	const modePreset = MODE_PRESETS[mode]
	const esTarget = normalizeEsTarget(
		cli.esTarget ?? apiOptions.esTarget,
		cli.esTarget !== undefined ? 'cli.esTarget' : 'options.esTarget',
	)

	const sourcemap = cli.sourcemap ?? apiOptions.sourcemap ?? false
	const minify = cli.minify ?? apiOptions.minify ?? modePreset.minify

	return {
		mode,
		platform,
		minify: !!minify,
		sourcemap: !!sourcemap,
		esTarget,
	}
}

/**
 * 从 build options 抽出配置相关字段，其余原样留给 build 流水线。
 * @param {object} [options]
 */
export function splitBuildOptions(options = {}) {
	const apiConfigInput = {}
	const rest = { ...options }
	for (const key of CONFIG_OPTION_KEYS) {
		if (Object.hasOwn(options, key)) {
			apiConfigInput[key] = options[key]
			delete rest[key]
		}
	}
	return { apiConfigInput, rest }
}

/**
 * sourcemap 模式下跳过最终 JS bundle minify（缺 remapping 串联）。
 * @param {{ minify: boolean, sourcemap: boolean }} config
 */
export function effectiveJsMinify(config) {
	return !!config.minify && !config.sourcemap
}

export {
	CONFIG_OPTION_KEYS,
	DEFAULT_ES_TARGET,
	MODE_PRESETS,
}
