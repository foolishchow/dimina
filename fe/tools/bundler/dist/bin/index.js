#!/usr/bin/env node
import build, { n as createLifecycle, t as LIFECYCLE_EVENTS } from "../index.js";
import { createBuildWatcher } from "../watch.js";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import { program } from "commander";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import dns from "node:dns";
import https from "node:https";
import net from "node:net";
var package_default = {
	name: "@dimina/bundler",
	version: "1.2.1",
	description: "Dimina 领域编译 + 预览 toolchain（非通用 JS bundler；由 improve 快照 compiler 旁路复制）",
	main: "./dist/index.js",
	module: "./dist/index.js",
	type: "module",
	files: ["dist"],
	exports: {
		".": "./dist/index.js",
		"./watch": "./dist/watch.js",
		"./view-compiler": "./dist/core/view-compiler.js",
		"./logic-compiler": "./dist/core/logic-compiler.js",
		"./style-compiler": "./dist/core/style-compiler.js"
	},
	bin: { "dimina-cli": "dist/bin/index.js" },
	scripts: {
		"prebuild": "node scripts/sync-compatibility-reference.js",
		"build": "vite build",
		"postbuild": "node scripts/copy-sdk-assets.js && node scripts/check-package-exports.js",
		"sync:compat": "node scripts/sync-compatibility-reference.js",
		"check:compat": "node scripts/sync-compatibility-reference.js --check",
		"pretest": "node scripts/sync-compatibility-reference.js --check",
		"test": "vitest run --no-file-parallelism",
		"test:dev": "vitest",
		"coverage": "vitest run --coverage",
		"prepack": "npm run build",
		"release:beta": "npm version prerelease --preid=beta && npm publish --tag beta",
		"release": "npm version patch && npm publish"
	},
	author: "doslin",
	license: "Apache-2.0",
	engines: { "node": ">=22.22.3" },
	keywords: [
		"dimina",
		"compiler",
		"miniapp",
		"小程序",
		"星河"
	],
	dependencies: {
		"@vue/compiler-sfc": "^3.5.42",
		"@vue/shared": "^3.5.42",
		"autoprefixer": "^10.5.5",
		"cheerio": "^1.2.0",
		"chokidar": "^4.0.3",
		"commander": "^14.0.3",
		"cssnano": "^9.0.3",
		"esbuild": "^0.28.2",
		"htmlparser2": "^12.0.0",
		"less": "^4.9.1",
		"listr2": "^11.1.0",
		"magic-string": "^1.2.3",
		"oxc-parser": "^0.148.0",
		"oxc-walker": "^1.1.1",
		"postcss": "^8.5.28",
		"postcss-selector-parser": "^7.1.6",
		"sass": "^1.104.0",
		"source-map-js": "^1.2.1",
		"ws": "^8.21.3"
	},
	publishConfig: {
		"registry": "https://registry.npmjs.org/",
		"access": "public"
	}
};
//#endregion
//#region src/common/dev-host.js
/**
* dev server 内置宿主页（dmcc-dev-server 契约 v1，technical-design §3）。
*
* 最小宿主：直开目标 app（可选 ?path= 参数），不含应用列表壳。
* 通过 container-sdk 公开 API（createContainer / openApp）接入，不耦合内部
* appManager；L1/L2/L3 的 relaunch/刷新回退经公开 openApp({ destroy: true })
* 实现（等价容器 relaunch 的 App 状态重建 + 页面重进）。
*/
var SDK_ASSET_PATHS = Object.freeze({
	indexJs: "/sdk/index.js",
	indexCss: "/sdk/index.css",
	pageFrameJs: "/sdk/pageFrame.js",
	pageFrameCss: "/sdk/pageFrame.css",
	serviceJs: "/sdk/service.js",
	/** container-sdk 将 mitt external；dmcc 宿主以 import map 提供浏览器可解析路径 */
	mittJs: "/sdk/mitt.js"
});
/**
* 生成内置宿主页 HTML。
* @param {{ appId: string, wsPath: string }} opts wsPath 形如 '/ws'（ws 由 dev server
*   在同端口提供，前端用 location.host 拼接 ws:// 地址）
* @returns {string} 完整 HTML 文档
*/
function createHostPageHtml({ appId, wsPath }) {
	if (typeof appId !== "string" || appId.length === 0) throw new TypeError("createHostPageHtml: appId must be a non-empty string");
	if (typeof wsPath !== "string" || !wsPath.startsWith("/")) throw new TypeError("createHostPageHtml: wsPath must be a path starting with \"/\"");
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<title>dmcc dev · ${escapeHtml(appId)}</title>
	<link rel="stylesheet" href="${SDK_ASSET_PATHS.indexCss}">
	<style>
		/* 宿主页自身 reset：SDK style.css 不含 html/body/#app 布局，缺省会留下 UA margin，
		   且 #app 高度为 0，绝对定位容器看起来像「样式没加载」。 */
		html, body, #app {
			margin: 0;
			padding: 0;
			width: 100%;
			height: 100%;
			overflow: hidden;
			background: #000;
		}
	</style>
	<script type="importmap">
	{
		"imports": {
			"mitt": "${SDK_ASSET_PATHS.mittJs}"
		}
	}
	<\/script>
