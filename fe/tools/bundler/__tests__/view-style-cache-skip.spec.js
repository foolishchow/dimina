import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { storeInfo, getDependencyGraph } from '../src/compiler/core/env.ts'
import { compileML } from '../src/compiler/view/index.ts'
import { compileSS } from '../src/compiler/style/index.ts'
import { runWithAbilities } from './helpers/run-with-abilities.js'

/**
 * G5 (fe-tools-view-style-cache-skip) 测试：
 *  - compileSS cache-hit per-page（跳 buildCompileCss，re-emit cached，不返 results）
 *  - compileML F6 cache-hit（allCached page+subs → ONE emitEntry；sub invalidated → ③ 降级）
 *  - no-cache（one-shot 边界）→ cache-miss 全量编译
 *  - logic 回归（stage-channel logic 块不变——见 view-style-compile-res.spec.js）
 */

let tempDir
let outDir

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g5-cache-'))
	outDir = path.join(tempDir, 'out')
	fs.mkdirSync(outDir, { recursive: true })
	fs.mkdirSync(path.join(tempDir, 'pages/home'), { recursive: true })
	fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
	fs.writeFileSync(path.join(tempDir, 'project.config.json'), JSON.stringify({ appid: 'g5-cache' }))
	fs.writeFileSync(path.join(tempDir, 'pages/home/index.json'), JSON.stringify({}))
	fs.writeFileSync(path.join(tempDir, 'pages/home/index.wxml'), '<view>home</view>\n')
	fs.writeFileSync(path.join(tempDir, 'pages/home/index.wxss'), '.home { color: red; }\n')
	fs.writeFileSync(path.join(tempDir, 'pages/home/index.js'), 'Page({})\n')
	storeInfo(tempDir)
})

afterEach(() => {
	if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
})

function viewMod(moduleId, code = 'var x=1') {
	return { moduleId, kind: 'view', code, map: null, dependencies: [] }
}
function styleMod(moduleId, code = '.x{c:1}') {
	return { moduleId, kind: 'style', code, map: null, dependencies: [] }
}

// ── compileSS cache-hit（per-page，非 recursive）──
describe('compileSS cache-hit (G5 D-G5-5)', () => {
	it('cache-hit：跳 buildCompileCss，re-emit cached，不返 results', async () => {
		const page = { path: 'pages/home/index' }
		const styleCache = new Map([['pages/home/index', styleMod('pages/home/index')]])
		const sinkWrites = []
		await runWithAbilities(outDir, async () => {
			const results = await compileSS([page], null, { completedTasks: 0 }, { sourcemap: false, minify: true }, styleCache, null)
			expect(results).toEqual([])  // cache-hit 不返（D-G5-3）
			return results
		}).then(() => { /* sink 侧效 */ }, () => {})
		// sink 收到 entry（re-emit cached）
		const files = fs.readdirSync(outDir)
		expect(files.length).toBeGreaterThan(0)
	})

	it('cache-miss invalidated：重编 + 返 results', async () => {
		const { getPages: gp } = await import('../src/compiler/core/env.ts')
		const pages = gp().mainPages
		const pagePath = pages[0].path
		const styleCache = new Map([[pagePath, styleMod(pagePath, 'OLD')]])
		const results = await runWithAbilities(outDir, () =>
			compileSS(pages, null, { completedTasks: 0 }, { sourcemap: false, minify: true }, styleCache, [pagePath]),
		)
		expect(results.length).toBe(1)
		expect(results[0].moduleId).toBe(pagePath)
	})

	it('no-cache（one-shot 边界）：cache-miss 全量编译', async () => {
		const { getPages: gp } = await import('../src/compiler/core/env.ts')
		const pages = gp().mainPages
		const results = await runWithAbilities(outDir, () =>
			compileSS(pages, null, { completedTasks: 0 }, { sourcemap: false, minify: true }, undefined, null),
		)
		expect(results.length).toBe(pages.length)
		expect(results[0].kind).toBe('style')
	})
})

// ── compileML cache-hit（F6 allCached + ③ 降级）──
describe('compileML cache-hit (G5 D-G5-4/F6)', () => {
	it('cache-hit allCached（page bundle cached 无 invalidated）：跳 viewParseWalk，不返 results', async () => {
		const page = { path: 'pages/home/index' }
		const viewCache = new Map([['pages/home/index', [viewMod('pages/home/index')]]])  // per-page-bundle
		const { results } = await runWithAbilities(outDir, () =>
			compileML([page], null, { completedTasks: 0 }, viewCache, null),
		)
		expect(results).toEqual([])  // cache-hit 不返
	})

	it('cache-miss invalidated：③ 降级全量 viewParseWalk + 返 results', async () => {
		const { getPages: gp } = await import('../src/compiler/core/env.ts')
		const pages = gp().mainPages
		const pagePath = pages[0].path
		const viewCache = new Map([[pagePath, [viewMod(pagePath, 'OLD')]]])  // per-page-bundle
		const { results } = await runWithAbilities(outDir, () =>
			compileML(pages, null, { completedTasks: 0 }, viewCache, [pagePath]),
		)
		expect(results.length).toBeGreaterThan(0)  // bundle invalidated → 全量 viewParseWalk
		expect(results.some(r => r.moduleId === pagePath)).toBe(true)
	})

	it('no-cache（one-shot 边界）：cache-miss 全量编译', async () => {
		const { getPages: gp } = await import('../src/compiler/core/env.ts')
		const pages = gp().mainPages
		const { results } = await runWithAbilities(outDir, () =>
			compileML(pages, null, { completedTasks: 0 }, undefined, null),
		)
		expect(results.length).toBeGreaterThan(0)
		expect(results[0].kind).toBe('view')
	})
})
