/**
 * WXML parser 入口（fe-tools-wxml-refactor · W3）。
 *
 * `process.env.WXML_PARSER ?? 'napi'` → 仅 `napi` | `cheerio`；非法值抛 `[wxml]`。
 */
import { parseWxml as parseWxmlCheerio, PARSE_OPTIONS, projectDocument } from './cheerio/parse.js'
import { parseWxml as parseWxmlNapi, documentFromSpanView, attrsFromOpeningTag } from './napi/parse.ts'

const ENGINES = new Set(['napi', 'cheerio'])

/**
 * @returns {'napi'|'cheerio'}
 */
export function resolveWxmlParserEngine(env = process.env) {
	const raw = env?.WXML_PARSER
	const engine = (raw == null || raw === '') ? 'napi' : String(raw)
	if (!ENGINES.has(engine)) {
		throw new Error(`[wxml] invalid WXML_PARSER=${JSON.stringify(engine)}; expected napi|cheerio`)
	}
	return engine
}

/**
 * @param {string} source
 * @param {{ sourceFile?: string }} [options]
 */
export function parseWxml(source, options = {}) {
	const engine = resolveWxmlParserEngine()
	if (engine === 'cheerio') {
		return parseWxmlCheerio(source, options)
	}
	return parseWxmlNapi(source, options)
}

export {
	PARSE_OPTIONS,
	projectDocument,
	documentFromSpanView,
	attrsFromOpeningTag,
	parseWxmlCheerio,
	parseWxmlNapi,
}
