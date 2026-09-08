/**
 * dev server 代理（dmcc-dev-server 契约 v1，technical-design §7）。
 *
 * 迁移自 fe/packages/server（express + axios 形态）到 Node http 原生：
 * - 上半部为 fe/packages/server/security.js 的纯函数源码级迁移（SSRF 防护、
 *   CORS 白名单、请求头净化），零外部依赖（node:dns / node:net）。
 * - handleProxyRequest 实现与 server /proxy 端点语义等价的转发：
 *   方法/响应类型校验、1–30s 超时、1MB/10MB 体积限制、assertSafeTarget
 *   SSRF 校验、maxRedirects=0（Node http 默认不跟随重定向，天然满足）、
 *   错误码 403（DIMINA_UNSAFE_TARGET）/400/500。
 */

import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

// ---------- 迁移自 fe/packages/server/security.js ----------

const blockedAddresses = new net.BlockList()

for (const [address, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4],
]) {
	blockedAddresses.addSubnet(address, prefix, 'ipv4')
}

for (const [address, prefix] of [
	['::', 128],
	['::1', 128],
	['64:ff9b:1::', 48],
	['100::', 64],
	['2001:db8::', 32],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8],
]) {
	blockedAddresses.addSubnet(address, prefix, 'ipv6')
}

const BLOCKED_REQUEST_HEADERS = new Set([
	'connection',
	'content-length',
	'forwarded',
	'host',
	'origin',
	'proxy-authenticate',
	'proxy-authorization',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'via',
])

function unsafeTargetError(message) {
	const error = new Error(message)
	error.code = 'DIMINA_UNSAFE_TARGET'
	return error
}

function normalizeHostname(hostname) {
	const withoutBrackets = hostname.startsWith('[') && hostname.endsWith(']')
		? hostname.slice(1, -1)
		: hostname
	return withoutBrackets.replace(/\.$/, '').toLowerCase()
}

export function isPublicAddress(address) {
	// Reject IPv4-mapped IPv6 literals instead of letting their alternate
	// representation bypass the IPv4 ranges above.
	if (address.toLowerCase().startsWith('::ffff:')) return false
	const family = net.isIP(address)
	if (family === 0) return false
	return !blockedAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

function assertPublicAddresses(addresses) {
	if (!Array.isArray(addresses) || addresses.length === 0) {
		throw unsafeTargetError('Target hostname did not resolve')
	}
	for (const entry of addresses) {
		if (!isPublicAddress(entry.address)) {
			throw unsafeTargetError('Requests to private or reserved networks are not allowed')
		}
	}
}

export async function assertSafeTarget(rawUrl, lookup = dns.promises.lookup) {
	if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
		throw unsafeTargetError('URL is required')
	}

	let target
	try {
		target = new URL(rawUrl)
	}
	catch {
		throw unsafeTargetError('Invalid URL')
	}

	if (!['http:', 'https:'].includes(target.protocol)) {
		throw unsafeTargetError('Only HTTP and HTTPS URLs are allowed')
	}
	if (target.username || target.password) {
		throw unsafeTargetError('Credentials in target URLs are not allowed')
	}

	const hostname = normalizeHostname(target.hostname)
	const family = net.isIP(hostname)
	const addresses = family
		? [{ address: hostname, family }]
		: await lookup(hostname, { all: true, verbatim: true })
	assertPublicAddresses(addresses)

	return target
}

export function createSafeLookup(lookup = dns.lookup) {
	return (hostname, options, callback) => {
		const normalizedOptions = typeof options === 'number'
			? { family: options }
			: { ...(options ?? {}) }
		lookup(hostname, { ...normalizedOptions, all: true, verbatim: true }, (error, addresses) => {
			if (error) {
				callback(error)
				return
			}
			try {
				assertPublicAddresses(addresses)
			}
			catch (validationError) {
				callback(validationError)
				return
			}

			if (normalizedOptions.all) {
				callback(null, addresses)
			}
			else {
				const [{ address, family }] = addresses
				callback(null, address, family)
			}
		})
	}
}

export function isAllowedBrowserOrigin(origin, configuredOrigins = '') {
	if (!origin) return true

	const explicitOrigins = new Set(String(configuredOrigins)
		.split(',')
		.map(value => value.trim())
		.filter(Boolean))
	if (explicitOrigins.has(origin)) return true

	try {
		const parsed = new URL(origin)
		const hostname = normalizeHostname(parsed.hostname)
		return ['http:', 'https:'].includes(parsed.protocol)
			&& ['localhost', '127.0.0.1', '::1'].includes(hostname)
	}
	catch {
		return false
	}
}

export function sanitizeRequestHeaders(headers) {
	if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {}

	return Object.fromEntries(Object.entries(headers).filter(([name]) => {
		const normalizedName = name.toLowerCase()
		return !BLOCKED_REQUEST_HEADERS.has(normalizedName) && !normalizedName.startsWith('proxy-')
	}))
}

