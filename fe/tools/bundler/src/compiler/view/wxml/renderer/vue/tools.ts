import * as htmlparser2 from 'htmlparser2'
import { compileTemplate } from '@vue/compiler-sfc'
import type { CompilerOptions } from '@vue/compiler-sfc'
import { getTemplateDirectiveName } from '../../../../core/compatibility.ts'
import { parseBindings } from '../../../../core/expression-parser.ts'
import { createLineSourcemap } from '../../../../core/sourcemap.ts'
import { tagWhiteList, transformRpx } from '../../../../../shared/utils.ts'
import { attrsToRecord } from '../../common/document.ts'
import {
	append,
	attrsRecord,
	createElement,
	getAttr,
	getChildren,
	getTagName,
	insertBefore,
	queryAll,
	removeAttr,
	serialize,
	setAttr,
} from '../../common/document-ops.ts'
import { parseWxml } from '../../parse.ts'
import type { WxmlNode, Attr } from '../../common/document.ts'
import { enableSourcemap, templateRenderCache } from './state.ts'
import { errorMessage } from '../../../../../shared/utils.ts'
import {
	transformTextInterpolation,
	isWrappedByBraces,
	parseBraceExp,
	parseSafeBraceExp,
	parseForExp,
	getForItemName,
	getForIndexName,
	parseKeyExpression,
	parseClassRules,
	parseTemplateDataExp,
	escapeQuotes,
	insertWxsToRenderResult,
} from './live.ts'
export function getTemplateCompilerOptions(scopeId: string): CompilerOptions {
	return {
		// https://template-explorer.vuejs.org/
		prefixIdentifiers: true,
		hoistStatic: false,
		cacheHandlers: true,
		scopeId,
		mode: 'function',
		inline: true,
		// transTag has already rewritten registered built-ins and custom
		// components to the reserved dd-* namespace. Every remaining unknown WXML
		// tag follows glass-easel's unused-native-node fallback instead of Vue's
		// component resolution.
		isCustomElement: (tag: string) => !tag.startsWith('dd-'),
	}
}

/**
 * 编译单个模板模块（<template name>）的 render 结果，并跨页面复用。
 * 被多个页面 import 的同一份模板文件在每个页面里会产出完全相同的
 * compileTemplate codegen 与 insertWxsToRenderResult 结果，只需计算一次。
 * moduleId 不入 key：function 模式下 scopeId 不进入产物（见 templateRenderCache 处说明）。
 */
export function compileTemplateModuleRender(tm: { path: string; tpl: string; sourceInfo?: { path: string; content: string; startLine?: number } | null }, moduleId: string, scriptModule: Array<{ path: string; code: string; originalName?: string }>, scriptRes: Map<string, string>) {
	const scriptSig = scriptModule.map(sm => `${sm.path}\u0000${sm.originalName ?? ''}`).join('\u0001')
	// sourceInfo.content 是 sourceInfo.path 对应文件的原文，在同一个 worker 任务内该文件
	// 不会被改写（与 compileResCache 直接按 module.path 做键的既有假设一致），path 已经
	// 唯一决定 content，不必把可能上百 KB 的原文本身也塞进 key（那样会随具名模板数线性放大）。
	const sourceSig = tm.sourceInfo
		? `${tm.sourceInfo.path}\u0000${tm.sourceInfo.startLine ?? ''}`
		: ''
	const cacheKey = `${tm.path}\u0002${sourceSig}\u0002${scriptSig}\u0002${tm.tpl}`
	const cached = templateRenderCache.get(cacheKey)
	if (cached) {
		// 跳过 insertWxsToRenderResult 时，补上它对 scriptRes 的登记副作用
		for (const sm of scriptModule) {
			if (!scriptRes.has(sm.path)) {
				scriptRes.set(sm.path, sm.code)
			}
		}
		return cached
	}
	const compiledTemplate = compileTemplate({
		source: tm.tpl,
		filename: tm.path,
		id: `data-v-${moduleId}`,
		scoped: true,
		inMap: enableSourcemap && tm.sourceInfo
			? createLineSourcemap(tm.tpl, tm.sourceInfo.path, tm.sourceInfo.content, tm.sourceInfo.startLine ?? 1)
			: undefined,
		compilerOptions: getTemplateCompilerOptions(`data-v-${moduleId}`) as Parameters<typeof compileTemplate>[0]['compilerOptions'],
	})
	const result = {
		path: tm.path,
		...insertWxsToRenderResult!(compiledTemplate.code, scriptModule, scriptRes, tm.path, compiledTemplate.map),
	}
	templateRenderCache.set(cacheKey, result)
	return result
}

