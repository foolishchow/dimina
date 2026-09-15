/**
 * parseWxml — 兼容入口（fe-tools-wxml-refactor · W3）。
 *
 * 正式实现在 `parser/`；本文件 re-export，保持既有相对路径 import 可用。
 * 默认引擎为 napi（`WXML_PARSER` 缺省）；cheerio 经 `WXML_PARSER=cheerio` 回退。
 */
export {
	parseWxml,
	PARSE_OPTIONS,
	projectDocument,
	resolveWxmlParserEngine,
	documentFromSpanView,
	parseWxmlCheerio,
	parseWxmlNapi,
} from './parser/index.js'
