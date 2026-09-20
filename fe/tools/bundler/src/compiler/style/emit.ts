import { transform } from 'esbuild'
import type { EmitModule, EmitEntry, EmitEntryFile, EmitEntrySourcemap } from '../pipeline/emit.ts'

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

	// esbuild CSS minify 由 minifyCss 在 enhanceCSS 内 per-module 执行（行为 0：保留模块间 \n）
	// emitStyle 仅做 package

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
