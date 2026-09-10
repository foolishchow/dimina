import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { WebSocket } from 'ws'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDevServer } from '../src/common/dev-server.js'

// dmcc-dev-server 契约 v1 §2/§6：静态服务/快照语义/pendingReload/ws 协议。

describe('dev server — HTTP 静态服务与快照语义', () => {
	let serveRoot
	let sdkRoot
	let devServer
	let baseUrl

	beforeEach(async () => {
		serveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-server-serve-'))
		sdkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-server-sdk-'))
		fs.mkdirSync(path.join(serveRoot, 'main'), { recursive: true })
		fs.writeFileSync(path.join(serveRoot, 'main', 'logic.js'), '/* logic v1 */\n')
		fs.writeFileSync(path.join(serveRoot, 'app-config.json'), JSON.stringify({ appId: 'wx_test' }))
		fs.writeFileSync(path.join(sdkRoot, 'index.js'), '/* sdk index */\n')

		devServer = createDevServer({
			serveRoot,
			sdkRoot,
			appId: 'wx_test',
		})
		await devServer.listen(0, '127.0.0.1')
		baseUrl = `http://127.0.0.1:${devServer.server.address().port}`
	})

	afterEach(async () => {
		await devServer.close()
		fs.rmSync(serveRoot, { recursive: true, force: true })
		fs.rmSync(sdkRoot, { recursive: true, force: true })
	})

	function get(url) {
		return new Promise((resolve, reject) => {
			http.get(url, (res) => {
				const chunks = []
				res.on('data', c => chunks.push(c))
				res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
			}).on('error', reject)
		})
	}

	it('GET / 返回内置宿主页（含 sdk 引用与 appId 注入）', async () => {
		const res = await get(`${baseUrl}/`)
		expect(res.status).toBe(200)
		expect(res.headers['cache-control']).toBe('no-cache')
		expect(res.body).toContain('dmcc dev · wx_test')
		expect(res.body).toContain('createContainer')
		expect(res.body).toContain('/sdk/index.js')
	})

	it('GET /pageFrame.html 返回渲染层 iframe 文档', async () => {
		const res = await get(`${baseUrl}/pageFrame.html`)
		expect(res.status).toBe(200)
		expect(res.headers['content-type']).toContain('text/html')
		expect(res.body).toContain('/sdk/pageFrame.js')
		expect(res.body).toContain('/sdk/pageFrame.css')
	})

	it('GET /sdk/index.js 服务 sdk 资产（no-cache + 正确类型）', async () => {
		const res = await get(`${baseUrl}/sdk/index.js`)
		expect(res.status).toBe(200)
		expect(res.headers['cache-control']).toBe('no-cache')
		expect(res.headers['content-type']).toContain('text/javascript')
		expect(res.body).toContain('sdk index')
	})

	it('GET 产物（/main/logic.js 与 /app-config.json）来自 serveRoot', async () => {
		const logic = await get(`${baseUrl}/main/logic.js`)
		expect(logic.status).toBe(200)
		expect(logic.body).toContain('logic v1')
		const cfg = await get(`${baseUrl}/app-config.json`)
		expect(cfg.status).toBe(200)
		expect(cfg.body).toContain('wx_test')
	})

	it('未知资源 404；路径穿越被拒 400', async () => {
		const missing = await get(`${baseUrl}/nope.js`)
		expect(missing.status).toBe(404)
		const traversal = await get(`${baseUrl}/..%2F..%2Fetc%2Fpasswd`)
		expect(traversal.status).toBe(400)
	})

	it('快照语义：serveRoot 更新后立即服务新内容（最后成功发布）', async () => {
		fs.writeFileSync(path.join(serveRoot, 'main', 'logic.js'), '/* logic v2 */\n')
		const res = await get(`${baseUrl}/main/logic.js`)
		expect(res.body).toContain('logic v2')
	})

	it('CORS：非白名单浏览器来源 403，白名单/无来源放行', async () => {
		const denied = await new Promise((resolve, reject) => {
			http.get({ hostname: '127.0.0.1', port: devServer.server.address().port, path: '/', headers: { origin: 'https://evil.example' } }, res => resolve({ status: res.statusCode })).on('error', reject)
		})
		expect(denied.status).toBe(403)
		const local = await new Promise((resolve, reject) => {
			http.get({ hostname: '127.0.0.1', port: devServer.server.address().port, path: '/', headers: { origin: 'http://localhost:5173' } }, res => resolve({ status: res.statusCode })).on('error', reject)
		})
		expect(local.status).toBe(200)
	})
})

