import { transform } from 'esbuild'
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

export interface StyleEmitOptions {
	entryId: string
	filename: string
	relPrefix: string
	sourcemap: boolean
	minify: boolean
}

/**
 * emit style：package + optional esbuild CSS minify（仅 sourcemap=false+minify）。
 * 无 modDefine。
 */
export async function emitStyle(
	modules: EmitModule[],
	options: StyleEmitOptions,
): Promise<EmitEntry> {
	// 取聚合后的 CSS（modules 数组只有 1 个元素）
	const module = modules[0]!
	let code = module.code
	const { filename, relPrefix, sourcemap } = options

	// esbuild CSS minify：验证模式由 parse-walk per-module 执行；生产模式由 emitStyle aggregated 执行（D-SM-3）
	// !sourcemap 守卫：sourcemap=true 路径 cssnano 已在 parse-walk 处理，不双重 minify + 不失效 sourcemap
	if (options.minify && !sourcemap && !isDiffVerifyMode()) {
		code = await minifyCss(code)
	}

	const files: EmitEntryFile[] = [{ path: `${relPrefix}/${filename}.css`, code }]
	const entry: EmitEntry = {
		entryId: options.entryId,
		kind: 'style',
		files,
	}

	if (sourcemap && module.map) {
		const mapFileName = `${filename}.css.map`
		const map = JSON.parse(module.map)
		map.file = `${filename}.css`
		code += `\n/*# sourceMappingURL=${mapFileName} */\n`
		files[0]!.code = code
		const sourcemaps: EmitEntrySourcemap[] = [{ path: `${relPrefix}/${mapFileName}`, map: JSON.stringify(map) }]
		entry.sourcemaps = sourcemaps
	}

	return entry
}
