/**
 * WXML IR / renderer 契约类型（fe-tools-bundler-typecheck · D-TC-10 →
 * fe-tools-bundler-tsc-dist · T1a 迁 .ts）。
 * 仅 `export type` / `interface`；无运行时导出值。白名单内权威类型源——
 * 不以 vue/index.js 为准（D-TD-16：emit 产空 .js 可接受）。
 */
import type { Span, Attr, Value, WxmlNode } from './document.ts'

export interface WxmlDocument extends WxmlNode {
	body: object[]
	sourceFile?: string
	_source?: string
}

/**
 * load 产物：展开后的 Document 本体（body 等）上挂 templateModule / scriptModule / sourceTexts。
 * （非 `{ document }` 包装。）
 */
export interface LoadedGraph extends WxmlDocument {
	templateModule?: object[]
	scriptModule?: object[]
	sourceTexts?: Map<string, string>
}

export interface WxmlRenderResult {
	code: string
	map?: unknown
	meta?: Record<string, unknown>
}

export interface WxmlRenderer {
	id: string
	render: (input: { loaded?: LoadedGraph }, ctx?: object) => WxmlRenderResult
}

export interface LoadTemplatesCtx {
	isComponent?: boolean
	modulePath?: string
	sourcePath?: string
	components?: Record<string, string>
	componentPlaceholder?: unknown
	processedPaths?: Set<string>
	hasOriginalContent?: boolean
	workPath: string
	stripTemplateExtsRegex: RegExp
	tools: Record<string, Function>
	env: Record<string, Function>
}

export type { Span, Attr, Value }
