import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DependencyGraph } from '../src/packer/graph/dependency-graph.ts'
import { computeInvalidatedModules } from '../src/packer/cache/invalidation.ts'
import build from '../src/index.ts'
import { getDependencyGraph, storeInfo } from '../src/packer/store/env.ts'

describe('compiler dependency graph', () => {
	let tempDir

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-graph-'))
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	function writeProjectFile(filePath, content) {
		const fullPath = path.join(tempDir, filePath)
		fs.mkdirSync(path.dirname(fullPath), { recursive: true })
		fs.writeFileSync(fullPath, content)
	}

	function prepareProject() {
		writeProjectFile('app.json', JSON.stringify({
			pages: ['pages/one/index', 'pages/two/index'],
		}))
		writeProjectFile('app.js', 'App({})\n')
		writeProjectFile('app.wxss', '')
		writeProjectFile('project.config.json', JSON.stringify({ appid: 'dependency-graph-app' }))
		for (const pageName of ['one', 'two']) {
			writeProjectFile(`pages/${pageName}/index.json`, JSON.stringify({
				usingComponents: { shared: '../../components/shared/index' },
			}))
			writeProjectFile(`pages/${pageName}/index.js`, 'Page({})\n')
			writeProjectFile(`pages/${pageName}/index.wxml`, `<view>${pageName}<shared /></view>\n`)
			writeProjectFile(`pages/${pageName}/index.wxss`, '')
		}
		writeProjectFile('components/shared/index.json', JSON.stringify({
			component: true,
			usingComponents: { leaf: '../leaf/index' },
		}))
		writeProjectFile('components/shared/index.js', 'Component({})\n')
		writeProjectFile('components/shared/index.wxml', '<leaf />\n')
		writeProjectFile('components/shared/index.wxss', '')
		writeProjectFile('components/leaf/index.json', JSON.stringify({ component: true }))
		writeProjectFile('components/leaf/index.js', 'Component({})\n')
		writeProjectFile('components/leaf/index.wxml', '<view>leaf</view>\n')
		writeProjectFile('components/leaf/index.wxss', '')
	}

	it('keeps typed forward and reverse edges across cycles and snapshots', () => {
		const graph = new DependencyGraph()
		graph.addNode('page', { type: 'page', entry: true })
		graph.addNode('a', { type: 'component' })
		graph.addNode('b', { type: 'component' })
		graph.addDependency('page', 'a', 'component')
		graph.addDependency('a', 'b', 'component')
		graph.addDependency('b', 'a', 'component')
		graph.addFile('b', path.join(tempDir, 'b.wxml'), 'view')

		const restored = new DependencyGraph(graph.toJSON())
		expect(restored.getDirectDependencies('a', 'component')).toEqual(['b'])
		expect(restored.getDirectDependents('a', 'component')).toEqual(expect.arrayContaining(['page', 'b']))
		expect(restored.getAffectedEntries(path.join(tempDir, 'b.wxml'))).toEqual(['page'])
		expect(restored.getFileKinds(path.join(tempDir, 'b.wxml'))).toEqual(['view'])
	})

	it('builds page-to-component edges and resolves all affected entries', () => {
		prepareProject()
		storeInfo(tempDir)
		const graph = getDependencyGraph()

		expect(graph.getDirectDependencies('pages/one/index', 'component'))
			.toContain('/components/shared/index')
		expect(graph.getDirectDependencies('/components/shared/index', 'component'))
			.toContain('/components/leaf/index')
		expect(graph.getAffectedEntries(path.join(tempDir, 'components/leaf/index.wxml')))
			.toEqual(['pages/one/index', 'pages/two/index'])
		expect(graph.getFileKinds(path.join(tempDir, 'components/leaf/index.wxml'))).toEqual(['view'])
	})

	// 两次真实构建都需要启动 view/logic/style worker；CI 资源竞争时可能超过默认 5 秒。
	// 仅为此集成用例放宽上限，其他依赖图单元测试仍使用默认超时。
	it('preserves unaffected page artifacts during an affected-entry rebuild', async () => {
		prepareProject()
		writeProjectFile('shared/helper.js', 'export const value = 1\n')
		writeProjectFile('shared/fragment.wxml', '<text>fragment</text>\n')
		writeProjectFile('shared/colors.wxss', '.shared { color: red; }\n')
		writeProjectFile('shared/logo.png', 'not-a-real-png')
		writeProjectFile('miniprogram_npm/unused/package.json', JSON.stringify({ name: 'unused', version: '1.0.0' }))
		writeProjectFile('miniprogram_npm/unused/index.js', 'module.exports = {}\n')
		writeProjectFile('pages/one/index.js', 'import { value } from "../../shared/helper.js"\nPage({ data: { value } })\n')
		writeProjectFile('pages/one/index.wxml', '<view>one<include src="../../shared/fragment.wxml" /><image src="../../shared/logo.png" /><shared /></view>\n')
		writeProjectFile('pages/one/index.wxss', '@import "../../shared/colors.wxss";\n')
		const outputDir = path.join(tempDir, 'out')
		const firstResult = await build(outputDir, tempDir, false, { sourcemap: true })
		const discoveredGraph = new DependencyGraph(firstResult.dependencyGraph)
		expect(discoveredGraph.getAffectedEntries(path.join(tempDir, 'shared/helper.js')))
			.toEqual(['pages/one/index'])
		expect(discoveredGraph.getAffectedEntries(path.join(tempDir, 'shared/fragment.wxml')))
			.toEqual(['pages/one/index'])
		expect(discoveredGraph.getAffectedEntries(path.join(tempDir, 'shared/colors.wxss')))
			.toEqual(['pages/one/index'])
		expect(discoveredGraph.getAffectedEntries(path.join(tempDir, 'shared/logo.png')))
			.toEqual(['pages/one/index'])
		expect(discoveredGraph.getFileKinds(path.join(tempDir, 'miniprogram_npm/unused/index.js')))
			.toEqual(['config'])
		const unaffectedPath = path.join(outputDir, 'main/pages_two_index.js')
		const unaffectedBefore = fs.readFileSync(unaffectedPath, 'utf8')

		writeProjectFile('pages/one/index.wxml', '<view>one changed<shared /></view>\n')
		await build(outputDir, tempDir, false, {
			sourcemap: true,
			affectedEntries: ['pages/one/index'],
			seedPath: outputDir,
			dependencyGraph: firstResult.dependencyGraph,
		})

		expect(fs.readFileSync(path.join(outputDir, 'main/pages_one_index.js'), 'utf8')).toContain('one changed')
		expect(fs.readFileSync(unaffectedPath, 'utf8')).toBe(unaffectedBefore)
	}, 30000)

	// --- M1: 模块级失效查询（getInvalidatedModules / computeInvalidatedModules）---
	// D-IV-1..9; TD §2.2 行为锚点 + D-IV-3 边缘案

	it('getInvalidatedModules: shared JS → moduleId + logic dependents', () => {
		const graph = new DependencyGraph()
		graph.addFile('/utils/shared', path.join(tempDir, 'utils/shared.js'), 'logic')
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.js'), 'logic')
		graph.addDependency('pages/foo/index', '/utils/shared', 'logic')

		expect(graph.getInvalidatedModules(path.join(tempDir, 'utils/shared.js')))
			.toEqual(['/utils/shared', 'pages/foo/index'])
	})

	it('getInvalidatedModules: page.js → page moduleId', () => {
		const graph = new DependencyGraph()
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.js'), 'logic')

		expect(graph.getInvalidatedModules(path.join(tempDir, 'pages/foo/index.js')))
			.toEqual(['pages/foo/index'])
	})

	it('getInvalidatedModules: wxml → view owner 进集 (D-IV-7 反转)', () => {
		const graph = new DependencyGraph()
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.wxml'), 'view')

		expect(graph.getInvalidatedModules(path.join(tempDir, 'pages/foo/index.wxml')))
			.toEqual(['pages/foo/index'])
	})

	it('getInvalidatedModules: component.js → moduleId + page 进集 (D-IV-6 反转：全 kind 闭包沿 component 边)', () => {
		const graph = new DependencyGraph()
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.js'), 'logic')
		graph.addFile('/components/leaf/index', path.join(tempDir, 'components/leaf/index.js'), 'logic')
		graph.addDependency('pages/foo/index', '/components/leaf/index', 'component')

		const result = graph.getInvalidatedModules(path.join(tempDir, 'components/leaf/index.js'))
		expect(result).toContain('/components/leaf/index')
		expect(result).toContain('pages/foo/index')
	})

	it('getInvalidatedModules: wxss → style owner 进集', () => {
		const graph = new DependencyGraph()
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.wxss'), 'style')

		expect(graph.getInvalidatedModules(path.join(tempDir, 'pages/foo/index.wxss')))
			.toEqual(['pages/foo/index'])
	})

	it('getInvalidatedModules: component .wxml 变更 → 依赖页 moduleId 进集 (全 kind 闭包沿 component 边)', () => {
		const graph = new DependencyGraph()
		graph.addFile('/components/leaf/index', path.join(tempDir, 'components/leaf/index.wxml'), 'view')
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.wxml'), 'view')
		graph.addDependency('pages/foo/index', '/components/leaf/index', 'component')

		const result = graph.getInvalidatedModules(path.join(tempDir, 'components/leaf/index.wxml'))
		expect(result).toContain('/components/leaf/index')
		expect(result).toContain('pages/foo/index')
	})

	it('getInvalidatedModules: 同模块多文件（js/wxml/wxss）任一变更 → 模块进集 (全 kind owner 收集)', () => {
		const graph = new DependencyGraph()
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.js'), 'logic')
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.wxml'), 'view')
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.wxss'), 'style')

		expect(graph.getInvalidatedModules(path.join(tempDir, 'pages/foo/index.js')))
			.toEqual(['pages/foo/index'])
		expect(graph.getInvalidatedModules(path.join(tempDir, 'pages/foo/index.wxml')))
			.toEqual(['pages/foo/index'])
		expect(graph.getInvalidatedModules(path.join(tempDir, 'pages/foo/index.wxss')))
			.toEqual(['pages/foo/index'])
	})

	it('getInvalidatedModules: unknown file → [] (D-IV-3, does not throw)', () => {
		const graph = new DependencyGraph()
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.js'), 'logic')

		expect(() => graph.getInvalidatedModules(path.join(tempDir, 'nonexistent.js')))
			.not.toThrow()
		expect(graph.getInvalidatedModules(path.join(tempDir, 'nonexistent.js')))
			.toEqual([])
	})

	it('computeInvalidatedModules: unions across files, dedupes, sorts', () => {
		const graph = new DependencyGraph()
		graph.addFile('/utils/a', path.join(tempDir, 'utils/a.js'), 'logic')
		graph.addFile('/utils/b', path.join(tempDir, 'utils/b.js'), 'logic')
		graph.addFile('pages/foo/index', path.join(tempDir, 'pages/foo/index.js'), 'logic')
		graph.addDependency('pages/foo/index', '/utils/a', 'logic')
		graph.addDependency('pages/foo/index', '/utils/b', 'logic')

		expect(computeInvalidatedModules(graph, [
			path.join(tempDir, 'utils/a.js'),
			path.join(tempDir, 'utils/b.js'),
		])).toEqual(['/utils/a', '/utils/b', 'pages/foo/index'])

		// D-IV-3: empty changedFiles → []
		expect(computeInvalidatedModules(graph, [])).toEqual([])
	})
})
