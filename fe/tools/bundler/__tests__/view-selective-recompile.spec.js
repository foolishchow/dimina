import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import build from '../src/index.ts'
import { PackerSessionState } from '../src/packer/state/session-state.ts'

/**
 * H3 Phase 2 (fe-tools-hmr-per-module-cache Phase 2): selective recompile 测试。
 *
 *  - selective 分支：orderList 存在 + 全 module（cached ∪ dirty）→ 只重编译 dirty
 *    （compileViewTree 内 clean+cached module 跳过 compile，seed from cache）
 *  - 字节恒等：selective 产物 == 全量 viewParseWalk 产物（fresh state build）
 *  - stale-orderList 回归：wxs 集变更 → selective orderList 全量回传 → 下轮 cache-hit 不缺 module
 */

function setupProject(root) {
	fs.mkdirSync(path.join(root, 'pages/home'), { recursive: true })
	fs.mkdirSync(path.join(root, 'components/mycomp'), { recursive: true })
	fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
	fs.writeFileSync(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'h3p2-sel' }))
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

describe('integration: H3 Phase 2 selective recompile', () => {
	let srcDir, out1, out2, out3

	beforeEach(() => {
		srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3p2-sel-'))
		setupProject(srcDir)
		out1 = path.join(srcDir, '_out1')
		out2 = path.join(srcDir, '_out2')
		out3 = path.join(srcDir, '_out3')
	})

	afterEach(() => {
		if (srcDir && fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true })
	})

	it('component dirty → selective 重编译：bundle == 全量重编（fresh state）', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		// build1：填 cache（page + mycomp bundle）
		await build(out1, srcDir, true, { state })

		// 变更 component wxml
		fs.writeFileSync(path.join(srcDir, 'components/mycomp/index.wxml'), '<view>comp-v2</view>\n')

		// build2：selective——只 mycomp dirty（page clean + cached）
		await build(out2, srcDir, true, { state, invalidatedModules: ['/components/mycomp/index'] })

		// build3：fresh state 全量（对照基准——非 selective）
		await build(out3, srcDir, true, {})

		const v2 = findFile(out2, 'pages_home_index.js')
		const v3 = findFile(out3, 'pages_home_index.js')
		expect(v2).not.toBeNull()
		expect(v3).not.toBeNull()
		const c2 = fs.readFileSync(v2, 'utf8')
		const c3 = fs.readFileSync(v3, 'utf8')
		expect(c2).toBe(c3)  // selective == 全量 字节恒等
		expect(c2).toContain('comp-v2')  // 新内容确实编入
	}, 30000)

	it('page dirty → selective 重编译 page（component from cache）：bundle == 全量重编', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		await build(out1, srcDir, true, { state })

		// 变更 page wxml
		fs.writeFileSync(path.join(srcDir, 'pages/home/index.wxml'), '<mycomp>home-v2</mycomp>\n')

		// build2：selective——page dirty（mycomp clean + cached）
		await build(out2, srcDir, true, { state, invalidatedModules: ['pages/home/index'] })
		// build3：fresh 全量对照
		await build(out3, srcDir, true, {})

		const v2 = fs.readFileSync(findFile(out2, 'pages_home_index.js'), 'utf8')
		const v3 = fs.readFileSync(findFile(out3, 'pages_home_index.js'), 'utf8')
		expect(v2).toBe(v3)
		expect(v2).toContain('home-v2')
	}, 30000)

	it('selective 后续 cache-hit：state 内 viewCache 已更新（下轮 hit 复用新内容）', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		await build(out1, srcDir, true, { state })

		fs.writeFileSync(path.join(srcDir, 'components/mycomp/index.wxml'), '<view>comp-v2</view>\n')
		// build2：selective（dirty mycomp）→ cache 更新（mycomp 新 code 入 cache）
		await build(out2, srcDir, true, { state, invalidatedModules: ['/components/mycomp/index'] })
		// build3：全 cache-hit（无 invalidated）→ assemble via orderList → 应含 comp-v2（cache 已更新）
		await build(out3, srcDir, true, { state, invalidatedModules: [] })

		const v3 = fs.readFileSync(findFile(out3, 'pages_home_index.js'), 'utf8')
		expect(v3).toContain('comp-v2')  // cache-hit 用的是 selective 更新后的 cache
	}, 30000)

	it('wxs 集变更（stale-orderList 回归）：selective orderList 全量回传 → 下轮 cache-hit 不缺 module', async () => {
		// 初始：page.wxml 带 wxs a
		fs.writeFileSync(path.join(srcDir, 'pages/home/index.wxml'), [
			'<wxs module="fmt" src="./fmt.wxs" />',
			'<mycomp>home {{fmt.m()}}</mycomp>',
			'',
		].join('\n'))
		fs.writeFileSync(path.join(srcDir, 'pages/home/fmt.wxs'), 'module.exports = { m: function () { return 1 } }\n')

		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		await build(out1, srcDir, true, { state })

		// 变更：page.wxml 加第二个 wxs b（wxs 集变更 → orderList 须增 id）
		fs.writeFileSync(path.join(srcDir, 'pages/home/index.wxml'), [
			'<wxs module="fmt" src="./fmt.wxs" />',
			'<wxs module="aux" src="./aux.wxs" />',
			'<mycomp>home {{fmt.m()}}{{aux.n()}}</mycomp>',
			'',
		].join('\n'))
		fs.writeFileSync(path.join(srcDir, 'pages/home/aux.wxs'), 'module.exports = { n: function () { return 2 } }\n')

		// build2：selective（page dirty——其 .wxml 变）→ orderList 全量回传（含新 aux wxs id）
		await build(out2, srcDir, true, { state, invalidatedModules: ['pages/home/index'] })

		// build3：全 cache-hit → assemble via 更新后的 orderList → 须含 aux wxs module（非缺 module）
		const out4 = path.join(srcDir, '_out4')
		await build(out4, srcDir, true, { state, invalidatedModules: [] })

		const v2 = fs.readFileSync(findFile(out2, 'pages_home_index.js'), 'utf8')
		const v4 = fs.readFileSync(findFile(out4, 'pages_home_index.js'), 'utf8')
		expect(v2).toContain('aux')      // 新 wxs 编入 selective 产物
		expect(v4).toBe(v2)              // cache-hit（经更新后 orderList assemble）== selective 产物
	}, 30000)
})
