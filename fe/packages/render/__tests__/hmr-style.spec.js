import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyStyleReload, applyStyleReloadBatch, createStyleRegistry, registerStyle, styleKey } from '../src/core/hmr-style.js'

// A3 契约 technical-design §2：L2 CSS hot swap 事务（load/commit/rollback）。

function appendLink(url) {
	const el = document.createElement('link')
	el.rel = 'stylesheet'
	el.href = url
	document.head.append(el)
	return el
}

function latestLink() {
	const links = document.head.querySelectorAll('link')
	return links[links.length - 1]
}

let registry

beforeEach(() => {
	document.head.querySelectorAll('link').forEach(el => el.remove())
	registry = createStyleRegistry()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('styleKey / registerStyle', () => {
	it('区分 app 全局与页面资源（单 app 帧内 scope+pagePath 唯一）', () => {
		expect(styleKey({ scope: 'app' })).toBe('style:app')
		expect(styleKey({ scope: 'page', pagePath: 'pages/index/index' })).toBe('style:page:pages/index/index')
	})

	it('loader 登记后 registry 记录 url 与元素', () => {
		const el = appendLink('/wx1/main/app.css')
		registerStyle(registry, { scope: 'app', appId: 'wx1', url: '/wx1/main/app.css', el })
		expect(registry.get('style:app')).toMatchObject({ url: '/wx1/main/app.css', el })
	})
})

describe('applyStyleReload — 事务', () => {
	it('未登记资源拒绝替换且不插入任何 link', async () => {
		const before = document.head.querySelectorAll('link').length
		const result = await applyStyleReload(registry, { scope: 'app', buildId: 1 })
		expect(result).toEqual({ applied: false, reason: 'unknown-style-resource' })
		expect(document.head.querySelectorAll('link')).toHaveLength(before)
	})

	it('成功替换：cache-bust 新 link onload 后移除旧 link 并更新 registry', async () => {
		const oldEl = appendLink('/wx1/main/app.css')
		registerStyle(registry, { scope: 'app', appId: 'wx1', url: '/wx1/main/app.css', el: oldEl })

		const pending = applyStyleReload(registry, { scope: 'app', buildId: 5 })
		const fresh = latestLink()
		expect(fresh).not.toBe(oldEl)
		expect(fresh.getAttribute('href')).toBe('/wx1/main/app.css?__dmcc_hmr=5')

		fresh.dispatchEvent(new Event('load'))
		await expect(pending).resolves.toEqual({ applied: true })

		expect(oldEl.isConnected).toBe(false)
		expect(fresh.isConnected).toBe(true)
		expect(registry.get('style:app').el).toBe(fresh)
	})

	it('URL 已含 query 时用 & 拼 cache-bust 参数', async () => {
		const oldEl = appendLink('/wx1/main/app.css?v=2')
		registerStyle(registry, { scope: 'app', url: '/wx1/main/app.css?v=2', el: oldEl })

		const pending = applyStyleReload(registry, { scope: 'app', buildId: 7 })
		expect(latestLink().getAttribute('href')).toBe('/wx1/main/app.css?v=2&__dmcc_hmr=7')
		latestLink().dispatchEvent(new Event('load'))
		await pending
	})

	it('失败回滚：新 link onerror 后移除新 link、保留旧 link、registry 不变', async () => {
		const oldEl = appendLink('/wx1/pages/index_index.css')
		registerStyle(registry, { scope: 'page', pagePath: 'pages/index/index', url: '/wx1/pages/index_index.css', el: oldEl })

		const pending = applyStyleReload(registry, { scope: 'page', pagePath: 'pages/index/index', buildId: 3 })
		const fresh = latestLink()
		fresh.dispatchEvent(new Event('error'))
		await expect(pending).resolves.toEqual({ applied: false, reason: 'style-load-failed' })

		expect(fresh.isConnected).toBe(false)
		expect(oldEl.isConnected).toBe(true)
		expect(registry.get('style:page:pages/index/index').el).toBe(oldEl)
	})

	it('加载超时按失败处理（不永久挂起）', async () => {
		vi.useFakeTimers()
		const oldEl = appendLink('/wx1/main/app.css')
		registerStyle(registry, { scope: 'app', url: '/wx1/main/app.css', el: oldEl })

		const pending = applyStyleReload(registry, { scope: 'app', buildId: 2 })
		await vi.advanceTimersByTimeAsync(10001)
		await expect(pending).resolves.toEqual({ applied: false, reason: 'style-load-failed' })
		expect(oldEl.isConnected).toBe(true)
	})
})

describe('applyStyleReloadBatch — 最终一致批量重载', () => {
	it('app + 每个受影响页面逐项执行，单项失败不影响其余', async () => {
		const appEl = appendLink('/wx1/main/app.css')
		registerStyle(registry, { scope: 'app', url: '/wx1/main/app.css', el: appEl })
		const pageEl = appendLink('/wx1/pages_index_index.css')
		registerStyle(registry, { scope: 'page', pagePath: 'pages/index/index', url: '/wx1/pages_index_index.css', el: pageEl })
		// pages/other/other 未登记 -> unknown，但不阻断

		const pending = applyStyleReloadBatch(registry, {
			buildId: 9,
			affectedPages: ['pages/index/index', 'pages/other/other'],
		})

		// 依次触发每个新 link load（app 先、页面后）
		latestLink().dispatchEvent(new Event('load'))
		await Promise.resolve()
		latestLink().dispatchEvent(new Event('load'))
		await Promise.resolve()
		latestLink().dispatchEvent(new Event('load'))
		const results = await pending

		expect(results).toEqual([
			{ scope: 'app', applied: true },
			{ scope: 'page', pagePath: 'pages/index/index', applied: true },
			{ scope: 'page', pagePath: 'pages/other/other', applied: false, reason: 'unknown-style-resource' },
		])
		expect(appEl.isConnected).toBe(false)
		expect(pageEl.isConnected).toBe(false)
	})
})