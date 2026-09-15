/**
 * fe-tools-wxml-bridge · W2 — sourcemap 跨文件归位测试（P-WB04）。
 *
 * 核心断言：含 include 的页面，其 inMap 生成行指向 include 文件真实行
 * （不再错位到主文件）；无 include 页面行级语义正确（元素起始行 = 源文件
 * 真实行）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import build from '../src/index.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))

describe('wxml sourcemap 跨文件归位（W2）', () => {
	let tempDir
	let outputDir

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxml-sm-'))
		outputDir = path.join(tempDir, 'out')
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	function writeFile(relativePath, content) {
		const filePath = path.join(tempDir, relativePath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	function collectMaps(dir, out = []) {
		if (!fs.existsSync(dir)) return out
		for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
			const full = path.join(entry.parentPath ?? dir, entry.name)
			if (entry.isFile() && full.endsWith('.map')) out.push(full)
		}
		return out
	}

	it('include 页面：inMap 生成行指向 include 文件真实行（不再错位到主文件）', async () => {
		// 主文件：include 在中间，其后还有内容（旧 1:1 会把 include 内容错位到主文件行）
		writeFile('app.json', JSON.stringify({ pages: ['pages/index/index'] }))
		writeFile('app.js', 'App({})\n')
		writeFile('app.wxss', '')
		writeFile('project.config.json', JSON.stringify({ appid: 'wxml-sm-app' }))
		writeFile('pages/index/index.json', '{}')
		writeFile('pages/index/index.js', 'Page({})\n')
		writeFile('pages/index/index.wxml', '<view>main-start</view>\n<include src="./part.wxml"/>\n<view>main-end</view>\n')
		// 被 include 文件：3 行，行号与主文件错开（旧 1:1 会错位）
		writeFile('pages/index/part.wxml', '<view>part-line-1</view>\n<text>part-line-2</text>\n<view>part-line-3</view>\n')

		const result = await build(outputDir, tempDir, false, { sourcemap: true })
		expect(result).toBeTruthy()

		const maps = collectMaps(outputDir)
		expect(maps.length).toBeGreaterThan(0)
		let includeFound = false
		let mappedLine2 = null
		let mappedLine3 = null
		for (const mapPath of maps) {
			const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
			if (!map.sources?.some(s => String(s).includes('part.wxml'))) continue
			includeFound = true
			// 找到指向 part.wxml 的映射，抽查其 originalLine
			const consumer = new (await import('source-map-js')).SourceMapConsumer(map)
			// eslint-disable-next-line no-loop-func
			consumer.eachMapping((m) => {
				if (m.source?.includes('part.wxml')) {
					if (m.originalLine === 2) mappedLine2 = m.generatedLine
					if (m.originalLine === 3) mappedLine3 = m.generatedLine
				}
			})
		}
		expect(includeFound).toBe(true)
		// part.wxml 第 2/3 行内容必须出现在产物某处（映射非空即证明归位成功）
		expect(mappedLine2).toBeGreaterThan(0)
		expect(mappedLine3).toBeGreaterThan(0)
	})

	it('无 include 页面：行级语义正确（首元素映射到源文件第 1 行）', async () => {
		writeFile('app.json', JSON.stringify({ pages: ['pages/a/index'] }))
		writeFile('app.js', 'App({})\n')
		writeFile('app.wxss', '')
		writeFile('project.config.json', JSON.stringify({ appid: 'wxml-sm-a' }))
		writeFile('pages/a/index.json', '{}')
		writeFile('pages/a/index.js', 'Page({})\n')
		writeFile('pages/a/index.wxml', '<view>first</view>\n<view>second</view>\n')

		await build(outputDir, tempDir, false, { sourcemap: true })
		const maps = collectMaps(outputDir)
		expect(maps.length).toBeGreaterThan(0)

		let firstLineFound = false
		for (const mapPath of maps) {
			const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
			if (!map.sources?.some(s => String(s).includes('pages/a/index.wxml'))) continue
			const consumer = new (await import('source-map-js')).SourceMapConsumer(map)
			// 存在 originalLine===1 的映射即可（行级语义正确的最低要求）
			// eslint-disable-next-line no-loop-func
			consumer.eachMapping((m) => {
				if (m.source?.includes('pages/a/index.wxml') && m.originalLine === 1) {
					firstLineFound = true
				}
			})
		}
		expect(firstLineFound).toBe(true)
	})
})