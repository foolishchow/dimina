import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import build from '../src/index.js'
import { createProjectStore } from '../src/model/project-store.js'

/**
 * M-A（PS1 / BP1 共同不变量）：注入 `options.store` 时，pipeline 必须实际使用
 * 该实例——`ctx.dependencyGraph` 与 `store.getDependencyGraph()` 同一引用，
 * 且 `store.load` 是唯一装载路径。
 *
 * 修复前缺陷：`_runBuild` 内 `store: providedStore` 遮蔽 createBuildPipeline
 * 传入的 store，导致注入实例被忽略、临时 create 另一份——本 spec 锁定该回归
 * （load spy 未命中 ⇒ 注入 store 未被使用 ⇒ 测试失败）。
 *
 * 观测约束：ProjectStore 是 ALS 薄包，build 外 `getDependencyGraph()` 读 default
 * context（空图）。因此「同一引用」通过 spy 包装观察 pipeline 对注入实例的调用，
 * 并用 store 的 snapshot 与 build 结果比对（同一 ALS 上下文内一致）。
 */
describe('project store M-A injection (PS1/BP1)', () => {
	let tempDir
	let outputDir
	const pagePath = 'pages/index/index'

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-store-'))
		outputDir = path.join(tempDir, 'out')
		writeFile('app.json', JSON.stringify({ pages: [pagePath] }))
		writeFile('app.js', 'App({})\n')
		writeFile('app.wxss', '')
		writeFile('project.config.json', JSON.stringify({ appid: 'project-store-app' }))
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

	it('uses the injected store: load called exactly once with workPath', async () => {
		const store = createProjectStore()
		const loadSpy = vi.spyOn(store, 'load')

		await build(outputDir, tempDir, false, { store })

		// 修复前：注入 store 被忽略，load 从未被调用（临时 store 被用）
		expect(loadSpy).toHaveBeenCalledTimes(1)
		expect(loadSpy).toHaveBeenCalledWith(tempDir, expect.any(Object))
	})

	it('M-A wiring: pipeline reads graph via store.getDependencyGraph', async () => {
		const store = createProjectStore()
		const graphSpy = vi.spyOn(store, 'getDependencyGraph')

		await build(outputDir, tempDir, false, { store })

		expect(graphSpy).toHaveBeenCalled()
	})

	it('M-A same-reference: captured graph equals build result graph', async () => {
		const store = createProjectStore()
		// vi.spyOn 默认 call-through：记录每次调用返回的引用
		const graphSpy = vi.spyOn(store, 'getDependencyGraph')

		const result = await build(outputDir, tempDir, false, { store })

		expect(graphSpy).toHaveBeenCalled()
		// build 内 store.getDependencyGraph() 返回的图引用被挂到 ctx.dependencyGraph，
		// 序列化后应与 build 结果一致（同一 ALS 上下文内的同一引用）
		const captured = graphSpy.mock.results[0].value
		expect(captured.toJSON()).toEqual(result.dependencyGraph)
	})

	it('no store: temporary createProjectStore path still works (L3)', async () => {
		const result = await build(outputDir, tempDir, false)

		expect(result).toMatchObject({
			appId: 'project-store-app',
			name: expect.any(String),
		})
		expect(typeof result.dependencyGraph).toBe('object')
	})
})
