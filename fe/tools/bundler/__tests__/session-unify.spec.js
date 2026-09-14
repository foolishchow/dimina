/**
 * fe-tools-session-unify — S1 kernel extraction.
 *
 * P-SU03: three-entry behavioral isomorphism — `.build()` / `watch.start()`
 *   first build / `.dev()` first build emit the same normalized lifecycle
 *   event-name sequence (normalization: event names only; volatile payload
 *   fields ignored; entry whitelist empty today — dev preview subscribers do
 *   not emit lifecycle events).
 * A-SU05②: static structural criterion — session shells (index.js) contain
 *   no inlined options assembly (`...state.compile` lives in runner.js) and
 *   delegate via `createSessionRunner`.
 * R-SU1: kernel unit — composeOptions whitelist merge / fileTypes default /
 *   store+lifecycle injection (forced last) / unknown-key rejection.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBundler } from '../src/session/index.js'
import { resolveBundlerConfig } from '../src/session/resolve.js'
import { createLifecycle, LIFECYCLE_EVENTS } from '../src/shared/lifecycle.js'
import { createSessionRunner } from '../src/session/runner.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.resolve(testDir, '../src/session')
const EVENT_NAMES = Object.values(LIFECYCLE_EVENTS)

describe('session unify — S1 kernel', () => {
	let tempDir
	let outputDir
	const pagePath = 'pages/index/index'

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-unify-'))
		outputDir = path.join(tempDir, 'out')
		writeFile('app.json', JSON.stringify({ pages: [pagePath] }))
		writeFile('app.js', 'App({})\n')
		writeFile('app.wxss', '')
		writeFile('project.config.json', JSON.stringify({ appid: 'session-unify-app' }))
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

	function makeStubAdapter() {
		return {
			setPendingReload() {},
			async createServer() {},
			async listen(port, host) {
				return { host, port }
			},
			notifyBuildPublished() {},
			notifyBuildError() {},
			async close() {},
		}
	}

	describe('R-SU1 — kernel routing and options assembly', () => {
		function makeState(overrides = {}) {
			return {
				workPath: 'wp',
				targetPath: 'tp',
				useAppIdDir: false,
				compile: {
					mode: 'build',
					platform: 'native',
					minify: true,
					sourcemap: false,
					esTarget: 'es2017',
				},
				fileTypes: { view: ['.wxml'], logic: ['.js'] },
				store: {},
				lifecycle: createLifecycle(),
				...overrides,
			}
		}

		it('composeOptions() merges C1 overrides, defaults fileTypes, injects store+lifecycle', () => {
			const runner = createSessionRunner(makeState())
			const opts = runner.composeOptions({ mode: 'dev', minify: false })
			expect(opts).toMatchObject({
				mode: 'dev',
				platform: 'native',
				minify: false,
				sourcemap: false,
				esTarget: 'es2017',
				fileTypes: { view: ['.wxml'], logic: ['.js'] },
			})
			expect(opts.store).toBeDefined()
			expect(typeof opts.lifecycle.on).toBe('function')
		})

		it('composeOptions() strips overrides.lifecycle — session forces its own (forced last)', () => {
			const forced = createLifecycle()
			const runner = createSessionRunner(makeState({ lifecycle: forced }))
			const opts = runner.composeOptions({ lifecycle: createLifecycle() })
			expect(opts.lifecycle).toBe(forced)
		})

		it('composeOptions() rejects unknown keys (whitelist)', () => {
			const runner = createSessionRunner(makeState())
			expect(() => runner.composeOptions({ bogus: 1 })).toThrow(/unknown keys/)
		})

		it('composeOptions() routing: same shape for one-shot and loop entries (R-SU1)', async () => {
			const bundler = createBundler(makeResolved())
			const result = await bundler.build()
			expect(result).toBeTruthy()
			expect(result.appId).toBe('session-unify-app')
			expect(fs.existsSync(outputDir)).toBe(true)
		})
	})

	describe('A-SU05② — static structural criterion (no inlined assembly in shells)', () => {
		it('session/index.js delegates to runner and contains no inlined options assembly', () => {
			const indexSrc = fs.readFileSync(path.join(sourceRoot, 'index.js'), 'utf8')
			expect(indexSrc).toContain('createSessionRunner')
			expect(indexSrc).toContain('runner.composeOptions')
			expect(indexSrc).toContain('runner.runOnce')
			// the assembly spread must live in runner.js, not in the shells
			expect(indexSrc).not.toContain('...state.compile')
			expect(indexSrc).not.toContain('splitBuildOverrides')
		})

		it('runner.js owns the assembly and exposes composeOptions / runOnce', () => {
			const runnerSrc = fs.readFileSync(path.join(sourceRoot, 'runner.js'), 'utf8')
			expect(runnerSrc).toContain('...state.compile')
			const runner = createSessionRunner({
				compile: {},
				fileTypes: {},
				store: {},
				lifecycle: createLifecycle(),
			})
			expect(typeof runner.composeOptions).toBe('function')
			expect(typeof runner.runOnce).toBe('function')
		})
	})

	describe('P-SU03 — behavioral isomorphism across the three entries', () => {
		function record(session) {
			const seq = []
			for (const ev of EVENT_NAMES) {
				session.lifecycle.on(ev, () => seq.push(ev))
			}
			return seq
		}

		async function captureBuildSeq() {
			const lifecycle = createLifecycle()
			const seq = record({ lifecycle })
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			await bundler.build()
			return seq
		}

		async function captureWatchFirstSeq() {
			const lifecycle = createLifecycle()
			const seq = record({ lifecycle })
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			const watcher = bundler.watch({ autoListen: false })
			try {
				await watcher.start()
			}
			finally {
				await watcher.stop()
			}
			return seq
		}

		async function captureDevFirstSeq() {
			const lifecycle = createLifecycle()
			const seq = record({ lifecycle })
			const bundler = createBundler({ ...makeResolved(), lifecycle })
			const handle = await bundler.dev({ previewAdapter: makeStubAdapter() })
			try {
				/* first build completed during dev start */
			}
			finally {
				await handle.close()
			}
			return seq
		}

		it('.build(), watch.start() first build, .dev() first build emit identical normalized event sequences', async () => {
			const buildSeq = await captureBuildSeq()
			const watchSeq = await captureWatchFirstSeq()
			const devSeq = await captureDevFirstSeq()

			// non-vacuous: the fixture really built
			expect(buildSeq.length).toBeGreaterThan(0)
			expect(buildSeq).toContain('build:start')
			expect(buildSeq[buildSeq.length - 1]).toBe('build:end')
			// normalization: event-name sequence equality across entries
			expect(watchSeq).toEqual(buildSeq)
			expect(devSeq).toEqual(buildSeq)
		})
	})
})