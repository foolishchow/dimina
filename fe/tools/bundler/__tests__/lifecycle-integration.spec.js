import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import build from '../src/index.js'
import { createLifecycle } from '../src/shared/lifecycle.js'

// 观察者集成规格（compiler-hook-layer 契约 v1）：
// 全量 / stages 过滤 / 小游戏 / 失败路径四场景 + 并发不串行 + 错误隔离消融。

const tempDirs = []

afterEach(() => {
	for (const dir of tempDirs) {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	tempDirs.length = 0
})

function makeTempDir(prefix) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
	tempDirs.push(dir)
	return dir
}

function writeFile(root, relativePath, content) {
	const filePath = path.join(root, relativePath)
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, content)
}

// 最小常规 app：两个页面 + 一处不支持的 wx API 调用以触发兼容性警告镜像。
function createRegularApp({ brokenJs = false } = {}) {
	const root = makeTempDir('lifecycle-app-')
	const page = brokenJs ? 'Page({ data: {' : 'Page({ data: { value: 1 } })'
	writeFile(root, 'app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/about/about'] }))
	writeFile(root, 'app.js', 'App({})\n')
	writeFile(root, 'app.wxss', '')
	writeFile(root, 'project.config.json', JSON.stringify({ appid: 'lifecycle-spec-app' }))
	for (const entry of ['index', 'about']) {
		const base = `pages/${entry}/${entry}`
		writeFile(root, `${base}.json`, '{}')
		writeFile(root, `${base}.js`, `${page}\n`)
		writeFile(root, `${base}.wxml`, '<view>{{value}}</view>\n')
		writeFile(root, `${base}.wxss`, '.page { color: red; }\n')
	}
	// 触发 Unsupported wx API 诊断（base 示例同款）
	writeFile(root, 'pages/index/index.js', 'Page({ onLoad() { wx.createVideoContext("video1") } })\n')
	return root
}

// 最小小游戏 app（game.json 存在即判定为小游戏）。
function createMiniGameApp() {
	const root = makeTempDir('lifecycle-game-')
	writeFile(root, 'game.json', JSON.stringify({ deviceOrientation: 'portrait' }))
	writeFile(root, 'game.js', 'Game({})\n')
	writeFile(root, 'project.config.json', JSON.stringify({ appid: 'lifecycle-spec-game' }))
	return root
}

function createObserver() {
	const lifecycle = createLifecycle()
	const events = []
	const record = name => (payload) => {
		events.push({
			name,
			...(payload && typeof payload === 'object' ? { payload } : {}),
		})
	}
	for (const name of [
		'build:start',
		'config:collected',
		'dist:prepared',
		'config:compiled',
		'npm:built',
		'stage:before',
		'stage:after',
		'stage:error',
		'bundle:published',
		'build:warning',
		'build:end',
		'build:error',
	]) {
		lifecycle.on(name, record(name))
	}
	return { lifecycle, events }
}

const namesOf = events => events.map(event => event.name)
const indexOfEvent = (events, name, predicate = () => true) => {
	const index = events.findIndex(event => event.name === name && predicate(event))
	if (index === -1) throw new Error(`event not found: ${name}`)
	return index
}

