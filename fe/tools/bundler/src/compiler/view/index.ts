/**
 * view index：compileML 编排 + W1 两套 shim 注入 + viewEngine。
 * parse+walk 代码在 parse-walk.ts（D-PW-2 真抽出）。
 */

import { getDependencyGraph, getWorkPath, resetStoreInfo } from '../core/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import { getWxmlRenderer, registerWxmlRenderer } from './wxml/renderer/registry.ts'
import { vueWxmlRenderer, VUE_RENDERER_ID } from './wxml/renderer/vue/index.ts'
import {
	normalizeTemplateSyntax,
	generateSlotDirective,
	generateVModelTemplate,
} from './wxml/renderer/vue/tools.ts'
import { processIncludeConditionalAttrs } from './wxml/load/include.ts'
import { bindTransformOrchestrator } from './wxml/load/orchestrator-live.ts'
import { bindVueToolsLive } from './wxml/renderer/vue/live.ts'
import { enableSourcemap, setEnableSourcemap } from './wxml/renderer/vue/state.ts'
import { emitEntry } from '../pipeline/emit.ts'
import type { ViewModule } from './parse-walk.ts'
import type { ViewCompiledModule } from '../../packer/types.ts'  // G4 D-G4-1: view compile-res 返回类型
import {
	viewParseWalk,
	insertWxsToRenderResult,
	parseBraceExp,
	parseSafeBraceExp,
	parseForExp,
	getForItemName,
	getForIndexName,
	parseKeyExpression,
	parseClassRules,
	parseTemplateDataExp,
	escapeQuotes,
	transformTextInterpolation,
	isWrappedByBraces,
	splitWithBraces,
	processWxsContent,
	initWxsFilePathMap,
	loadWxsModule,
	transTagWxs,
	transAsses,
	processIncludedFileWxsDependencies,
	ensureWxsScan,
	resetWxsScan,
	clearViewCaches,
} from './parse-walk.ts'

// TS-2（fe-tools-wxml-ir）：wxml renderer₀ 注册（registry 同 id 抛错；测例可先 unregister）
if (!getWxmlRenderer(VUE_RENDERER_ID)) {
	registerWxmlRenderer(vueWxmlRenderer)
}

// enableSourcemap: see wxml/renderer/vue/state.ts
/** @type {{ minify: boolean, sourcemap: boolean, esTarget: { logic: string, view: string } }} */
let activeCompileConfig = {
	minify: true,
	sourcemap: false,
	esTarget: { logic: 'es2023', view: 'es2020' },
}

interface Progress {
	completedTasks: number
}

async function compileML(pages: ViewModule[], root: string | null, progress: Progress): Promise<ViewCompiledModule[]> {
	const workPath = getWorkPath()

	// 主包和所有分包共享同一 npm WXS 索引；一次 Worker 任务只扫描一次。
	ensureWxsScan(workPath)

	// G4 D-G4-1：收集 ViewCompiledModule[]（降级 base + dependencies: []），供 G5 cache-hit skip
	const results: ViewCompiledModule[] = []

	for (const page of pages) {
		// D-ET-9：viewParseWalk 编排 + 一次编译（替代 buildCompileView 二次编译）
		const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
		// G4 D-G4-1：viewParseWalk 返 EmitModule（{moduleId,code,map,extraInfoCode?}）→ 降级 base ViewCompiledModule
		for (const mod of modules) {
			results.push({ moduleId: mod.moduleId, kind: 'view', code: mod.code, map: mod.map, dependencies: [] })
		}
		const filename = `${page.path.replace(/\//g, '_')}`
		// 相对发布根的物化路径前缀（D-P2）：主包 → main/，分包 → {root}/
		const relPrefix = root ? `${root}` : 'main'

		await emitEntry({
			entryId: page.path,
			kind: 'view',
			modules,
			transform: {
				strategy: 'bundle',
				minify: activeCompileConfig.minify,
				target: activeCompileConfig.esTarget.view,
				platform: 'browser',
			},
			sourcemap: enableSourcemap,
			sourcemapTargetPath: null,
			filename,
			relPrefix,
		})

		progress.completedTasks++
	}

	return results
}

// W1 live bindings — break index ↔ load / vue renderer tools cycles (bodies stay in modules)
bindVueToolsLive({
	transformTextInterpolation,
	isWrappedByBraces,
	parseBraceExp,
	parseSafeBraceExp,
	parseForExp,
	getForItemName,
	getForIndexName,
	parseKeyExpression,
	parseClassRules,
	parseTemplateDataExp,
	escapeQuotes,
	insertWxsToRenderResult,
})
bindTransformOrchestrator({
	transTagWxs,
	transAsses,
	processIncludedFileWxsDependencies,
})

export {
	compileML,
	viewParseWalk,
	generateVModelTemplate,
	generateSlotDirective,
	initWxsFilePathMap,
	loadWxsModule,
	parseBraceExp,
	parseClassRules,
	parseKeyExpression,
	parseTemplateDataExp,
	normalizeTemplateSyntax,
	processIncludeConditionalAttrs,
	processWxsContent,
	splitWithBraces,
}

// P-WR02: engine export（不动调度，F47；onMessage 旧版保留，compile 函数声明供 export）
async function viewCompile({ msg, progress, config }: CompileOptions): Promise<{ viewCompileResults: ViewCompiledModule[] }> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: ViewModule[]; subPages: Record<string, { info: ViewModule[]; independent: boolean }> } }
	resetStoreInfo(m.storeInfo)
	setEnableSourcemap(!!m.sourcemap)
	activeCompileConfig = config as { minify: boolean; sourcemap: boolean; esTarget: { logic: string; view: string } }
	resetWxsScan()

	// G4 D-G4-1：compile 只返 { viewCompileResults }（新字段）；successPayload 由 runtime.ts:30 单独调并合并
	const viewCompileResults: ViewCompiledModule[] = []
	viewCompileResults.push(...await compileML(m.pages.mainPages, null, progress as Progress))
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		viewCompileResults.push(...await compileML(subPages.info as ViewModule[], root, progress as Progress))
	}

	clearViewCaches()
	return { viewCompileResults }
}
function viewSuccessPayload({ logger }: { logger: { warn: (msg: string) => void; flush: () => string[] } }): Record<string, unknown> {
	return {
		dependencyGraph: getDependencyGraph().toJSON(),
		compatibilityWarnings: logger.flush(),
	}
}
function viewBuildConfig(msg: Record<string, any>) {
	return {
		sourcemap: !!msg.sourcemap,
		minify: msg.compileConfig?.minify !== false,
		esTarget: {
			logic: msg.compileConfig?.esTarget?.logic || 'es2023',
			view: msg.compileConfig?.esTarget?.view || 'es2020',
		},
	}
}

export const viewEngine = defineEngine({
	name: 'view',
	compile: viewCompile,
	cleanup: () => {},
	successPayload: viewSuccessPayload,
	buildConfig: viewBuildConfig,
})
