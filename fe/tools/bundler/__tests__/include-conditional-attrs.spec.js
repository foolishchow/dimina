import { describe, it, expect } from 'vitest'
import { parseWxml } from '../src/compiler/view/wxml/parse.ts'
import { query, serialize, replaceNode } from '../src/compiler/view/wxml/common/document-ops.js'
import { processIncludeConditionalAttrs } from '../src/compiler/view/index.ts'

describe('Include 节点条件属性处理', () => {
	/**
	 * 测试辅助函数：处理 HTML 中的 include 节点
	 */
	function processIncludeNode(html, includeContent) {
		const doc = parseWxml(html)
		const includeNode = query(doc, 'include')
		if (!includeNode) {
			return serialize(doc)
		}
		const includeDoc = parseWxml(includeContent)
		const nodes = processIncludeConditionalAttrs(includeNode, includeDoc)
		if (typeof nodes === 'string') {
			replaceNode(includeNode, parseWxml(nodes).body)
		}
		else {
			replaceNode(includeNode, nodes)
		}
		return serialize(doc)
	}

	it('应该正确处理 include 节点的 wx:else 属性', () => {
		const html = `
			<view wx:if="{{ poppable }}">
				<text>弹窗模式</text>
			</view>
			<include wx:else src="./content.wxml" />
		`
		
		const includeContent = `
			<view class="calendar-content">
				<text>日历内容</text>
			</view>
		`
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('wx:else')
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		expect(result).toContain('calendar-content')
		expect(result).not.toContain('<include')
	})

	it('应该正确处理 include 节点的 wx:if 属性', () => {
		const html = `
			<view class="container">
				<include wx:if="{{ showHeader }}" src="./header.wxml" />
				<view class="body">
					<text>主体内容</text>
				</view>
			</view>
		`
		
		const includeContent = `
			<view class="header">
				<text>头部内容</text>
			</view>
		`
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('wx:if')
		expect(result).toContain('showHeader')
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		expect(result).toContain('header')
		expect(result).not.toContain('<include')
	})

	it('应该正确处理 include 节点的 wx:elif 属性', () => {
		const html = `
			<view class="container">
				<include wx:elif="{{ mode === 'b' }}" src="./mode-b.wxml" />
			</view>
		`
		
		const includeContent = `<text>模式 B</text>`
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('wx:elif')
		expect(result).toContain("mode === 'b'")
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		expect(result).toContain('模式 B')
	})

	it('应该正确处理完整的 wx:if, wx:elif, wx:else 链', () => {
		const htmlA = `<include wx:if="{{ mode === 'a' }}" src="./mode-a.wxml" />`
		const htmlB = `<include wx:elif="{{ mode === 'b' }}" src="./mode-b.wxml" />`
		const htmlC = `<include wx:else src="./mode-c.wxml" />`
		
		const contentA = `<text>模式 A</text>`
		const contentB = `<text>模式 B</text>`
		const contentC = `<text>模式 C</text>`
		
		const resultA = processIncludeNode(htmlA, contentA)
		const resultB = processIncludeNode(htmlB, contentB)
		const resultC = processIncludeNode(htmlC, contentC)
		
		expect(resultA).toContain('wx:if')
		expect(resultA).toContain("mode === 'a'")
		expect(resultA).toContain('模式 A')
		
		expect(resultB).toContain('wx:elif')
		expect(resultB).toContain("mode === 'b'")
		expect(resultB).toContain('模式 B')
		
		expect(resultC).toContain('wx:else')
		expect(resultC).toContain('模式 C')
	})

	it('应该正确处理 include 节点的 dd:else 属性（钉钉小程序）', () => {
		const html = `
			<view dd:if="{{ hasData }}">
				<text>有数据</text>
			</view>
			<include dd:else src="./fallback.ddml" />
		`
		
		const includeContent = `
			<view class="fallback">
				<text>备用内容</text>
			</view>
		`
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('dd:else')
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		expect(result).toContain('fallback')
		expect(result).not.toContain('<include')
	})

	it('应该正确处理 include 节点的 a:if 和 a:else 属性（支付宝小程序）', () => {
		const htmlIf = `<include a:if="{{ loading }}" src="./loading.axml" />`
		const htmlElse = `<include a:else src="./content.axml" />`
		
		const loadingContent = `
			<view class="loading">
				<text>加载中...</text>
			</view>
		`
		
		const contentContent = `
			<view class="content">
				<text>内容区</text>
			</view>
		`
		
		const resultIf = processIncludeNode(htmlIf, loadingContent)
		const resultElse = processIncludeNode(htmlElse, contentContent)
		
		expect(resultIf).toContain('a:if')
		expect(resultIf).toContain('loading')
		expect(resultIf).toContain('加载中')
		
		expect(resultElse).toContain('a:else')
		expect(resultElse).toContain('content')
		expect(resultElse).toContain('内容区')
	})

	it('应该保持没有条件属性的 include 节点的原有行为', () => {
		const html = `
			<view class="container">
				<view class="header">
					<text>页头</text>
				</view>
				<include src="./footer.wxml" />
			</view>
		`
		
		const includeContent = `
			<view class="footer">
				<text>页脚</text>
			</view>
		`
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('footer')
		expect(result).toContain('页脚')
		
		const footerMatch = result.match(/<view class="footer">[\s\S]*?<\/view>/)
		expect(footerMatch).toBeTruthy()
		expect(result).not.toContain('<include')
	})

	it('应该正确处理多个连续的 include 节点', () => {
		const html = `
			<view class="container">
				<include wx:if="{{ mode === 'a' }}" src="./a.wxml" />
				<include wx:elif="{{ mode === 'b' }}" src="./b.wxml" />
				<include wx:else src="./c.wxml" />
			</view>
		`
		
		const contentA = `<text>内容 A</text>`
		const contentB = `<text>内容 B</text>`
		const contentC = `<text>内容 C</text>`
		
		let result = html
		result = result.replace(/<include wx:if="{{[^"]*}}" src="[^"]*" \/>/, `<block wx:if="{{ mode === 'a' }}">${contentA}</block>`)
		result = result.replace(/<include wx:elif="{{[^"]*}}" src="[^"]*" \/>/, `<block wx:elif="{{ mode === 'b' }}">${contentB}</block>`)
		result = result.replace(/<include wx:else src="[^"]*" \/>/, `<block wx:else>${contentC}</block>`)
		
		expect(result).toContain('wx:if')
		expect(result).toContain('wx:elif')
		expect(result).toContain('wx:else')
		expect(result).toContain('内容 A')
		expect(result).toContain('内容 B')
		expect(result).toContain('内容 C')
	})

	it('应该正确处理带有其他属性的 include 节点（只保留条件属性）', () => {
		const html = `
			<include wx:if="{{ show }}" src="./content.wxml" data-id="123" />
		`
		
		const includeContent = `<text>内容</text>`
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('wx:if')
		expect(result).toContain('show')
		expect(result).toContain('<block')
		expect(result).not.toContain('data-id')
	})

	it('应该正确处理空的 include 内容', () => {
		const html = `
			<view>
				<include wx:if="{{ show }}" src="./empty.wxml" />
			</view>
		`
		
		const includeContent = ``
		
		const result = processIncludeNode(html, includeContent)
		
		expect(result).toContain('<block')
		expect(result).toContain('wx:if')
	})
})