</head>
<body>
	<div id="app"></div>
	<script type="module">
		import { createContainer, createDefaultShell } from '${SDK_ASSET_PATHS.indexJs}'

		const params = new URLSearchParams(window.location.search)
		const appId = params.get('appId') || ${JSON.stringify(appId)}
		const entryPath = params.get('path') || undefined
		const mount = document.getElementById('app')
		// 最小宿主也需要状态栏几何：不接 shell 时导航栏 padding 仍按刘海区预留，
		// 但矩形全 0、无状态栏节点，上沿会像缺样式的空白条。
		const shell = createDefaultShell({ mount })

		const container = createContainer({
			mount,
			shell,
			// dev server 把产物与 sdk 资产都挂在站点根路径下，资源引用（/main/... 等）
			// 相对根即可命中。
			resourceBaseUrl: '/',
			getAppInfo: () => ({ name: appId }),
		})

		let currentApp = null
		async function launch() {
			currentApp = await container.openApp({
				appId,
				path: entryPath,
				scene: 1001,
				destroy: true,
			})
		}

		function relaunchCurrentPage() {
			// A2 L1 fallback：App 状态重建 + 入口页重进。
			void launch()
		}

		function dispatchHmr(message) {
			const handleResult = (result) => {
				if (result.status === 'fallback') relaunchCurrentPage()
			}
			const delivered = container.sendDevCommand('enableDevHmr', {})
				&& container.sendDevCommand('hmr', {
					level: message.reloadLevel,
					changedStages: message.changedStages,
					affectedPages: message.affectedPages,
					buildId: message.buildId,
				}, handleResult)
			if (!delivered) relaunchCurrentPage()
		}

		function restartApp() {
			// L0 全量重启：整页重建（覆盖"通知容器重启 app"语义）。
			window.location.reload()
		}

		launch().catch((error) => {
			console.error('[dmcc-dev] openApp failed:', error)
		})

		// ws 变更推送：{ type:'reload', appId, changedStages, affectedPages, reloadLevel, buildId }
		const ws = new WebSocket(
			(location.protocol === 'https:' ? 'wss' : 'ws')
			+ '://' + location.host
			+ ${JSON.stringify(wsPath)},
		)
		ws.addEventListener('open', () => {
			ws.send(JSON.stringify({ type: 'subscribe', appId }))
		})
		ws.addEventListener('message', (event) => {
			let message
			try {
				message = JSON.parse(event.data)
			}
			catch {
				return
			}
			if (message.type === 'reload' && message.reloadLevel === 'L0') {
				restartApp()
			}
			else if (message.type === 'reload') {
				if (message.reloadLevel === 'L2' || message.reloadLevel === 'L3') {
					dispatchHmr(message)
				}
				else {
					// L1（A2 生效级别）保持原有 relaunch 路径。
					relaunchCurrentPage()
				}
			}
			else if (message.type === 'build:error') {
				console.error('[dmcc-dev] build failed:', message.message)
			}
		})
	<\/script>
