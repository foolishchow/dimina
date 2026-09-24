import { transform } from 'esbuild'
import type { EmitModule, EmitEntry, EmitEntryFile, EmitEntrySourcemap } from '../pipeline/emit.ts'

/**
 * esbuild CSS minify（单模块，parse-walk per-module 调用）。
 * D-SMPU-2: 统一到 parse-walk per-module（保留模块间 `\n`）。
 */
export async function minifyCss(css: string): Promise<string> {
	const result = await transform(css, {
		loader: 'css',
		minify: true,
	})
	return result.code
}

/**
 * D-SMPU-2: cssnano loader（parse-walk per-module 调用，canonical home）。
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
	/** D-SMPU-2: dead param（minify 归 parse-walk per-module）；保留向后兼容。 */
	minify: boolean
}

/**
 * emit style：package only（minify 归 parse-walk per-module，D-SMPU-2）。
 * 无 modDefine。
 */
export async function emitStyle(
	modules: EmitModule[],
	options: StyleEmitOptions,
): Promise<EmitEntry> {
	// 取聚合后的 CSS（modules 数组只有 1 个元素，parse-walk 已 per-module minify）
	const module = modules[0]!
	let code = module.code
	let map = module.map
	const { filename, relPrefix, sourcemap } = options

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
