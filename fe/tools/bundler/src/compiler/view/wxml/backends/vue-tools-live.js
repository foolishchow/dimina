/**
 * Live bindings for symbols still defined in view/index.js (W1 cycle break).
 * Index calls bindVueToolsLive after those defs exist.
 */
export let transformTextInterpolation
export let isWrappedByBraces
export let parseBraceExp
export let parseSafeBraceExp
export let parseForExp
export let getForItemName
export let getForIndexName
export let parseKeyExpression
export let parseClassRules
export let parseTemplateDataExp
export let escapeQuotes
export let insertWxsToRenderResult

export function bindVueToolsLive(deps) {
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