const DIMINA_SLOT_GROUP_TAG = 'dimina-slot-group'
const DIMINA_FOR_SCOPE_TAG = 'dimina-for-scope'
function asAttrsRecord(attrs: unknown): Record<string, string> {
	if (!attrs) {
		return {}
	}
	if (Array.isArray(attrs)) {
		return attrsToRecord(attrs as Attr[])
	}
	return attrs as Record<string, string>
}
export function getDirectiveAttributeNames(attrs: unknown, suffixes: string[]): string[] {
	const record = asAttrsRecord(attrs)
	const directiveNames = new Set(suffixes.map((suffix: string) => suffix.replace(/^:/, '')))
	return Object.keys(record || {}).filter(name => directiveNames.has(getTemplateDirectiveName(name)!))
}
export function hasForAndIf(attrs: unknown) {
	return getDirectiveAttributeNames(attrs, [':for', ':for-items']).length > 0
		&& getDirectiveAttributeNames(attrs, [':if']).length > 0
}

/**
 * @param {object} document 标准 Document 或子树根
 * @param {object} [components]
 */
export function groupDuplicateNamedSlots(document: Parameters<typeof queryAll>[0], components: Record<string, unknown> | null | undefined) {
	const slotHosts = queryAll(document, '*').filter((element) => {
		const tag = getTagName(element)
		return tag === 'component' || (tag !== null && Boolean(components?.[tag]))
	})

	for (const host of slotHosts) {
		const groups = new Map()
		for (const child of getChildren(host)) {
			const slotName = getAttr(child, 'slot')
			if (!slotName) continue
			const group = groups.get(slotName) || []
			group.push(child)
			groups.set(slotName, group)
		}

		for (const [slotName, nodes] of groups) {
			// 单个普通插槽继续使用原转换，保留既有 v-if/fallback 行为。
			if (nodes.length === 1 && !hasForAndIf(attrsRecord(nodes[0]))) {
				continue
			}

			const wrapper = createElement({ name: DIMINA_SLOT_GROUP_TAG, attrs: [] })
			setAttr(wrapper, 'name', slotName)
			insertBefore(nodes[0], wrapper)
			for (const node of nodes) {
				removeAttr(node, 'slot')
				append(wrapper, node)
			}
		}
	}
}
export function wrapForIfScopes(document: Parameters<typeof queryAll>[0]) {
	const nodes = queryAll(document, '*')
	for (const node of nodes) {
		const tag = getTagName(node)
		const record = attrsRecord(node)
		if (tag === DIMINA_FOR_SCOPE_TAG || !hasForAndIf(record)) {
			continue
		}

		const attrsToMove = getDirectiveAttributeNames(record, [
			':for',
			':for-items',
			':for-item',
			':for-index',
			':key',
		])
		const wrapper = createElement({ name: DIMINA_FOR_SCOPE_TAG, attrs: [] })
		for (const name of attrsToMove) {
			setAttr(wrapper, name, record[name])
			removeAttr(node, name)
		}
		insertBefore(node, wrapper)
		append(wrapper, node)
	}
}

/**
 * 就地改写标准 Document（§4.5）。
 * 签名：(document, components)；兼容误传旧 root 时忽略第二参中的节点。
 */
export function normalizeTemplateDom(document: Parameters<typeof queryAll>[0], rootOrComponents: WxmlNode | Record<string, unknown> | null | undefined, maybeComponents?: Record<string, unknown> | null | undefined) {
	let components: Record<string, unknown> = {}
	if (maybeComponents !== undefined) {
		components = maybeComponents || {}
	}
	else if (rootOrComponents && typeof rootOrComponents === 'object') {
		const looksLikeNode = Array.isArray(rootOrComponents.body)
			|| Array.isArray(rootOrComponents.children)
			|| typeof rootOrComponents.type === 'string'
		if (!looksLikeNode) {
			components = rootOrComponents
		}
	}
	groupDuplicateNamedSlots(document, components)
	wrapForIfScopes(document)
}

