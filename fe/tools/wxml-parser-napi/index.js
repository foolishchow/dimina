/**
 * @dimina/wxml-parser-napi — Rust WXML parser 的 SpanView 薄包
 * （fe-tools-wxml-bridge · W1；fe-tools-wxml-parser-dist · P1 完整双态）。
 *
 * 双态加载（D-WX-3/D-WX-9）：经 CLI 生成 `binding.cjs`（CJS glue——延迟
 * require，不炸 import 链）：① 本地 `index.<platform>.node`（pnpm build 产，
 * git 不追踪）优先 → ② optionalDependencies 子包 → ③ WASI 回退。
 * 皆无时延迟抛 `[wxml]` 指引（R-WB5——不自动构建、不污染 pnpm install）。
 *
 * parseWxmlSpanView(source, sourceFile?) → Document SpanView：
 *   { span, body: SpanNode[], sourceFile? }
 * 契约见 docs/wxml PARSING-SPEC §0.4 与 fe-tools-wxml-bridge design：
 *   半开 byte span；Element.raw = source[lo..hi]；Expr 仅 span+raw；
 *   sourceFile 透传；platform 不进入。
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * 双态解析（可测钩 · R1-F6）：require CLI glue（其内建 本地 `index.<platform>.node`
 * 优先 → 子包 → WASI 回退 的完整序）。失败返回 null（延迟抛错，不炸 import 链）。
 * @param {string} [bindingPath] 可注入 glue 路径（单测"皆无"态用）
 * @returns {object | null}
 */
export function _resolveNative(bindingPath = './binding.cjs') {
	try {
		return require(bindingPath)
	}
	catch {
		return null
	}
}

const native = _resolveNative()

function assertNative() {
	if (!native) {
		throw new Error(
			`[wxml] @dimina/wxml-parser-napi native module not built — run \`pnpm build\` in fe/tools/wxml-parser-napi (expects index.<platform>.node or platform subpackage)`,
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
