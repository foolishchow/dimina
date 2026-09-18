/**
 * Live bindings for symbols still defined in view/index.js (W1 cycle break).
 * Index calls bindVueToolsLive after those defs exist.
 */
export let transformTextInterpolation: ((text: string) => string) | undefined
export let isWrappedByBraces: ((str: string) => boolean) | undefined
export let parseBraceExp: ((exp: string) => string) | undefined
export let parseSafeBraceExp: ((exp: string) => string) | undefined
export let parseForExp: ((exp: string, attrs: Record<string, unknown>) => string) | undefined
export let getForItemName: ((attrs: Record<string, unknown>) => string) | undefined
export let getForIndexName: ((attrs: Record<string, unknown>) => string) | undefined
export let parseKeyExpression: ((exp: string, itemName?: string, indexName?: string) => string) | undefined
export let parseClassRules: ((cssRule: string) => string) | undefined
export let parseTemplateDataExp: ((exp: string) => string) | undefined
export let escapeQuotes: ((input: string) => string) | undefined
export let insertWxsToRenderResult: ((code: string, scriptModule: unknown, scriptRes: Map<string, string>, filename?: string, inputMap?: unknown) => { code: string; map?: unknown }) | undefined
export function bindVueToolsLive(deps: {
	transformTextInterpolation: NonNullable<typeof transformTextInterpolation>
	isWrappedByBraces: NonNullable<typeof isWrappedByBraces>
	parseBraceExp: NonNullable<typeof parseBraceExp>
	parseSafeBraceExp: NonNullable<typeof parseSafeBraceExp>
	parseForExp: NonNullable<typeof parseForExp>
	getForItemName: NonNullable<typeof getForItemName>
	getForIndexName: NonNullable<typeof getForIndexName>
	parseKeyExpression: NonNullable<typeof parseKeyExpression>
	parseClassRules: NonNullable<typeof parseClassRules>
	parseTemplateDataExp: NonNullable<typeof parseTemplateDataExp>
	escapeQuotes: NonNullable<typeof escapeQuotes>
	insertWxsToRenderResult: NonNullable<typeof insertWxsToRenderResult>
}) {
	transformTextInterpolation = deps.transformTextInterpolation
	isWrappedByBraces = deps.isWrappedByBraces
	parseBraceExp = deps.parseBraceExp
	parseSafeBraceExp = deps.parseSafeBraceExp
	parseForExp = deps.parseForExp
	getForItemName = deps.getForItemName
	getForIndexName = deps.getForIndexName
	parseKeyExpression = deps.parseKeyExpression
	parseClassRules = deps.parseClassRules
	parseTemplateDataExp = deps.parseTemplateDataExp
	escapeQuotes = deps.escapeQuotes
	insertWxsToRenderResult = deps.insertWxsToRenderResult
}