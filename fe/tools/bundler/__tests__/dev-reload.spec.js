import { describe, expect, it } from 'vitest'
import { RELOAD_LEVELS, synthesizeReloadLevel } from '../src/dev/dev-reload.js'

// dmcc-dev-server 契约 v1 §4：reloadLevel 合成矩阵（technical-design §4 + F-001 修复）。

const CTX = { event: 'change', filePath: 'pages/index/index.js', count: 1 }

function incrementalPlan(stages, affectedEntries = ['pages/index/index']) {
	return {
		skip: false,
		incremental: true,
		options: { stages, affectedEntries },
	}
}

describe('synthesizeReloadLevel — 矩阵', () => {
	it('plan.skip 时不推送（返回 null）', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: { skip: true, incremental: false, options: {} },
			appId: 'app-x',
			buildId: 3,
		})
		expect(result).toBeNull()
	})

	it('合并（count>1）→ L0', () => {
		const result = synthesizeReloadLevel({
			event: 'change',
			filePath: 'pages/index/index.js',
			count: 3,
			plan: { skip: false, incremental: false, options: {} },
			appId: 'app-x',
			buildId: 4,
		})
		expect(result).toEqual({
			appId: 'app-x',
			reloadLevel: RELOAD_LEVELS.L0,
			changedStages: [],
			affectedPages: [],
			buildId: 4,
		})
	})

	it('配置 json 变更（incremental=false）→ L0', () => {
		const result = synthesizeReloadLevel({
			event: 'change',
			filePath: 'app.json',
			count: 1,
			plan: { skip: false, incremental: false, options: {} },
			appId: 'app-x',
			buildId: 5,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L0)
	})

	it('未知 kind（incremental=false）→ L0', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: { skip: false, incremental: false, options: {} },
			appId: 'app-x',
			buildId: 6,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L0)
	})

	it('add/unlink 非增量（event !== change）→ L0', () => {
		const result = synthesizeReloadLevel({
			event: 'add',
			filePath: 'pages/new/index.wxml',
			count: 1,
			plan: { skip: false, incremental: false, options: {} },
			appId: 'app-x',
			buildId: 7,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L0)
	})

	it('非增量全量兜底 → L0', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: { skip: false, incremental: false, options: {} },
			appId: 'app-x',
			buildId: 8,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L0)
	})

	it('仅 logic 阶段 → L1（本门生效级别）', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['logic']),
			appId: 'app-x',
			buildId: 9,
		})
		expect(result).toEqual({
			appId: 'app-x',
			reloadLevel: RELOAD_LEVELS.L1,
			changedStages: ['logic'],
			affectedPages: ['pages/index/index'],
			buildId: 9,
		})
	})

	it('logic + style 混合 → L1（logic 优先，最破坏性）', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['logic', 'style']),
			appId: 'app-x',
			buildId: 10,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L1)
	})

	it('仅 style 阶段 → L2', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['style']),
			appId: 'app-x',
			buildId: 11,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L2)
	})

	it('仅 view 阶段 → L3', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['view']),
			appId: 'app-x',
			buildId: 12,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L3)
	})

	it('view + style 混合 → L3（最破坏性）', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['view', 'style']),
			appId: 'app-x',
			buildId: 13,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L3)
	})

	it('防御：增量但 affectedPages 为空 → L1', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['view'], []),
			appId: 'app-x',
			buildId: 14,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L1)
		expect(result.affectedPages).toEqual([])
	})

	it('防御：stages 为空但 affectedPages 非空 → L1（保守 relaunch）', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan([], ['pages/index/index']),
			appId: 'app-x',
			buildId: 15,
		})
		expect(result.reloadLevel).toBe(RELOAD_LEVELS.L1)
	})

	it('载荷字段：affectedPages 来自 plan.options.affectedEntries 映射', () => {
		const result = synthesizeReloadLevel({
			...CTX,
			plan: incrementalPlan(['view'], ['pages/a/index', 'pages/b/index']),
			appId: 'app-y',
			buildId: 16,
		})
		expect(result.affectedPages).toEqual(['pages/a/index', 'pages/b/index'])
		expect(result.changedStages).toEqual(['view'])
		expect(result.appId).toBe('app-y')
		expect(result.buildId).toBe(16)
	})
})
