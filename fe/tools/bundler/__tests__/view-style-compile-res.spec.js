import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * G4 (fe-tools-view-style-compile-res) 测试：
 *  ① stage-channel view/style cache 写入（bare value，mock executeTask）
 *  ② no-op 路径（ctx 无 viewCache/styleCache → guarded 不 crash）
 *  ③ worker 返回 shape 断言（viewEngine/styleEngine.compile 直调）
 *
 * 注：worker 返回类型本身由 tsc 保证（viewCompile: Promise<{viewCompileResults:
 * ViewCompiledModule[]}> / styleCompile: Promise<{styleCompileResults:
 * StyleCompiledModule[]}>）。③ 验证 runtime 返回值 shape 与字段。
 */

// ── ①② mock executeTask（避免 worker spawn）──
vi.mock('../src/packer/worker/executor.ts', () => ({
	executeTask: vi.fn(),
}))

import { executeTask } from '../src/packer/worker/executor.ts'
import { runCompileStage } from '../src/packer/state/stage-channel.ts'
import { storeInfo, getPages } from '../src/packer/store/env.ts'
import { viewEngine } from '../src/compiler/view/index.ts'
import { styleEngine } from '../src/compiler/style/index.ts'
import { runWithAbilities } from './helpers/run-with-abilities.js'

function makeCtx({ cache, viewCache, viewOrderList, styleCache } = {}) {
	const ctx = {
		dependencyGraph: { merge: vi.fn() },
		compatibilityWarnings: new Set(),
	}
	if (cache) (ctx).cache = cache
	if (viewCache) (ctx).viewCache = viewCache
	if (viewOrderList) (ctx).viewOrderList = viewOrderList
	if (styleCache) (ctx).styleCache = styleCache
	return ctx
}

const VIEW_MOD = { moduleId: 'pages/a/index', kind: 'view', code: '/*v*/', map: null, dependencies: [] }
const STYLE_MOD = { moduleId: 'pages/a/index', kind: 'style', code: '/*s*/', map: null, dependencies: [] }

describe('stage-channel cache write (G4 D-G4-3)', () => {
	beforeEach(() => { vi.clearAllMocks() })

	it('① writes view/style results to ctx.viewCache (per-module, H3 D-PMC-1) / viewOrderList / styleCache (bare, G4 D-G4-3)', async () => {
		executeTask.mockResolvedValue({
			dependencyGraph: { toJSON: () => [] },
			compatibilityWarnings: [],
			viewPageBundles: [{ pagePath: 'pages/a/index', modules: [VIEW_MOD] }],  // worker 仍返 pageBundles
			styleCompileResults: [STYLE_MOD],  // G4: style 仍 per-module（无 transitive subs）
		})
		const viewCache = new Map()
		const viewOrderList = new Map()
		const styleCache = new Map()
		const ctx = makeCtx({ viewCache, viewOrderList, styleCache })
		await runCompileStage({
			script: 'view',
			ctx,
			task: { output: '' },
			options: { pages: { mainPages: [], subPages: {} } },
			lifecycle: null,
		})
		expect(viewCache.get('pages/a/index')).toEqual(VIEW_MOD)  // H3: per-module（ViewCompiledModule）
		expect(viewOrderList.get('pages/a/index')).toEqual(['pages/a/index'])  // H3: order list
		expect(styleCache.get('pages/a/index')).toEqual(STYLE_MOD)  // G4: per-module bare
	})

	it('② no-op when ctx has no viewCache/styleCache (G4 period: undefined → guarded)', async () => {
		executeTask.mockResolvedValue({
			dependencyGraph: { toJSON: () => [] },
			compatibilityWarnings: [],
			viewPageBundles: [{ pagePath: 'pages/a/index', modules: [VIEW_MOD] }],
			styleCompileResults: [STYLE_MOD],
		})
		const ctx = makeCtx({})  // 无 viewCache/styleCache（G4 期 PackerSessionState 无字段）
		await runCompileStage({
			script: 'view',
			ctx,
			task: { output: '' },
			options: { pages: { mainPages: [], subPages: {} } },
			lifecycle: null,
		})
		// 不 crash + ctx 无 viewCache/styleCache 字段（未误写）
		expect(ctx).not.toHaveProperty('viewCache')
		expect(ctx).not.toHaveProperty('styleCache')
	})

	it('logic cache 块回归——仍读 compileRes + logicDependencies（D-IU-3 logic 不变）', async () => {
		executeTask.mockResolvedValue({
			dependencyGraph: { toJSON: () => [] },
			compatibilityWarnings: [],
			compileRes: [{ path: 'pages/a/index', code: 'c' }],
			logicDependencies: { 'pages/a/index': ['utils/helper'] },
		})
		const cacheSet = vi.fn()
		const cache = { toJSON: () => [], set: cacheSet }  // stage-channel:47 期望 cache.toJSON
		const ctx = makeCtx({ cache })
		await runCompileStage({
			script: 'logic',
			ctx,
			task: { output: '' },
			options: { pages: { mainPages: [], subPages: {} } },
			lifecycle: null,
		})
		expect(cacheSet).toHaveBeenCalledWith('pages/a/index', {
			compileInfo: { path: 'pages/a/index', code: 'c' },
			logicDependencies: ['utils/helper'],
		})
	})
})

