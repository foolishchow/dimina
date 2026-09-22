import { afterEach, describe, expect, it, vi } from 'vitest'
import { abilityALS } from '../src/compiler/worker-runtime/context.ts'
import { BufferingLogger } from '../src/compiler/worker-runtime/loggers.ts'

const {
	checkTemplateCompatibility,
	warnUnsupportedWxApi,
} = await import('../src/compiler/core/compatibility.ts')

describe('worker compatibility diagnostics', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('collects deduplicated warnings in discovery order without writing to the terminal', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const logger = new BufferingLogger()

		// P-WR07: warnOnce 从 getStore 拿 logger（BufferingLogger 缓冲，不 console.warn）
		abilityALS.run({ logger }, () => {
			warnUnsupportedWxApi('getUserProfile', '/pages/index/index.js', 2)
			warnUnsupportedWxApi('getUserProfile', '/pages/index/index.js', 2)
			checkTemplateCompatibility('<unknown-element />', '/pages/index/index.wxml')
		})

		expect(warn).not.toHaveBeenCalled()
		expect(logger.flush()).toEqual([
			'[compat] Unsupported wx API: wx.getUserProfile (/pages/index/index.js:2)',
			'[compat] Unsupported or undeclared component: <unknown-element> (/pages/index/index.wxml:1)',
		])
		expect(logger.flush()).toEqual([])
	})
})
