import { transform } from 'esbuild'
import postcss from 'postcss'
import type { EmitModule, EmitEntry, EmitEntryFile, EmitEntrySourcemap } from '../pipeline/emit.ts'

/**
 * D-SM-1: 行为 0 验证模式开关。
 * 设置 DIMINA_COMPILER_DIFF_VERIFY 时，style minifyCss 留在 parse-walk（现状）→ diff=0 保证。
 * 未设置时，minifyCss 在 emit 执行（parse-walk 不 minify）。
 */
export function isDiffVerifyMode(): boolean {
	return !!process.env.DIMINA_COMPILER_DIFF_VERIFY
}

/**
 * esbuild CSS minify（单模块）。
 * 行为 0：per-module minify + join 保留模块间 `\n`（aggregated minify 会删 `\n`）。
 */
export async function minifyCss(css: string): Promise<string> {
	const result = await transform(css, {
		loader: 'css',
		minify: true,
	})
	return result.code
}

/**
 * D-CN-1: cssnano loader（正本在此，parse-walk legacy fallback 借用）。
 */
let cssnanoLoader: Promise<typeof import('cssnano')['default']> | undefined

export function loadCssnano() {
	cssnanoLoader ||= import('cssnano').then(module => module.default)
	return cssnanoLoader
}

export interface StyleEmitOptions {
	entryId: string
	filename: string
	relPrefix: string
	sourcemap: boolean
	minify: boolean
}

/**
 * emit style：package + optional CSS minify。
 * - sourcemap=false + minify → esbuild minifyCss（D-SM-3）
 * - sourcemap=true  + minify → cssnano PostCSS（D-CN-3）
 * 无 modDefine。
 */
export async function emitStyle(
	modules: EmitModule[],
	options: StyleEmitOptions,
): Promise<EmitEntry> {
	// 取聚合后的 CSS（modules 数组只有 1 个元素）
	const module = modules[0]!
	let code = module.code
	let map = module.map
	const { filename, relPrefix, sourcemap } = options

	// D-CN-3: cssnano PostCSS minify（sourcemap=true 路径，生产模式 canonical）
	// annotation: false 守卫：PostCSS 默认追加 sourceMappingURL，与 emitStyle 手动追加重复
	// sourcesContent: true：保留 sourcesContent（style-sourcemap.spec.js 断言）
	if (options.minify && sourcemap && !isDiffVerifyMode() && map) {
		const cssnano = await loadCssnano()
		const postcssResult = await postcss([cssnano() as unknown as postcss.Plugin]).process(code, {
			from: undefined,
			map: { prev: map, inline: false, annotation: false, sourcesContent: true },
		})
		code = postcssResult.css
		map = postcssResult.map.toString()
	}

	// D-SM-3: esbuild CSS minify（sourcemap=false 路径，生产模式 canonical）
	// !sourcemap 守卫：sourcemap=true 路径 cssnano 已处理，不双重 minify
	if (options.minify && !sourcemap && !isDiffVerifyMode()) {
		code = await minifyCss(code)
	}

	const files: EmitEntryFile[] = [{ path: `${relPrefix}/${filename}.css`, code }]
	const entry: EmitEntry = {
		entryId: options.entryId,
		kind: 'style',
		files,
	}

	if (sourcemap && map) {
		const mapFileName = `${filename}.css.map`
		const parsedMap = JSON.parse(map)
		parsedMap.file = `${filename}.css`
		code += `\n/*# sourceMappingURL=${mapFileName} */\n`
		files[0]!.code = code
		const sourcemaps: EmitEntrySourcemap[] = [{ path: `${relPrefix}/${mapFileName}`, map: JSON.stringify(parsedMap) }]
		entry.sourcemaps = sourcemaps
	}

	return entry
}
