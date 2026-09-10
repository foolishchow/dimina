import { describe, expect, it } from 'vitest'
import { SDK_ASSET_PATHS, createHostPageHtml, createPageFrameHtml } from '../src/common/dev-host.js'

// dmcc-dev-server 契约 v1 §3：内置宿主页生成（占位替换 / sdk 资产引用 / 宿主逻辑）。

describe('SDK_ASSET_PATHS', () => {
	it('为 container-sdk 预构建资产定义稳定的路由路径', () => {
		expect(SDK_ASSET_PATHS).toEqual({
			indexJs: '/sdk/index.js',
			indexCss: '/sdk/index.css',
			pageFrameJs: '/sdk/pageFrame.js',
			pageFrameCss: '/sdk/pageFrame.css',
			serviceJs: '/sdk/service.js',
			mittJs: '/sdk/mitt.js',
		})
		expect(Object.isFrozen(SDK_ASSET_PATHS)).toBe(true)
	})
})

describe('createHostPageHtml — 参数校验', () => {
	it('拒绝空 appId', () => {
		expect(() => createHostPageHtml({ appId: '', wsPath: '/ws' })).toThrow(TypeError)
	})

	it('拒绝非 / 开头的 wsPath', () => {
		expect(() => createHostPageHtml({ appId: 'wx123', wsPath: 'ws' })).toThrow(TypeError)
	})
})

describe('createHostPageHtml — 占位替换与资源引用', () => {
	const html = createHostPageHtml({ appId: 'wx_test_app', wsPath: '/ws' })

	it('注入 appId（title 转义 + 脚本常量 + ws 订阅）', () => {
		expect(html).toContain('<title>dmcc dev · wx_test_app</title>')
		expect(html).toContain('const appId = params.get(\'appId\') || "wx_test_app"')
		expect(html).toContain("JSON.stringify({ type: 'subscribe', appId })")
	})

	it('注入 wsPath 并拼接到同端口 ws 地址', () => {
		expect(html).toContain("+ '://' + location.host")
		expect(html).toContain('+ "/ws",')
	})

	it('引用 sdk 预构建资产（index.js 入口 + index.css 样式）', () => {
		expect(html).toContain(`import { createContainer, createDefaultShell } from '${SDK_ASSET_PATHS.indexJs}'`)
		expect(html).toContain(`<link rel="stylesheet" href="${SDK_ASSET_PATHS.indexCss}">`)
	})

	it('宿主页自带 html/body/#app reset，并接入 createDefaultShell', () => {
		expect(html).toContain('html, body, #app')
		expect(html).toContain('createDefaultShell({ mount })')
		expect(html).toContain('shell,')
	})

	it('提供 mitt import map（sdk external 依赖的浏览器解析）', () => {
		expect(html).toContain('type="importmap"')
		expect(html).toContain(`"mitt": "${SDK_ASSET_PATHS.mittJs}"`)
	})

	it('HTML 上下文（title）转义，脚本字符串上下文（JSON 字面量）安全注入', () => {
		const evil = createHostPageHtml({ appId: 'wx"><script>alert(1)</script>', wsPath: '/ws' })
		// title 是 HTML 上下文：必须转义，杜绝标签注入
		expect(evil).toContain('dmcc dev · wx&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
		expect(evil).not.toContain('<title>dmcc dev · wx"><script>alert(1)</script></title>')
		// 脚本内 appId 经 JSON.stringify 成为 JS 字符串字面量：不参与 HTML 解析，
		// 保留原文是安全注入（浏览器不会把字符串内容当标签执行）；
		// 生成源码中引号以 \\" 转义，<> 保持原文。
		expect(evil).toContain('|| "wx\\"><script>alert(1)</script>"')
	})
})

describe('createHostPageHtml — 宿主逻辑', () => {
	const html = createHostPageHtml({ appId: 'wx_test_app', wsPath: '/ws' })

	it('经公开 API 直开目标 app（openApp + ?path= 入口）', () => {
		expect(html).toContain('import { createContainer, createDefaultShell } from')
		expect(html).toContain("params.get('appId')")
		expect(html).toContain("params.get('path')")
		expect(html).toContain('container.openApp({')
		expect(html).toContain('destroy: true')
		expect(html).toContain("resourceBaseUrl: '/'")
	})

	it('ws 消息按 reloadLevel 分发：L0 → 整页重启，L1 → relaunch，L2/L3 → sendDevCommand', () => {
		expect(html).toContain('message.reloadLevel === \'L0\'')
		expect(html).toContain('window.location.reload()')
		expect(html).toContain('relaunchCurrentPage()')
		expect(html).toContain("message.reloadLevel === 'L2' || message.reloadLevel === 'L3'")
		expect(html).toContain("container.sendDevCommand('enableDevHmr', {})")
		expect(html).toContain("container.sendDevCommand('hmr'")
		expect(html).toContain("result.status === 'fallback'")
		expect(html).toContain("message.type === 'build:error'")
	})

	it('不含应用列表壳（最小宿主，列表壳保留在 container demo）', () => {
		expect(html).not.toContain('appList')
		expect(html).not.toContain('AppList')
	})
})
describe('createPageFrameHtml', () => {
	it('加载 sdk pageFrame 资产并提供 mitt import map', () => {
		const frame = createPageFrameHtml()
		expect(frame).toContain(`href="${SDK_ASSET_PATHS.pageFrameCss}"`)
		expect(frame).toContain(`src="${SDK_ASSET_PATHS.pageFrameJs}"`)
		expect(frame).toContain(`"mitt": "${SDK_ASSET_PATHS.mittJs}"`)
		expect(frame).toContain('class="dd-page"')
	})
})
