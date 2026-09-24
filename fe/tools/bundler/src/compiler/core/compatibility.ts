import { Parser } from 'htmlparser2'
import type { ParserOptions } from 'htmlparser2'
import { isHTMLTag } from '@vue/shared'
import { getTemplateDirectivePrefixes, getViewScriptTags } from '../../packer/store/env.ts'
import { supportedBuiltinComponents, supportedWxApis } from './compatibility-reference.ts'
import { miniProgramBuiltinTags, tagWhiteList } from '../../shared/utils.ts'
import { abilityALS } from '../worker-runtime/context.ts'  // P-WR03：收敛点 getStore
import { consoleFallback } from '../worker-runtime/loggers.ts'  // P-WR03：D-WR-4 兜底

let cachedReference: { supportedBuiltinComponents: Set<string>; supportedWxApis: Set<string> } | null = null
const warnedItems = new Set()
const TEMPLATE_DIRECTIVE_NAMES = new Set([
	'if',
	'elif',
	'else',
	'for',
	'for-items',
	'for-item',
	'for-index',
	'key',
])
const KNOWN_NON_TEMPLATE_PREFIXES = new Set([
	'model',
	'change',
	'worklet',
	'data',
	'class',
	'style',
	'bind',
	'mut-bind',
	'catch',
	'capture-bind',
	'capture-mut-bind',
	'capture-catch',
	'mark',
	'generic',
	'extra-attr',
	'slot',
	'let',
])

function splitAttributePrefix(attributeName: string): { prefix: string; name: string } | null {
	const segments = attributeName.split(':')
	if (segments.length !== 2 || !segments[0] || !segments[1]) {
		return null
	}
	return { prefix: segments[0], name: segments[1] }
}

function getTemplateDirectiveName(attributeName: string): string | null {
	const attribute = splitAttributePrefix(attributeName)
	if (!attribute || !getTemplateDirectivePrefixes().includes(attribute.prefix)) {
		return null
	}
	return TEMPLATE_DIRECTIVE_NAMES.has(attribute.name) ? attribute.name : null
}

function getInvalidAttributePrefix(attributeName: string): string | null {
	const attribute = splitAttributePrefix(attributeName)
	if (!attribute) return null
	const templatePrefixes = getTemplateDirectivePrefixes()
	if (templatePrefixes.includes(attribute.prefix)) {
		return TEMPLATE_DIRECTIVE_NAMES.has(attribute.name) ? null : attribute.prefix
	}
	if (KNOWN_NON_TEMPLATE_PREFIXES.has(attribute.prefix)) {
		return null
	}
	return attribute.prefix
}

function loadReference() {
	if (cachedReference) {
		return cachedReference
	}

	cachedReference = {
		supportedBuiltinComponents: new Set(supportedBuiltinComponents),
		supportedWxApis: new Set(supportedWxApis),
	}
	return cachedReference
}

function parseApiReference(content: string): { supportedBuiltinComponents: Set<string>; supportedWxApis: Set<string> } {
	return {
		supportedBuiltinComponents: parseSingleColumnTable(content, '组件列表'),
		supportedWxApis: parseApiTable(content),
	}
}

function parseSingleColumnTable(content: string, heading: string): Set<string> {
	const section = getSectionContent(content, heading)
	const items = new Set<string>()

	for (const row of getMarkdownRows(section)) {
		if (row.length !== 1 || row[0] === heading.replace(/列表$/, '') || isDividerCell(row[0])) {
			continue
		}
		items.add(stripMarkdownCode(row[0]))
	}

	return items
}

function parseApiTable(content: string): Set<string> {
	const section = getSectionContent(content, 'API 列表')
	const apis = new Set<string>()
	let apiColumnIndex = -1

	for (const row of getMarkdownRows(section)) {
		if (row.includes('API 名称')) {
			apiColumnIndex = row.indexOf('API 名称')
			continue
		}

		if (apiColumnIndex === -1 || row.some(isDividerCell)) {
			continue
		}

		const apiName = stripMarkdownCode(row[apiColumnIndex])
		if (apiName) {
			apis.add(apiName)
		}
	}

	return apis
}

function getSectionContent(content: string, heading: string): string {
	const sectionStart = content.indexOf(`## ${heading}`)
	if (sectionStart === -1) {
		return ''
	}

	const nextSection = content.indexOf('\n## ', sectionStart + 1)
	return nextSection === -1
		? content.slice(sectionStart)
		: content.slice(sectionStart, nextSection)
}

function getMarkdownRows(content: string): string[][] {
	return content
		.split('\n')
		.map(line => line.trim())
		.filter(line => line.startsWith('|') && line.endsWith('|'))
		.map(line => line.slice(1, -1).split('|').map(cell => cell.trim()))
}

function stripMarkdownCode(value: string = ''): string {
	return value.replace(/^`|`$/g, '').trim()
}

function isDividerCell(value: string = ''): boolean {
	return /^:?-{3,}:?$/.test(value.trim())
}

