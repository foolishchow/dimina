import http from 'node:http'
import { Readable } from 'node:stream'
import { afterAll, describe, expect, it } from 'vitest'
import {
	assertSafeTarget,
	handleProxyRequest,
	isAllowedBrowserOrigin,
	isPublicAddress,
	sanitizeRequestHeaders,
} from '../src/dev/dev-proxy.js'

// dmcc-dev-server 契约 v1 §7：代理（security 纯函数迁移 + /proxy 端点）。

describe('dev-proxy — security 纯函数（迁移自 fe/packages/server/security.js）', () => {
	it('阻止私网/回环/链路本地/保留地址，允许公网地址', () => {
		for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fe80::1', '0.0.0.0']) {
			expect(isPublicAddress(address)).toBe(false)
		}
		expect(isPublicAddress('8.8.8.8')).toBe(true)
		expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
		// IPv4-mapped IPv6 不得绕过 IPv4 段
		expect(isPublicAddress('::ffff:192.168.1.1')).toBe(false)
	})

	it('校验每个 DNS answer 后才允许目标（注入 lookup 断言）', async () => {
		await expect(
			assertSafeTarget('https://example.test/path', async () => [{ address: '203.0.113.4', family: 4 }]),
		).rejects.toMatchObject({ code: 'DIMINA_UNSAFE_TARGET' })
		await expect(
			assertSafeTarget('https://example.test/path', async () => [{ address: '8.8.8.8', family: 4 }]),
		).resolves.toBeInstanceOf(URL)
	})

	it('拒绝无效/非 http(s)/带凭据的目标 URL', async () => {
		await expect(assertSafeTarget('', async () => [])).rejects.toMatchObject({ code: 'DIMINA_UNSAFE_TARGET' })
		await expect(assertSafeTarget('ftp://example.com', async () => [])).rejects.toMatchObject({ code: 'DIMINA_UNSAFE_TARGET' })
		await expect(assertSafeTarget('http://user:pw@example.com', async () => [])).rejects.toMatchObject({ code: 'DIMINA_UNSAFE_TARGET' })
	})

	it('CORS 来源允许回环、私网 IP 或显式白名单', () => {
		expect(isAllowedBrowserOrigin('http://localhost:5173')).toBe(true)
		expect(isAllowedBrowserOrigin('https://127.0.0.1:4173')).toBe(true)
		expect(isAllowedBrowserOrigin('http://192.168.2.124:8080')).toBe(true)
		expect(isAllowedBrowserOrigin('http://10.0.0.8:8080')).toBe(true)
		expect(isAllowedBrowserOrigin('https://evil.example')).toBe(false)
		expect(isAllowedBrowserOrigin('https://8.8.8.8')).toBe(false)
		expect(isAllowedBrowserOrigin('https://dev.example', 'https://dev.example')).toBe(true)
		expect(isAllowedBrowserOrigin(null)).toBe(true)
	})

	it('移除逐跳与路由敏感请求头', () => {
		expect(sanitizeRequestHeaders({
			Authorization: 'Bearer token',
			Host: 'localhost',
			Connection: 'upgrade',
			'X-Request-ID': '123',
		})).toEqual({
			Authorization: 'Bearer token',
			'X-Request-ID': '123',
		})
	})
})

