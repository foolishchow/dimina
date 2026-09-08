/**
 * dmcc dev HTTP/WebSocket server（契约 v1，technical-design §2/§6）。
 *
 * 职责边界：只管理最后成功发布目录的服务、sdk 静态资产、宿主页、ws
 * 广播与 pendingReload 关联；build/watch 编排由 src/bin/dev.js 负责。
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { createHostPageHtml } from './dev-host.js'
import { handleProxyRequest, isAllowedBrowserOrigin } from './dev-proxy.js'

const DEFAULT_WS_PATH = '/ws'
const MIME_TYPES = Object.freeze({
	'.css': 'text/css; charset=utf-8',
	'.gif': 'image/gif',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.webp': 'image/webp',
})

/**
 * 创建 dev server。服务启动前应完成初始 build 并获得 appId。
 * @param {{ serveRoot: string, sdkRoot: string, appId: string,
 *           wsPath?: string, hostHtml?: string, allowedOrigins?: string }} options
 * @returns {{ server: import('node:http').Server, wsServer: WebSocketServer,
 *   listen: (port?: number, host?: string) => Promise<{ port: number, host: string }>,
 *   close: () => Promise<void>, setPendingReload: (payload: object|null) => void,
 *   notifyBuildPublished: () => void, notifyBuildError: (message: string) => void,
 *   getPendingReload: () => object|null, getAcks: () => Array<object> }}
 *   dev server 控制句柄：server/wsServer 为底层实例，listen/close 负责生命周期，
 *   setPendingReload/notifyBuildPublished/notifyBuildError 驱动 reload 推送，
 *   getPendingReload/getAcks 供诊断与契约测试断言。
 */
