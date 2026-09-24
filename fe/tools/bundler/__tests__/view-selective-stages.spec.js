import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import build from '../src/index.ts'
import { PackerSessionState } from '../src/packer/session-state.ts'

/**
 * D-HR-3（fe-tools-hmr-chain-residuals）：selective recompile 链路级验证。
 *
 * stage-channel 边界级（build() 全链：orchestrator → stage-channel → worker → compileML）：
 *  - (a) selective 触发：round2 后 viewCache 中 dirty module code 更新（非 clean 不变）
 *  - (b) dirty 子集：仅 invalidated module 在 viewCache 变化；clean module 保持 round1 值
 *  - (c) 字节恒等：selective 产物（round2）== 全量重编（round3 fresh）
 *  - (d) dirty 子集规模：invalidatedModules 集大小 == viewCache 中变化 module 数
 *
 * 复用 H3 Phase 2 spec 的项目 setup 模式（page + component）。
 */

function setupProject(root) {
	fs.mkdirSync(path.join(root, 'pages/home'), { recursive: true })
	fs.mkdirSync(path.join(root, 'components/mycomp'), { recursive: true })
	fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
	fs.writeFileSync(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'hr-d3-sel' }))
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

describe('D-HR-3: selective recompile stage-channel boundary', () => {
	let srcDir, out1, out2, out3

	beforeEach(() => {
		srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-d3-'))
		setupProject(srcDir)
		out1 = path.join(srcDir, '_out1')
		out2 = path.join(srcDir, '_out2')
		out3 = path.join(srcDir, '_out3')
	})

	afterEach(() => {
		if (srcDir && fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true })
	})

	it('(a+b+d) component dirty → selective 触发：viewCache 仅 dirty 变，clean 不变；dirty 子集规模=1', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		// round1：priming（填 viewCache + orderList）
		await build(out1, srcDir, true, { state })
		// 快照 round1 viewCache module codes
		const compKey = '/components/mycomp/index'
		const pageKey = 'pages/home/index'
		const r1Comp = state.viewCache.get(compKey)
		const r1Page = state.viewCache.get(pageKey)
		expect(r1Comp).toBeDefined()
		expect(r1Page).toBeDefined()

		// 变更 component wxml
		fs.writeFileSync(path.join(srcDir, 'components/mycomp/index.wxml'), '<view>comp-v2</view>\n')

		// round2：selective——只 mycomp dirty
		await build(out2, srcDir, true, { state, invalidatedModules: [compKey] })

		// (a) selective 触发：dirty module（comp）viewCache code 变化（更新为新内容）
		const r2Comp = state.viewCache.get(compKey)
		expect(r2Comp).toBeDefined()
		expect(r2Comp.code).not.toBe(r1Comp.code)

		// (b) clean 子集：page module viewCache code 不变（未被重编）
		const r2Page = state.viewCache.get(pageKey)
		expect(r2Page.code).toBe(r1Page.code)

		// (d) dirty 子集规模：invalidatedModules = [compKey]（1 个）== viewCache 中变化 module 数
		let changedCount = 0
		for (const [k, v] of state.viewCache) {
			const r1 = k === compKey ? r1Comp : k === pageKey ? r1Page : null
			if (r1 && v.code !== r1.code) changedCount++
		}
		expect(changedCount).toBe(1)
	})

	it('(c) selective 产物 == 全量重编（字节恒等）', async () => {
		const state = new PackerSessionState()
		state.viewCache = new Map()
		state.viewOrderList = new Map()
		state.styleCache = new Map()
		await build(out1, srcDir, true, { state })

		fs.writeFileSync(path.join(srcDir, 'components/mycomp/index.wxml'), '<view>comp-v2</view>\n')

		// round2 selective
		await build(out2, srcDir, true, { state, invalidatedModules: ['/components/mycomp/index'] })
		// round3 fresh 全量（对照）
		await build(out3, srcDir, true, {})

		const v2 = findFile(out2, 'pages_home_index.js')
		const v3 = findFile(out3, 'pages_home_index.js')
		expect(v2).not.toBeNull()
		expect(v3).not.toBeNull()
		expect(fs.readFileSync(v2, 'utf8')).toBe(fs.readFileSync(v3, 'utf8'))
	})
})
