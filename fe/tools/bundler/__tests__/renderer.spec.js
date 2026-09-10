import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	DEFAULT_RENDERER,
	InvalidRendererError,
	readAppRenderer,
	readPageRenderers,
	resolveProjectRenderers,
	resolveRenderer,
	SUPPORTED_RENDERERS,
} from '../src/common/renderers.js'

function makeTempDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-spec-'))
}

function writeApp(workPath, config) {
	fs.writeFileSync(path.join(workPath, 'app.json'), JSON.stringify(config))
}

function writePage(workPath, pagePath, config) {
	const filePath = path.join(workPath, `${pagePath}.json`)
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, JSON.stringify(config))
}

describe('resolveRenderer (A4 P-001)', () => {
	it('defaults to webview when undefined and accepts explicit webview', () => {
		expect(resolveRenderer(undefined)).toBe('webview')
		expect(resolveRenderer('webview')).toBe('webview')
		expect(DEFAULT_RENDERER).toBe('webview')
		expect(SUPPORTED_RENDERERS).toEqual(['webview'])
	})

	it('rejects unknown renderers with a structured error including context', () => {
		try {
			resolveRenderer('skyline', 'app.json')
			throw new Error('should have thrown')
		}
		catch (error) {
			expect(error).toBeInstanceOf(InvalidRendererError)
			expect(error).toBeInstanceOf(TypeError)
			expect(error.code).toBe('DIMINA_INVALID_RENDERER')
			expect(error.renderer).toBe('skyline')
			expect(error.context).toBe('app.json')
			expect(error.message).toContain('Unsupported renderer: skyline')
			expect(error.message).toContain('in app.json')
		}
	})
})

describe('readAppRenderer (A4 P-001)', () => {
	it('reads renderer from app.json when declared', () => {
		const dir = makeTempDir()
		try {
			writeApp(dir, { pages: ['pages/index/index'], renderer: 'webview' })
			expect(readAppRenderer(dir)).toBe('webview')
		}
		finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})

	it('returns undefined when app.json has no renderer or is missing/invalid', () => {
		const dir = makeTempDir()
		try {
			writeApp(dir, { pages: ['pages/index/index'] })
			expect(readAppRenderer(dir)).toBeUndefined()
			fs.writeFileSync(path.join(dir, 'app.json'), 'not-json')
			expect(readAppRenderer(dir)).toBeUndefined()
		}
		finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
		const missing = makeTempDir()
		try {
			expect(readAppRenderer(missing)).toBeUndefined()
		}
		finally {
			fs.rmSync(missing, { recursive: true, force: true })
		}
	})
})

describe('readPageRenderers / resolveProjectRenderers (A4 P-001)', () => {
	it('reads per-page renderer and subPackage page paths', () => {
		const dir = makeTempDir()
		try {
			writeApp(dir, {
				pages: ['pages/index/index', 'pages/about/index'],
				subPackages: [{ root: 'subA', pages: ['home/index'] }],
			})
			writePage(dir, 'pages/index/index', { renderer: 'webview' })
			writePage(dir, 'pages/about/index', {}) // 无 renderer -> undefined
			writePage(dir, 'subA/home/index', { renderer: 'webview' })

			const pageRenderers = readPageRenderers(dir)
			expect(pageRenderers.get('pages/index/index')).toBe('webview')
			expect(pageRenderers.get('pages/about/index')).toBeUndefined()
			expect(pageRenderers.get('subA/home/index')).toBe('webview')
		}
		finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})

	it('resolveProjectRenderers accepts webview declarations and rejects unknowns', () => {
		const dir = makeTempDir()
		try {
			writeApp(dir, { pages: ['pages/index/index'], renderer: 'webview' })
			writePage(dir, 'pages/index/index', { renderer: 'webview' })
			const result = resolveProjectRenderers(dir)
			expect(result.appRenderer).toBe('webview')
			expect([...result.pageRenderers.values()]).toEqual(['webview'])
		}
		finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}

		const badDir = makeTempDir()
		try {
			writeApp(badDir, { pages: ['pages/index/index'] })
			writePage(badDir, 'pages/index/index', { renderer: 'skyline' })
			expect(() => resolveProjectRenderers(badDir)).toThrowError(InvalidRendererError)
		}
		finally {
			fs.rmSync(badDir, { recursive: true, force: true })
		}
	})
})