// ---------- /proxy 端点（Node http 原生，语义对齐 fe/packages/server） ----------

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
const ALLOWED_RESPONSE_TYPES = new Set(['json', 'text', 'arraybuffer'])
const MAX_REQUEST_BODY_BYTES = 1024 * 1024
const MAX_RESPONSE_BODY_BYTES = 10 * 1024 * 1024

function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let body = ''
		let size = 0
		req.on('data', (chunk) => {
			size += chunk.length
			if (size > MAX_REQUEST_BODY_BYTES) {
				reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }))
				req.destroy()
				return
			}
			body += chunk
		})
		req.on('end', () => {
			try {
				resolve(body ? JSON.parse(body) : {})
			}
			catch {
				reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }))
			}
		})
		req.on('error', reject)
	})
}

function forwardRequest(target, { method, data, header, timeout }) {
	return new Promise((resolve, reject) => {
		const lib = target.protocol === 'https:' ? https : http
		const safeLookup = createSafeLookup()

		// axios `params` 等价：GET 的 data 对象序列化为 query string 拼进 URL
		let requestTarget = target
		if (method === 'GET' && data) {
			const url = new URL(target.href)
			for (const [key, value] of Object.entries(data)) {
				url.searchParams.set(key, String(value))
			}
			requestTarget = url
		}

		const request = lib.request(
			requestTarget,
			{
				method,
				timeout,
				headers: {
					'Content-Type': 'application/json',
					...sanitizeRequestHeaders(header),
				},
				agent: lib === https
					? new https.Agent({ lookup: safeLookup })
					: new http.Agent({ lookup: safeLookup }),
			},
			(response) => {
				const chunks = []
				let received = 0
				response.on('data', (chunk) => {
					received += chunk.length
					if (received > MAX_RESPONSE_BODY_BYTES) {
						request.destroy()
						reject(Object.assign(new Error('Response body too large'), { statusCode: 502 }))
						return
					}
					chunks.push(chunk)
				})
				response.on('end', () => {
					resolve({
						status: response.statusCode,
						headers: response.headers,
						body: Buffer.concat(chunks),
					})
				})
			},
		)
		request.on('timeout', () => {
			request.destroy(Object.assign(new Error('Proxy request timed out'), { statusCode: 504 }))
		})
		request.on('error', reject)
		if (method !== 'GET' && data !== undefined) {
			request.write(typeof data === 'string' ? data : JSON.stringify(data))
		}
		request.end()
	})
}

/**
 * 处理 POST /proxy 请求（express 语义等价的 Node http 版本）。
 * 支持依赖注入（断言/转发函数）——契约测试免真实公网目标；
 * 默认参数即生产实现，SSRF 保护由 assertSafeTarget 承担（纯函数独立测试锁定）。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ assertSafeTarget?: typeof assertSafeTarget, forwardRequest?: typeof forwardRequest }} [deps]
 */
export async function handleProxyRequest(req, res, deps = {}) {
	const {
		assertSafeTarget: resolveTarget = assertSafeTarget,
		forwardRequest: doForward = forwardRequest,
	} = deps
	try {
		const {
			url,
			data,
			header = {},
			timeout = 30000,
			method = 'GET',
			responseType = 'json',
		} = await readJsonBody(req)

		const normalizedMethod = String(method).toUpperCase()
		if (!ALLOWED_METHODS.has(normalizedMethod)) {
			res.writeHead(400, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Invalid HTTP method' }))
			return
		}
		if (!ALLOWED_RESPONSE_TYPES.has(responseType)) {
			res.writeHead(400, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Invalid response type' }))
			return
		}

		const target = await resolveTarget(url)
		const parsedTimeout = Number.parseInt(timeout, 10)
		const boundedTimeout = Number.isFinite(parsedTimeout)
			? Math.min(Math.max(parsedTimeout, 1), 30000)
			: 30000

		const response = await doForward(target, {
			method: normalizedMethod,
			data,
			header,
			timeout: boundedTimeout,
		})

		let contentType
		let body
		if (responseType === 'arraybuffer') {
			contentType = response.headers['content-type'] || 'application/octet-stream'
			body = response.body
		}
		else if (responseType === 'text') {
			contentType = response.headers['content-type'] || 'text/plain; charset=utf-8'
			body = response.body.toString('utf8')
		}
		else {
			contentType = 'application/json'
			body = JSON.stringify(parseResponseJson(response.body))
		}
		res.writeHead(response.status, { 'Content-Type': contentType })
		res.end(body)
	}
	catch (error) {
		const statusCode = error.statusCode
			|| (error.code === 'DIMINA_UNSAFE_TARGET' ? 403 : 500)
		res.writeHead(statusCode, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({
			error: error.message || 'Internal Server Error',
			status: statusCode,
			timestamp: new Date().toISOString(),
		}))
	}
}

function parseResponseJson(buffer) {
	try {
		return JSON.parse(buffer.toString('utf8'))
	}
	catch {
		return null
	}
}
