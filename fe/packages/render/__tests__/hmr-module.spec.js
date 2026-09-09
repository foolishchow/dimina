import { beforeEach, describe, expect, it, vi } from 'vitest'
import loader from '../src/core/loader'

function moduleInfo(path, usingComponents = {}) {
	return { path, id: `id-${path}`, render: vi.fn(), usingComponents }
}

describe('loader.replaceModule — L3 module replacement transaction', () => {
	beforeEach(() => {
		loader.staticModules = {}
		loader.lastHmrBuildId = 0
		window.modRequire = vi.fn()
	})

	it('replaces an existing module only after dependency validation', () => {
		const old = moduleInfo('pages/index/index')
		const next = moduleInfo('pages/index/index')
		loader.createModule(old)

		const transaction = loader.replaceModule('pages/index/index', next, 1)

		expect(transaction.committed).toBe(true)
		expect(loader.getModuleByPath('pages/index/index').moduleInfo).toBe(next)
		expect(loader.lastHmrBuildId).toBe(1)
	})

	it('rejects stale buildIds without changing the current module', () => {
		const old = moduleInfo('pages/index/index')
		loader.createModule(old)
		const first = loader.replaceModule('pages/index/index', moduleInfo('pages/index/index'), 3)
		const current = loader.getModuleByPath('pages/index/index')

		const stale = loader.replaceModule('pages/index/index', moduleInfo('pages/index/index'), 2)

		expect(first.committed).toBe(true)
		expect(stale).toMatchObject({ committed: false, reason: 'stale-build-id' })
		expect(loader.getModuleByPath('pages/index/index')).toBe(current)
	})

	it('rolls back a committed replacement only while it remains current', () => {
		const old = moduleInfo('pages/index/index')
		const next = moduleInfo('pages/index/index')
		loader.createModule(old)
		const transaction = loader.replaceModule('pages/index/index', next, 1)

		expect(transaction.rollback()).toBe(true)
		expect(loader.getModuleByPath('pages/index/index').moduleInfo).toBe(old)
		expect(transaction.rollback()).toBe(false)
	})

	it('keeps the old module when usingComponents validation fails', () => {
		const old = moduleInfo('pages/index/index')
		loader.createModule(old)
		window.modRequire.mockImplementation(() => {
			throw new Error('missing component')
		})

		const transaction = loader.replaceModule('pages/index/index', moduleInfo('pages/index/index', { card: '/components/card' }), 1)

		expect(transaction).toMatchObject({ committed: false, reason: 'dependency-resolution-failed' })
		expect(loader.getModuleByPath('pages/index/index').moduleInfo).toBe(old)
		expect(transaction.rollback()).toBe(false)
	})

	it('supports placeholder fallback during validation', () => {
		const old = moduleInfo('pages/index/index')
		loader.createModule(old)
		window.modRequire.mockImplementation((path) => {
			if (path === '/components/card') throw new Error('missing')
		})

		const next = moduleInfo('pages/index/index', { card: '/components/card', fallback: '/components/fallback' })
		next.componentPlaceholder = { card: 'fallback' }
		const transaction = loader.replaceModule(
			'pages/index/index',
			next,
			1,
		)

		expect(transaction.committed).toBe(true)
		expect(window.modRequire).toHaveBeenCalledWith('/components/fallback')
	})

	it('rejects mismatched paths and invalid buildIds without mutation', () => {
		const old = moduleInfo('pages/index/index')
		loader.createModule(old)
		expect(loader.replaceModule('pages/index/index', moduleInfo('other'), 1).reason).toBe('invalid-module')
		expect(loader.replaceModule('pages/index/index', moduleInfo('pages/index/index'), 0).reason).toBe('stale-build-id')
		expect(loader.getModuleByPath('pages/index/index').moduleInfo).toBe(old)
	})
})
