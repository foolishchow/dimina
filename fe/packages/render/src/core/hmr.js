/**
 * dev-only HMR 控制器（dmcc A3 契约，technical-design §1/§5）。
 *
 * 运行时 flag：dmcc dev 消费的是 container-sdk 生产构建 dist，
 * import.meta.env.DEV 已固化为 false，构建期条件不可用（F-A1 定案）。
 * 标志由宿主页 ws 订阅成功后经 bridge 注入（enableDevHmr 消息）；
 * 原生四端与生产路径没有该消息类型，天然隔离。
 *
 * 本模块只承担通道守卫：flag、envelope 校验、stale buildId 拒绝。
 * L2 CSS 事务与 L3 remount/replay 由后续任务在 accepted 后接入。
 */

const HMR_LEVELS = new Set(['L2', 'L3'])

/**
 * 创建 HMR 状态（render 实例持有）。
 * @returns {{ enabled: boolean, lastAcceptedBuildId: number }} 初始关闭
 */
export function createHmrState() {
	return {
		enabled: false,
		lastAcceptedBuildId: 0,
	}
}

/**
 * 注入运行时 dev 标志（宿主页 ws 就绪后经 bridge 调用；重复调用幂等）。
 * @param {{ enabled: boolean, lastAcceptedBuildId: number }} state
 * @param {{ buildId?: number }} [payload]
 */
export function enableDevHmr(state, payload = {}) {
	state.enabled = true
	if (Number.isFinite(payload.buildId) && payload.buildId > state.lastAcceptedBuildId) {
		state.lastAcceptedBuildId = payload.buildId
	}
}

/**
 * 校验并接收 HMR 指令。仅守卫，不执行事务。
 * @param {{ enabled: boolean, lastAcceptedBuildId: number }} state
 * @param {{ level?: string, buildId?: number, affectedPages?: unknown,
 *           changedStages?: unknown }} payload bridge 转发的 hmr 消息体
 * @returns {{ accepted: boolean, reason?: string, payload?: object }} 校验结果：accepted
 *   为 true 时 payload 为通过守卫的指令体；拒绝时携带可观察 reason。
 */
export function handleHmrCommand(state, payload) {
	if (!state.enabled) {
		return { accepted: false, reason: 'hmr-disabled' }
	}

	if (!payload || typeof payload !== 'object') {
		return { accepted: false, reason: 'invalid-envelope' }
	}

	const { level, buildId, affectedPages } = payload
	if (!HMR_LEVELS.has(level)) {
		return { accepted: false, reason: 'invalid-level' }
	}
	if (!Number.isInteger(buildId) || buildId <= 0) {
		return { accepted: false, reason: 'invalid-build-id' }
	}
	if (buildId <= state.lastAcceptedBuildId) {
		return { accepted: false, reason: 'stale-build-id' }
	}
	if (!Array.isArray(affectedPages)) {
		return { accepted: false, reason: 'invalid-envelope' }
	}

	state.lastAcceptedBuildId = buildId
	return { accepted: true, payload }
}
