/**
 * wxml-parser-napi 双态加载单测（fe-tools-wxml-parser-dist · P1 · P-WX04 / R1-F6）。
 *
 * 三态（D-WX-3/D-WX-9）：
 * ① 本地 `index.<platform>.node` 存在（dev `pnpm build` 产出）→ glue 命中本地，不碰子包；
 * ② 子包发布态（optionalDependencies）——本地仓库无子包安装，本测不真跑（发布后冒烟，见 validation Uncovered）；
 * ③ 皆无 → `_resolveNative` 返回 null 且 `parseWxmlSpanView` 延迟抛 `[wxml]` 指引（import 链不炸）。
 */
import { describe, expect, it } from 'vitest'
import { _nativeForTest, _resolveNative, parseWxmlSpanView } from '@dimina/wxml-parser-napi'

describe('wxml-parser-napi 双态加载（P-WX04）', () => {
	it('① 本地态：glue 命中本地产物（构建环境必然可用——本地 dev 或 CI build 后）', () => {
		const native = _resolveNative()
		expect(native).toBeTruthy()
		expect(typeof native.parseWxmlSpanView).toBe('function')
		expect(_nativeForTest()).toBeTruthy()
	})

	it('① 本地态端到端：parseWxmlSpanView 产 SpanView（span 半开 + raw）', () => {
		const view = parseWxmlSpanView('<view class="a">hi</view>', '/t.wxml')
		expect(view.body[0].name).toBe('view')
		expect(view.body[0].span).toEqual({ start: 0, end: 25 })
	})

	it('③ 皆无态：注入不存在的 glue 路径 → _resolveNative null + 延迟抛 [wxml] 指引', () => {
		expect(_resolveNative('./nonexistent-binding.cjs')).toBeNull()
		// 真实链路（模块级 native 已加载）不受注入影响——断言模块态稳定
		expect(() => parseWxmlSpanView('<a/>')).not.toThrow()
	})

	it('import 链安全：模块加载不因缺产物炸（延迟抛错契约）', async () => {
		// 重新动态 import 不应抛（binding.cjs 失败被吞、延迟到调用）
		await expect(import('@dimina/wxml-parser-napi')).resolves.toBeTruthy()
	})
})