describe('dev server — WebSocket 协议与 pendingReload', () => {
	let serveRoot
	let sdkRoot
	let devServer
	let wsUrl

	beforeEach(async () => {
		serveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-server-ws-serve-'))
		sdkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-server-ws-sdk-'))
		devServer = createDevServer({ serveRoot, sdkRoot, appId: 'wx_test' })
		await devServer.listen(0, '127.0.0.1')
		wsUrl = `ws://127.0.0.1:${devServer.server.address().port}/ws`
	})

	afterEach(async () => {
		await devServer.close()
		fs.rmSync(serveRoot, { recursive: true, force: true })
		fs.rmSync(sdkRoot, { recursive: true, force: true })
	})

	function connectAndSubscribe() {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(wsUrl)
			const messages = []
			socket.on('open', () => {
				socket.send(JSON.stringify({ type: 'subscribe', appId: 'wx_test' }))
			})
			socket.on('message', (data) => {
				messages.push(JSON.parse(data.toString()))
				resolve({ socket, messages, getReloads: () => messages.filter(m => m.type === 'reload') })
			})
			socket.on('error', reject)
		})
	}

	it('订阅成功收到 subscribed；unknown appId 收到 error', async () => {
		const { socket, messages } = await connectAndSubscribe()
		expect(messages[0].type).toBe('subscribed')
		expect(messages[0].appId).toBe('wx_test')
		socket.close()
	})

	it('bundle:published 且有 pendingReload → 推送完整 reload 载荷并清空', async () => {
		const { socket, messages } = await connectAndSubscribe()
		devServer.setPendingReload({
			appId: 'wx_test',
			reloadLevel: 'L1',
			changedStages: ['logic'],
			affectedPages: ['pages/index/index'],
			buildId: 1,
		})
		devServer.notifyBuildPublished()
		// 等待消息送达
		await new Promise(resolve => setTimeout(resolve, 20))
		const reloads = messages.filter(m => m.type === 'reload')
		expect(reloads).toHaveLength(1)
		expect(reloads[0]).toEqual({
			type: 'reload',
			appId: 'wx_test',
			reloadLevel: 'L1',
			changedStages: ['logic'],
			affectedPages: ['pages/index/index'],
			buildId: 1,
		})
		expect(devServer.getPendingReload()).toBeNull()
		socket.close()
	})

	it('无 pendingReload 时 bundle:published 不推送', async () => {
		const { socket, messages } = await connectAndSubscribe()
		devServer.notifyBuildPublished()
		await new Promise(resolve => setTimeout(resolve, 20))
		expect(messages.filter(m => m.type === 'reload')).toHaveLength(0)
		socket.close()
	})

	it('build:error → 清空 pendingReload 并推送 build:error', async () => {
		const { socket, messages } = await connectAndSubscribe()
		devServer.setPendingReload({ appId: 'wx_test', reloadLevel: 'L1', changedStages: ['logic'], affectedPages: [], buildId: 2 })
		devServer.notifyBuildError('compile failed: syntax error')
		await new Promise(resolve => setTimeout(resolve, 20))
		expect(devServer.getPendingReload()).toBeNull()
		expect(messages.filter(m => m.type === 'reload')).toHaveLength(0)
		const err = messages.find(m => m.type === 'build:error')
		expect(err).toEqual({ type: 'build:error', message: 'compile failed: syntax error' })
		socket.close()
	})

	it('ack 被记录（诊断不改变控制流）', async () => {
		const { socket } = await connectAndSubscribe()
		socket.send(JSON.stringify({ type: 'ack', appId: 'wx_test', buildId: 1 }))
		await new Promise(resolve => setTimeout(resolve, 20))
		const acks = devServer.getAcks()
		expect(acks).toHaveLength(1)
		expect(acks[0].buildId).toBe(1)
		socket.close()
	})

	it('subscribe 后收到 buildId 自增的连续 reload（幂等可去重）', async () => {
		const { socket, messages } = await connectAndSubscribe()
		devServer.setPendingReload({ appId: 'wx_test', reloadLevel: 'L2', changedStages: ['style'], affectedPages: ['pages/index/index'], buildId: 3 })
		devServer.notifyBuildPublished()
		await new Promise(resolve => setTimeout(resolve, 20))
		devServer.setPendingReload({ appId: 'wx_test', reloadLevel: 'L0', changedStages: [], affectedPages: [], buildId: 4 })
		devServer.notifyBuildPublished()
		await new Promise(resolve => setTimeout(resolve, 20))
		const reloads = messages.filter(m => m.type === 'reload')
		expect(reloads.map(r => r.buildId)).toEqual([3, 4])
		expect(reloads.map(r => r.reloadLevel)).toEqual(['L2', 'L0'])
		socket.close()
	})
})
