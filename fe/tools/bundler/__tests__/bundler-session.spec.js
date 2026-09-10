import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBundler } from '../src/session/index.js'
import { resolveBundlerConfig } from '../src/session/resolve.js'
import { createLifecycle } from '../src/common/lifecycle.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * A-BS01 (build part) — session facade: .build callable, lifecycle exposure,
 * overrides whitelist; plus resolveBundlerConfig shape (R-BC7: C1 semantics
 * delegated to resolveCompileConfig).
 */
describe('bundler session (O1 build)', () => {
	let tempDir
	let outputDir
	const pagePath = 'pages/index/index'

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundler-session-'))
		outputDir = path.join(tempDir, 'out')
		writeFile('app.json', JSON.stringify({ pages: [pagePath] }))
		writeFile('app.js', 'App({})\n')
		writeFile('app.wxss', '')
		writeFile('project.config.json', JSON.stringify({ appid: 'bundler-session-app' }))
		writeFile(`${pagePath}.json`, '{}')
		writeFile(`${pagePath}.js`, 'Page({ data: { value: 1 } })\n')
		writeFile(`${pagePath}.wxml`, '<view>initial view</view>\n')
		writeFile(`${pagePath}.wxss`, '.page { color: red; }\n')
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	function writeFile(relativePath, content) {
		const filePath = path.join(tempDir, relativePath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	function makeResolved(cliOverrides = {}) {
		return resolveBundlerConfig({
			command: 'build',
			cli: {
				workPath: tempDir,
				targetPath: outputDir,
				useAppIdDir: false,
				...cliOverrides,
			},
		})
	}

	describe('createBundler facade', () => {
		it('exposes .build (O1) and read-only .lifecycle', () => {
			const bundler = createBundler(makeResolved())
			expect(typeof bundler.build).toBe('function')
			expect(bundler.lifecycle).toBeTruthy()
			expect(typeof bundler.lifecycle.on).toBe('function')
		})

		it('uses resolved.lifecycle when provided (test inject only)', () => {
			const lifecycle = createLifecycle()
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			expect(bundler.lifecycle).toBe(lifecycle)
		})

		it('build() compiles the fixture and returns the build result', async () => {
			const bundler = createBundler(makeResolved())
			const result = await bundler.build()
			expect(result).toBeTruthy()
			expect(typeof result.appId).toBe('string')
			expect(result.appId).toBe('bundler-session-app')
			expect(fs.existsSync(outputDir)).toBe(true)
		})

		it('emits lifecycle events through the session instance', async () => {
			const lifecycle = createLifecycle()
			const events = []
			lifecycle.on('build:start', () => events.push('build:start'))
			lifecycle.on('build:end', () => events.push('build:end'))
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			await bundler.build()
			expect(events).toEqual(['build:start', 'build:end'])
		})

		it('rejects unknown override keys (whitelist)', async () => {
			const bundler = createBundler(makeResolved())
			await expect(bundler.build({ bogus: 1 })).rejects.toThrow(/unknown keys/)
		})

		it('ignores overrides.lifecycle — session forces its own instance', async () => {
			const lifecycle = createLifecycle()
			let buildEndCount = 0
			lifecycle.on('build:end', () => { buildEndCount++ })
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			await bundler.build({ lifecycle: createLifecycle() })
			expect(bundler.lifecycle).toBe(lifecycle)
			expect(buildEndCount).toBe(1)
		})

		it('applies C1 overrides on top of the session base', async () => {
			const sourcemapDir = path.join(tempDir, 'out-sourcemap')
			const bundler = createBundler(
				makeResolved({ targetPath: sourcemapDir }),
			)
			await bundler.build({ sourcemap: true })
			// sourcemap 产物应存在（.map 文件）
			const mapFiles = collectFiles(sourcemapDir).filter(f => f.endsWith('.map'))
			expect(mapFiles.length).toBeGreaterThan(0)
		})

		it('allows repeated build() calls on one session (R2)', async () => {
			const bundler = createBundler(makeResolved())
			await bundler.build()
			await bundler.build()
		})
	})

	describe('resolveBundlerConfig', () => {
		it('resolves paths absolutely and seeds build compile via resolveCompileConfig', () => {
			const resolved = resolveBundlerConfig({
				command: 'build',
				cli: { workPath: tempDir, targetPath: 'out' },
			})
			expect(path.isAbsolute(resolved.workPath)).toBe(true)
			expect(resolved.targetPath).toBe(path.resolve(tempDir, 'out'))
			expect(resolved.useAppIdDir).toBe(true)
			expect(resolved.command).toBe('build')
			expect(resolved.compile.mode).toBe('build')
			expect(resolved.compile.platform).toBe('native')
			expect(resolved.compile.minify).toBe(true) // build mode preset
			expect(resolved.compile.sourcemap).toBe(false)
			expect(resolved.server).toBeUndefined()
		})

		it('falls back to api.outDir on build (API-only; dev omits it, D-R4)', () => {
			const resolved = resolveBundlerConfig({
				command: 'build',
				api: { root: tempDir, outDir: 'api-out' },
			})
			expect(resolved.targetPath).toBe(path.resolve(tempDir, 'api-out'))
		})

		it('hard-fails on invalid command', () => {
			expect(() => resolveBundlerConfig({ command: 'deploy' }))
				.toThrow(/command must be/)
		})

		it('D-R2/C: dev with drifted mode hard-fails after merge', () => {
			expect(() => resolveBundlerConfig({
				command: 'dev',
				cli: { workPath: tempDir, targetPath: outputDir, mode: 'build' },
			})).toThrow(/D-R2\/C/)
		})

		it('D-R2/C: dev with drifted platform hard-fails after merge', () => {
			expect(() => resolveBundlerConfig({
				command: 'dev',
				cli: { workPath: tempDir, targetPath: outputDir, platform: 'native' },
			})).toThrow(/D-R2\/C/)
		})

		it('D-R3: dev server is host/port only', () => {
			const resolved = resolveBundlerConfig({
				command: 'dev',
				cli: { workPath: tempDir, targetPath: outputDir, host: '0.0.0.0', port: '3000' },
			})
			expect(resolved.server).toEqual({ host: '0.0.0.0', port: 3000 })
		})

		it('rejects invalid mode via resolveCompileConfig semantics (R-BC7)', () => {
			expect(() => resolveBundlerConfig({
				command: 'build',
				cli: { workPath: tempDir, targetPath: outputDir, mode: 'staging' },
			})).toThrow(/Invalid mode/)
		})
	})
})

function collectFiles(dir) {
	const out = []
	if (!fs.existsSync(dir)) {
		return out
	}
	for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: false })) {
		const full = path.join(dir, entry)
		if (fs.statSync(full).isFile()) {
			out.push(full)
		}
	}
	return out
}