describe('lifecycle observer integration', () => {
	it('emits the full contract event sequence for a regular build', async () => {
		const workPath = createRegularApp()
		const outputDir = makeTempDir('lifecycle-out-')
		const { lifecycle, events } = createObserver()

		const result = await build(outputDir, workPath, false, { lifecycle })
		const names = namesOf(events)

		expect(names[0]).toBe('build:start')
		expect(names[names.length - 1]).toBe('build:end')

		// 阶段顺序：start < collected < prepared < config:compiled < npm:built
		const order = ['build:start', 'config:collected', 'dist:prepared', 'config:compiled', 'npm:built']
			.map(name => indexOfEvent(events, name))
		for (let i = 1; i < order.length; i++) {
			expect(order[i]).toBeGreaterThan(order[i - 1])
		}

		// 三阶段并发启动：全部 stage:before 先于第一个 stage:after
		const beforeIndexes = events
			.map((event, index) => (event.name === 'stage:before' ? index : -1))
			.filter(index => index >= 0)
		const afterIndexes = events
			.map((event, index) => (event.name === 'stage:after' ? index : -1))
			.filter(index => index >= 0)
		expect(beforeIndexes).toHaveLength(3)
		expect(afterIndexes).toHaveLength(3)
		expect(Math.max(...beforeIndexes)).toBeLessThan(Math.min(...afterIndexes))

		// 每个阶段的 before/after 成对且先 after 后 before
		for (const stage of ['view', 'logic', 'style']) {
			const beforeIndex = indexOfEvent(events, 'stage:before', e => e.payload.stage === stage)
			const afterIndex = indexOfEvent(events, 'stage:after', e => e.payload.stage === stage)
			expect(beforeIndex).toBeLessThan(afterIndex)
		}

		// 全部 stage:after 先于 bundle:published，再先于 build:end
		expect(Math.max(...afterIndexes)).toBeLessThan(
			indexOfEvent(events, 'bundle:published'),
		)
		expect(indexOfEvent(events, 'bundle:published')).toBeLessThan(
			indexOfEvent(events, 'build:end'),
		)

		// build:warning 镜像：常规 app 至少一条，载荷含 message
		const warnings = events.filter(event => event.name === 'build:warning')
		expect(warnings.length).toBeGreaterThan(0)
		for (const event of warnings) {
			expect(typeof event.payload.message).toBe('string')
			expect(event.payload.message.length).toBeGreaterThan(0)
		}

		// 载荷形状
		const start = events.find(event => event.name === 'build:start').payload
		expect(start).toMatchObject({ workPath, targetPath: outputDir, useAppIdDir: false })
		expect(Object.isFrozen(start)).toBe(true)
		expect('lifecycle' in start.options).toBe(false) // 非序列化字段已剥离

		const published = events.find(event => event.name === 'bundle:published').payload
		expect(published).toEqual({ targetPath: outputDir, useAppIdDir: false })

		const collected = events.find(event => event.name === 'config:collected').payload
		expect(collected.miniGame).toBe(false)
		expect(collected.pagesCount).toBe(2)
		expect(collected.fileTypes).toBeTruthy()

		const stageAfter = events.find(event => event.name === 'stage:after' && event.payload.stage === 'view')
		expect(typeof stageAfter.payload.durationMs).toBe('number')
		expect(Array.isArray(stageAfter.payload.compatibilityWarnings)).toBe(true)

		// build:end 载荷与公开返回值一致，isolatedListenerErrors 为 0
		const end = events.find(event => event.name === 'build:end').payload
		expect(end.isolatedListenerErrors).toBe(0)
		expect(end.result).toEqual(result)
		expect(Object.keys(result).sort()).toEqual(['appId', 'dependencyGraph', 'name', 'path'])
	})

	it('honors stages filtering in emitted events', async () => {
		const workPath = createRegularApp()
		const outputDir = makeTempDir('lifecycle-out-')
		const { lifecycle, events } = createObserver()

		const result = await build(outputDir, workPath, false, { lifecycle, stages: ['logic'] })

		const stageEvents = events.filter(event => event.name.startsWith('stage:'))
		expect(stageEvents).toHaveLength(2)
		expect(stageEvents.map(event => event.payload.stage).sort()).toEqual(['logic', 'logic'])
		expect(stageEvents[0].name).toBe('stage:before')
		expect(stageEvents[1].name).toBe('stage:after')
		expect(events.some(event => event.name === 'build:end')).toBe(true)
		expect(result.appId).toBe('lifecycle-spec-app')
	})

	it('emits only the logic stage for mini-game projects', async () => {
		const workPath = createMiniGameApp()
		const outputDir = makeTempDir('lifecycle-out-')
		const { lifecycle, events } = createObserver()

		const result = await build(outputDir, workPath, false, { lifecycle })

		const stageEvents = events.filter(event => event.name.startsWith('stage:'))
		expect(stageEvents).toHaveLength(2)
		expect(stageEvents.map(event => event.payload.stage)).toEqual(['logic', 'logic'])
		const collected = events.find(event => event.name === 'config:collected').payload
		expect(collected.miniGame).toBe(true)
		expect(result.path).toBe('game')
	})

	it('emits build:error with the same error object on initialization failure', async () => {
		const root = makeTempDir('lifecycle-err-')
		const workPath = path.join(root, 'missing-app')
		const outputDir = makeTempDir('lifecycle-out-')
		const { lifecycle, events } = createObserver()

		let caught
		try {
			await build(outputDir, workPath, false, { lifecycle })
		}
		catch (error) {
			caught = error
		}

		expect(caught.code).toBe('ENOENT')
		expect(namesOf(events)).toEqual(['build:start', 'build:error'])
		const errorEvent = events.find(event => event.name === 'build:error')
		expect(errorEvent.payload.stage).toBe(null)
		expect(errorEvent.payload.error).toBe(caught) // 同一错误对象（进程内）
	})

	it('emits stage:error then build:error and rejects with the same error on stage failure', async () => {
		const workPath = createRegularApp({ brokenJs: true })
		const outputDir = makeTempDir('lifecycle-out-')
		const { lifecycle, events } = createObserver()

		let caught
		try {
			await build(outputDir, workPath, false, { lifecycle, stages: ['logic'] })
		}
		catch (error) {
			caught = error
		}

		expect(caught).toBeInstanceOf(Error)
		expect(indexOfEvent(events, 'stage:error')).toBeLessThan(indexOfEvent(events, 'build:error'))
		const stageError = events.find(event => event.name === 'stage:error')
		expect(stageError.payload.stage).toBe('logic')
		expect(stageError.payload.error).toBeInstanceOf(Error)
		const buildError = events.find(event => event.name === 'build:error')
		expect(buildError.payload.error.message).toBe(caught.message) // worker 错误经序列化重建，比对消息
		expect(buildError.payload.error).toBe(caught)
	})
})

