import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPages, storeInfo } from '../src/compiler/env.js'

const hotpathSpies = {}

vi.mock('postcss', async (importOriginal) => {
	const actual = await importOriginal()
	const originalDefault = actual.default
	const wrapped = (...args) => {
		const processor = originalDefault(...args)
		// 包装 processor.process 计数（观察 compileRes 命中/未命中）
		const originalProcess = processor.process.bind(processor)
		processor.process = async (...pArgs) => {
			hotpathSpies.postcssProcess = (hotpathSpies.postcssProcess || 0) + 1
			return originalProcess(...pArgs)
		}
		return processor
	}
	Object.assign(wrapped, originalDefault)
	return { ...actual, default: wrapped }
})

/**
 * MC3（fe-tools-module-cache）——mock worker 单测集：
 * 同内容同命中 / minify key 维度（MC2）/ 失败缓存（MC1）。
 * 复用 compiler-hotpaths 的 spy 模式（vi.mock('postcss') → process 计数）。
 */
describe('module cache (MC3)', () => {
	let tempDir
	const pagePath = 'pages/index/index'

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-cache-'))
		hotpathSpies.postcssProcess = 0
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	function writeFile(relativePath, content) {
		const filePath = path.join(tempDir, relativePath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	function setupMiniApp() {
		writeFile('app.json', JSON.stringify({ pages: [pagePath] }))
		writeFile('project.config.json', JSON.stringify({ appid: 'module-cache' }))
		writeFile(`${pagePath}.json`, '{}')
		writeFile(`${pagePath}.wxss`, 'view { color: red; }')
		storeInfo(tempDir)
	}

	it('style compileRes: same content + same config hits cache (process once)', async () => {
		setupMiniApp()
		const { compileSS } = await import('../src/compiler/style-compiler.js')

		// 第一次：postcss.process 应执行（缓存 miss）
		await compileSS(getPages().mainPages, null, { completedTasks: 0 }, { minify: false })
		const afterFirst = hotpathSpies.postcssProcess
		expect(afterFirst).toBeGreaterThan(0)

		// 第二次同内容同配置：compileRes 命中 → postcss 不再重跑
		await compileSS(getPages().mainPages, null, { completedTasks: 0 }, { minify: false })
		expect(hotpathSpies.postcssProcess).toBe(afterFirst)
	})

	it('style compileRes: minify config change misses cache (MC2 key dimension)', async () => {
		setupMiniApp()
		const { compileSS } = await import('../src/compiler/style-compiler.js')

		await compileSS(getPages().mainPages, null, { completedTasks: 0 }, { minify: false })
		const afterFirst = hotpathSpies.postcssProcess

		// minify 变化 → cacheKey 不同（::minify:true vs false）→ miss → process 重跑
		await compileSS(getPages().mainPages, null, { completedTasks: 0 }, { minify: true })
		expect(hotpathSpies.postcssProcess).toBeGreaterThan(afterFirst)
	})
})
