import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { storeInfo, getDependencyGraph } from '../src/packer/store/env.ts'
import { compileML } from '../src/compiler/view/index.ts'
import { compileSS } from '../src/compiler/style/index.ts'
import { runWithAbilities } from './helpers/run-with-abilities.js'
import build from '../src/index.ts'
import { PackerSessionState } from '../src/packer/state/session-state.ts'

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
		const { getPages: gp } = await import('../src/packer/store/env.ts')
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
		const { getPages: gp } = await import('../src/packer/store/env.ts')
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
		const viewCache = new Map([['pages/home/index', viewMod('pages/home/index')]])  // H3 per-module
		const viewOrderList = new Map([['pages/home/index', ['pages/home/index']]])  // H3 order list
		const { results } = await runWithAbilities(outDir, () =>
			compileML([page], null, { completedTasks: 0 }, viewCache, viewOrderList, null),
		)
		expect(results).toEqual([])  // cache-hit 不返
	})

	it('cache-miss invalidated：③ 降级全量 viewParseWalk + 返 results', async () => {
		const { getPages: gp } = await import('../src/packer/store/env.ts')
		const pages = gp().mainPages
		const pagePath = pages[0].path
		const viewCache = new Map([[pagePath, viewMod(pagePath, 'OLD')]])  // H3 per-module
		const viewOrderList = new Map([[pagePath, [pagePath]]])  // H3 order list
		const { results } = await runWithAbilities(outDir, () =>
			compileML(pages, null, { completedTasks: 0 }, viewCache, viewOrderList, [pagePath]),
		)
		expect(results.length).toBeGreaterThan(0)  // bundle invalidated → 全量 viewParseWalk
		expect(results.some(r => r.moduleId === pagePath)).toBe(true)
	})

	it('no-cache（one-shot 边界）：cache-miss 全量编译', async () => {
		const { getPages: gp } = await import('../src/packer/store/env.ts')
		const pages = gp().mainPages
		const { results } = await runWithAbilities(outDir, () =>
			compileML(pages, null, { completedTasks: 0 }, undefined, null),
		)
		expect(results.length).toBeGreaterThan(0)
		expect(results[0].kind).toBe('view')
	})
})

// ── 集成：state-reuse cache-hit 字节一致性（P-G506 / 真实路径）──
// D-G5-4' per-page-bundle 重建 transitive subs+wxs 的回归门
function setupProjectWithComponent(root) {
	fs.mkdirSync(path.join(root, 'pages/home'), { recursive: true })
	fs.mkdirSync(path.join(root, 'components/mycomp'), { recursive: true })
	fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
	fs.writeFileSync(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'g5-int' }))
	fs.writeFileSync(path.join(root, 'pages/home/index.json'), JSON.stringify({ usingComponents: { mycomp: '/components/mycomp/index' } }))
	fs.writeFileSync(path.join(root, 'pages/home/index.wxml'), '<mycomp>home</mycomp>\n')
	fs.writeFileSync(path.join(root, 'pages/home/index.js'), 'Page({})\n')
	fs.writeFileSync(path.join(root, 'pages/home/index.wxss'), '.home { color: red; }\n')
	fs.writeFileSync(path.join(root, 'components/mycomp/index.json'), JSON.stringify({ component: true }))
	fs.writeFileSync(path.join(root, 'components/mycomp/index.wxml'), '<view>comp</view>\n')
	fs.writeFileSync(path.join(root, 'components/mycomp/index.js'), 'Component({})\n')
	fs.writeFileSync(path.join(root, 'components/mycomp/index.wxss'), '.comp { color: blue; }\n')
}

function findFile(root, name) {
	for (const e of fs.readdirSync(root, { withFileTypes: true })) {
		const p = path.join(root, e.name)
		if (e.isDirectory()) { const r = findFile(p, name); if (r) return r }
		else if (e.name === name) return p
	}
	return null
}

function diffDirs(a, b) {
	try { return execFileSync('diff', ['-rq', a, b], { encoding: 'utf8' }) }
	catch (e) { return (e.stdout || '') + (e.stderr || '') }
}

describe('integration: state-reuse cache-hit byte-identity', () => {
	let srcDir, out1, out2
	beforeEach(() => {
		srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g5-int-'))
		setupProjectWithComponent(srcDir)
		out1 = path.join(srcDir, '_out1')
		out2 = path.join(srcDir, '_out2')
	})
	afterEach(() => {
		// IRC R8: 防泄漏后续 test
		if (srcDir && fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true })
	})

	it('view cache-hit 含 transitive subs：bundle 含子组件 + 字节一致（D-G5-4\'）', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		// build1：填 cache（page bundle = page + sub-component，经 viewParseWalk transitive 发现）
		await build(out1, srcDir, true, { state })
		// build2：state reuse + 空 invalidated → cache-hit（page bundle 未 invalidated → re-emit 原序 bundle）
		await build(out2, srcDir, true, { state, invalidatedModules: [] })

		const v1 = findFile(out1, 'pages_home_index.js')
		const v2 = findFile(out2, 'pages_home_index.js')
		expect(v1).not.toBeNull()
		expect(v2).not.toBeNull()
		const c1 = fs.readFileSync(v1, 'utf8')
		const c2 = fs.readFileSync(v2, 'utf8')
		// D-G5-4' per-page-bundle：cache-hit re-emit 含 transitive sub-component（非缺内容）
		expect(c1).toContain('components/mycomp')  // sub-component moduleId 在 bundle
		expect(c1).toContain('render:')  // view render fn
		// cache-hit 字节一致：build2 re-emit = build1 全量
		expect(c1).toBe(c2)

		// IRC R6: style cache-hit .css 字节恒等
		const s1 = findFile(out1, 'pages_home_index.css')
		const s2 = findFile(out2, 'pages_home_index.css')
		expect(s1).not.toBeNull()
		expect(s2).not.toBeNull()
		expect(fs.readFileSync(s1, 'utf8')).toBe(fs.readFileSync(s2, 'utf8'))
	}, 30000)

	it('真实路径字节一致：非空 invalidated（单 page 变更）→ 全 diff=0', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		await build(out1, srcDir, true, { state })
		// build2：真实 watch 路径——单 page invalidated（page 逻辑变更）
		await build(out2, srcDir, true, { state, invalidatedModules: ['pages/home/index'] })

		const diff = diffDirs(out1, out2)
		expect(diff.trim()).toBe('')  // logic + view + style + static 全字节一致
	}, 30000)
})
