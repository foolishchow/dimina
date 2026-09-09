/**
 * dev server 内置宿主页（dmcc-dev-server 契约 v1，technical-design §3）。
 *
 * 最小宿主：直开目标 app（可选 ?path= 参数），不含应用列表壳。
 * 通过 container-sdk 公开 API（createContainer / openApp）接入，不耦合内部
 * appManager；L1/L2/L3 的 relaunch/刷新回退经公开 openApp({ destroy: true })
 * 实现（等价容器 relaunch 的 App 状态重建 + 页面重进）。
 */

// sdk 预构建资产的路由路径（与 dev-server.js 的路由常量保持一致）
export const SDK_ASSET_PATHS = Object.freeze({
	indexJs: '/sdk/index.js',
	indexCss: '/sdk/index.css',
	pageFrameJs: '/sdk/pageFrame.js',
	pageFrameCss: '/sdk/pageFrame.css',
	serviceJs: '/sdk/service.js',
})

/**
 * 生成内置宿主页 HTML。
 * @param {{ appId: string, wsPath: string }} opts wsPath 形如 '/ws'（ws 由 dev server
 *   在同端口提供，前端用 location.host 拼接 ws:// 地址）
 * @returns {string} 完整 HTML 文档
 */
export function createHostPageHtml({ appId, wsPath }) {
	if (typeof appId !== 'string' || appId.length === 0) {
		throw new TypeError('createHostPageHtml: appId must be a non-empty string')
	}
	if (typeof wsPath !== 'string' || !wsPath.startsWith('/')) {
		throw new TypeError('createHostPageHtml: wsPath must be a path starting with "/"')
	}

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<title>dmcc dev · ${escapeHtml(appId)}</title>
	<link rel="stylesheet" href="${SDK_ASSET_PATHS.indexCss}">
</head>
<body>
	<div id="app"></div>
	<script type="module">
		import { createContainer } from '${SDK_ASSET_PATHS.indexJs}'

		const params = new URLSearchParams(window.location.search)
		const appId = params.get('appId') || ${JSON.stringify(appId)}
		const entryPath = params.get('path') || undefined

		const container = createContainer({
			mount: document.getElementById('app'),
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
	</script>
</body>
</html>`
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (char) => {
		switch (char) {
			case '&': return '&amp;'
			case '<': return '&lt;'
			case '>': return '&gt;'
			case '"': return '&quot;'
			case "'": return '&#39;'
			default: return char
		}
	})
}