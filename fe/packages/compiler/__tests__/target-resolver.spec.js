import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TARGET, InvalidTargetError, readAppRenderer, resolveTarget, SUPPORTED_TARGETS } from '../src/common/targets.js'

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

describe('readAppRenderer (A4 P-001, WeChat renderer alignment)', () => {
	function makeWorkPath(config) {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'target-renderer-'))
		fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(config))
		return dir
	}

	it('reads renderer from app.json when declared', () => {
		const dir = makeWorkPath({ pages: ['pages/index/index'], renderer: 'webview' })
		try {
			expect(readAppRenderer(dir)).toBe('webview')
		}
		finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})

	it('returns undefined when app.json has no renderer or is missing', () => {
		const dir = makeWorkPath({ pages: ['pages/index/index'] })
		try {
			expect(readAppRenderer(dir)).toBeUndefined()
		}
		finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
		const missing = fs.mkdtempSync(path.join(os.tmpdir(), 'target-renderer-missing-'))
		try {
			expect(readAppRenderer(missing)).toBeUndefined()
		}
		finally {
			fs.rmSync(missing, { recursive: true, force: true })
		}
	})
})
