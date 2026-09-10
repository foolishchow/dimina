// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { acquireNativePageBackground } from '../src/common/nativePageBackground'

const handles = []
function acquire(onChange, doc = document) {
	const handle = acquireNativePageBackground(doc, onChange)
	handles.push(handle)
	return handle
}
afterEach(() => {
	handles.splice(0).forEach(handle => handle.release())
	document.head.innerHTML = ''
	document.body.removeAttribute('style')
	document.documentElement.removeAttribute('style')
	vi.restoreAllMocks()
})

it('moves the official demo page color without changing business styles or descendants', () => {
	document.head.innerHTML = '<style>body {background-color:#f8f8f8;height:100%} button {background-color:red}</style>'
	document.body.innerHTML = '<button>overlay</button>'
	const handle = acquire()
	expect(handle.snapshot()).toEqual([0, -460552])
	expect(document.defaultView.getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)')
	expect(document.defaultView.getComputedStyle(document.querySelector('button')).backgroundColor).toBe('rgb(255, 0, 0)')
	handle.release()
	expect(document.defaultView.getComputedStyle(document.body).backgroundColor).toBe('rgb(248, 248, 248)')
})

it('shares one override for multiple maps and restores the latest cascade after the last release', () => {
	const source = document.createElement('style')
	source.textContent = 'body {background-color:#123456}'
	document.head.append(source)
	const one = acquire(), two = acquire()
	expect(one.snapshot()).toEqual([0, -15584170])
	source.textContent = 'body {background-color:rgba(255, 0, 0, 0.5)}'
	expect(two.snapshot()).toEqual([0, -2130771968])
	one.release(); one.release()
	expect(document.defaultView.getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)')
	two.release()
	expect(document.defaultView.getComputedStyle(document.body).backgroundColor).toBe('rgba(255, 0, 0, 0.5)')
	const again = acquire()
	expect(again.snapshot()).toEqual([0, -2130771968])
})

it('preserves root image backgrounds instead of silently dropping them', () => {
	document.head.innerHTML = '<style>body {background-color:blue}</style>'
	const handle = acquire()
	expect(handle.snapshot()).toEqual([0, -16776961])
	document.body.style.backgroundImage = 'linear-gradient(red, blue)'
	expect(handle.snapshot()).toBeUndefined()
	expect(document.defaultView.getComputedStyle(document.body).backgroundColor).toBe('rgb(0, 0, 255)')
	expect(document.defaultView.getComputedStyle(document.body).backgroundImage).toContain('linear-gradient')
})

it('shares cached sampling across maps without style reads or writes during 300 layout updates', async () => {
	document.head.innerHTML = '<style>body {background-color:#f8f8f8}</style>'
	const change = vi.fn()
	const one = acquire(change), two = acquire()
	const read = vi.spyOn(document.defaultView, 'getComputedStyle')
	const colors = one.snapshot()
	const initialReads = read.mock.calls.length
	const mutations = new MutationObserver(() => {})
	mutations.observe(document.head, { subtree: true, childList: true, characterData: true })
	for (let i = 0; i < 300; i++) {
		window.dispatchEvent(new Event('scroll'))
		expect(one.snapshot()).toBe(colors)
		expect(two.snapshot()).toBe(colors)
	}
	expect(read).toHaveBeenCalledTimes(initialReads)
	expect(mutations.takeRecords()).toHaveLength(0)
	mutations.disconnect()
	await Promise.resolve()
	expect(change).not.toHaveBeenCalled() // Our own compatibility stylesheet is ignored.
})

it('invalidates all maps once for root and stylesheet changes and stops notifications after release', async () => {
	document.head.innerHTML = '<style>body {background-color:blue} body.dark {background-color:black}</style>'
	const source = document.head.firstElementChild
	const first = vi.fn(), second = vi.fn()
	const one = acquire(first), two = acquire(second)
	one.snapshot()
	document.body.classList.add('dark')
	await Promise.resolve()
	expect(first).toHaveBeenCalledTimes(1)
	expect(second).toHaveBeenCalledTimes(1)
	expect(two.snapshot()).toEqual([0, -16777216])
	one.release()
	source.textContent = 'body {background-color:red}'
	await Promise.resolve()
	expect(first).toHaveBeenCalledTimes(1)
	expect(second).toHaveBeenCalledTimes(2)
	expect(two.snapshot()).toEqual([0, -65536])
	two.release()
	source.textContent = 'body {background-color:green}'
	window.dispatchEvent(new Event('resize'))
	await Promise.resolve()
	expect(second).toHaveBeenCalledTimes(2)
	document.body.classList.remove('dark')
})

it('refreshes on resize and stylesheet load while caching unsupported backgrounds', () => {
	document.body.style.backgroundImage = 'linear-gradient(red, blue)'
	const change = vi.fn(), handle = acquire(change)
	const read = vi.spyOn(document.defaultView, 'getComputedStyle')
	expect(handle.snapshot()).toBeUndefined()
	const initial = read.mock.calls.length
	for (let i = 0; i < 100; i++) expect(handle.snapshot()).toBeUndefined()
	expect(read).toHaveBeenCalledTimes(initial)
	window.dispatchEvent(new Event('resize'))
	handle.snapshot()
	expect(read.mock.calls.length).toBeGreaterThan(initial)
	const link = document.createElement('link')
	link.rel = 'stylesheet'
	document.head.append(link)
	handle.snapshot()
	const afterInsert = read.mock.calls.length
	link.dispatchEvent(new Event('load'))
	handle.snapshot()
	expect(read.mock.calls.length).toBeGreaterThan(afterInsert)
	expect(change).toHaveBeenCalledTimes(3)
})

it('invalidates on system theme changes and removes the shared theme listener on final release', () => {
	const media = new EventTarget()
	const add = vi.spyOn(media, 'addEventListener'), remove = vi.spyOn(media, 'removeEventListener')
	const original = window.matchMedia
	window.matchMedia = vi.fn(() => media)
	try {
		const first = acquire(), second = acquire()
		const read = vi.spyOn(document.defaultView, 'getComputedStyle')
		first.snapshot()
		const initial = read.mock.calls.length
		media.dispatchEvent(new Event('change'))
		second.snapshot()
		expect(read.mock.calls.length).toBeGreaterThan(initial)
		expect(add).toHaveBeenCalledTimes(1)
		first.release()
		expect(remove).not.toHaveBeenCalled()
		second.release()
		expect(remove).toHaveBeenCalledTimes(1)
	} finally { window.matchMedia = original }
})

it('keeps cached colors and cleanup isolated between page documents', () => {
	const frame = document.createElement('iframe')
	document.body.append(frame)
	try {
		const other = frame.contentDocument
		other.body.style.backgroundColor = 'red'
		const one = acquire(), two = acquire(undefined, other)
		expect(one.snapshot()).toEqual([0, 0])
		expect(two.snapshot()).toEqual([0, -65536])
		one.release()
		expect(two.snapshot()).toEqual([0, -65536])
		two.release()
		expect(other.defaultView.getComputedStyle(other.body).backgroundColor).toBe('rgb(255, 0, 0)')
	} finally { frame.remove() }
})
