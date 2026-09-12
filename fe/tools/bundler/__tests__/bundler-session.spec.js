import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBundler } from '../src/session/index.js'
import { resolveBundlerConfig } from '../src/session/resolve.js'
import { createLifecycle } from '../src/shared/lifecycle.js'

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

	describe('watch (O2)', () => {
		it('exposes .watch returning a handle with start/listen/stop', () => {
			const bundler = createBundler(makeResolved())
			const watcher = bundler.watch({ autoListen: false })
			expect(typeof watcher.start).toBe('function')
			expect(typeof watcher.listen).toBe('function')
			expect(typeof watcher.stop).toBe('function')
			// R3: 创建即占用；从未 start 过，stop() 也能释放
			return watcher.stop()
		})

		it('watch opts: unknown keys throw (whitelist)', () => {
			const bundler = createBundler(makeResolved())
			expect(() => bundler.watch({ bogus: 1 })).toThrow(/unknown keys/)
		})

		it('R3: second .watch() throws until stop() releases', async () => {
			const bundler = createBundler(makeResolved())
			const w1 = bundler.watch({ autoListen: false })
			expect(() => bundler.watch({})).toThrow(/R3/)
			await w1.stop()
			const w2 = bundler.watch({ autoListen: false })
			await w2.stop()
		})

		it('R4: build() rejects while a watch handle is active', async () => {
			const bundler = createBundler(makeResolved())
			const watcher = bundler.watch({ autoListen: false })
			await expect(bundler.build()).rejects.toThrow(/R4/)
			await watcher.stop()
			// 释放后可再次 build
			await bundler.build()
		})

		it('watch loop shares the session lifecycle (H2: options.lifecycle)', async () => {
			const lifecycle = createLifecycle()
			const events = []
			lifecycle.on('build:end', () => events.push('build:end'))
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			const watcher = bundler.watch({ autoListen: false })
			await watcher.start()
			await watcher.stop()
			expect(events).toEqual(['build:end'])
		})

		it('start() returns the build result; stop() allows build again', async () => {
			const bundler = createBundler(makeResolved())
			const watcher = bundler.watch({ autoListen: false })
			const result = await watcher.start()
			expect(result.appId).toBe('bundler-session-app')
			expect(fs.existsSync(outputDir)).toBe(true)
			await watcher.stop()
			await bundler.build()
		})
	})

	describe('dev (O3, stub adapter)', () => {
		function makeStubAdapter() {
			const calls = []
			let serverCreated = false
			const adapter = {
				calls,
				setPendingReload() { calls.push('setPendingReload') },
				async createServer(opts) {
					serverCreated = true
					calls.push(`createServer:${opts.appId}`)
				},
				async listen(port, host) {
					calls.push(`listen:${port}:${host}`)
					return { host, port }
				},
				notifyBuildPublished() { calls.push('notifyBuildPublished') },
				notifyBuildError() { calls.push('notifyBuildError') },
				async close() { calls.push('close') },
				get serverCreated() { return serverCreated },
			}
			return adapter
		}

		it('dev opts whitelist: host/port overrides are rejected (M-C2)', async () => {
			const bundler = createBundler(makeResolved())
			await expect(bundler.dev({ host: '0.0.0.0' })).rejects.toThrow(/unknown keys/)
		})

		it('dev() sequences start → createServer → listen → watcher.listen via session.watch', async () => {
			const adapter = makeStubAdapter()
			const bundler = createBundler(makeResolved())
			const handle = await bundler.dev({ previewAdapter: adapter })
			expect(adapter.calls).toEqual([
				'createServer:bundler-session-app',
				'listen:8080:127.0.0.1',
			])
			expect(handle.appId).toBe('bundler-session-app')
			expect(handle.server).toEqual({ host: '127.0.0.1', port: 8080 })
			await handle.close()
			expect(adapter.calls).toEqual([
				'createServer:bundler-session-app',
				'listen:8080:127.0.0.1',
				'close',
			])
		})

		it('A-BS08/R7: startup failure rolls back and session stays reusable', async () => {
			const failing = {
				setPendingReload() {},
				async createServer() { throw new Error('adapter boom') },
				async listen() { return { host: '127.0.0.1', port: 9 } },
				async close() {},
			}
			const bundler = createBundler(makeResolved())
			await expect(bundler.dev({ previewAdapter: failing })).rejects.toThrow(/adapter boom/)
			// R7: activeLoop 已清，会话可复用（build 成功 + 可再次 dev）
			await bundler.build()
			await expect(bundler.dev({ previewAdapter: failing })).rejects.toThrow(/adapter boom/)
		})

		it('A-BS08: failure in listen also rolls back', async () => {
			const failing = {
				setPendingReload() {},
				async createServer() {},
				async listen() { throw new Error('port busy') },
				async close() {},
			}
			const bundler = createBundler(makeResolved())
			await expect(bundler.dev({ previewAdapter: failing })).rejects.toThrow(/port busy/)
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
