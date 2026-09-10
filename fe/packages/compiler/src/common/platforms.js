/**
 * Platform 枚举与解析（CF-2）。
 * 内部模块；不新增 package exports 子路径。
 */

export const PLATFORMS = Object.freeze(['native', 'web'])

export class InvalidPlatformError extends TypeError {
	/**
	 * @param {unknown} platform
	 * @param {string} [detail]
	 */
	constructor(platform, detail = '') {
		const message = detail
			? `Invalid platform: ${JSON.stringify(platform)} (${detail})`
			: `Invalid platform: expected 'native' | 'web', got ${JSON.stringify(platform)}`
		super(message)
		this.name = 'InvalidPlatformError'
		this.code = 'DIMINA_INVALID_PLATFORM'
		this.platform = platform
	}
}

/**
 * @param {unknown} value
 * @returns {'native' | 'web'}
 */
export function resolvePlatform(value) {
	if (value === undefined || value === null) {
		return 'native'
	}
	if (value === 'native' || value === 'web') {
		return value
	}
	throw new InvalidPlatformError(value)
}

/**
 * @param {'native' | 'web'} platform
 * @returns {'quickjs-attach' | 'devtools-url'}
 */
export function sourcemapStrategyFor(platform) {
	return platform === 'web' ? 'devtools-url' : 'quickjs-attach'
}

/**
 * renderer × platform 约束（预留 lynx 等声明 unsupportedPlatforms）。
 * @param {{ name: string, unsupportedPlatforms?: string[] } | null | undefined} renderer
 * @param {'native' | 'web'} platform
 */
export function assertRendererSupportsPlatform(renderer, platform) {
	const blocked = renderer?.unsupportedPlatforms
	if (Array.isArray(blocked) && blocked.includes(platform)) {
		throw new InvalidPlatformError(
			platform,
			`renderer ${renderer.name} does not support platform`,
		)
	}
}
