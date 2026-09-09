import { describe, expect, it, vi } from 'vitest'
import { Bridge } from '../src/core/bridge.js'

// A3 契约 technical-design §1：宿主 -> container.sendDevCommand -> bridge -> render。
// 本文件锁定 Bridge 层 dev-only 转发语义；不依赖真实 iframe/worker。

function createBridgeForTest() {
	const bridge = new Bridge({
		appId: 'dev-command-spec-app',
		pagePath: 'pages/index/index',
		isRoot: true,
		configInfo: {} as never,
		jscore: {} as never,
	})
	const postMessage = vi.fn()
	bridge.webview = { postMessage } as never
	return { bridge, postMessage }
}

describe('Bridge.sendDevCommand（dev-only HMR 通道）', () => {
	it('经 webview 以 target:render 转发指令体', () => {
		const { bridge, postMessage } = createBridgeForTest()
		const body = { level: 'L2', buildId: 3, affectedPages: [], changedStages: ['style'] }
		const delivered = bridge.sendDevCommand('hmr', body)

		expect(delivered).toBe(true)
		expect(postMessage).toHaveBeenCalledTimes(1)
		expect(postMessage).toHaveBeenCalledWith({
			type: 'hmr',
			body,
			target: 'render',
		})
	})

	it('指令体缺省为空对象', () => {
		const { bridge, postMessage } = createBridgeForTest()
		bridge.sendDevCommand('enableDevHmr')
		expect(postMessage).toHaveBeenCalledWith({
			type: 'enableDevHmr',
			body: {},
			target: 'render',
		})
	})

	it('无 webview 时返回 false 且不抛错', () => {
		const bridge = new Bridge({
		appId: 'dev-command-spec-app',
		pagePath: 'pages/index/index',
		isRoot: true,
		configInfo: {} as never,
		jscore: {} as never,
	})
		expect(bridge.sendDevCommand('hmr', {})).toBe(false)
	})

	it('bridge 已销毁时返回 false', () => {
		const { bridge, postMessage } = createBridgeForTest()
		bridge.destroyed = true
		expect(bridge.sendDevCommand('hmr', {})).toBe(false)
		expect(postMessage).not.toHaveBeenCalled()
	})
})