export function createDevServer({
	serveRoot,
	sdkRoot,
	appId,
	wsPath = DEFAULT_WS_PATH,
	hostHtml = createHostPageHtml({ appId, wsPath }),
	allowedOrigins = '',
}) {
	if (!serveRoot || !sdkRoot || !appId) {
		throw new TypeError('createDevServer requires serveRoot, sdkRoot, and appId')
	}
	if (!wsPath.startsWith('/')) {
		throw new TypeError('createDevServer: wsPath must start with "/"')
	}

	let pendingReload = null
	const subscribedClients = new Set()
	const acknowledgements = []
	const server = http.createServer((request, response) => {
		void handleHttpRequest(request, response)
	})
	const wsServer = new WebSocketServer({ server, path: wsPath })

	wsServer.on('connection', (socket) => {
		socket.on('message', (raw) => {
			let message
			try {
				message = JSON.parse(raw.toString())
			}
			catch {
				sendJson(socket, { type: 'error', message: 'Invalid WebSocket JSON' })
				return
			}

			if (message.type === 'subscribe') {
				if (message.appId === appId) {
					subscribedClients.add(socket)
					sendJson(socket, { type: 'subscribed', appId })
				}
				else {
					sendJson(socket, { type: 'error', message: 'Unknown appId' })
				}
				return
			}

			if (message.type === 'ack') {
				acknowledgements.push({
					appId: message.appId ?? appId,
					buildId: message.buildId,
					timestamp: Date.now(),
				})
			}
		})
		socket.on('close', () => subscribedClients.delete(socket))
	})

	async function handleHttpRequest(request, response) {
		const origin = request.headers.origin
		if (!isAllowedBrowserOrigin(origin, allowedOrigins)) {
			writeJson(response, 403, { error: 'Browser origin is not allowed' })
			return
		}
		if (origin) {
			response.setHeader('Access-Control-Allow-Origin', origin)
			response.setHeader('Vary', 'Origin')
		}
		if (request.method === 'OPTIONS') {
			response.writeHead(204, {
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
			})
			response.end()
			return
		}

		const pathname = getPathname(request.url)
		if (pathname === '/proxy') {
			if (request.method !== 'POST') {
				writeJson(response, 405, { error: 'Method Not Allowed' })
				return
			}
			await handleProxyRequest(request, response)
			return
		}

		if (request.method !== 'GET' && request.method !== 'HEAD') {
			writeJson(response, 405, { error: 'Method Not Allowed' })
			return
		}

		let filePath
		try {
			if (pathname === '/' || pathname === '/index.html') {
				writeStatic(response, hostHtml, 'text/html; charset=utf-8', request.method === 'HEAD')
				return
			}
			if (pathname.startsWith('/sdk/')) {
				filePath = resolveContainedPath(sdkRoot, pathname.slice('/sdk/'.length))
			}
			else {
				filePath = resolveContainedPath(serveRoot, pathname.slice(1))
			}
		}
		catch {
			writeJson(response, 400, { error: 'Invalid path' })
			return
		}

		try {
			const stats = await fs.promises.stat(filePath)
			if (!stats.isFile()) throw new Error('Not a file')
			const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()]
				|| 'application/octet-stream'
			if (request.method === 'HEAD') {
				response.writeHead(200, { 'Cache-Control': 'no-cache', 'Content-Type': contentType })
				response.end()
				return
			}
			const content = await fs.promises.readFile(filePath)
			writeStatic(response, content, contentType, false)
		}
		catch {
			writeJson(response, 404, { error: 'Not Found' })
		}
	}

	function setPendingReload(payload) {
		pendingReload = payload ? { ...payload } : null
	}

	function notifyBuildPublished() {
		if (!pendingReload) return
		broadcast({ type: 'reload', ...pendingReload })
		pendingReload = null
	}

	function notifyBuildError(message) {
		pendingReload = null
		broadcast({ type: 'build:error', message: String(message) })
	}

	function broadcast(message) {
		const data = JSON.stringify(message)
		for (const socket of subscribedClients) {
			if (socket.readyState === WebSocket.OPEN) socket.send(data)
		}
	}

	function listen(port = 8080, host = '127.0.0.1') {
		return new Promise((resolve, reject) => {
			const onError = (error) => {
				server.off('listening', onListening)
				reject(error)
			}
			const onListening = () => {
				server.off('error', onError)
				resolve({ host, port: server.address().port })
			}
			server.once('error', onError)
			server.once('listening', onListening)
			server.listen(port, host)
		})
	}

	function close() {
		for (const socket of subscribedClients) socket.close()
		subscribedClients.clear()
		return new Promise((resolve, reject) => {
			wsServer.close((wsError) => {
				if (wsError) {
					reject(wsError)
					return
				}
				if (!server.listening) {
					resolve()
					return
				}
				server.close(error => error ? reject(error) : resolve())
			})
		})
	}

	return {
		server,
		wsServer,
		listen,
		close,
		setPendingReload,
		notifyBuildPublished,
		notifyBuildError,
		getPendingReload: () => pendingReload ? { ...pendingReload } : null,
		getAcks: () => acknowledgements.map(ack => ({ ...ack })),
	}
}

function getPathname(requestUrl = '/') {
	try {
		return decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname)
	}
	catch {
		throw new Error('Invalid URL')
	}
}

function resolveContainedPath(root, relativePath) {
	const absoluteRoot = path.resolve(root)
	const candidate = path.resolve(absoluteRoot, relativePath)
	const relative = path.relative(absoluteRoot, candidate)
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error('Path traversal')
	}
	return candidate
}

function writeStatic(response, body, contentType, headOnly) {
	response.writeHead(200, { 'Cache-Control': 'no-cache', 'Content-Type': contentType })
	if (!headOnly) response.write(body)
	response.end()
}

function writeJson(response, statusCode, body) {
	response.writeHead(statusCode, {
		'Cache-Control': 'no-cache',
		'Content-Type': 'application/json; charset=utf-8',
	})
	response.end(JSON.stringify(body))
}

function sendJson(socket, message) {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}
