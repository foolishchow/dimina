import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getPages, storeInfo } from '../src/compiler/core/env.ts'
import { compileJS } from '../src/compiler/logic/index.ts'
import { ModuleResultCache } from '../src/model/module-result-cache.ts'

/**
 * M2 module-result-cache 测试：验证 cache hit 输出与无 cache 一致（行为 0），
 * logicDependencies 捕获正确，以及 dirty/cached 混合场景。
 */
describe('module result cache (M2)', () => {
	let tempDir
	let originalCwd

	beforeEach(() => {
		originalCwd = process.cwd()
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dimina-cache-'))
		process.chdir(tempDir)
	})

	afterEach(() => {
		process.chdir(originalCwd)
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	function setupProject() {
		fs.writeFileSync('app.json', JSON.stringify({ pages: ['pages/index/index'] }))
		fs.writeFileSync('app.js', 'App({})')
		fs.writeFileSync('project.config.json', JSON.stringify({ appid: 'cache-test' }))

		// 工具模块（被 require）
		fs.mkdirSync('utils', { recursive: true })
		fs.writeFileSync('utils/helper.js', `
			export function format() { return 'ok' }
		`)

		// 页面模块（import 工具模块）
		fs.mkdirSync('pages/index', { recursive: true })
		fs.writeFileSync('pages/index/index.json', JSON.stringify({ usingComponents: {} }))
		fs.writeFileSync('pages/index/index.js', `
			import { format } from '../../utils/helper'
			Page({ onLoad() { console.log(format()) } })
		`)
		storeInfo(tempDir)
	}

	it('cache hit produces byte-identical output to non-cache build', async () => {
		setupProject()
		const pages = getPages()
		const progress = { completedTasks: 0 }

		// 1. 无 cache baseline
		const { compileRes: baseline, logicDependencies: baselineDeps } = await compileJS(pages.mainPages, null, null, progress)

		// 2. 构造 cache：将 baseline CompileInfo + logicDependencies 存入
		const cache = new ModuleResultCache()
		for (const info of baseline) {
			cache.set(info.path, { compileInfo: info, logicDependencies: baselineDeps[info.path] ?? [] })
		}

		// 3. 有 cache + 全部 cached（invalidatedModules = 空集）→ 应该全部 cache hit
		const invalidatedModules = new Set()  // 空 = 全 cached
		const { compileRes: cached, logicDependencies: cachedDeps } = await compileJS(
			pages.mainPages, null, null, { completedTasks: 0 },
			{ cache, invalidatedModules },
		)

		// 4. 输出应该一致（行为 0）
		expect(cached.length).toBe(baseline.length)
		for (let i = 0; i < baseline.length; i++) {
			expect(cached[i].path).toBe(baseline[i].path)
			expect(cached[i].code).toBe(baseline[i].code)
			expect(cached[i].map).toBe(baseline[i].map)
			expect(cached[i].sourceFile).toBe(baseline[i].sourceFile)
		}

		// 5. cache hit 时 logicDependencies 应为空（无 dirty 模块）
		expect(Object.keys(cachedDeps)).toHaveLength(0)
	})

	it('logicDependencies captures require/import deps correctly', async () => {
		setupProject()
		const pages = getPages()
		const { logicDependencies } = await compileJS(pages.mainPages, null, null, { completedTasks: 0 })

		// 页面模块应该有 logicDependencies 条目
		const pageDeps = logicDependencies['pages/index/index']
		expect(pageDeps).toBeDefined()
		expect(pageDeps).toContain('/utils/helper')
	})

	it('dirty + cached mixed produces identical output', async () => {
		setupProject()
		const pages = getPages()
		const progress = { completedTasks: 0 }

		// 1. 无 cache baseline
		const { compileRes: baseline, logicDependencies: baselineDeps } = await compileJS(pages.mainPages, null, null, progress)

		// 2. 构造 cache
		const cache = new ModuleResultCache()
		for (const info of baseline) {
			cache.set(info.path, { compileInfo: info, logicDependencies: baselineDeps[info.path] ?? [] })
		}

		// 3. 仅 pages/index/index dirty，utils/helper cached
		const invalidatedModules = new Set(['pages/index/index'])
		const { compileRes: mixed, logicDependencies: mixedDeps } = await compileJS(
			pages.mainPages, null, null, { completedTasks: 0 },
			{ cache, invalidatedModules },
		)

		// 4. 输出应该一致（行为 0）
		expect(mixed.length).toBe(baseline.length)
		for (let i = 0; i < baseline.length; i++) {
			expect(mixed[i].path).toBe(baseline[i].path)
			expect(mixed[i].code).toBe(baseline[i].code)
		}

		// 5. dirty 模块有 logicDependencies 条目，cached 模块没有
		expect(mixedDeps['pages/index/index']).toBeDefined()
		// utils/helper 是 cached → 不在 mixedDeps 中
		expect(mixedDeps['utils/helper']).toBeUndefined()
	})

	it('no cache param falls back to full recompile (behavior 0)', async () => {
		setupProject()
		const pages = getPages()

		// 不传 options → 无 cache → 全量重算
		const { compileRes: result1 } = await compileJS(pages.mainPages, null, null, { completedTasks: 0 })
		const { compileRes: result2 } = await compileJS(pages.mainPages, null, null, { completedTasks: 0 })

		// 两次全量结果一致
		expect(result2.length).toBe(result1.length)
		for (let i = 0; i < result1.length; i++) {
			expect(result2[i].code).toBe(result1[i].code)
		}
	})
})