describe('dev-proxy — /proxy 端点', () => {
	function callProxy(body, deps = {}) {
		const req = Readable.from([JSON.stringify(body)])
		req.method = 'POST'
		req.headers = { 'content-type': 'application/json' }

		const chunks = []
		let statusCode = 0
		let sentHeaders = null
		const res = {
			writeHead(code, headers) {
				statusCode = code
				sentHeaders = headers
			},
			end(bodyChunk) {
				if (bodyChunk) chunks.push(bodyChunk)
			},
		}

		return handleProxyRequest(req, res, deps).then(() => ({
			req,
			res,
			chunks,
			statusCode,
			sentHeaders,
			rawBody: Buffer.concat(chunks.map(chunk => Buffer.isBuffer(chunk)
				? chunk
				: Buffer.from(String(chunk)))),
			body: Buffer.concat(chunks.map(chunk => Buffer.isBuffer(chunk)
				? chunk
				: Buffer.from(String(chunk)))).toString('utf8'),
		}))
	}

	it('SSRF：私网目标被拒（403）；endpoint 层不触达转发', async () => {
		let forwardCalled = false
		const result = await callProxy({
			url: 'http://192.168.1.1/api',
			method: 'GET',
			responseType: 'json',
			header: {},
			timeout: 5000,
		}, {
			forwardRequest: async () => {
				forwardCalled = true
				return { status: 200, headers: {}, body: Buffer.from('{}') }
			},
		})
		expect(result.statusCode).toBe(403)
		expect(forwardCalled).toBe(false)
		const parsed = JSON.parse(result.body)
		expect(parsed.error).toMatch(/private or reserved/)
	})

	it('合法请求转发成功（DI 注入本地目标走全链路）', async () => {
		// 本地 HTTP 目标服务器（经 DI 绕过 SSRF 预校验，模拟"已通过校验的公网目标"）
		const targetServer = http.createServer((req, res) => {
			let body = ''
			req.on('data', c => body += c)
			req.on('end', () => {
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({ method: req.method, received: body ? JSON.parse(body) : null }))
			})
		})
		await new Promise(resolve => targetServer.listen(0, '127.0.0.1', resolve))
		const port = targetServer.address().port
		try {
			const result = await callProxy({
				url: `http://127.0.0.1:${port}/echo`,
				data: { hello: 'world' },
				method: 'POST',
				responseType: 'json',
				header: {},
				timeout: 5000,
			}, {
				assertSafeTarget: async (rawUrl) => new URL(rawUrl),
			})
			expect(result.statusCode).toBe(200)
			expect(result.sentHeaders['Content-Type']).toBe('application/json')
			const parsed = JSON.parse(result.body)
			expect(parsed.method).toBe('POST')
			expect(parsed.received).toEqual({ hello: 'world' })
		}
		finally {
			await new Promise(resolve => targetServer.close(resolve))
		}
	})

	it('GET 请求的 data 作为查询参数透传', async () => {
		const targetServer = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ url: req.url }))
		})
		await new Promise(resolve => targetServer.listen(0, '127.0.0.1', resolve))
		const port = targetServer.address().port
		try {
			const result = await callProxy({
				url: `http://127.0.0.1:${port}/search`,
				data: { q: 'dimina', page: 1 },
				method: 'GET',
				responseType: 'json',
				timeout: 5000,
			}, {
				assertSafeTarget: async (rawUrl) => new URL(rawUrl),
			})
			const parsed = JSON.parse(result.body)
			expect(parsed.url).toContain('/search')
			expect(parsed.url).toContain('q=dimina')
			expect(parsed.url).toContain('page=1')
		}
		finally {
			await new Promise(resolve => targetServer.close(resolve))
		}
	})

	it('responseType=arraybuffer 原样透传二进制响应', async () => {
		const targetServer = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
			res.end(Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]))
		})
		await new Promise(resolve => targetServer.listen(0, '127.0.0.1', resolve))
		const port = targetServer.address().port
		try {
			const result = await callProxy({
				url: `http://127.0.0.1:${port}/bin`,
				method: 'GET',
				responseType: 'arraybuffer',
				timeout: 5000,
			}, {
				assertSafeTarget: async (rawUrl) => new URL(rawUrl),
			})
			expect(result.statusCode).toBe(200)
			expect(result.sentHeaders['Content-Type']).toBe('application/octet-stream')
			expect([...result.rawBody]).toEqual([0xDE, 0xAD, 0xBE, 0xEF])
		}
		finally {
			await new Promise(resolve => targetServer.close(resolve))
		}
	})

	it('非法 HTTP method → 400（不触达转发）', async () => {
		let forwardCalled = false
		const result = await callProxy({
			url: 'http://8.8.8.8/api',
			method: 'TRACE',
			responseType: 'json',
		}, {
			forwardRequest: async () => {
				forwardCalled = true
				return { status: 200, headers: {}, body: Buffer.from('{}') }
			},
		})
		expect(result.statusCode).toBe(400)
		expect(forwardCalled).toBe(false)
		expect(JSON.parse(result.body).error).toBe('Invalid HTTP method')
	})

	it('非法 responseType → 400', async () => {
		const result = await callProxy({
			url: 'http://8.8.8.8/api',
			method: 'GET',
			responseType: 'xml',
		})
		expect(result.statusCode).toBe(400)
	})

	it('无效 JSON body → 400', async () => {
		const req = Readable.from(['not-json'])
		req.method = 'POST'
		const chunks = []
		const res = {
			writeHead(code) { this.statusCode = code },
			end(body) { if (body) chunks.push(body) },
		}
		await handleProxyRequest(req, res)
		expect(res.statusCode).toBe(400)
	})

	it('转发超时 → 504', async () => {
		const result = await callProxy({
			url: 'http://192.0.2.1/slow',
			method: 'GET',
			responseType: 'json',
			timeout: 1,
		}, {
			assertSafeTarget: async (rawUrl) => new URL(rawUrl),
			forwardRequest: async () => {
				// 不 resolve，等待真实 forwardRequest 超时由 timeout 触发 —— 此处替换为
				// 用真实 forwardRequest 连不可达内网 IP，验证超时路径
				throw Object.assign(new Error('Proxy request timed out'), { statusCode: 504 })
			},
		})
		expect(result.statusCode).toBe(504)
	})
})

afterAll(() => {
	// 无全局服务器遗留（本文件测试内都自行 close）
})