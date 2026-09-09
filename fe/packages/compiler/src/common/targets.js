import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_TARGET = 'webview'
const SUPPORTED_TARGETS = Object.freeze([DEFAULT_TARGET])

/** 项目声明的 target 字段名（对齐微信 app.json.renderer 语义）。 */
const RENDERER_FIELD = 'renderer'

export class InvalidTargetError extends TypeError {
	constructor(target) {
		super(`Unsupported compiler target: ${String(target)} (expected: ${SUPPORTED_TARGETS.join(', ')})`)
		this.name = 'InvalidTargetError'
		this.code = 'DIMINA_INVALID_TARGET'
		this.target = target
	}
}

/**
 * 轻量读取项目声明的 target（app.json.renderer，对齐微信 renderer 字段）。
 * 不依赖完整 storeInfo/env 上下文，供 build 入口在 lifecycle 前校验。
 * @param {string} workPath
 * @returns {string|undefined} renderer 值；app.json 缺失/解析失败/无该字段时 undefined
 */
export function readAppRenderer(workPath) {
	try {
		const raw = fs.readFileSync(path.join(workPath, 'app.json'), 'utf8')
		const config = JSON.parse(raw)
		return typeof config?.[RENDERER_FIELD] === 'string' ? config[RENDERER_FIELD] : undefined
	}
	catch {
		return undefined
	}
}

export function resolveTarget(target) {
	const resolved = target === undefined ? DEFAULT_TARGET : target
	if (!SUPPORTED_TARGETS.includes(resolved)) {
		throw new InvalidTargetError(resolved)
	}
	return resolved
}

export { DEFAULT_TARGET, SUPPORTED_TARGETS }
