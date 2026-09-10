import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createContainer } from '../src/index.js'
import { FakeWorker, resetFakeWorker } from './fixtures/fake-worker.js'
import { installFetchMock } from './fixtures/mock-fetch.js'

// v2 使用带 appId 长度的命名空间，使 (appId, key) 映射保持单射；旧的
// `${appId}_${key}` 数据仍可按精确 key 懒迁移，但不会再被前缀枚举或清理。
//
// 复用 storage-sync-adapter.spec.ts 里验证过的 house style：success/fail/complete 不是真函数，
// 是逻辑线程传入的不透明 callback id，SDK 经 jscore.postMessage({ type: 'triggerCallback', ... })
// 原样带回，这里同样用字符串 id + 检查 FakeWorker.postMessage 的调用记录来断言。

/** 等到指定起始下标之后出现下一个 FakeWorker 实例（对应某次 openApp 起的逻辑线程）。 */
async function waitForWorker(startIndex: number, timeout = 8000) {
	await vi.waitFor(() => {
		expect(FakeWorker.instances.length).toBeGreaterThan(startIndex)
	}, { timeout })
	return FakeWorker.instances[startIndex]
}

interface TriggerCallbackMessage {
	body: { id: string, args?: { data?: unknown, errMsg?: string, keys?: string[], currentSize?: number, limitSize?: number } }
}

function findTriggerCallback(workerIndexStart: number, id: string): TriggerCallbackMessage | undefined {
	const relevantWorkers = FakeWorker.instances.slice(workerIndexStart)
	for (const worker of relevantWorkers) {
		const call = worker.postMessage.mock.calls.find(
			([message]: [{ type?: string, body?: { id?: string } }]) => message?.type === 'triggerCallback' && message?.body?.id === id,
		)
		if (call) return call[0] as TriggerCallbackMessage
	}
	return undefined
}

/** 等到指定起始下标之后的某个 worker 收到匹配 id 的 triggerCallback 消息，返回其 payload。 */
async function waitForTriggerCallback(workerIndexStart: number, id: string, timeout = 8000): Promise<TriggerCallbackMessage> {
	return vi.waitFor(() => {
		const message = findTriggerCallback(workerIndexStart, id)
		if (!message) throw new Error(`triggerCallback with id "${id}" was not posted yet`)
		return message
	}, { timeout })
}

