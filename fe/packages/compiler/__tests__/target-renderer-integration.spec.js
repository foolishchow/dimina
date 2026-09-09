import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import build from '../src/index.js'
import { InvalidRendererError } from '../src/common/renderers.js'

describe('build renderer pre-validation (A4 P-007 ablation target)', () => {
	function makeProject(renderer) {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-renderer-int-'))
		fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({
			pages: ['pages/index/index'],
			...(renderer ? { renderer } : {}),
		}))
		fs.writeFileSync(path.join(root, 'app.js'), 'App({})\n')
		fs.writeFileSync(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'a4-renderer' }))
		const pageDir = path.join(root, 'pages/index')
		fs.mkdirSync(pageDir, { recursive: true })
		fs.writeFileSync(path.join(pageDir, 'index.json'), '{}')
		fs.writeFileSync(path.join(pageDir, 'index.js'), 'Page({})\n')
		fs.writeFileSync(path.join(pageDir, 'index.wxml'), '<view/>\n')
		fs.writeFileSync(path.join(pageDir, 'index.wxss'), '.x{}\n')
		return root
	}

	it('default project (no renderer) builds successfully with webview', async () => {
		const root = makeProject()
		const out = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-renderer-out-'))
		try {
			const result = await build(out, root, false)
			expect(result.appId).toBeDefined()
			expect(fs.existsSync(path.join(out, 'main', 'logic.js'))).toBe(true)
		}
		finally {
			fs.rmSync(root, { recursive: true, force: true })
			fs.rmSync(out, { recursive: true, force: true })
		}
	})

	it('project with renderer:webview in app.json builds', async () => {
		const root = makeProject('webview')
		const out = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-renderer-out-'))
		try {
			const result = await build(out, root, false)
			expect(result.appId).toBeDefined()
		}
		finally {
			fs.rmSync(root, { recursive: true, force: true })
			fs.rmSync(out, { recursive: true, force: true })
		}
	})

	it('project with unknown renderer rejects before lifecycle side effects (ablation target)', async () => {
		const root = makeProject('skyline')
		// 目标目录不存在：验证 build 失败后不会被创建（无副作用）
		const out = path.join(root, 'out-should-not-exist')
		try {
			let caught
			try {
				await build(out, root, false)
			}
			catch (error) {
				caught = error
			}
			expect(caught).toBeInstanceOf(InvalidRendererError)
			expect(caught.code).toBe('DIMINA_INVALID_RENDERER')
			expect(fs.existsSync(out)).toBe(false)
			expect(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).renderer).toBe('skyline')
		}
		finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})