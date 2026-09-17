/**
 * fe-tools-wxml-refactor · W3 — parser 开关与语义对拍（P-WR04 / A-WR3/A-WR5）。
 */
import { describe, expect, it } from 'vitest'
import {
	parseWxml,
	parseWxmlCheerio,
	parseWxmlNapi,
	resolveWxmlParserEngine,
} from '../src/compiler/view/wxml/parse.ts'
import { compareDocumentsSemantic } from '../src/compiler/view/wxml/common/parity.js'
import { serialize } from '../src/compiler/view/wxml/common/document-ops.js'

describe('WXML_PARSER switch（A-WR3）', () => {
	it('缺省为 napi', () => {
		const prev = process.env.WXML_PARSER
		try {
			delete process.env.WXML_PARSER
			expect(resolveWxmlParserEngine()).toBe('napi')
		}
		finally {
			if (prev === undefined) {
				delete process.env.WXML_PARSER
			}
			else {
				process.env.WXML_PARSER = prev
			}
		}
	})

	it('非法值抛 [wxml]', () => {
		expect(() => resolveWxmlParserEngine({ WXML_PARSER: 'acorn' })).toThrow(/\[wxml\]/)
		expect(() => resolveWxmlParserEngine({ WXML_PARSER: 'acorn' })).toThrow(/napi\|cheerio/)
	})

	it('显式 cheerio / napi 可选', () => {
		expect(resolveWxmlParserEngine({ WXML_PARSER: 'cheerio' })).toBe('cheerio')
		expect(resolveWxmlParserEngine({ WXML_PARSER: 'napi' })).toBe('napi')
	})
})

describe('napi ↔ cheerio 语义对拍（P-WR04）', () => {
	const fixtures = [
		'<view class="a">hi</view>',
		'<view class="a" wx:if="{{show}}" disabled>x</view>',
		'<view wx:for="{{list}}" wx:for-item="it" wx:key="id">{{it}}</view>',
		'<text>hi{{x}}!</text>',
		'<text>{{c}}</text>',
		'<template name="t"><text>x</text></template><template is="t" data="{{d}}" />',
		'<wxs module="m">var a=1;</wxs><include src="/a.wxml" /><import src="/b.wxml" /><slot name="s" />',
		'<view hidden="{{h}}">x</view>',
	]

	for (const src of fixtures) {
		it(`serialize 等价：${src.slice(0, 48)}`, () => {
			expect(serialize(parseWxmlNapi(src))).toBe(serialize(parseWxmlCheerio(src)))
		})

		it(`语义对拍：${src.slice(0, 48)}`, () => {
			const napiDoc = parseWxmlNapi(src, { sourceFile: '/t.wxml' })
			const cheerioDoc = parseWxmlCheerio(src, { sourceFile: '/t.wxml' })
			const result = compareDocumentsSemantic(napiDoc, cheerioDoc)
			expect(result.ok, result.reason || result.path).toBe(true)
			expect(napiDoc.body[0]?.type || napiDoc.body.length).toBeTruthy()
			if (napiDoc.body.some(n => n.type === 'element' && (n.directives?.length > 0))) {
				expect(napiDoc.body.find(n => n.directives?.length)?.directives[0].kind).toBeTruthy()
			}
		})
	}

	it('napi 元素保留 directives；cheerio 可为 []', () => {
		const napiDoc = parseWxmlNapi('<view wx:if="{{show}}">x</view>')
		const cheerioDoc = parseWxmlCheerio('<view wx:if="{{show}}">x</view>')
		expect(napiDoc.body[0].directives[0].kind).toBe('if')
		expect(cheerioDoc.body[0].directives).toEqual([])
		expect(cheerioDoc.body[0].attrs.some(a => a.name === 'wx:if')).toBe(true)
		expect(napiDoc.body[0].attrs.some(a => a.name === 'wx:if')).toBe(true)
	})

	it('parseWxml 走开关（默认 napi 时含 directives）', () => {
		const prev = process.env.WXML_PARSER
		try {
			delete process.env.WXML_PARSER
			const doc = parseWxml('<view wx:if="{{1}}">x</view>')
			expect(doc.body[0].directives?.[0]?.kind).toBe('if')
		}
		finally {
			if (prev === undefined) {
				delete process.env.WXML_PARSER
			}
			else {
				process.env.WXML_PARSER = prev
			}
		}
	})
})
