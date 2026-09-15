/**
 * @dimina/wxml-parser-napi — Rust WXML parser 的 SpanView 薄包
 * （fe-tools-wxml-bridge · W1；fe-tools-wxml-parser-dist · P0 最小加载）。
 *
 * 加载 `index.<platform>.node`（napi-rs cdylib，`--platform` 产物）；未构建时抛
 * `[wxml]` 指引（R-WB5 / R-WX0——不自动构建、不污染 pnpm install，走显式
 * `pnpm build`）。P1 再接 `binding.js` 子包回退（完整双态）。
 *
 * parseWxmlSpanView(source, sourceFile?) → Document SpanView：
 *   { span, body: SpanNode[], sourceFile? }
 * 契约见 docs/wxml PARSING-SPEC §0.4 与 fe-tools-wxml-bridge design：
 *   半开 byte span；Element.raw = source[lo..hi]；Expr 仅 span+raw；
 *   sourceFile 透传；platform 不进入。
 */
import { createRequire } from 'node:module'
import { arch, platform } from 'node:process'

const require = createRequire(import.meta.url)

/** @returns {string | null} napi-rs platformArchABI（D-WX-2 五元组） */
function resolvePlatformArchAbi() {
	switch (platform) {
		case 'darwin':
			if (arch === 'arm64') return 'darwin-arm64'
			if (arch === 'x64') return 'darwin-x64'
			return null
		case 'linux':
			if (arch === 'x64') return 'linux-x64-gnu'
			if (arch === 'arm64') return 'linux-arm64-gnu'
			return null
		case 'win32':
			if (arch === 'x64') return 'win32-x64-msvc'
			return null
		default:
			return null
	}
}

let native = null
try {
	const abi = resolvePlatformArchAbi()
	if (abi) {
		native = require(`./index.${abi}.node`)
	}
}
catch {
	// 延迟到调用时抛（构造期不炸 import）
}

function assertNative() {
	if (!native) {
		const abi = resolvePlatformArchAbi()
		const hint = abi ? `index.${abi}.node` : 'index.<platform>.node'
		throw new Error(
			`[wxml] @dimina/wxml-parser-napi native module not built — run \`pnpm build\` in fe/tools/wxml-parser-napi (expects ${hint})`,
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
