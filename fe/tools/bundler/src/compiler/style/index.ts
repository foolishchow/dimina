import { resetStoreInfo } from '../core/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import { abilityALS } from '../worker-runtime/context.ts'  // P-WR03
import type { EnhancedError } from '../../shared/utils.ts'
import { emitStyle } from './emit.ts'
import { buildCompileCss, clearStyleCaches } from './parse-walk.ts'
import type { StyleModule, StyleOptions } from './parse-walk.ts'

interface Progress {
	completedTasks: number
}

async function compileSS(pages: StyleModule[], root: string | null, progress: Progress, options: StyleOptions = {}): Promise<void> {
	// page 样式
	for (const page of pages) {
		const result = await buildCompileCss(page, new Set(), options)
		const filename = `${page.path.replace(/\//g, '_')}`
		// 相对发布根的物化路径前缀（D-P2）
		const relPrefix = root ? `${root}` : 'main'

		const entry = await emitStyle(
			[{ moduleId: page.path, code: result.code, map: result.map }],
			{ entryId: page.path, filename, relPrefix, sourcemap: !!options.sourcemap, minify: options.minify !== false },
		)
		const { sink } = abilityALS.get()
		sink.write(entry)

		progress.completedTasks++
	}
}

export { buildCompileCss, boostExternalClassSelectors, ensureImportSemicolons, normalizeCssUrlValue, normalizeRootStyleImports, processHostSelector, resolveStyleImportPath } from './parse-walk.ts'
export { compileSS }

// P-WR02: engine export（不动调度，F47）
async function styleCompile({ msg, progress, config }: CompileOptions): Promise<void> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: StyleModule[]; subPages: Record<string, { info: StyleModule[]; independent: boolean }> } }
	resetStoreInfo(m.storeInfo)

	const styleOptions: StyleOptions = { sourcemap: m.sourcemap, minify: (config as { minify?: boolean }).minify }
	await compileSS(m.pages.mainPages, null, progress as Progress, styleOptions)
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		await compileSS(subPages.info, root, progress as Progress, styleOptions)
	}

	clearStyleCaches()
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
