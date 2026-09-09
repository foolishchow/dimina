import { describe, expect, it } from 'vitest'
import { DEFAULT_TARGET, InvalidTargetError, resolveTarget, SUPPORTED_TARGETS } from '../src/common/targets.js'

describe('target resolver (A4 P-001)', () => {
	it('defaults to webview and treats explicit webview identically', () => {
		expect(resolveTarget(undefined)).toBe('webview')
		expect(resolveTarget('webview')).toBe('webview')
		expect(DEFAULT_TARGET).toBe('webview')
		expect(SUPPORTED_TARGETS).toEqual(['webview'])
	})

	it('rejects unknown targets with a structured error', () => {
		try {
			resolveTarget('lynx')
			throw new Error('should have thrown')
		}
		catch (error) {
			expect(error).toBeInstanceOf(InvalidTargetError)
			expect(error).toBeInstanceOf(TypeError)
			expect(error.code).toBe('DIMINA_INVALID_TARGET')
			expect(error.target).toBe('lynx')
			expect(error.message).toContain('Unsupported compiler target: lynx')
		}
	})
})
