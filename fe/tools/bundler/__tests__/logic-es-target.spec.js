import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const esbuildTransform = vi.hoisted(() => vi.fn())

vi.mock('esbuild', async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...actual,
		transform(...args) {
			esbuildTransform(...args)
			return actual.transform(...args)
		},
	}
})

const { compileJS, _setActiveCompileConfigForTest } = await import('../src/core/logic-compiler.js')
const { storeInfo } = await import('../src/env.js')

describe('logic esTarget.logic wiring (CF-3)', () => {
	let tempDir
	let originalCwd
	let originalTargetPath

	beforeEach(() => {
		vi.clearAllMocks()
		originalCwd = process.cwd()
		originalTargetPath = process.env.TARGET_PATH
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dimina-logic-es-'))
		process.chdir(tempDir)
		process.env.TARGET_PATH = path.join(tempDir, 'dist')
		fs.mkdirSync('pages/index', { recursive: true })
		fs.writeFileSync('project.config.json', JSON.stringify({ appid: 'logic-es' }))
		fs.writeFileSync('app.json', JSON.stringify({ pages: ['pages/index/index'] }))
		fs.writeFileSync('app.js', 'App({})')
		fs.writeFileSync('pages/index/index.json', JSON.stringify({}))
		fs.writeFileSync('pages/index/index.js', 'Page({ data: { ok: true } })')
		_setActiveCompileConfigForTest({
			minify: false,
			sourcemap: false,
			esTarget: { logic: 'es2023', view: 'es2020' },
		})
	})

	afterEach(() => {
		process.chdir(originalCwd)
		if (originalTargetPath) process.env.TARGET_PATH = originalTargetPath
		else delete process.env.TARGET_PATH
		fs.rmSync(tempDir, { recursive: true, force: true })
		_setActiveCompileConfigForTest({
			minify: true,
			sourcemap: false,
			esTarget: { logic: 'es2023', view: 'es2020' },
		})
	})

	it('CJS transform target reads esTarget.logic (default es2023)', async () => {
		storeInfo(tempDir)
		await compileJS([{ path: 'pages/index/index' }], null, null, { completedTasks: 0 })
		const cjsCalls = esbuildTransform.mock.calls.filter(([, opts]) => opts?.format === 'cjs')
		expect(cjsCalls.length).toBeGreaterThan(0)
		for (const [, opts] of cjsCalls) {
			expect(opts.target).toBe('es2023')
		}
	})

	it('CJS transform target follows esTarget.logic override es2020', async () => {
		_setActiveCompileConfigForTest({
			minify: false,
			sourcemap: false,
			esTarget: { logic: 'es2020', view: 'es2020' },
		})
		storeInfo(tempDir)
		await compileJS([{ path: 'pages/index/index' }], null, null, { completedTasks: 0 })
		const cjsCalls = esbuildTransform.mock.calls.filter(([, opts]) => opts?.format === 'cjs')
		expect(cjsCalls.length).toBeGreaterThan(0)
		for (const [, opts] of cjsCalls) {
			expect(opts.target).toBe('es2020')
		}
	})

	it('source contract: no hardcoded CJS target es2020', () => {
		const src = fs.readFileSync(
			path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/core/logic-compiler.js'),
			'utf8',
		)
		expect(src).toMatch(/target:\s*activeCompileConfig\.esTarget\.logic/)
		expect(src).not.toMatch(/target:\s*['"]es2020['"]/)
	})
})
