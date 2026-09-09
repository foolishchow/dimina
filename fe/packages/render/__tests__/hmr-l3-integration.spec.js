import { beforeEach, describe, expect, it, vi } from 'vitest'
import loader from '../src/core/loader'
import runtime from '../src/core/runtime'

describe('P-006 L3 resource integration', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		loader.staticModules = {}
		loader.lastHmrBuildId = 0
		loader.hmrCapture = null
		loader.resourceContext = { appId: 'app', root: 'main', baseUrl: '/' }
		window.modRequire = vi.fn()
		window.Module = moduleInfo => loader.createModule(moduleInfo)
		runtime.app = {}
		runtime.pageId = 'page-1'
		runtime.pagePath = 'pages/index/index'
	})

	it('reloads view JS with buildId, captures new Module registration, then replaces it', async () => {
		const old = { path: 'pages/index/index', render: vi.fn(), usingComponents: {} }
		const next = { path: 'pages/index/index', render: vi.fn(), usingComponents: {} }
		loader.createModule(old)
		const scriptSpy = vi.spyOn(loader, 'loadScriptFile').mockImplementation(async (url) => {
			expect(url).toContain('pages_index_index.js?__dmcc_hmr=7')
			window.Module(next)
		})

		const nextInfo = await loader.reloadViewModule('pages/index/index', 7)
		const transaction = loader.replaceModule('pages/index/index', nextInfo, 7)

		expect(scriptSpy).toHaveBeenCalledTimes(1)
		expect(nextInfo).toBe(next)
		expect(transaction.committed).toBe(true)
		expect(loader.getModuleByPath('pages/index/index').moduleInfo).toBe(next)
	})

	it('applies L3 and reports applied when module replace and remount succeed', async () => {
		const next = { path: 'pages/index/index', render: vi.fn(), usingComponents: {} }
		const reloadSpy = vi.spyOn(loader, 'reloadViewModule').mockResolvedValue(next)
		const replaceSpy = vi.spyOn(loader, 'replaceModule').mockReturnValue({
			committed: true,
			rollback: vi.fn(),
		})
		const remountSpy = vi.spyOn(runtime, 'remountPageWithSnapshot').mockResolvedValue({ remounted: true, replayed: true })

		const result = await runtime.handleHmr({ level: 'L3', buildId: 8, affectedPages: ['pages/index/index'] })

		expect(result).toEqual({ status: 'applied' })
		expect(reloadSpy).toHaveBeenCalledWith('pages/index/index', 8)
		expect(replaceSpy).toHaveBeenCalledWith('pages/index/index', next, 8)
		expect(remountSpy).toHaveBeenCalledWith('page-1')
	})

	it('rolls back the module and reports fallback when remount fails', async () => {
		const next = { path: 'pages/index/index', render: vi.fn(), usingComponents: {} }
		const rollback = vi.fn()
		vi.spyOn(loader, 'reloadViewModule').mockResolvedValue(next)
		vi.spyOn(loader, 'replaceModule').mockReturnValue({ committed: true, rollback })
		vi.spyOn(runtime, 'remountPageWithSnapshot').mockResolvedValue({ remounted: false, reason: 'page-remount-failed' })

		const result = await runtime.handleHmr({ level: 'L3', buildId: 9, affectedPages: ['pages/index/index'] })

		expect(result).toEqual({ status: 'fallback', reason: 'page-remount-failed' })
		expect(rollback).toHaveBeenCalledTimes(1)
	})

	it('does not load a module for an unaffected current page', async () => {
		const reloadSpy = vi.spyOn(loader, 'reloadViewModule')
		const result = await runtime.handleHmr({ level: 'L3', buildId: 10, affectedPages: ['pages/other/index'] })

		expect(result).toEqual({ status: 'applied', reason: 'current-page-not-affected' })
		expect(reloadSpy).not.toHaveBeenCalled()
	})
})
