/**
 * Platform 枚举与解析（CF-2）。
 * 内部模块；不新增 package exports 子路径。
 */

export const PLATFORMS = Object.freeze(['native', 'web'])

export class InvalidPlatformError extends TypeError {
	code: string
	platform: unknown
	constructor(platform: unknown, detail: string = '') {
		const message = detail
			? `Invalid platform: ${JSON.stringify(platform)} (${detail})`
			: `Invalid platform: expected 'native' | 'web', got ${JSON.stringify(platform)}`
		super(message)
		this.name = 'InvalidPlatformError'
		this.code = 'DIMINA_INVALID_PLATFORM'
		this.platform = platform
	}
}

export function resolvePlatform(value: unknown): 'native' | 'web' {
	if (value === undefined || value === null) {
		return 'native'
	}
	if (value === 'native' || value === 'web') {
		return value
	}
	throw new InvalidPlatformError(value)
}

export function sourcemapStrategyFor(platform: 'native' | 'web'): 'quickjs-attach' | 'devtools-url' {
	return platform === 'web' ? 'devtools-url' : 'quickjs-attach'
}

/**
 * renderer × platform 约束（预留 lynx 等声明 unsupportedPlatforms）。
 */
export function assertRendererSupportsPlatform(renderer: { name: string; unsupportedPlatforms?: string[] } | null | undefined, platform: 'native' | 'web'): void {
	const blocked = renderer?.unsupportedPlatforms
	if (Array.isArray(blocked) && blocked.includes(platform)) {
		throw new InvalidPlatformError(
			platform,
			`renderer ${renderer?.name} does not support platform`,
		)
	}
}
