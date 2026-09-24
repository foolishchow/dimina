import { describe, it, expect } from 'vitest'
import { DependencyGraph } from '../src/packer/graph/dependency-graph.ts'
import { ModuleResultCache } from '../src/packer/cache/module-result-cache.ts'
import { deriveFromGraph } from '../src/packer/emit/convergence.ts'

/**
 * MC3a deriveFromGraph 测试：验证 Packer 核心形状——
 * entry → 遍历 GraphNode → 取 module 集 → ModuleResult 取 code → [EmitModule]。
 *
 * 只读：不改 graph、不改 cache、不碰 emit。
 */
describe('deriveFromGraph (MC3a)', () => {
	function makeGraph() {
		const graph = new DependencyGraph()
		// app node (type='app', entry=false)
		graph.addNode('app', { type: 'app' })
		// page entry (type='page', entry=true)
		graph.addNode('pages/index/index', { type: 'page', entry: true })
		graph.addDependency('pages/index/index', 'app', 'app')
		// component dependency
		graph.addNode('components/foo', { type: 'component' })
		graph.addDependency('pages/index/index', 'components/foo', 'component')
		// logic deps (require/import)
		graph.addNode('utils/helper')
		graph.addDependency('pages/index/index', 'utils/helper', 'logic')
		graph.addNode('utils/config')
		graph.addDependency('utils/helper', 'utils/config', 'logic')
		return graph
	}

	function makeCache() {
		const cache = new ModuleResultCache()
		// app has logic code
		cache.set('app', {
			compileInfo: { path: 'app', code: 'AppCode', map: null, sourceFile: null },
			logicDependencies: [],
		})
		// page has logic code
		cache.set('pages/index/index', {
			compileInfo: { path: 'pages/index/index', code: 'PageCode', map: 'PageMap', sourceFile: null },
			logicDependencies: ['utils/helper', 'app', 'components/foo'],
		})
		// component has logic code (.js)
		cache.set('components/foo', {
			compileInfo: { path: 'components/foo', code: 'ComponentCode', map: null, sourceFile: null, extraInfoCode: 'ExtraInfo' },
			logicDependencies: [],
		})
		// utils/helper has logic code
		cache.set('utils/helper', {
			compileInfo: { path: 'utils/helper', code: 'HelperCode', map: null, sourceFile: null },
			logicDependencies: ['utils/config'],
		})
		// utils/config has logic code
		cache.set('utils/config', {
			compileInfo: { path: 'utils/config', code: 'ConfigCode', map: 'ConfigMap', sourceFile: null },
			logicDependencies: [],
		})
		return cache
	}

	it('returns all logic modules in the dependency closure (entry + app + component + transitive)', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'pages/index/index')
		const ids = modules.map(m => m.moduleId).sort()
		// closure includes: entry itself, app (via 'app' edge), component (via 'component' edge),
		// utils/helper (via 'logic' edge), utils/config (transitive logic edge)
		expect(ids).toEqual(['app', 'components/foo', 'pages/index/index', 'utils/config', 'utils/helper'])
	})

	it('includes entryId itself in the closure', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'pages/index/index')
		expect(modules.some(m => m.moduleId === 'pages/index/index')).toBe(true)
	})

	it('includes app module (via "app" kind edge, not "logic")', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'pages/index/index')
		expect(modules.some(m => m.moduleId === 'app' && m.code === 'AppCode')).toBe(true)
	})

	it('includes component module (via "component" kind edge, not "logic")', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'pages/index/index')
		expect(modules.some(m => m.moduleId === 'components/foo' && m.code === 'ComponentCode')).toBe(true)
	})

	it('maps EmitModule fields correctly from CachedModuleResult', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'pages/index/index')
		const pageModule = modules.find(m => m.moduleId === 'pages/index/index')
		expect(pageModule).toBeDefined()
		expect(pageModule.code).toBe('PageCode')
		expect(pageModule.map).toBe('PageMap')
		// component has extraInfoCode
		const compModule = modules.find(m => m.moduleId === 'components/foo')
		expect(compModule.extraInfoCode).toBe('ExtraInfo')
	})

	it('skips modules not in cache (non-logic modules like view-only nodes)', () => {
		const graph = makeGraph()
		// add a view-only node (no cache entry)
		graph.addNode('pages/index/index.wxml')
		graph.addDependency('pages/index/index', 'pages/index/index.wxml', 'logic')
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'pages/index/index')
		// view-only node not in cache → filtered out
		expect(modules.some(m => m.moduleId === 'pages/index/index.wxml')).toBe(false)
	})

	it('returns empty array for non-existent entry', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const modules = deriveFromGraph(graph, cache, 'nonexistent')
		expect(modules).toEqual([])
	})

	it('handles circular dependencies without infinite loop', () => {
		const graph = new DependencyGraph()
		graph.addNode('a', { type: 'page', entry: true })
		graph.addNode('b')
		graph.addDependency('a', 'b', 'logic')
		graph.addDependency('b', 'a', 'logic')
		const cache = new ModuleResultCache()
		cache.set('a', { compileInfo: { path: 'a', code: 'A', map: null, sourceFile: null }, logicDependencies: ['b'] })
		cache.set('b', { compileInfo: { path: 'b', code: 'B', map: null, sourceFile: null }, logicDependencies: ['a'] })
		const modules = deriveFromGraph(graph, cache, 'a')
		expect(modules.map(m => m.moduleId).sort()).toEqual(['a', 'b'])
	})

	it('is read-only: does not modify graph or cache', () => {
		const graph = makeGraph()
		const cache = makeCache()
		const graphBefore = JSON.stringify(graph.toJSON())
		const cacheBefore = JSON.stringify(cache.toJSON())
		deriveFromGraph(graph, cache, 'pages/index/index')
		expect(JSON.stringify(graph.toJSON())).toBe(graphBefore)
		expect(JSON.stringify(cache.toJSON())).toBe(cacheBefore)
	})
})
