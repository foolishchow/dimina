import { beforeEach, describe, expect, it } from 'vitest'
import { _rendererRegistryForTest, getRenderer, registerRenderer } from '../src/common/renderers.js'

describe('renderer registry (A4 P-002)', () => {
	beforeEach(() => {
		// 保留 index.js 模块加载时可能注入的 webview 适配器
		const keep = _rendererRegistryForTest.get('webview')
		_rendererRegistryForTest.clear()
		if (keep) _rendererRegistryForTest.set('webview', keep)
	})

	it('registers and looks up a renderer by name', () => {
		const renderer = { name: 'test-renderer', runViewStage: () => {} }
		registerRenderer(renderer)
		expect(getRenderer('test-renderer')).toBe(renderer)
	})

	it('returns null for an unregistered renderer', () => {
		expect(getRenderer('not-registered')).toBeNull()
	})

	it('rejects renderers without a non-empty name', () => {
		expect(() => registerRenderer({})).toThrow(TypeError)
		expect(() => registerRenderer({ name: '' })).toThrow(TypeError)
	})
})