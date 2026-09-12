/**
 * 构建生命周期事件与注册表（compiler-hook-layer 契约 v1）。
 *
 * 契约要点（docs/actions/compiler-hook-layer/technical-design.md）：
 * - 每次 build() 创建独立实例，与 AsyncLocalStorage 并发构建上下文隔离；
 * - 监听器按注册顺序依次 await，阶段边界触发，不影响阶段并发；
 * - 监听器错误隔离：捕获后记入 isolatedListenerErrors 并打印统一前缀日志，
 *   不中断事件流与构建；
 * - 载荷在触发前浅冻结（Object.freeze），深层数据按约定只读；
 *   监听器改动载荷不产生构建影响；
 * - emit 永不 reject。
 */

export const LIFECYCLE_EVENTS = Object.freeze({
	BUILD_START: 'build:start',
	CONFIG_COLLECTED: 'config:collected',
	DIST_PREPARED: 'dist:prepared',
	CONFIG_COMPILED: 'config:compiled',
	NPM_BUILT: 'npm:built',
	STAGE_BEFORE: 'stage:before',
	STAGE_AFTER: 'stage:after',
	STAGE_ERROR: 'stage:error',
	BUNDLE_PUBLISHED: 'bundle:published',
	BUILD_WARNING: 'build:warning',
	BUILD_END: 'build:end',
	BUILD_ERROR: 'build:error',
})

function logIsolatedListenerError(event, error) {
	// 诊断日志统一前缀与结构化字段（Experience-Review §7）
	console.error(`[lifecycle] listener error on ${event}: ${error?.stack || error?.message || error}`)
}

function createLifecycle() {
	const listeners = new Map()
	const isolatedListenerErrors = []

	const on = (event, listener) => {
		if (typeof event !== 'string' || event.length === 0) {
			throw new TypeError('lifecycle event name must be a non-empty string')
		}
		if (typeof listener !== 'function') {
			throw new TypeError('lifecycle listener must be a function')
		}
		const bucket = listeners.get(event) || []
		bucket.push(listener)
		listeners.set(event, bucket)
	}

	const emit = async (event, payload) => {
		const bucket = listeners.get(event)
		if (!bucket || bucket.length === 0) {
			return
		}
		// 浅冻结：对象与数组冻结；其余类型原样传递
		const frozenPayload
			= payload !== null && typeof payload === 'object'
				? Object.freeze(payload)
				: payload
		for (const listener of bucket) {
			try {
				await listener(frozenPayload)
			}
			catch (error) {
				isolatedListenerErrors.push({ event, error })
				logIsolatedListenerError(event, error)
			}
		}
	}

	return {
		on,
		emit,
		/**
		 * 被隔离的监听器错误（只读约定：消费方不得修改）。
		 * build:end 载荷的 isolatedListenerErrors 计数由此派生。
		 */
		isolatedListenerErrors,
	}
}

export { createLifecycle }
