import { resolve } from 'node:path'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'

it('bundles vConsole in production and initializes it before render', async () => {
	const result: any = await build({
		configFile: resolve(process.cwd(), 'vite.config.mjs'),
		logLevel: 'silent', mode: 'production',
		define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
		plugins: [{
			name: 'page-frame-build-fixtures', enforce: 'pre',
			resolveId(id) {
				if (id.startsWith('@dimina/') || /\.(scss|css)$/.test(id)) return `\0fixture:${id}`
			},
			load(id) {
				if (!id.startsWith('\0fixture:')) return
				if (id.endsWith('@dimina/common')) return 'export const modDefine = () => {}; export const modRequire = () => {}'
				if (id.endsWith('@dimina/render')) return 'window.renderSawVConsole = Boolean(window.vConsole)'
				return ''
			},
		}],
		build: { write: false, lib: { entry: resolve(process.cwd(), 'src/pages/pageFrame/pageFrame.ts') } },
	})
	const chunks = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output).filter((item: any) => item.type === 'chunk')
	const entry = chunks.find((item: any) => item.isEntry)
	expect(entry.imports).toEqual([])
	expect(entry.dynamicImports).toEqual([])
	const originalConsole = { ...console }
	for (const enabled of [false, true]) {
		window.history.replaceState({}, '', enabled ? '/?vconsole=1' : '/')
		// Execute the production bundle in the test DOM, including its initialization order.
		// eslint-disable-next-line no-eval
		window.eval(entry.code)
		expect((window as any).renderSawVConsole).toBe(enabled)
		expect(Boolean((window as any).vConsole)).toBe(enabled)
		if (enabled) {
			window.dispatchEvent(new window.Event('dimina:debug-ready'))
			expect((window as any).vConsole.pluginList['dimina-storage']).toBeDefined()
			await vi.waitFor(() => expect(document.querySelector('#__vconsole')).not.toBeNull())
			;(window as any).vConsole.showPlugin('dimina-storage')
			window.dispatchEvent(new CustomEvent('dimina:debug-storage', { detail: { value: [{ key: 'persisted', data: 334 }] } }))
			await vi.waitFor(() => expect(Array.from((document.querySelector('#__vconsole')!.shadowRoot || document.querySelector('#__vconsole'))!.querySelectorAll('input')).some(input => input.value === 'persisted')).toBe(true))
		}
		delete window.vConsole
	}
	Object.assign(console, originalConsole)
})