/** 过渡薄封装：string → Document normalize → string；正式编译路径不依赖 */
	export function normalizeTemplateSyntax(html: string, components?: Record<string, unknown> | null | undefined): string {
	const document = parseWxml(html)
	normalizeTemplateDom(document, components)
	return serialize(document)
}
export function transHtmlTag(html: string, res: string[], components: Record<string, unknown> | null | undefined, componentPlaceholder: Record<string, unknown> | null | undefined) {
	const attrsList: Array<Record<string, string>> = []
	const parser = new htmlparser2.Parser(
		{
			onopentag(tag: string, attrs: Record<string, string>) {
				attrsList.push(attrs)
				res.push(transTag({ isStart: true, tag, attrs, components, componentPlaceholder }))
			},
			ontext(text) {
				res.push(transformTextInterpolation!(text))
			},
			onclosetag(tag: string) {
				res.push(transTag({ tag, attrs: attrsList.pop(), components }))
			},
			onerror(error: unknown) {
				console.error(error)
			},
		},
		{ xmlMode: true },
	)

	parser.write(html)
	parser.end()
}

/**
 * 处理组件标签
 * @param {*} opts
 */
export function transTag(opts: { isStart?: boolean; tag: string; attrs?: Record<string, string> | null; components?: Record<string, unknown> | null; componentPlaceholder?: Record<string, unknown> | null }) {
	const { isStart, tag, attrs, components } = opts
	let res
	if (tag === DIMINA_SLOT_GROUP_TAG) {
		if (isStart) {
			return `<template ${generateSlotDirective((attrs?.name as string) ?? '')}>`
		}
		return '</template>'
	}
	else if (tag === DIMINA_FOR_SCOPE_TAG) {
		res = 'template'
	}
	else if (tag === 'slot') {
		// https://cn.vuejs.org/guide/components/slots.html#slots
		// 保留插槽节点和自定义组件节点
		res = tag
	}
	else if (components && components[tag]) {
		res = `dd-${tag}`
	}
	else if (tag === 'component') {
		// 动态组件
		res = tag
	}
	else if (tagWhiteList.includes(tag)) {
		res = `dd-${tag}`
	}
	else {
		// glass-easel: local/global usingComponents resolution wins; an
		// undeclared tag is kept as an unused native node with its original name.
		res = tag
	}

	let tagRes
	const propsAry = isStart ? getProps(attrs ?? {}, tag, components) : []
	// 多 slot 支持，目前在组件定义时的选项中 multipleSlots 未生效
	const multipleSlots = attrs?.slot ?? ''
	if (attrs?.slot) {
		// 检查是否为动态插槽（slot 属性值被 {{}} 包裹）
		const isDynamicSlot = isWrappedByBraces!(multipleSlots)

		if (isStart) {
			// 如果存在 if/else 属性，则需要转移到 template 中
			const withVIf = []
			const withoutVIf = []

			for (let i = 0; i < propsAry.length; i++) {
				const prop = propsAry[i]
				if (prop.includes('v-if') || prop.includes('v-else-if') || prop.includes('v-else')) {
					withVIf.push(prop)
				}
				else if(!prop.includes('slot')){
					withoutVIf.push(prop)
				}
			}
			const vIfProps = withVIf.length > 0 ? `${withVIf.join(' ')} ` : ''
			const vOtherProps = withoutVIf.length > 0 ? ` ${withoutVIf.join(' ')}` : ''

			// 构建共同的 template 内容
			const templateContent = `<template ${vIfProps}${generateSlotDirective(multipleSlots)}><${res}${vOtherProps}>`

			if (isDynamicSlot) {
				// 动态插槽无法正常编译，添加 dd-block 包装器。
				// Error: Codegen node is missing for element/if/for node. Apply appropriate transforms first.
				tagRes = `<dd-block>${templateContent}`
			} else {
				tagRes = templateContent
			}
		}
		else {
			if (isDynamicSlot) {
				tagRes = `</${res}></template></dd-block>`
			} else {
				tagRes = `</${res}></template>`
			}
		}
	}
	else {
		if (isStart) {
			const props = propsAry.join(' ')
			tagRes = props ? `<${res} ${props}>` : `<${res}>`
		}
		else {
			tagRes = `</${res}>`
		}
	}

	return tagRes
}

/**
 * 处理动态slot指令生成，比如 slot="{{xxx}}"
 *
 * @param {string} slotValue - slot属性值
 * @returns {string} 生成的slot指令
 */
export function generateSlotDirective(slotValue: string): string {
	if (isWrappedByBraces!(slotValue)) {
		// 动态 slot 值，使用 v-slot 指令
		const slotExpression = parseBraceExp!(slotValue)
		return `#[${slotExpression}]`
	} else {
		// 静态 slot 值，使用命名插槽语法
		return `#${slotValue}`
	}
}

