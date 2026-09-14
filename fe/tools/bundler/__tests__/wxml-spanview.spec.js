/**
 * fe-tools-wxml-bridge · W1 — napi SpanView 契约测试（P-WB01）。
 *
 * 覆盖：node/attr/expr-body span（半开 byte 偏移）、template parts 源码绝对
 * 重映射、纯 expr relative 标记（vendored 行为留档）、特殊节点分类、
 * sourceFile 透传、[wxml] 错误路径、raw 切片派生。
 */
import { describe, expect, it } from 'vitest'
import { parseWxmlSpanView } from '../../wxml-parser-napi/index.js'

describe('wxml SpanView（napi bridge · W1）', () => {
	it('基础元素：type/name/span 半开/raw 切片/selfClosing', () => {
		const view = parseWxmlSpanView('<view class="a">hi</view>', '/pages/i.wxml')
		expect(view.sourceFile).toBe('/pages/i.wxml')
		const el = view.body[0]
		expect(el.type).toBe('element')
		expect(el.name).toBe('view')
		expect(el.span).toEqual({ start: 0, end: 25 })
		expect(el.raw).toBe('<view class="a">hi</view>')
		expect(el.selfClosing).toBe(false)
	})

	it('attr：name/span 含 = 与引号/raw/值三态', () => {
		const el = parseWxmlSpanView('<view class="a" disabled />').body[0]
		expect(el.attrs).toHaveLength(2)
		const [classAttr, disabledAttr] = el.attrs
		expect(classAttr.name).toBe('class')
		expect(classAttr.raw).toBe('class="a"')
		expect(classAttr.value.kind).toBe('static')
		expect(classAttr.value.raw).toBe('a')
		expect(classAttr.value.span).toEqual({ start: 13, end: 14 })
		// 布尔属性 → value null（JSON null 表达 Option::None）
		expect(disabledAttr.value).toBeNull()
		expect(disabledAttr.name).toBe('disabled')
	})

	it('text 插值三态：static / template（parts 源码绝对重映射） / expr（relative 留档）', () => {
		const view = parseWxmlSpanView('<text>hi{{x}}!</text>')
		const textNode = view.body[0].children[0]
		expect(textNode.type).toBe('text')
		const value = textNode.value
		expect(value.kind).toBe('template')
		expect(value.raw).toBe('hi{{x}}!')
		// 源码：<text>hi{{x}}!</text>  → hi=[6,8) x=[10,11)
		expect(value.parts[0]).toMatchObject({ kind: 'static', raw: 'hi', span: { start: 6, end: 8 } })
		expect(value.parts[1]).toMatchObject({ kind: 'expr', raw: 'x', span: { start: 10, end: 11 } })
		expect(value.parts[2]).toMatchObject({ kind: 'static', raw: '!', span: { start: 13, end: 14 } })

		// 纯 expr：vendored relative 标记（W3+ 列级再处理）
		const pureExpr = parseWxmlSpanView('<text>{{c}}</text>').body[0].children[0].value
		expect(pureExpr.kind).toBe('expr')
		expect(pureExpr.raw).toBe('c')
		expect(pureExpr.relative).toBe(true)
	})

	it('特殊节点保留分类：include/import/wxs/templateDef/templateRef/slot', () => {
		const src = '<template name="t"><text>x</text></template><template is="t" /><wxs module="m">v</wxs><include src="/a.wxml" /><import src="/b.wxml" /><slot name="s" />'
		const types = parseWxmlSpanView(src).body.map(n => n.type)
		expect(types).toEqual(['templateDef', 'templateRef', 'wxs', 'include', 'import', 'slot'])
	})

	it('指令：wx:if → directives[0].kind=if + test.raw + span', () => {
		const el = parseWxmlSpanView('<view wx:if="{{show}}">x</view>').body[0]
		expect(el.directives[0]).toMatchObject({
			kind: 'if',
			test: { raw: 'show' },
		})
	})

	it('错误路径：[wxml] + sourceFile + span（R-WB5）', () => {
		let thrown = null
		try {
			parseWxmlSpanView('<view>{{}}</view>', '/bad.wxml') // 空插值 = 表达式错误
		}
		catch (e) {
			thrown = e
		}
		expect(thrown).toBeInstanceOf(Error)
		expect(thrown.message).toMatch(/\[wxml\] parse failed/)
		expect(thrown.message).toMatch(/sourceFile=\/bad\.wxml/)
	})

	it('跨文件/多根：Document.body 多根保留', () => {
		const view = parseWxmlSpanView('<view>1</view><view>2</view>')
		expect(view.body).toHaveLength(2)
	})
})