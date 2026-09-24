import { resetStoreInfo } from '../../packer/store/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import { abilityALS } from '../worker-runtime/context.ts'  // P-WR03
import type { EnhancedError } from '../../shared/utils.ts'
import { emitStyle } from './emit.ts'
import { buildCompileCss, clearStyleCaches } from './parse-walk.ts'
import type { StyleModule, StyleOptions } from './parse-walk.ts'
import type { StyleCompiledModule } from '../../packer/types.ts'  // G4 D-G4-2: style compile-res 返回类型

interface Progress {
	completedTasks: number
}

async function compileSS(pages: StyleModule[], root: string | null, progress: Progress, options: StyleOptions = {}, styleCache?: Map<string, StyleCompiledModule>, invalidated?: string[] | null): Promise<StyleCompiledModule[]> {
	// G4 D-G4-2 / G5 D-G5-5: 收集 cache-miss StyleCompiledModule[]（cache-hit 不返——D-G5-3/D-IU-5 只返 dirty）
	const results: StyleCompiledModule[] = []
	// page 样式
	for (const page of pages) {
		const cached = styleCache?.get(page.path)  // G5 cross-rebuild 读
		const isInvalidated = invalidated?.includes(page.path) ?? false
		let code: string
		let map: string | null
		if (cached && !isInvalidated) {
			// ★ G5 cache-hit：跳 buildCompileCss，用 cached code/map re-emit（不 push——D-G5-3）
			code = cached.code
			map = cached.map
		} else {
			// cache-miss：编译 + push（stage-channel 写 cache）
			const result = await buildCompileCss(page, new Set(), options)
			code = result.code
			map = result.map
			results.push({ moduleId: page.path, kind: 'style', code, map, dependencies: [] })
		}
		const filename = `${page.path.replace(/\//g, '_')}`
		// 相对发布根的物化路径前缀（D-P2）
		const relPrefix = root ? `${root}` : 'main'

		const entry = await emitStyle(
			[{ moduleId: page.path, code, map }],
			{ entryId: page.path, filename, relPrefix, sourcemap: !!options.sourcemap, minify: options.minify !== false },
		)
		const { sink } = abilityALS.get()
		sink.write(entry)

		progress.completedTasks++
	}
	return results  // 只 cache-miss（dirty）
}

export { buildCompileCss, boostExternalClassSelectors, ensureImportSemicolons, normalizeCssUrlValue, normalizeRootStyleImports, processHostSelector, resolveStyleImportPath } from './parse-walk.ts'
export { compileSS }

// P-WR02: engine export（不动调度，F47）
async function styleCompile({ msg, progress, config }: CompileOptions): Promise<{ styleCompileResults: StyleCompiledModule[] }> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: StyleModule[]; subPages: Record<string, { info: StyleModule[]; independent: boolean }> }; styleCache?: Map<string, StyleCompiledModule> | null; invalidatedModules?: string[] | null }
	resetStoreInfo(m.storeInfo)

	const styleOptions: StyleOptions = { sourcemap: m.sourcemap, minify: (config as { minify?: boolean }).minify }
	// G4 D-G4-2 / G5 D-G5-3: compile 只返 { styleCompileResults }（只 cache-miss——D-IU-5 只返 dirty）；styleEngine 用 defineEngine 默认 successPayload
	const styleCompileResults: StyleCompiledModule[] = []
	styleCompileResults.push(...await compileSS(m.pages.mainPages, null, progress as Progress, styleOptions, m.styleCache ?? undefined, m.invalidatedModules))
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		styleCompileResults.push(...await compileSS(subPages.info, root, progress as Progress, styleOptions, m.styleCache ?? undefined, m.invalidatedModules))
	}

	clearStyleCaches()
	return { styleCompileResults }
}
function styleNormalizeError(e: Error): Record<string, unknown> {
	const err = e as EnhancedError
	return { message: err.message, stack: err.stack, name: err.name, file: err.file, line: err.line, column: err.column, stage: err.stage }
}

export const styleEngine = defineEngine({
	name: 'style',
	compile: styleCompile,
	cleanup: () => {},
	normalizeError: styleNormalizeError,
})
