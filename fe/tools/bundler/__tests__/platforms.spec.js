import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	assertRendererSupportsPlatform,
	InvalidPlatformError,
	PLATFORMS,
	resolvePlatform,
	sourcemapStrategyFor,
} from '../src/common/platforms.js'

describe('resolvePlatform', () => {
	it('defaults unset to native', () => {
		expect(resolvePlatform(undefined)).toBe('native')
		expect(resolvePlatform(null)).toBe('native')
	})

	it('accepts native and web', () => {
		expect(resolvePlatform('native')).toBe('native')
		expect(resolvePlatform('web')).toBe('web')
		expect(PLATFORMS).toEqual(['native', 'web'])
	})

	it('hard-fails invalid values', () => {
		expect(() => resolvePlatform('ios')).toThrow(InvalidPlatformError)
		expect(() => resolvePlatform('ios')).toThrow(/expected 'native' \| 'web'/)
	})
})

describe('sourcemapStrategyFor', () => {
	it('derives strategy from platform', () => {
		expect(sourcemapStrategyFor('native')).toBe('quickjs-attach')
		expect(sourcemapStrategyFor('web')).toBe('devtools-url')
	})
})

describe('assertRendererSupportsPlatform', () => {
	it('allows webview on both platforms', () => {
		expect(() => assertRendererSupportsPlatform({ name: 'webview' }, 'native')).not.toThrow()
		expect(() => assertRendererSupportsPlatform({ name: 'webview' }, 'web')).not.toThrow()
	})

	it('fails when renderer lists unsupported platform', () => {
		const lynxLike = { name: 'lynx', unsupportedPlatforms: ['web'] }
		expect(() => assertRendererSupportsPlatform(lynxLike, 'web')).toThrow(InvalidPlatformError)
		expect(() => assertRendererSupportsPlatform(lynxLike, 'web')).toThrow(/lynx does not support/)
		expect(() => assertRendererSupportsPlatform(lynxLike, 'native')).not.toThrow()
	})
})

describe('platform-abstraction bin contract', () => {
	it('build exposes --platform; dev fixes web without --platform flag', () => {
		const binDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/bin')
		const buildBin = fs.readFileSync(path.join(binDir, 'index.js'), 'utf8')
		const devBin = fs.readFileSync(path.join(binDir, 'dev.js'), 'utf8')
		const resolveSrc = fs.readFileSync(
			path.resolve(binDir, '../session/resolve.js'),
			'utf8',
		)
		expect(buildBin).toMatch(/\.option\(['"]--platform <name>['"]/)
		expect(devBin).not.toMatch(/\.option\(['"]--platform/)
		// D-R2 seed 取代旧 bin 硬编码：dev 强制 platform:'web'（行为等价，见 resolveBundlerConfig）
		expect(resolveSrc).toMatch(/mode: 'dev', platform: 'web'/)
	})
})
