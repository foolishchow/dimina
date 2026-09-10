import { beforeEach, describe, expect, it } from 'vitest'
import { createContainer } from '../src/index.js'
import { FakeWorker, resetFakeWorker } from './fixtures/fake-worker.js'
import { installFetchMock } from './fixtures/mock-fetch.js'

describe('createContainer virtualFilePrefix', () => {
	beforeEach(() => {
		installFetchMock()
		resetFakeWorker()
	})

	it('passes the normalized per-container prefix to the service Worker before startup', async () => {
		const mount = document.createElement('div')
		const container = createContainer({ mount, virtualFilePrefix: 'HostFile://' })

		const miniApp = await container.openApp({ appId: 'wx-custom-prefix', path: 'pages/index/index' })
		const workerConfig = JSON.parse(FakeWorker.instances[0].options.name)

		expect(container.application.virtualFilePrefix).toBe('hostfile://')
		expect(miniApp.appInfo.virtualFilePrefix).toBe('hostfile://')
		expect(workerConfig.virtualFilePrefix).toBe('hostfile://')
	}, 10000)

	it('keeps prefixes isolated between container instances', async () => {
		const first = createContainer({ mount: document.createElement('div'), virtualFilePrefix: 'first-file://' })
		const second = createContainer({ mount: document.createElement('div'), virtualFilePrefix: 'second-file://' })

		await first.openApp({ appId: 'wx-prefix-first', path: 'pages/index/index' })
		await second.openApp({ appId: 'wx-prefix-second', path: 'pages/index/index' })

		expect(JSON.parse(FakeWorker.instances[0].options.name).virtualFilePrefix).toBe('first-file://')
		expect(JSON.parse(FakeWorker.instances[1].options.name).virtualFilePrefix).toBe('second-file://')
	}, 10000)

	it('rejects prefixes that are not a bare URI scheme', () => {
		expect(() => createContainer({
			mount: document.createElement('div'),
			virtualFilePrefix: 'host-file://usr/',
		})).toThrow(/virtualFilePrefix/)
		expect(() => createContainer({
			mount: document.createElement('div'),
			virtualFilePrefix: 'https://',
		})).toThrow(/virtualFilePrefix/)
	})
})