// ── ③ worker 返回 shape 直调 ──
describe('view/style worker compile-res return shape (G4 D-G4-1/2)', () => {
	let tempDir
	let outDir

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g4-shape-'))
		outDir = path.join(tempDir, 'out')
		fs.mkdirSync(outDir, { recursive: true })
		fs.mkdirSync(path.join(tempDir, 'pages/home'), { recursive: true })
		fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({ pages: ['pages/home/index'] }))
		fs.writeFileSync(path.join(tempDir, 'project.config.json'), JSON.stringify({ appid: 'g4-shape' }))
		fs.writeFileSync(path.join(tempDir, 'pages/home/index.json'), JSON.stringify({}))
		fs.writeFileSync(path.join(tempDir, 'pages/home/index.wxml'), '<view>home</view>\n')
		fs.writeFileSync(path.join(tempDir, 'pages/home/index.wxss'), '.home { color: red; }\n')
		fs.writeFileSync(path.join(tempDir, 'pages/home/index.js'), 'Page({})\n')
	})

	afterEach(() => {
		if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
	})

	it('viewEngine.compile 返回 { viewCompileResults: ViewCompiledModule[] }', async () => {
		const info = storeInfo(tempDir)
		const pages = getPages()
		const result = await runWithAbilities(outDir, () =>
			viewEngine.compile({
				msg: { storeInfo: info, sourcemap: false, pages },
				progress: { completedTasks: 0 },
				config: { minify: true, sourcemap: false, esTarget: { logic: 'es2023', view: 'es2020' } },
			}),
		)
		expect(result).toHaveProperty('viewCompileResults')
		expect(Array.isArray(result.viewCompileResults)).toBe(true)
		expect(result.viewCompileResults.length).toBeGreaterThan(0)
		for (const m of result.viewCompileResults) {
			expect(m).toEqual(expect.objectContaining({
				moduleId: expect.any(String),
				kind: 'view',
				code: expect.any(String),
				dependencies: [],
			}))
			expect(m.map === null || typeof m.map === 'string').toBe(true)  // string | null
			// 降级：renderBody/wxsBindings 不填（undefined）
			expect(m).not.toHaveProperty('renderBody')
			expect(m).not.toHaveProperty('wxsBindings')
		}
	})

	it('styleEngine.compile 返回 { styleCompileResults: StyleCompiledModule[] }', async () => {
		const info = storeInfo(tempDir)
		const pages = getPages()
		const result = await runWithAbilities(outDir, () =>
			styleEngine.compile({
				msg: { storeInfo: info, sourcemap: false, pages },
				progress: { completedTasks: 0 },
				config: { minify: true, sourcemap: false, esTarget: { logic: 'es2023', view: 'es2020' } },
			}),
		)
		expect(result).toHaveProperty('styleCompileResults')
		expect(Array.isArray(result.styleCompileResults)).toBe(true)
		expect(result.styleCompileResults.length).toBeGreaterThan(0)
		for (const m of result.styleCompileResults) {
			expect(m).toEqual(expect.objectContaining({
				moduleId: expect.any(String),
				kind: 'style',
				code: expect.any(String),
				dependencies: [],
			}))
			expect(m.map === null || typeof m.map === 'string').toBe(true)  // string | null
			// 降级：styleScopeId 不填（undefined）
			expect(m).not.toHaveProperty('styleScopeId')
		}
	})
})
