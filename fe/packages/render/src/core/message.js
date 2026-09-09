import { isAndroid, isIOS } from '@dimina/common'
import mitt from 'mitt'
import { decodeDataFunctions } from './data-function'

class Message {
	constructor() {
		this.event = mitt()
		this.pendingWaitData = new Map()
		this.pendingWaiters = new Map()
		this.init()
	}

	init() {
		if (!window.DiminaRenderBridge) {
			window.DiminaRenderBridge = {}
		}
		// window.DiminaRenderBridge 是容器提供，容器调用此方法给视图层发消息
		window.DiminaRenderBridge.onMessage = (msg) => {
			const decodedMsg = decodeDataFunctions(msg)
			console.log('[system]', '[render]', 'receive msg: ', decodedMsg)
			const { type, body } = decodedMsg
			const waiters = this.pendingWaiters.get(type)
			if (waiters?.length) {
				this.pendingWaiters.delete(type)
				for (const resolve of waiters) resolve(body?.data)
			}
			else {
				this.event.emit(type, body)
			}
		}
	}

	// 向渲染层注册消息监听
	on(type, callback) {
		this.event.on(type, callback)
	}

	// 渲染层经过容器层中转向逻辑层发送消息
	send(msg) {
		window.DiminaRenderBridge.publish(JSON.stringify(msg))
	}

	// 渲染层向容器层发送消息
	invoke(msg) {
		// android/ios 只能接收基础类型，需要转换成字符串
		if (isAndroid || isIOS) {
			Message.prototype.invoke = function (msg) {
				window.DiminaRenderBridge.invoke(JSON.stringify(msg))
			}
		}
		else {
			Message.prototype.invoke = function (msg) {
				window.DiminaRenderBridge.invoke(msg)
			}
		}
		return this.invoke(msg)
	}

	off(type, callback) {
		this.event.off(type, callback)
	}

	wait(eventName) {
		if (this.pendingWaitData.has(eventName)) {
			const data = this.pendingWaitData.get(eventName)
			this.pendingWaitData.delete(eventName)
			return Promise.resolve(data)
		}
		return new Promise((resolve) => {
			const waiters = this.pendingWaiters.get(eventName) || []
			waiters.push(resolve)
			this.pendingWaiters.set(eventName, waiters)
		})
	}

	/**
	 * render 内部 P-005：向等待某 page/module initial data 的 setup 注入快照。
	 * 若 setup 尚未注册 wait，暂存一次，避免 remount 时序丢失。
	 */
	resolveWait(eventName, data) {
		const waiters = this.pendingWaiters.get(eventName)
		if (waiters?.length) {
			this.pendingWaiters.delete(eventName)
			for (const resolve of waiters) resolve(data)
			return
		}
		this.pendingWaitData.set(eventName, data)
	}

	waitAndSend(eventName, msg) {
		const response = this.wait(eventName)
		this.send(msg)
		return response
	}
}

export default new Message()
