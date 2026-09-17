/**
 * Live bindings for symbols still defined in view/index.js (W1 cycle break).
 * Index calls bindVueToolsLive after those defs exist.
 */
// @ts-expect-error P-TM05: type narrowing needed
export let transformTextInterpolation
// @ts-expect-error P-TM05: type narrowing needed
export let isWrappedByBraces
// @ts-expect-error P-TM05: type narrowing needed
export let parseBraceExp
// @ts-expect-error P-TM05: type narrowing needed
export let parseSafeBraceExp
// @ts-expect-error P-TM05: type narrowing needed
export let parseForExp
// @ts-expect-error P-TM05: type narrowing needed
export let getForItemName
// @ts-expect-error P-TM05: type narrowing needed
export let getForIndexName
// @ts-expect-error P-TM05: type narrowing needed
export let parseKeyExpression
// @ts-expect-error P-TM05: type narrowing needed
export let parseClassRules
// @ts-expect-error P-TM05: type narrowing needed
export let parseTemplateDataExp
// @ts-expect-error P-TM05: type narrowing needed
export let escapeQuotes
// @ts-expect-error P-TM05: type narrowing needed
export let insertWxsToRenderResult

// @ts-expect-error P-TM05: type narrowing needed
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
