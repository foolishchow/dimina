import { describe, expect, it } from 'vitest'
import {
	DEFAULT_ES_TARGET,
	effectiveJsMinify,
	resolveCompileConfig,
	splitBuildOptions,
} from '../src/common/compile-config.js'
import { InvalidPlatformError } from '../src/common/platforms.js'

describe('resolveCompileConfig', () => {
	it('uses build preset minify=true, default native platform, and dual esTarget', () => {
		expect(resolveCompileConfig()).toEqual({
			mode: 'build',
			platform: 'native',
			sourcemapStrategy: 'quickjs-attach',
			minify: true,
			sourcemap: false,
			esTarget: { ...DEFAULT_ES_TARGET },
		})
	})

	it('uses dev preset minify=false', () => {
		expect(resolveCompileConfig({ mode: 'dev' }).minify).toBe(false)
		expect(resolveCompileConfig({ apiOptions: { mode: 'dev' } }).minify).toBe(false)
	})

	it('lets cli override api and mode preset', () => {
		expect(resolveCompileConfig({
			mode: 'dev',
			apiOptions: { minify: false, sourcemap: true },
			cli: { minify: true },
		})).toMatchObject({
			mode: 'dev',
			minify: true,
			sourcemap: true,
		})
	})

	it('accepts partial esTarget and fills defaults', () => {
		expect(resolveCompileConfig({
			apiOptions: { esTarget: { logic: 'es2022' } },
		}).esTarget).toEqual({
			logic: 'es2022',
			view: 'es2020',
		})
	})

	it('hard-fails scalar esTarget and unknown keys', () => {
		expect(() => resolveCompileConfig({ apiOptions: { esTarget: 'es2023' } }))
			.toThrow(/expected \{ logic, view \}/)
		expect(() => resolveCompileConfig({ apiOptions: { esTarget: { logic: 'es2023', view: 'es2020', extra: 1 } } }))
			.toThrow(/unknown key/)
	})

	it('hard-fails invalid mode', () => {
		expect(() => resolveCompileConfig({ mode: 'prod' })).toThrow(/Invalid mode/)
	})

	it('defaults platform to native and derives sourcemapStrategy', () => {
		expect(resolveCompileConfig({ apiOptions: { platform: 'web' } })).toMatchObject({
			platform: 'web',
			sourcemapStrategy: 'devtools-url',
		})
		expect(resolveCompileConfig({ cli: { platform: 'web' }, apiOptions: { platform: 'native' } }))
			.toMatchObject({ platform: 'web', sourcemapStrategy: 'devtools-url' })
	})

	it('hard-fails invalid platform', () => {
		expect(() => resolveCompileConfig({ apiOptions: { platform: 'ios' } }))
			.toThrow(InvalidPlatformError)
	})

	it('does not let platform change minify or esTarget', () => {
		const nativeCfg = resolveCompileConfig({ apiOptions: { platform: 'native' } })
		const webCfg = resolveCompileConfig({ apiOptions: { platform: 'web' } })
		expect(webCfg.minify).toBe(nativeCfg.minify)
		expect(webCfg.esTarget).toEqual(nativeCfg.esTarget)
		expect(webCfg.sourcemap).toBe(nativeCfg.sourcemap)
	})
})

describe('effectiveJsMinify', () => {
	it('skips minify when sourcemap is on', () => {
		expect(effectiveJsMinify({ minify: true, sourcemap: true })).toBe(false)
		expect(effectiveJsMinify({ minify: true, sourcemap: false })).toBe(true)
		expect(effectiveJsMinify({ minify: false, sourcemap: false })).toBe(false)
	})
})

describe('splitBuildOptions', () => {
	it('peels config keys and keeps pipeline options', () => {
		const { apiConfigInput, rest } = splitBuildOptions({
			mode: 'dev',
			platform: 'web',
			minify: false,
			sourcemap: true,
			esTarget: { logic: 'es2023', view: 'es2020' },
			stages: ['logic'],
			lifecycle: { on() {} },
		})
		expect(apiConfigInput).toMatchObject({
			mode: 'dev',
			platform: 'web',
			minify: false,
			sourcemap: true,
		})
		expect(rest.stages).toEqual(['logic'])
		expect(rest.lifecycle).toBeTruthy()
		expect(rest).not.toHaveProperty('minify')
		expect(rest).not.toHaveProperty('platform')
	})
})
