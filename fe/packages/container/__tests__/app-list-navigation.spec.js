// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAppList, getMiniAppInfo } = vi.hoisted(() => ({
	getAppList: vi.fn(() => new Promise(() => {})),
	getMiniAppInfo: vi.fn(),
}))

vi.mock('@/services', () => ({
	getAppList,
	getMiniAppInfo,
}))

import { AppList } from '../src/pages/appList/appList.js'

describe('app list navigation', () => {
	let page
	let list
	let navigation

	beforeEach(() => {
		getAppList.mockClear()
		getMiniAppInfo.mockReset()
		page = new AppList({ openApp: vi.fn() })
		page.parent = { updateStatusBarColor: vi.fn() }
		page.viewDidLoad()
		list = page.el.querySelector('.dimina-app__mini-used-list')
		navigation = page.el.querySelector('.dimina-app-navigation')
	})

	it('opens list entries without requesting destruction of retained apps', async () => {
		page.renderAppList([{ appId: 'retained-a', name: 'A' }])
		getMiniAppInfo.mockResolvedValue({ path: 'pages/index' })
		list.querySelector('[data-appid="retained-a"]').click()
		await vi.waitFor(() => expect(page.container.openApp).toHaveBeenCalledOnce())
		const options = page.container.openApp.mock.calls[0][0]
		expect(options.appId).toBe('retained-a')
		expect(options.destroy).not.toBe(true)
	})

	it('reveals the navigation after the list leaves its top edge', () => {
		expect(navigation.classList.contains('dimina-app-navigation--visible')).toBe(false)

		list.scrollTop = 24
		list.dispatchEvent(new Event('scroll'))

		expect(navigation.classList.contains('dimina-app-navigation--visible')).toBe(true)
	})

	it('hides the navigation again when the list returns to the top', () => {
		list.scrollTop = 24
		list.dispatchEvent(new Event('scroll'))
		list.scrollTop = 0
		list.dispatchEvent(new Event('scroll'))

		expect(navigation.classList.contains('dimina-app-navigation--visible')).toBe(false)
	})

	it('restores the navigation state when the list page is presented again', () => {
		list.scrollTop = 24
		page.onPresentIn()

		expect(navigation.classList.contains('dimina-app-navigation--visible')).toBe(true)
		expect(page.parent.updateStatusBarColor).toHaveBeenCalledWith('black')
	})
})
