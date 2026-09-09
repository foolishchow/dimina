import fs from 'node:fs'
import path from 'node:path'

/**
 * renderer 抽象（A4 P-001 修订，方案 A：对齐微信 renderer 配置模型）。
 *
 * A4 只做抽象边界，不暴露 renderer 选择能力：
 * - 识别 `app.json.renderer`（全局）与各页面 `page.json.renderer`（页面级字段）；
 * - 缺省均为 webview；
 * - 当前仅支持 webview；未知 renderer（如微信 skyline、未来 lynx）在构建前
 *   以结构化 InvalidRendererError 失败，不静默当作 webview；
 * - 不提供 CLI/API renderer 覆盖（本门无第二个 renderer，无切换需求）；
 * - 页面级混合 renderer 编译留待未来（届时需运行时/容器按页识别与 A2/A3 扩展）。
 */

const DEFAULT_RENDERER = 'webview'
const SUPPORTED_RENDERERS = Object.freeze([DEFAULT_RENDERER])
const RENDERER_FIELD = 'renderer'
const APP_CONFIG_FILE = 'app.json'

export class InvalidRendererError extends TypeError {
	constructor(renderer, context = '') {
		const scope = context ? ` in ${context}` : ''
		super(`Unsupported renderer: ${String(renderer)} (expected: ${SUPPORTED_RENDERERS.join(', ')})${scope}`)
		this.name = 'InvalidRendererError'
		this.code = 'DIMINA_INVALID_RENDERER'
		this.renderer = renderer
		this.context = context
	}
}

function readJsonFile(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'))
	}
	catch {
		return null
	}
}

function extractRenderer(config) {
	return typeof config?.[RENDERER_FIELD] === 'string' ? config[RENDERER_FIELD] : undefined
}

/** 轻量读取全局 renderer（app.json.renderer）；缺省/缺失/解析失败 → undefined。 */
export function readAppRenderer(workPath) {
	return extractRenderer(readJsonFile(path.join(workPath, APP_CONFIG_FILE)))
}

/**
 * 轻量读取各页面 renderer（page.json.renderer）。页面路径取自 app.json 的
 * pages 与 subPackages（root/path），与 env 解析规则一致；缺失页面文件 → undefined。
 * @returns {Map<string, string|undefined>} pagePath -> renderer|undefined
 */
export function readPageRenderers(workPath) {
	const pageRenderers = new Map()
	const appConfig = readJsonFile(path.join(workPath, APP_CONFIG_FILE))
	if (!appConfig) return pageRenderers

	const pagePaths = Array.isArray(appConfig.pages) ? [...appConfig.pages] : []
	for (const subPackage of appConfig.subPackages || []) {
		if (!Array.isArray(subPackage.pages)) continue
		for (const page of subPackage.pages) {
			pagePaths.push(`${subPackage.root}/${page}`)
		}
	}

	for (const pagePath of pagePaths) {
		const pageConfig = readJsonFile(path.join(workPath, `${pagePath}.json`))
		pageRenderers.set(pagePath, extractRenderer(pageConfig))
	}
	return pageRenderers
}

export function resolveRenderer(renderer, context = '') {
	const resolved = renderer === undefined ? DEFAULT_RENDERER : renderer
	if (!SUPPORTED_RENDERERS.includes(resolved)) {
		throw new InvalidRendererError(resolved, context)
	}
	return resolved
}

/**
 * 解析并校验项目 renderer 声明（app + page）。
 * A4 v1 仅 webview：任何非 webview 声明（含未来 renderer）都在构建前失败。
 * @returns {{ appRenderer: string, pageRenderers: Map<string, string> }} 解析结果；
 *   任一未知 renderer 声明时抛 InvalidRendererError（携带声明上下文）。
 */
export function resolveProjectRenderers(workPath) {
	const appRenderer = resolveRenderer(readAppRenderer(workPath), 'app.json')
	const pageRenderers = new Map()
	for (const [pagePath, declared] of readPageRenderers(workPath)) {
		pageRenderers.set(pagePath, resolveRenderer(declared, `${pagePath}.json`))
	}
	return { appRenderer, pageRenderers }
}

export { DEFAULT_RENDERER, SUPPORTED_RENDERERS }