function getWxMemberName(node: unknown): string | null {
	const n = node as { type?: string; object?: { type?: string; name?: string }; computed?: boolean; property?: { type?: string; name?: string; value?: unknown } } | null | undefined
	if (n?.type !== 'MemberExpression') {
		return null
	}

	if (n!.object?.type !== 'Identifier' || n!.object.name !== 'wx') {
		return null
	}

	if (!n!.computed && n!.property?.type === 'Identifier') {
		return n!.property.name ?? null
	}

	const propValue = n!.property?.value
	if (
		n!.computed
		&& (n!.property?.type === 'StringLiteral' || n!.property?.type === 'Literal')
		&& typeof propValue === 'string'
	) {
		return propValue
	}

	return null
}

function warnUnsupportedWxApi(apiName: string | null, filePath: string, line: number | null): void {
	const { supportedWxApis } = loadReference()
	if (!apiName || supportedWxApis.has(apiName)) {
		return
	}

	const location = formatLocation(filePath, line)
	warnOnce('api', apiName, location, `[compat] Unsupported wx API: wx.${apiName}${location}`)
}

function warnUnsupportedComponent(tagName: string | null, filePath: string, line: number | null): void {
	const { supportedBuiltinComponents } = loadReference()
	// 视图脚本标签（wxs、dds 及自定义标签）不是组件，需动态豁免。
	// 兼容性清单仅包含 wxs，因此还需在此放行 dds 和自定义标签，避免误报。
	if (
		!tagName
		|| supportedBuiltinComponents.has(tagName)
		|| tagWhiteList.includes(tagName)
		|| getViewScriptTags().includes(tagName)
	) {
		return
	}

	// glass-easel resolves registered mini-program components first, then falls
	// back to a native node for undeclared tags. Standard HTML follows that native
	// path, but known mini-program built-ins still need an unsupported warning.
	if (!miniProgramBuiltinTags.has(tagName) && isHTMLTag(tagName)) {
		return
	}

	const location = formatLocation(filePath, line)
	warnOnce('component', tagName, location, `[compat] Unsupported or undeclared component: <${tagName}>${location}`)
}

function checkTemplateCompatibility(content: string, filePath: string, components: Record<string, unknown> = {}): void {
	const newlineOffsets = collectNewlineOffsets(content)
	let parser: Parser
	parser = new Parser(
		{
			onopentag(tagName: string, attrs: Record<string, string>) {
				const line = getLineByIndex(newlineOffsets, parser.startIndex)
				for (const attributeName of Object.keys(attrs)) {
					const invalidPrefix = getInvalidAttributePrefix(attributeName)
					if (invalidPrefix) {
						const location = formatLocation(filePath, line)
						warnOnce(
							'template-prefix',
							attributeName,
							location,
							`[compat] Invalid template attribute prefix: ${invalidPrefix}: (${attributeName})${location}`,
						)
					}
				}
				if (components?.[tagName]) {
					return
				}

				warnUnsupportedComponent(tagName, filePath, line)
			},
			onerror(error: Error) {
				warnOnce(
					'parse',
					filePath,
					error.message,
					`[compat] Failed to parse template for compatibility diagnostics: ${filePath} ${error.message}`,
				)
			},
		},
		{
			xmlMode: true,
			lowerCaseTags: false,
			lowerCaseAttributeNames: false,
			withStartIndices: true,
		} as ParserOptions,
	)

	parser.write(content)
	parser.end()
}

function collectNewlineOffsets(content: string): number[] {
	const offsets = []
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10) {
			offsets.push(i)
		}
	}
	return offsets
}

// Binary search over precomputed newline offsets: line = count of newlines
// strictly before `index`, plus 1. `checkTemplateCompatibility` fires this once
// per opened tag; a per-call linear rescan from offset 0 (the previous
// implementation) turned a single template's compatibility check into O(n²) —
// on taro-ui's shared ~112KB base.wxml (reprocessed per page) that dominated
// total dmcc compile time (~43% of the view-compile worker's CPU time).
function getLineByIndex(newlineOffsets: number[], index: number): number | null {
	if (typeof index !== 'number' || index < 0) {
		return null
	}

	let lo = 0
	let hi = newlineOffsets.length
	while (lo < hi) {
		const mid = (lo + hi) >>> 1
		if (newlineOffsets[mid]! < index) {
			lo = mid + 1
		}
		else {
			hi = mid
		}
	}
	return lo + 1
}

function formatLocation(filePath: string, line: number | null): string {
	if (!filePath) {
		return ''
	}
	return line ? ` (${filePath}:${line})` : ` (${filePath})`
}

function warnOnce(type: string, name: string, location: string, message: string): void {
	const key = `${type}:${name}:${location}`
	if (warnedItems.has(key)) {
		return
	}
	warnedItems.add(key)
	const logger = abilityALS.tryGet()?.logger ?? consoleFallback  // D-WR-4 兜底
	logger.warn(message)
}

export {
	checkTemplateCompatibility,
	getTemplateDirectiveName,
	getWxMemberName,
	loadReference,
	parseApiReference,
	warnUnsupportedWxApi,
}
