import { describe, expect, it } from 'vitest'
import { createHmrState, enableDevHmr, handleHmrCommand } from '../src/core/hmr.js'

// A3 契约 technical-design §1/§5：运行时 flag、envelope 校验、stale buildId 守卫。

const CMD = { level: 'L3', buildId: 5, affectedPages: ['pages/index/index'], changedStages: ['view'] }

describe('createHmrState', () => {
	it('初始关闭且无已接受 buildId', () => {
		const state = createHmrState()
		expect(state).toEqual({ enabled: false, lastAcceptedBuildId: 0 })
	})
})

describe('enableDevHmr', () => {
	it('开启运行时 flag（生产 dist 无构建期条件依赖）', () => {
		const state = createHmrState()
		enableDevHmr(state)
		expect(state.enabled).toBe(true)
	})

	it('携带更高 buildId 时推进水位（幂等重放不回退）', () => {
		const state = createHmrState()
		enableDevHmr(state, { buildId: 7 })
		expect(state.lastAcceptedBuildId).toBe(7)
		enableDevHmr(state, { buildId: 3 })
		expect(state.lastAcceptedBuildId).toBe(7)
		enableDevHmr(state, { buildId: 9 })
		expect(state.lastAcceptedBuildId).toBe(9)
	})
})

describe('handleHmrCommand — flag 守卫', () => {
	it('flag 未开启时拒绝（原生/生产天然隔离）', () => {
		const state = createHmrState()
		const result = handleHmrCommand(state, CMD)
		expect(result).toEqual({ accepted: false, reason: 'hmr-disabled' })
		expect(state.lastAcceptedBuildId).toBe(0)
	})

	it('开启后接受合法指令', () => {
		const state = createHmrState()
		enableDevHmr(state)
		const result = handleHmrCommand(state, CMD)
		expect(result.accepted).toBe(true)
		expect(result.payload).toEqual(CMD)
		expect(state.lastAcceptedBuildId).toBe(5)
	})
})

describe('handleHmrCommand — envelope 校验', () => {
	it('非对象载荷拒绝', () => {
		const state = createHmrState()
		enableDevHmr(state)
		expect(handleHmrCommand(state, null)).toMatchObject({ accepted: false, reason: 'invalid-envelope' })
	})

	it('非法 level 拒绝（仅 L2/L3）', () => {
		const state = createHmrState()
		enableDevHmr(state)
		expect(handleHmrCommand(state, { ...CMD, level: 'L1' })).toMatchObject({ accepted: false, reason: 'invalid-level' })
		expect(handleHmrCommand(state, { ...CMD, level: 'L0' })).toMatchObject({ accepted: false, reason: 'invalid-level' })
	})

	it('非法 buildId 拒绝（正整数）', () => {
		const state = createHmrState()
		enableDevHmr(state)
		expect(handleHmrCommand(state, { ...CMD, buildId: 0 })).toMatchObject({ accepted: false, reason: 'invalid-build-id' })
		expect(handleHmrCommand(state, { ...CMD, buildId: -1 })).toMatchObject({ accepted: false, reason: 'invalid-build-id' })
		expect(handleHmrCommand(state, { ...CMD, buildId: 1.5 })).toMatchObject({ accepted: false, reason: 'invalid-build-id' })
		expect(handleHmrCommand(state, { ...CMD, buildId: '5' })).toMatchObject({ accepted: false, reason: 'invalid-build-id' })
	})

	it('affectedPages 非数组拒绝', () => {
		const state = createHmrState()
		enableDevHmr(state)
		expect(handleHmrCommand(state, { ...CMD, affectedPages: 'pages/index' }))
			.toMatchObject({ accepted: false, reason: 'invalid-envelope' })
	})
})

describe('handleHmrCommand — stale buildId 守卫', () => {
	it('旧 buildId 拒绝且不推进水位', () => {
		const state = createHmrState()
		enableDevHmr(state, { buildId: 10 })
		const stale = handleHmrCommand(state, { ...CMD, buildId: 10 })
		expect(stale).toMatchObject({ accepted: false, reason: 'stale-build-id' })
		const older = handleHmrCommand(state, { ...CMD, buildId: 9 })
		expect(older).toMatchObject({ accepted: false, reason: 'stale-build-id' })
		expect(state.lastAcceptedBuildId).toBe(10)
	})

	it('乱序到达只接受单调递增的新指令（快速连续变更场景）', () => {
		const state = createHmrState()
		enableDevHmr(state)
		expect(handleHmrCommand(state, { ...CMD, buildId: 2 }).accepted).toBe(true)
		expect(handleHmrCommand(state, { ...CMD, buildId: 1 }).accepted).toBe(false)
		expect(handleHmrCommand(state, { ...CMD, buildId: 3 }).accepted).toBe(true)
		expect(handleHmrCommand(state, { ...CMD, buildId: 3 }).accepted).toBe(false)
		expect(state.lastAcceptedBuildId).toBe(3)
	})
})
