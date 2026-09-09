import { beforeEach, describe, expect, it } from 'vitest'
import message from '../src/core/message'

describe('message.resolveWait — P-006 remount initial data bridge', () => {
	beforeEach(() => {
		message.pendingWaitData = new Map()
		message.pendingWaiters = new Map()
	})

	it('resolves an already waiting page setup without service resend', async () => {
		const pending = message.wait('page-1')
		message.resolveWait('page-1', { value: 3 })
		expect(await pending).toEqual({ value: 3 })
	})

	it('stores data when remount setup has not registered its wait yet', async () => {
		message.resolveWait('page-2', { value: 4 })
		expect(await message.wait('page-2')).toEqual({ value: 4 })
	})

	it('resolves multiple waiters in one remount transaction', async () => {
		const first = message.wait('page-3')
		const second = message.wait('page-3')
		message.resolveWait('page-3', { value: 5 })
		expect(await Promise.all([first, second])).toEqual([{ value: 5 }, { value: 5 }])
	})
})