describe('lifecycle listener error isolation in build (A-006 消融口径)', () => {
	it('keeps the build successful and artifacts byte-identical when a listener throws', async () => {
		const workPath = createRegularApp()
		const baselineOutput = makeTempDir('lifecycle-iso-base-')
		const boomOutput = makeTempDir('lifecycle-iso-boom-')

		// 基线：无监听器构建
		const baselineResult = await build(baselineOutput, workPath, false)

		// 注入抛错监听器 + 记录监听器
		const lifecycle = createLifecycle()
		const events = []
		lifecycle.on('build:start', () => {
			throw new Error('observer boom')
		})
		lifecycle.on('build:end', payload => events.push(payload))
		lifecycle.on('build:error', payload => events.push(payload))

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		let boomResult
		let capturedCalls = []
		try {
			boomResult = await build(boomOutput, workPath, false, { lifecycle })
			// mockRestore 会清空 spy 调用记录，必须在 restore 前复制
			capturedCalls = [...errorSpy.mock.calls]
		}
		finally {
			errorSpy.mockRestore()
		}

		// 构建成功且公开返回值一致
		expect(boomResult).toEqual(baselineResult)

		// build:end 载荷计入隔离错误
		const endPayload = events.find(event => event?.result)
		expect(endPayload.isolatedListenerErrors).toBe(1)

		// 诊断日志带统一前缀
		expect(capturedCalls.length).toBeGreaterThan(0)
		const logLine = capturedCalls.map(call => call[0]).find(line => String(line).includes('observer boom'))
		expect(String(logLine)).toContain('[lifecycle] listener error on build:start')

		// 产物逐字节一致
		expect(collectTree(baselineOutput)).toEqual(collectTree(boomOutput))
	})

	it('records a mutation attempt on a frozen payload as isolated without affecting the build', async () => {
		const workPath = createRegularApp()
		const outputDir = makeTempDir('lifecycle-out-')
		const lifecycle = createLifecycle()
		lifecycle.on('build:start', (payload) => {
			payload.workPath = '/mutated' // 严格模式对冻结对象写入抛错 -> 被隔离
		})

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		let result
		try {
			result = await build(outputDir, workPath, false, { lifecycle })
		}
		finally {
			errorSpy.mockRestore()
		}

		expect(result.appId).toBe('lifecycle-spec-app')
		expect(lifecycle.isolatedListenerErrors).toHaveLength(1)
	})
})

function collectTree(root) {
	const result = {}
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				walk(fullPath)
			}
			else {
				result[path.relative(root, fullPath)] = fs.readFileSync(fullPath, 'base64')
			}
		}
	}
	walk(root)
	return result
}
