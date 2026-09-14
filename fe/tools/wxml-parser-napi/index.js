/**
 * @dimina/wxml-parser-napi — Rust WXML parser 的 SpanView 薄包
 * （fe-tools-wxml-bridge · W1）。
 *
 * 加载 `index.node`（napi-rs cdylib）；未构建时抛 `[wxml]` 指引（R-WB5/
 * R-WB4——不自动构建、不污染 pnpm install，走显式 `pnpm build`）。
 *
 * parseWxmlSpanView(source, sourceFile?) → Document SpanView：
 *   { span, body: SpanNode[], sourceFile? }
 * 契约见 docs/wxml PARSING-SPEC §0.4 与 fe-tools-wxml-bridge design：
 *   半开 byte span；Element.raw = source[lo..hi]；Expr 仅 span+raw；
 *   sourceFile 透传；platform 不进入。
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let native = null
try {
	native = require('./index.node')
}
catch (error) {
	// 延迟到调用时抛（构造期不炸 import）
}

function assertNative() {
	if (!native) {
		throw new Error(
			'[wxml] @dimina/wxml-parser-napi native module not built — run `pnpm build` (cargo build -p dimina-wxml-parser-napi --release) first',
		)
	}
}

/**
 * @param {string} source WXML 源串
 * @param {string} [sourceFile] 透传来源标识（不规范化）
 * @returns {object} SpanView Document
 */
export function parseWxmlSpanView(source, sourceFile) {
	assertNative()
	let payload
	try {
		payload = native.parseWxmlSpanView(source, sourceFile ?? null)
	}
	catch (error) {
		// napi Err → JS throw，message 为 errors JSON（或裸串）
		const wrapped = wrapErrors(error?.message)
		throw wrapped ?? error
	}
	if (typeof payload !== 'string') {
		return payload
	}
	const value = JSON.parse(payload)
	if (value.errors) {
		throw formatErrors(value.errors)
	}
	return value
}

function wrapErrors(rawMessage) {
	if (typeof rawMessage !== 'string' || !rawMessage.includes('"errors"')) {
		return null
	}
	try {
		const value = JSON.parse(rawMessage)
		if (Array.isArray(value.errors)) {
			return formatErrors(value.errors)
		}
	}
	catch {
		return null
	}
	return null
}

function formatErrors(errors) {
	const first = errors?.[0]
	if (!first) {
		return new Error(`[wxml] parse failed`)
	}
	return new Error(
		`[wxml] parse failed${first.sourceFile ? ` sourceFile=${first.sourceFile}` : ''}${first.span ? ` span=[${first.span.start},${first.span.end})` : ''}: ${first.message ?? JSON.stringify(errors)}`,
	)
}

/** @internal 测试清理/诊断 */
export const _nativeForTest = () => native