</body>
</html>`;
}
/**
* 生成渲染层 iframe 文档（对齐 container 参考宿主的 pageFrame.html，指向随包 sdk 资产）。
* @returns {string}
*/
function createPageFrameHtml() {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
	<title>pageFrame</title>
	<link rel="stylesheet" href="${SDK_ASSET_PATHS.pageFrameCss}">
	<script type="importmap">
	{
		"imports": {
			"mitt": "${SDK_ASSET_PATHS.mittJs}"
		}
	}
	<\/script>
</head>
<body class="dd-page">
	<script type="module" src="${SDK_ASSET_PATHS.pageFrameJs}"><\/script>
</body>
</html>
`;
}
function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (char) => {
		switch (char) {
			case "&": return "&amp;";
			case "<": return "&lt;";
			case ">": return "&gt;";
			case "\"": return "&quot;";
			case "'": return "&#39;";
			default: return char;
		}
	});
}
//#endregion
//#region src/common/dev-proxy.js
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
var blockedAddresses = new net.BlockList();
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4]
]) blockedAddresses.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
	["::", 128],
	["::1", 128],
	["64:ff9b:1::", 48],
	["100::", 64],
	["2001:db8::", 32],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8]
]) blockedAddresses.addSubnet(address, prefix, "ipv6");
var BLOCKED_REQUEST_HEADERS = /* @__PURE__ */ new Set([
	"connection",
	"content-length",
	"forwarded",
	"host",
	"origin",
	"proxy-authenticate",
	"proxy-authorization",
	"referer",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"via"
]);
function unsafeTargetError(message) {
	const error = new Error(message);
	error.code = "DIMINA_UNSAFE_TARGET";
	return error;
}
function normalizeHostname(hostname) {
	return (hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname).replace(/\.$/, "").toLowerCase();
}
function isPublicAddress(address) {
	if (address.toLowerCase().startsWith("::ffff:")) return false;
	const family = net.isIP(address);
	if (family === 0) return false;
	return !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");
}
function assertPublicAddresses(addresses) {
	if (!Array.isArray(addresses) || addresses.length === 0) throw unsafeTargetError("Target hostname did not resolve");
	for (const entry of addresses) if (!isPublicAddress(entry.address)) throw unsafeTargetError("Requests to private or reserved networks are not allowed");
}
async function assertSafeTarget(rawUrl, lookup = dns.promises.lookup) {
	if (typeof rawUrl !== "string" || rawUrl.trim() === "") throw unsafeTargetError("URL is required");
	let target;
	try {
		target = new URL(rawUrl);
	} catch {
		throw unsafeTargetError("Invalid URL");
	}
	if (!["http:", "https:"].includes(target.protocol)) throw unsafeTargetError("Only HTTP and HTTPS URLs are allowed");
	if (target.username || target.password) throw unsafeTargetError("Credentials in target URLs are not allowed");
	const hostname = normalizeHostname(target.hostname);
	const family = net.isIP(hostname);
	assertPublicAddresses(family ? [{
		address: hostname,
		family
	}] : await lookup(hostname, {
		all: true,
		verbatim: true
	}));
	return target;
}
function createSafeLookup(lookup = dns.lookup) {
	return (hostname, options, callback) => {
		const normalizedOptions = typeof options === "number" ? { family: options } : { ...options ?? {} };
		lookup(hostname, {
			...normalizedOptions,
			all: true,
			verbatim: true
		}, (error, addresses) => {
			if (error) {
				callback(error);
				return;
			}
			try {
				assertPublicAddresses(addresses);
			} catch (validationError) {
				callback(validationError);
				return;
			}
			if (normalizedOptions.all) callback(null, addresses);
			else {
				const [{ address, family }] = addresses;
				callback(null, address, family);
			}
		});
	};
}
function isAllowedBrowserOrigin(origin, configuredOrigins = "") {
	if (!origin) return true;
	if (new Set(String(configuredOrigins).split(",").map((value) => value.trim()).filter(Boolean)).has(origin)) return true;
	try {
		const parsed = new URL(origin);
		const hostname = normalizeHostname(parsed.hostname);
		if (!["http:", "https:"].includes(parsed.protocol)) return false;
		if ([
			"localhost",
			"127.0.0.1",
			"::1"
		].includes(hostname)) return true;
		if (net.isIP(hostname) && !isPublicAddress(hostname)) return true;
		return false;
	} catch {
		return false;
	}
}
function sanitizeRequestHeaders(headers) {
	if (!headers || typeof headers !== "object" || Array.isArray(headers)) return {};
	return Object.fromEntries(Object.entries(headers).filter(([name]) => {
		const normalizedName = name.toLowerCase();
		return !BLOCKED_REQUEST_HEADERS.has(normalizedName) && !normalizedName.startsWith("proxy-");
	}));
}
var ALLOWED_METHODS = /* @__PURE__ */ new Set([
	"GET",
	"POST",
	"PUT",
	"DELETE",
	"PATCH"
]);
var ALLOWED_RESPONSE_TYPES = /* @__PURE__ */ new Set([
	"json",
	"text",
	"arraybuffer"
]);
var MAX_REQUEST_BODY_BYTES = 1048576;
var MAX_RESPONSE_BODY_BYTES = 10485760;
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_REQUEST_BODY_BYTES) {
				reject(Object.assign(/* @__PURE__ */ new Error("Request body too large"), { statusCode: 413 }));
				req.destroy();
				return;
			}
			body += chunk;
		});
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch {
				reject(Object.assign(/* @__PURE__ */ new Error("Invalid JSON body"), { statusCode: 400 }));
			}
		});
		req.on("error", reject);
	});
}
function forwardRequest(target, { method, data, header, timeout }) {
	return new Promise((resolve, reject) => {
		const lib = target.protocol === "https:" ? https : http;
		const safeLookup = createSafeLookup();
		let requestTarget = target;
		if (method === "GET" && data) {
			const url = new URL(target.href);
			for (const [key, value] of Object.entries(data)) url.searchParams.set(key, String(value));
			requestTarget = url;
		}
		const request = lib.request(requestTarget, {
			method,
			timeout,
			headers: {
				"Content-Type": "application/json",
				...sanitizeRequestHeaders(header)
			},
			agent: lib === https ? new https.Agent({ lookup: safeLookup }) : new http.Agent({ lookup: safeLookup })
		}, (response) => {
			const chunks = [];
			let received = 0;
			response.on("data", (chunk) => {
				received += chunk.length;
				if (received > MAX_RESPONSE_BODY_BYTES) {
					request.destroy();
					reject(Object.assign(/* @__PURE__ */ new Error("Response body too large"), { statusCode: 502 }));
					return;
				}
				chunks.push(chunk);
			});
			response.on("end", () => {
				resolve({
					status: response.statusCode,
					headers: response.headers,
					body: Buffer.concat(chunks)
				});
			});
		});
		request.on("timeout", () => {
			request.destroy(Object.assign(/* @__PURE__ */ new Error("Proxy request timed out"), { statusCode: 504 }));
		});
		request.on("error", reject);
		if (method !== "GET" && data !== void 0) request.write(typeof data === "string" ? data : JSON.stringify(data));
		request.end();
	});
}
/**
* 处理 POST /proxy 请求（express 语义等价的 Node http 版本）。
* 支持依赖注入（断言/转发函数）——契约测试免真实公网目标；
* 默认参数即生产实现，SSRF 保护由 assertSafeTarget 承担（纯函数独立测试锁定）。
* @param {import('node:http').IncomingMessage} req
* @param {import('node:http').ServerResponse} res
* @param {{ assertSafeTarget?: typeof assertSafeTarget, forwardRequest?: typeof forwardRequest }} [deps]
*/
async function handleProxyRequest(req, res, deps = {}) {
	const { assertSafeTarget: resolveTarget = assertSafeTarget, forwardRequest: doForward = forwardRequest } = deps;
	try {
		const { url, data, header = {}, timeout = 3e4, method = "GET", responseType = "json" } = await readJsonBody(req);
		const normalizedMethod = String(method).toUpperCase();
		if (!ALLOWED_METHODS.has(normalizedMethod)) {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Invalid HTTP method" }));
			return;
		}
		if (!ALLOWED_RESPONSE_TYPES.has(responseType)) {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Invalid response type" }));
			return;
		}
		const target = await resolveTarget(url);
		const parsedTimeout = Number.parseInt(timeout, 10);
		const response = await doForward(target, {
			method: normalizedMethod,
			data,
			header,
			timeout: Number.isFinite(parsedTimeout) ? Math.min(Math.max(parsedTimeout, 1), 3e4) : 3e4
		});
		let contentType;
		let body;
		if (responseType === "arraybuffer") {
			contentType = response.headers["content-type"] || "application/octet-stream";
			body = response.body;
		} else if (responseType === "text") {
			contentType = response.headers["content-type"] || "text/plain; charset=utf-8";
			body = response.body.toString("utf8");
		} else {
			contentType = "application/json";
			body = JSON.stringify(parseResponseJson(response.body));
		}
		res.writeHead(response.status, { "Content-Type": contentType });
		res.end(body);
	} catch (error) {
		const statusCode = error.statusCode || (error.code === "DIMINA_UNSAFE_TARGET" ? 403 : 500);
		res.writeHead(statusCode, { "Content-Type": "application/json" });
		res.end(JSON.stringify({
			error: error.message || "Internal Server Error",
			status: statusCode,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}));
	}
}
function parseResponseJson(buffer) {
	try {
		return JSON.parse(buffer.toString("utf8"));
	} catch {
		return null;
	}
}
//#endregion
//#region src/common/dev-server.js
/**
* dmcc dev HTTP/WebSocket server（契约 v1，technical-design §2/§6）。
*
* 职责边界：只管理最后成功发布目录的服务、sdk 静态资产、宿主页、ws
* 广播与 pendingReload 关联；build/watch 编排由 src/bin/dev.js 负责。
*/
var DEFAULT_WS_PATH = "/ws";
var MIME_TYPES = Object.freeze({
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".webp": "image/webp"
});
/**
* 创建 dev server。服务启动前应完成初始 build 并获得 appId。
* @param {{ serveRoot: string, sdkRoot: string, appId: string,
*           wsPath?: string, hostHtml?: string, pageFrameHtml?: string, allowedOrigins?: string }} options
* @returns {{ server: import('node:http').Server, wsServer: WebSocketServer,
*   listen: (port?: number, host?: string) => Promise<{ port: number, host: string }>,
*   close: () => Promise<void>, setPendingReload: (payload: object|null) => void,
*   notifyBuildPublished: () => void, notifyBuildError: (message: string) => void,
*   getPendingReload: () => object|null, getAcks: () => Array<object> }}
*   dev server 控制句柄：server/wsServer 为底层实例，listen/close 负责生命周期，
*   setPendingReload/notifyBuildPublished/notifyBuildError 驱动 reload 推送，
*   getPendingReload/getAcks 供诊断与契约测试断言。
*/
function createDevServer({ serveRoot, sdkRoot, appId, wsPath = DEFAULT_WS_PATH, hostHtml = createHostPageHtml({
	appId,
	wsPath
}), pageFrameHtml = createPageFrameHtml(), allowedOrigins = "" }) {
	if (!serveRoot || !sdkRoot || !appId) throw new TypeError("createDevServer requires serveRoot, sdkRoot, and appId");
	if (!wsPath.startsWith("/")) throw new TypeError("createDevServer: wsPath must start with \"/\"");
	let pendingReload = null;
	const subscribedClients = /* @__PURE__ */ new Set();
	const acknowledgements = [];
	const server = http.createServer((request, response) => {
		handleHttpRequest(request, response);
	});
	const wsServer = new WebSocketServer({
		server,
		path: wsPath
	});
	wsServer.on("connection", (socket) => {
		socket.on("message", (raw) => {
			let message;
			try {
				message = JSON.parse(raw.toString());
			} catch {
				sendJson(socket, {
					type: "error",
					message: "Invalid WebSocket JSON"
				});
				return;
			}
			if (message.type === "subscribe") {
				if (message.appId === appId) {
					subscribedClients.add(socket);
					sendJson(socket, {
						type: "subscribed",
						appId
					});
				} else sendJson(socket, {
					type: "error",
					message: "Unknown appId"
				});
				return;
			}
			if (message.type === "ack") acknowledgements.push({
				appId: message.appId ?? appId,
				buildId: message.buildId,
				timestamp: Date.now()
			});
		});
		socket.on("close", () => subscribedClients.delete(socket));
	});
	async function handleHttpRequest(request, response) {
		const origin = request.headers.origin;
		if (!isAllowedBrowserOrigin(origin, allowedOrigins)) {
			writeJson(response, 403, { error: "Browser origin is not allowed" });
			return;
		}
		if (origin) {
			response.setHeader("Access-Control-Allow-Origin", origin);
			response.setHeader("Vary", "Origin");
		}
		if (request.method === "OPTIONS") {
			response.writeHead(204, {
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS"
			});
			response.end();
			return;
		}
		const pathname = getPathname(request.url);
		if (pathname === "/proxy") {
			if (request.method !== "POST") {
				writeJson(response, 405, { error: "Method Not Allowed" });
				return;
			}
			await handleProxyRequest(request, response);
			return;
		}
		if (request.method !== "GET" && request.method !== "HEAD") {
			writeJson(response, 405, { error: "Method Not Allowed" });
			return;
		}
		let filePath;
		try {
			if (pathname === "/" || pathname === "/index.html") {
				writeStatic(response, hostHtml, "text/html; charset=utf-8", request.method === "HEAD");
				return;
			}
			if (pathname === "/pageFrame.html") {
				writeStatic(response, pageFrameHtml, "text/html; charset=utf-8", request.method === "HEAD");
				return;
			}
			if (pathname.startsWith("/sdk/")) filePath = resolveContainedPath(sdkRoot, pathname.slice(5));
			else filePath = resolveContainedPath(serveRoot, pathname.slice(1));
		} catch {
			writeJson(response, 400, { error: "Invalid path" });
			return;
		}
		try {
			if (!(await fs.promises.stat(filePath)).isFile()) throw new Error("Not a file");
			const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
			if (request.method === "HEAD") {
				response.writeHead(200, {
					"Cache-Control": "no-cache",
					"Content-Type": contentType
				});
				response.end();
				return;
			}
			writeStatic(response, await fs.promises.readFile(filePath), contentType, false);
		} catch {
			writeJson(response, 404, { error: "Not Found" });
		}
	}
	function setPendingReload(payload) {
		pendingReload = payload ? { ...payload } : null;
	}
	function notifyBuildPublished() {
		if (!pendingReload) return;
		broadcast({
			type: "reload",
			...pendingReload
		});
		pendingReload = null;
	}
	function notifyBuildError(message) {
		pendingReload = null;
		broadcast({
			type: "build:error",
			message: String(message)
		});
	}
	function broadcast(message) {
		const data = JSON.stringify(message);
		for (const socket of subscribedClients) if (socket.readyState === WebSocket.OPEN) socket.send(data);
	}
	function listen(port = 8080, host = "127.0.0.1") {
		return new Promise((resolve, reject) => {
			const onError = (error) => {
				server.off("listening", onListening);
				reject(error);
			};
			const onListening = () => {
				server.off("error", onError);
				resolve({
					host,
					port: server.address().port
				});
			};
			server.once("error", onError);
			server.once("listening", onListening);
			server.listen(port, host);
		});
	}
	function close() {
		for (const socket of subscribedClients) socket.close();
		subscribedClients.clear();
		return new Promise((resolve, reject) => {
			wsServer.close((wsError) => {
				if (wsError) {
					reject(wsError);
					return;
				}
				if (!server.listening) {
					resolve();
					return;
				}
				server.close((error) => error ? reject(error) : resolve());
			});
		});
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
		getAcks: () => acknowledgements.map((ack) => ({ ...ack }))
	};
}
function getPathname(requestUrl = "/") {
	try {
		return decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
	} catch {
		throw new Error("Invalid URL");
	}
}
function resolveContainedPath(root, relativePath) {
	const absoluteRoot = path.resolve(root);
	const candidate = path.resolve(absoluteRoot, relativePath);
	const relative = path.relative(absoluteRoot, candidate);
	if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Path traversal");
	return candidate;
}
function writeStatic(response, body, contentType, headOnly) {
	response.writeHead(200, {
		"Cache-Control": "no-cache",
		"Content-Type": contentType
	});
	if (!headOnly) response.write(body);
	response.end();
}
function writeJson(response, statusCode, body) {
	response.writeHead(statusCode, {
		"Cache-Control": "no-cache",
		"Content-Type": "application/json; charset=utf-8"
	});
	response.end(JSON.stringify(body));
}
function sendJson(socket, message) {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
//#endregion
//#region src/common/dev-reload.js
/**
* dev server 的 reloadLevel 合成（dmcc-dev-server 契约 v1，technical-design §4）。
*
* 纯函数：输入 watch 计划结果 + 变更上下文，输出 ws 推送载荷（不含 type，推送端包装）。
*
* 实参来源（评审 F-001 定案）：
* - plan = createWatchBuildPlan 返回值（{ skip, incremental, options }）；
*   本函数不触碰 src/common/watch-plan.js —— stages 取 plan.options.stages、
*   受影响页面取 plan.options.affectedEntries，对外载荷字段名统一为 affectedPages。
* - event / filePath / count = createWatchRebuildScheduler 的 change 对象字段。
* - appId / buildId 由 dev 侧持有（初始 build 结果的 appId；每次重建自增的 buildId）。
*
* 合成规则（对齐 RFC §4.2，最破坏性优先）：
*   plan.skip              -> null（不推送）
*   incremental=false      -> L0（非增量全量：合并/配置/未知类型/新增删除，保守重启）
*   stages 含 'logic'      -> L1（本门生效级别：页面 relaunch）
*   stages 含 'view'       -> L3（上报级别；宿主按刷新回退，A3 升级执行端）
*   仅 'style'             -> L2（同 L3 语义）
*   防御：affectedPages 为空但 stages 非空 -> L1
*/
var RELOAD_LEVELS = Object.freeze({
	L0: "L0",
	L1: "L1",
	L2: "L2",
	L3: "L3"
});
/**
* @param {{ event: string, filePath: string, count: number,
*           plan: { skip: boolean, incremental: boolean, options: object },
*           appId: string, buildId: number }} input
* @returns {({ appId: string, reloadLevel: string, changedStages: string[],
*             affectedPages: string[], buildId: number } | null)} 合成后的 ws 推送载荷；
*   plan.skip 时为 null（不推送）。
*/
function synthesizeReloadLevel(input) {
	const { plan, appId, buildId } = input;
	if (!plan || plan.skip) return null;
	if (!plan.incremental) return {
		appId,
		reloadLevel: RELOAD_LEVELS.L0,
		changedStages: [],
		affectedPages: [],
		buildId
	};
	const stages = plan.options?.stages ?? [];
	const affectedPages = [...plan.options?.affectedEntries ?? []];
	if (affectedPages.length === 0) return {
		appId,
		reloadLevel: RELOAD_LEVELS.L1,
		changedStages: stages,
		affectedPages,
		buildId
	};
	let reloadLevel;
	const logic = stages.includes("logic");
	const view = stages.includes("view");
	const style = stages.includes("style");
	if (logic) reloadLevel = RELOAD_LEVELS.L1;
	else if (view) reloadLevel = RELOAD_LEVELS.L3;
	else if (style) reloadLevel = RELOAD_LEVELS.L2;
	else reloadLevel = RELOAD_LEVELS.L1;
	return {
		appId,
		reloadLevel,
		changedStages: stages,
		affectedPages,
		buildId
	};
}
//#endregion
//#region src/bin/dev.js
var DEFAULT_PORT = 8080;
var EVENT_LABELS$1 = {
	add: "新增",
	change: "改动",
	unlink: "删除"
};
/**
* 注册 `dmcc dev` 子命令（挂载到 program）。
* 编排：createBuildWatcher(autoListen:false) 初始 build → devServer → attach lifecycle →
* listen server → watcher.listen()（D1a）。
*/
function registerDevCommand(program) {
	program.command("dev").description("启动 dev server：编译 + 静态服务 + 内置宿主页 + ws 热更新 + 代理").option("-c, --work-path <path>", "小程序工程根（app.json 所在目录），缺省为当前目录").option("-s, --target-path <path>", "产物快照目录（仅暴露最后一次成功发布），缺省使用系统临时目录").option("-p, --port <number>", `端口（缺省 ${DEFAULT_PORT}）`).option("--host <addr>", "监听地址（缺省 127.0.0.1；局域网访问用 0.0.0.0）").option("--no-app-id-dir", "产物根目录不包含appId").option("--sourcemap", "生成 sourcemap 文件用于调试").option("--minify", "压缩产物（覆盖 mode=dev 缺省；可用 --no-minify 关闭）").action(async (options) => {
		const workPath = options.workPath ? path.resolve(options.workPath) : process.cwd();
		const targetPath = options.targetPath ? path.resolve(options.targetPath) : fs.mkdtempSync(path.join(os.tmpdir(), "dmcc-dev-"));
		const useAppIdDir = options.appIdDir !== false;
		const sourcemap = !!options.sourcemap;
		const minify = typeof options.minify === "boolean" ? options.minify : void 0;
		const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT;
		const host = typeof options.host === "string" && options.host ? options.host : "127.0.0.1";
		const lifecycle = createLifecycle();
		let buildIdCounter = 0;
		/** @type {ReturnType<typeof createDevServer> | undefined} */
		let devServer;
		const watcher = createBuildWatcher({
			targetPath,
			workPath,
			useAppIdDir,
			autoListen: false,
			options: {
				mode: "dev",
				platform: "web",
				sourcemap,
				lifecycle,
				...minify === void 0 ? {} : { minify }
			},
			beforeBuild: ({ event, filePath, count, plan, appId }) => {
				const payload = synthesizeReloadLevel({
					event,
					filePath,
					count,
					plan,
					appId,
					buildId: ++buildIdCounter
				});
				devServer.setPendingReload(payload);
			},
			onRebuild: ({ event, filePath, count }) => {
				const merged = count > 1 ? `（合并 ${count} 个文件事件）` : "";
				console.log(`${filePath} ${EVENT_LABELS$1[event]}，重新编译${merged}`);
			},
			onError: (error) => {
				console.error(`${workPath} 编译出错: ${error.message}`);
			}
		});
		let buildResult;
		try {
			buildResult = await watcher.start();
		} catch (error) {
			throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error });
		}
		devServer = createDevServer({
			serveRoot: targetPath,
			sdkRoot: resolveSdkRoot(),
			appId: buildResult.appId,
			wsPath: "/ws"
		});
		lifecycle.on(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, () => {
			devServer.notifyBuildPublished();
		});
		lifecycle.on(LIFECYCLE_EVENTS.BUILD_ERROR, (payload) => {
			devServer.notifyBuildError(payload.error?.message || "build failed");
		});
		const { port: actualPort, host: boundHost } = await devServer.listen(port, host);
		console.log(`[dmcc-dev] preview at http://${boundHost === "0.0.0.0" ? "127.0.0.1" : boundHost}:${actualPort}?appId=${buildResult.appId}`);
		if (boundHost === "0.0.0.0") console.log(`[dmcc-dev] listening on 0.0.0.0:${actualPort} (LAN: http://<your-lan-ip>:${actualPort}?appId=${buildResult.appId})`);
		console.log(`[dmcc-dev] watching ${workPath}`);
		await watcher.listen();
	});
	return program;
}
/**
* 定位 container-sdk 预构建资产（A2.0 随包分发）。
* 发布形态：compiler/dist/sdk（copy-sdk-assets 复制产物，P-002.5）；
* 源码形态：显式 TARGET_SDK_DIR 可用。
*/
function resolveSdkRoot() {
	if (process.env.DIMINA_DEV_SDK_DIR) return path.resolve(process.env.DIMINA_DEV_SDK_DIR);
	return path.resolve(path.dirname(new URL("../../package.json", import.meta.url).pathname), "dist", "sdk");
}
//#endregion
//#region src/bin/index.js
var EVENT_LABELS = {
	add: "新增",
	change: "改动",
	unlink: "删除"
};
program.command("build").option("-c, --work-path <path>", "编译工作目录").option("-s, --target-path <path>", "编译产物存放路径").option("-w, --watch", "启用监听文件改动").option("--no-app-id-dir", "产物根目录不包含appId").option("--sourcemap", "生成 sourcemap 文件用于调试").option("--minify", "压缩产物（覆盖 mode 缺省；可用 --no-minify 关闭）").option("--platform <name>", "运行时宿主平台：native | web（缺省 native）").action(async (options) => {
	const workPath = options.workPath ? path.resolve(options.workPath) : process.cwd();
	const targetPath = options.targetPath ? path.resolve(options.targetPath) : process.cwd();
	const useAppIdDir = options.appIdDir !== false;
	const sourcemap = !!options.sourcemap;
	const minify = typeof options.minify === "boolean" ? options.minify : void 0;
	const platform = typeof options.platform === "string" ? options.platform : void 0;
	const buildOptions = {
		mode: "build",
		sourcemap,
		...minify === void 0 ? {} : { minify },
		...platform === void 0 ? {} : { platform }
	};
	if (!options.watch) {
		try {
			await build(targetPath, workPath, useAppIdDir, buildOptions);
		} catch (error) {
			throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error });
		}
		return;
	}
	const watcher = createBuildWatcher({
		targetPath,
		workPath,
		useAppIdDir,
		options: buildOptions,
		onRebuild: ({ event, filePath, count }) => {
			const merged = count > 1 ? `（合并 ${count} 个文件事件）` : "";
			console.log(`${filePath} ${EVENT_LABELS[event]}，重新编译${merged}`);
		},
		onError: (error) => {
			console.error(`${workPath} 编译出错: ${error.message}`);
		}
	});
	try {
		await watcher.start();
	} catch (error) {
		throw new Error(`${workPath} 编译出错: ${error.message}`, { cause: error });
	}
});
registerDevCommand(program);
program.name("dimina-cli").version(package_default.version);
program.parseAsync(process.argv).catch((error) => {
	console.error(error.stack || error.message);
	process.exitCode = 1;
});
//#endregion
export {};
