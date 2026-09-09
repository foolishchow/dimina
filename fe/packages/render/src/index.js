import './polyfills'
import { callback } from '@dimina/common'
import env from './core/env'
import { createHmrState, enableDevHmr, handleHmrCommand } from './core/hmr'
import { applyStyleReloadBatch, styleRegistry } from './core/hmr-style'
import loader from './core/loader'
import message from './core/message'
import runtime from './core/runtime'

/**
 * 渲染层消息通道
 */
class Render {
	constructor() {
		console.log('[system]', '[render]', 'init')
		this.env = env
		this.message = message
		window.__message = message
		window.__callback = callback

		this.init()
		this.initHmr()
	}

	initHmr() {
		// dev-only HMR（A3）：运行时 flag 由宿主页 ws 就绪后经 bridge 注入；
		// 原生/生产路径无该消息类型，天然隔离（F-A1 定案）。
		this.hmrState = createHmrState()
		this.message.on('enableDevHmr', (body) => {
			enableDevHmr(this.hmrState, body)
		})
		this.message.on('hmr', (body) => {
			const result = handleHmrCommand(this.hmrState, body)
			if (!result.accepted) {
				this.message.invoke({ type: 'hmr:result', target: 'container', body: {
					buildId: body?.buildId,
					level: body?.level,
					status: 'fallback',
					reason: result.reason,
				} })
				return
			}
			if (result.payload.level === 'L2') {
				void applyStyleReloadBatch(styleRegistry, result.payload).then((items) => {
					const failed = items.find(item => !item.applied)
					this.message.invoke({ type: 'hmr:result', target: 'container', body: {
						buildId: result.payload.buildId,
						level: result.payload.level,
						status: failed ? 'fallback' : 'applied',
						reason: failed?.reason,
					} })
				})
			}
			else {
				void runtime.handleHmr?.(result.payload).then((outcome) => {
					this.message.invoke({ type: 'hmr:result', target: 'container', body: {
						buildId: result.payload.buildId,
						level: result.payload.level,
						status: outcome?.status || 'fallback',
						reason: outcome?.reason,
					} })
				})
			}
		})
	}

	init() {
		// 资源加载消息
		this.message.on('loadResource', (msg) => {
			const { bridgeId, appId, pagePath, root = '.', baseUrl = '/', resourceLoadId, runtimeType } = msg
			runtime.registerResourceLoad(bridgeId, resourceLoadId)
			loader.loadResource({ bridgeId, appId, pagePath, root, baseUrl, resourceLoadId, runtimeType })
		})

		// 数据初始化消息
		this.message.on('firstRender', (msg) => {
			const { bridgeId, pageId, pagePath, initialProps, query } = msg

			loader.setInitialData(initialProps)
			runtime.firstRender({
				pagePath,
				pageId,
				bridgeId,
				query,
			})
		})

		this.message.on('u', (msg) => {
			queueMicrotask(() => {
				runtime.updateModule(msg)
			})
		})

		this.message.on('ub', (msg) => {
			queueMicrotask(() => {
				runtime.updateModules(msg)
			})
		})

		this.message.on('invokeAPI', (msg) => {
			runtime[msg.name](msg)
		})

		this.message.on('triggerCallback', (msg) => {
			const { success, data } = msg
			success && callback.invoke(success, data)
		})

		if (__DEV__) {
			// 可接收端容器或引擎日志
			this.message.on('print', (msg) => {
				const { type, detail } = msg
				// eslint-disable-next-line no-console
				const logMethod = console[type] || console.log

				// Handle when detail is an object or a string representation of an object
				let parsedDetail = detail

				// Try to parse detail if it's a string that might be a JSON object
				if (typeof detail === 'string') {
					try {
						// Check if the string looks like an object (starts with '{')
						if (detail.trim().startsWith('{')) {
							parsedDetail = JSON.parse(detail)
						}
					}
					catch {
						// If parsing fails, keep the original string
						parsedDetail = detail
					}
				}

				if (typeof parsedDetail === 'object' && parsedDetail !== null) {
					const { group, value } = parsedDetail
					if (group === 'network' && window.vConsole) {
						window.vConsole.network.add(value)
					}
					else {
						logMethod('[system]', parsedDetail)
					}
				}
				else if (typeof detail === 'string' && detail.startsWith('[service]')) {
					logMethod('[system]', detail)
				}
				else {
					logMethod(detail)
				}
			})
		}
	}
}

export default new Render()