/**
 * 转换语法
 * @param {*} attrs
 * @param {*} tag
 * @param {*} components - 组件映射，用于判断是否为自定义组件
 */
export function getProps(attrs: Record<string, string>, tag: string, components: Record<string, unknown> | null | undefined): string[] {
	const attrsList: Array<{ name: string; value: string }> = []
	const isCustomComponent = Boolean(components && components[tag])
	// 用于记录属性绑定关系：{ 子组件属性名: 父组件数据路径 }
	const propBindings: Record<string, string> = {}
	const hasEventBindings = Object.keys(attrs).some(name => /^(?:capture-)?(?:bind|catch)(?::)?.+/.test(name))

	// New packages use vw as the rpx transport unit. Keep that contract on the
	// compiled node so PageMeta can distinguish them from legacy rem packages.
	if (tag === 'page-meta') {
		attrsList.push({
			name: 'dimina-rpx-unit',
			value: 'vw',
		})
	}

	if (hasEventBindings) {
		// exparser 的自定义事件沿 WXML 节点树派发，而 Vue 没有对应的
		// ShadowRoot/slot 路径。在真实 DOM 节点上保留事件绑定和节点类型，
		// render 层才能为 service 层重建 composed/capture 路径。
		attrsList.push({
			name: 'v-c-event-node',
			value: components && components[tag] ? "'component'" : "'node'",
		})
	}

	Object.entries(attrs).forEach(([name, value]) => {
		const templateDirective = getTemplateDirectiveName(name)
		if (templateDirective === 'if') {
			attrsList.push({
				name: 'v-if',
				value: parseSafeBraceExp!(value),
			})
		}
		else if (templateDirective === 'elif') {
			attrsList.push({
				name: 'v-else-if',
				value: parseSafeBraceExp!(value),
			})
		}
		else if (templateDirective === 'else') {
			attrsList.push({
				name: 'v-else',
				value: '',
			})
		}
		else if (templateDirective === 'for' || templateDirective === 'for-items') {
			attrsList.push({
				name: 'v-for',
				value: parseForExp!(value, attrs),
			})
		}
		else if (templateDirective === 'for-item' || templateDirective === 'for-index') {
			// do noting
		}
		else if (templateDirective === 'key') {
			const tranValue = parseKeyExpression!(value, getForItemName!(attrs), getForIndexName!(attrs))
			attrsList.push({
				name: ':key',
				value: tranValue,
			})
		}
		else if (name === 'style') {
			const parsedStyle = parseSafeBraceExp!(value)
			// 内联样式
			attrsList.push({
				name: 'v-c-style',
				value: transformRpx(parsedStyle),
			})
			// style 是小程序自定义组件可声明的 property，同时也会作用于
			// 组件宿主。Vue 会把 style 规范化为 DOM 样式对象，因此通过内部
			// transport prop 保留原始字符串，render 层再映射回 style property。
			if (isCustomComponent) {
				attrsList.push({
					name: ':dimina-wxml-style',
					value: parsedStyle,
				})
				if (isWrappedByBraces!(value) && parsedStyle) {
					propBindings.style = parsedStyle
				}
			}
		}
		else if (name === 'class') {
			if (isWrappedByBraces!(value)) {
				attrsList.push({
					name: ':class',
					value: parseClassRules!(value),
				})
			}
			else {
				attrsList.push({
					name: 'class',
					value,
				})
			}
			// 使用自定义指令处理可能的外部样式类 https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/wxml-wxss.html#外部样式类
			attrsList.push({
				name: 'v-c-class',
				value: '',
			})
		}
		else if (name === 'is' && tag === 'component') {
			attrsList.push({
				name: ':is',
				value: '\'dd-\'+' + `${parseSafeBraceExp!(value)}`,
			})
		}
		else if (name === 'animation' && (tag !== 'movable-view' && tagWhiteList.includes(tag))) {
			// movable-view 有自己的 animation 属性
			// 自定义组件的属性有可能是 animation，所以只在普通组件节点生效
			attrsList.push({
				name: 'v-c-animation',
				value: parseSafeBraceExp!(value),
			})
		}
		else if ((name === 'value' && (tag === 'input' || tag === 'textarea'))
			|| ((name === 'x' || name === 'y') && tag === 'movable-view')
		) {
			const parsedValue = parseSafeBraceExp!(value)
			const conditionExp = generateVModelTemplate(parsedValue)
			if (conditionExp) {
				// v-model 不支持表达式
				attrsList.push({
					name: `:${name}`,
					value: parsedValue,
				})

				attrsList.push({
					name: `update:${name}`,
					value: conditionExp,
				})
			}
			else {
				attrsList.push({
					name: `v-model:${name}`,
					value: parsedValue,
				})
			}
		}
		else if (name.startsWith('data-')) {
			if (isWrappedByBraces!(value)) {
				attrsList.push({
					name: 'v-c-data',
					value: '',
				})

				attrsList.push({
					name: `:${name}`,
					value: parseSafeBraceExp!(value),
				})
			}
			else {
				attrsList.push({
					name,
					value,
				})
			}
		}
		else if (isWrappedByBraces!(value)) {
			const pVal = tag === 'template' && name === 'data'
				? parseTemplateDataExp!(value)
				: parseSafeBraceExp!(value)

			// 如果是自定义组件的属性绑定，记录绑定关系
			if (isCustomComponent) {
				// 记录：子组件属性名 -> 父组件数据表达式
				// 例如：count2="{{count}}" => propBindings['count2'] = 'count'
				//       value="{{item.name}}" => propBindings['value'] = 'item.name'
				//       total="{{count + defaultValue}}" => propBindings['total'] = 'count + defaultValue'
				// 确保 pVal 是有效的字符串值
				if (pVal && typeof pVal === 'string') {
					propBindings[name] = pVal
				}
			}

			// 转换 {{}}，绑定属性
			attrsList.push({
				name: `:${name}`,
				value: pVal,
			})
		}
		else if (name !== 'slot') {
			attrsList.push({
				name,
				value,
			})
		}
	})

	const propsRes = []
	attrsList.forEach((attr) => {
		const { name, value } = attr
		if (value === '') {
			propsRes.push(`${name}`)
		}
		else if (/\$\{[^}]*\}/.test(value)) {
			// 内容中含有 ${...} 为模板字符串
			propsRes.push(`:${name}="\`${value}\`"`)
		}
		else {
			// 统一转义属性值，避免生成的 Vue 模板被值中的引号截断。
			propsRes.push(`${name}="${escapeQuotes!(value)}"`)
		}
	})

	// 如果是自定义组件且有属性绑定，添加绑定信息
	if (isCustomComponent && Object.keys(propBindings).length > 0) {
		// 解析绑定表达式，提取依赖信息
		try {
			// 过滤掉无效值，确保所有值都是可序列化的字符串
			const validBindings: Record<string, string> = {}
			for (const [key, value] of Object.entries(propBindings)) {
				if (value !== undefined && value !== null && typeof value === 'string') {
					validBindings[key] = value
				}
			}

		if (Object.keys(validBindings).length > 0) {
			// 解析表达式，生成包含依赖信息的绑定对象
			const parsedBindings = parseBindings(validBindings)
			// 使用动态绑定 + HTML 实体转义，Vue 会自动解码并解析为对象
			const bindingsJson = JSON.stringify(parsedBindings)
			const escapedJson = bindingsJson.replace(/"/g, '&quot;')
			propsRes.push(`v-c-prop-bindings="${escapedJson}"`)
		}
		} catch (error) {
			console.warn('[compiler] 序列化 propBindings 失败:', errorMessage(error), '标签:', tag, '绑定数据:', propBindings)
		}
	}

	return propsRes
}
export function generateVModelTemplate(expression: string): string | false {
	let var1, var2, updateExpression

	if (expression.includes('&&')) {
		// 处理 "x && y"
		[var1, var2] = expression.split('&&').map(v => v.trim())
		// 对于 x && y，x 为真时更新 y，x 为假时更新 x
		updateExpression = `${var1} ? (${var2} = $event) : (${var1} = $event)`
	}
	else if (expression.includes('||')) {
		// 处理 "x || y"
		[var1, var2] = expression.split('||').map(v => v.trim())
		// 对于 x || y，x 为真时更新 x，x 为假时更新 y
		updateExpression = `${var1} ? (${var1} = $event) : (${var2} = $event)`
	}
	else if (expression.includes('?')) {
		// 处理 "x ? x : y"
		const parts = expression.split(/[?:]/).map(v => v.trim())
		var1 = parts[0]
		var2 = parts[2]
		// 对于 x ? x : y，x 为真时更新 x，x 为假时更新 y
		updateExpression = `${var1} ? (${var1} = $event) : (${var2} = $event)`
	}
	else {
		return false
	}
	return updateExpression
}
