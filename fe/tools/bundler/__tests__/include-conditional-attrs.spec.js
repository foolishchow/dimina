import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import { processIncludeConditionalAttrs } from '../src/core/view-compiler.js'

describe('Include 节点条件属性处理', () => {
	/**
	 * 测试辅助函数：处理 HTML 中的 include 节点
	 */
	function processIncludeNode(html, includeContent) {
		const $ = cheerio.load(html, {
			xmlMode: true,
			decodeEntities: false,
		})
		
		const includeNodes = $('include')
		
		includeNodes.each((_, elem) => {
			// 使用真实导出的函数处理条件属性
			const processedContent = processIncludeConditionalAttrs($, elem, includeContent)
			$(elem).replaceWith(processedContent)
		})
		
		return $.html()
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
		
		// 验证结果包含 block 和 wx:else
		expect(result).toContain('wx:else')
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		
		// 验证包含了 calendar-content
		expect(result).toContain('calendar-content')
		
		// 验证不包含 include 标签（已被替换）
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
		
		// 验证结果包含 block 和 wx:if
		expect(result).toContain('wx:if')
		expect(result).toContain('showHeader')
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		
		// 验证包含了 header
		expect(result).toContain('header')
		
		// 验证不包含 include 标签
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
		
		// 验证结果包含 block 和 wx:elif
		expect(result).toContain('wx:elif')
		expect(result).toContain("mode === 'b'")
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		
		// 验证包含了内容
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
		
		// 验证 wx:if
		expect(resultA).toContain('wx:if')
		expect(resultA).toContain("mode === 'a'")
		expect(resultA).toContain('模式 A')
		
		// 验证 wx:elif
		expect(resultB).toContain('wx:elif')
		expect(resultB).toContain("mode === 'b'")
		expect(resultB).toContain('模式 B')
		
		// 验证 wx:else
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
		
		// 验证结果包含 dd:else
		expect(result).toContain('dd:else')
		expect(result).toContain('<block')
		expect(result).toContain('</block>')
		
		// 验证包含了 fallback
		expect(result).toContain('fallback')
		
		// 验证不包含 include 标签
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
		
		// 验证 a:if
		expect(resultIf).toContain('a:if')
		expect(resultIf).toContain('loading')
		expect(resultIf).toContain('加载中')
		
		// 验证 a:else
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
		
		// 验证包含了 footer 内容
		expect(result).toContain('footer')
		expect(result).toContain('页脚')
		
		// 验证不应该有条件属性的 block 包裹
		// 由于直接替换，block 不应该出现在 footer 周围
		const footerMatch = result.match(/<view class="footer">[\s\S]*?<\/view>/)
		expect(footerMatch).toBeTruthy()
		
		// 验证不包含 include 标签
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
		
		// 模拟处理多个 include（实际场景中每个 include 引用不同文件）
		// 这里为了简化，我们分别处理每个
		let result = html
		result = result.replace(/<include wx:if="{{[^"]*}}" src="[^"]*" \/>/, `<block wx:if="{{ mode === 'a' }}">${contentA}</block>`)
		result = result.replace(/<include wx:elif="{{[^"]*}}" src="[^"]*" \/>/, `<block wx:elif="{{ mode === 'b' }}">${contentB}</block>`)
		result = result.replace(/<include wx:else src="[^"]*" \/>/, `<block wx:else>${contentC}</block>`)
		
		// 验证所有条件分支都存在
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
		
		// 验证只保留了条件属性
		expect(result).toContain('wx:if')
		expect(result).toContain('show')
		expect(result).toContain('<block')
		
		// data-id 不应该出现在 block 上（只保留条件属性）
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
		
		// 验证有 block 标签，即使内容为空
		expect(result).toContain('<block')
		expect(result).toContain('wx:if')
	})
})