describe('storage key isolation and legacy migration', () => {
	beforeEach(() => {
		installFetchMock()
		resetFakeWorker()
		localStorage.clear()
	})

	it('keeps appId/key pairs isolated even when their legacy spellings collide', async () => {
		const mountAB = document.createElement('div')
		const mountA = document.createElement('div')
		document.body.appendChild(mountAB)
		document.body.appendChild(mountA)

		const containerAB = createContainer({ mount: mountAB })
		const containerA = createContainer({ mount: mountA })

		const workerIndexBeforeAB = FakeWorker.instances.length
		const miniAppAB = await containerAB.openApp({ appId: 'a_b', path: 'pages/index/index' })
		await waitForWorker(workerIndexBeforeAB)

		const workerIndexBeforeA = FakeWorker.instances.length
		const miniAppA = await containerA.openApp({ appId: 'a', path: 'pages/index/index' })
		await waitForWorker(workerIndexBeforeA)

		miniAppAB.invokeApi('setStorage', { key: 'c', data: 'value-from-a_b', success: 'ab-set-success', fail: 'ab-set-fail', complete: 'ab-set-complete' })
		await waitForTriggerCallback(workerIndexBeforeAB, 'ab-set-success')

		miniAppA.invokeApi('setStorage', { key: 'b_c', data: 'value-from-a', success: 'a-set-success', fail: 'a-set-fail', complete: 'a-set-complete' })
		await waitForTriggerCallback(workerIndexBeforeA, 'a-set-success')

		miniAppAB.invokeApi('getStorage', { key: 'c', success: 'ab-get-success', fail: 'ab-get-fail', complete: 'ab-get-complete' })
		const abGetResult = await waitForTriggerCallback(workerIndexBeforeAB, 'ab-get-success')

		miniAppA.invokeApi('getStorage', { key: 'b_c', success: 'a-get-success', fail: 'a-get-fail', complete: 'a-get-complete' })
		const aGetResult = await waitForTriggerCallback(workerIndexBeforeA, 'a-get-success')

		expect(abGetResult.body.args?.data).toEqual('value-from-a_b')
		expect(aGetResult.body.args?.data).toEqual('value-from-a')
		expect(localStorage.getItem('__dimina_storage_v2_data__3:a_b:c')).not.toBeNull()
		expect(localStorage.getItem('__dimina_storage_v2_data__1:a:b_c')).not.toBeNull()
	}, 10000)

	it('clearStorage only clears the requesting appId namespace', async () => {
		const mountA = document.createElement('div')
		const mountAB = document.createElement('div')
		document.body.appendChild(mountA)
		document.body.appendChild(mountAB)

		const containerA = createContainer({ mount: mountA })
		const containerAB = createContainer({ mount: mountAB })

		const workerIndexBeforeA = FakeWorker.instances.length
		const miniAppA = await containerA.openApp({ appId: 'a', path: 'pages/index/index' })
		await waitForWorker(workerIndexBeforeA)

		const workerIndexBeforeAB = FakeWorker.instances.length
		const miniAppAB = await containerAB.openApp({ appId: 'a_b', path: 'pages/index/index' })
		await waitForWorker(workerIndexBeforeAB)

		miniAppAB.invokeApi('setStorage', { key: 'x', data: 'ab-value', success: 'ab-set-success', fail: 'ab-set-fail', complete: 'ab-set-complete' })
		await waitForTriggerCallback(workerIndexBeforeAB, 'ab-set-success')

		miniAppAB.invokeApi('getStorage', { key: 'x', success: 'ab-get-success-1', fail: 'ab-get-fail-1', complete: 'ab-get-complete-1' })
		const beforeClearResult = await waitForTriggerCallback(workerIndexBeforeAB, 'ab-get-success-1')
		expect(beforeClearResult.body.args?.data).toEqual('ab-value')

		miniAppA.invokeApi('clearStorage', { success: 'a-clear-success', fail: 'a-clear-fail', complete: 'a-clear-complete' })
		await waitForTriggerCallback(workerIndexBeforeA, 'a-clear-success')

		miniAppAB.invokeApi('getStorage', { key: 'x', success: 'ab-get-success-2', fail: 'ab-get-fail-2', complete: 'ab-get-complete-2' })
		const afterClear = await waitForTriggerCallback(workerIndexBeforeAB, 'ab-get-success-2')

		expect(afterClear.body.args?.data).toEqual('ab-value')
	}, 10000)

	it('reads legacy data once and writes a v2 migration copy', async () => {
		localStorage.setItem('legacyapp_token', JSON.stringify('legacy-value'))
		const mount = document.createElement('div')
		document.body.appendChild(mount)
		const container = createContainer({ mount })
		const workerIndexBefore = FakeWorker.instances.length
		const miniApp = await container.openApp({ appId: 'legacyapp', path: 'pages/index/index' })
		await waitForWorker(workerIndexBefore)

		miniApp.invokeApi('getStorage', { key: 'token', success: 'get-success', fail: 'get-fail', complete: 'get-complete' })
		const result = await waitForTriggerCallback(workerIndexBefore, 'get-success')

		expect(result.body.args?.data).toBe('legacy-value')
		expect(localStorage.getItem('__dimina_storage_v2_data__9:legacyapp:token')).not.toBeNull()
		expect(localStorage.getItem('legacyapp_token')).toBe(JSON.stringify('legacy-value'))
	}, 10000)

	it('does not guess ownership for ambiguous legacy spellings', async () => {
		localStorage.setItem('a_b_c', JSON.stringify('ambiguous'))
		const mount = document.createElement('div')
		document.body.appendChild(mount)
		const container = createContainer({ mount })
		const workerIndexBefore = FakeWorker.instances.length
		const miniApp = await container.openApp({ appId: 'a', path: 'pages/index/index' })
		await waitForWorker(workerIndexBefore)

		miniApp.invokeApi('getStorage', { key: 'b_c', success: 'get-success', fail: 'get-fail', complete: 'get-complete' })
		const result = await waitForTriggerCallback(workerIndexBefore, 'get-fail')

		expect(result.body.args?.errMsg).toMatch(/^getStorage:fail /)
		expect(localStorage.getItem('a_b_c')).toBe(JSON.stringify('ambiguous'))
	}, 10000)

	it.each(['123', 'true', 'null', '{"x":1}'])('preserves JSON-looking string %s as a string', async (value) => {
		const mount = document.createElement('div')
		document.body.appendChild(mount)
		const container = createContainer({ mount })
		const workerIndexBefore = FakeWorker.instances.length
		const miniApp = await container.openApp({ appId: `type-app-${value.length}`, path: 'pages/index/index' })
		await waitForWorker(workerIndexBefore)

		miniApp.invokeApi('setStorage', { key: value, data: value, success: 'set-success', fail: 'set-fail', complete: 'set-complete' })
		await waitForTriggerCallback(workerIndexBefore, 'set-success')
		miniApp.invokeApi('getStorage', { key: value, success: 'get-success', fail: 'get-fail', complete: 'get-complete' })
		const result = await waitForTriggerCallback(workerIndexBefore, 'get-success')

		expect(result.body.args?.data).toBe(value)
	}, 10000)
})
