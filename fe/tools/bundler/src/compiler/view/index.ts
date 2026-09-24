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

interface ViewCompileMLResult {
	results: ViewCompiledModule[]
	pageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[] }>
}

async function compileML(pages: ViewModule[], root: string | null, progress: Progress, viewCache?: Map<string, ViewCompiledModule[]> | null, invalidated?: string[] | null): Promise<ViewCompileMLResult> {
	const workPath = getWorkPath()

	// 主包和所有分包共享同一 npm WXS 索引；一次 Worker 任务只扫描一次。
	ensureWxsScan(workPath)

	// G4 D-G4-1 / G5 D-G5-3: 收集 cache-miss ViewCompiledModule[]（cache-hit 不返——D-IU-5 只返 dirty）
	const results: ViewCompiledModule[] = []
	// G5 D-G5-4'：per-page-bundle——存 viewParseWalk 完整有序 EmitModule[]（page+transitive subs+wxs），cache-hit re-emit 原序保字节一致
	const pageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[] }> = []

	for (const page of pages) {
		const filename = `${page.path.replace(/\//g, '_')}`
		// 相对发布根的物化路径前缀（D-P2）：主包 → main/，分包 → {root}/
		const relPrefix = root ? `${root}` : 'main'
		const emitParams = {
			entryId: page.path,
			kind: 'view' as const,
			transform: {
				strategy: 'bundle' as const,
				minify: activeCompileConfig.minify,
				target: activeCompileConfig.esTarget.view,
				platform: 'browser' as const,
			},
			sourcemap: enableSourcemap,
			sourcemapTargetPath: null,
			filename,
			relPrefix,
		}

		// G5 D-G5-4'：cache-hit 预检——page bundle cached 且 bundle 内任一 module 均未 invalidated → re-emit 原序 bundle（字节一致）
		const cachedBundle = viewCache?.get(page.path)
		const bundleInvalidated = cachedBundle ? cachedBundle.some(m => invalidated?.includes(m.moduleId) ?? false) : false

		if (cachedBundle && !bundleInvalidated) {
			// ★ G5 cache-hit：跳 viewParseWalk，re-emit 原序 bundle（= cache-miss 结构，保 watch 产物粒度+字节一致）
			const modules = cachedBundle.map(m => ({ moduleId: m.moduleId, code: m.code, map: m.map }))
			await emitEntry({ ...emitParams, modules })
			// 不 push——D-G5-3 cache-hit 不返（已在 main-thread cache）
		} else {
			// cache-miss（bundle 未 cached 或任一 module invalidated → 全量 viewParseWalk）
			const modules = viewParseWalk(page, { sourcemap: enableSourcemap })
			// G4 D-G4-1：viewParseWalk 返 EmitModule（{moduleId,code,map}）→ 降级 base ViewCompiledModule，存 per-page-bundle
			const viewMods: ViewCompiledModule[] = modules.map(mod => ({ moduleId: mod.moduleId, kind: 'view', code: mod.code, map: mod.map, dependencies: [] }))
			results.push(...viewMods)
			pageBundles.push({ pagePath: page.path, modules: viewMods })
			await emitEntry({ ...emitParams, modules })
		}

		progress.completedTasks++
	}

	return { results, pageBundles }  // results 只 cache-miss（dirty）；pageBundles 供 stage-channel 写 cache
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
async function viewCompile({ msg, progress, config }: CompileOptions): Promise<{ viewCompileResults: ViewCompiledModule[]; viewPageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[] }> }> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: ViewModule[]; subPages: Record<string, { info: ViewModule[]; independent: boolean }> }; viewCache?: Map<string, ViewCompiledModule[]> | null; invalidatedModules?: string[] | null }
	resetStoreInfo(m.storeInfo)
	setEnableSourcemap(!!m.sourcemap)
	activeCompileConfig = config as { minify: boolean; sourcemap: boolean; esTarget: { logic: string; view: string } }
	resetWxsScan()

	// G4 D-G4-1 / G5 D-G5-3/D-G5-4': compile 返 { viewCompileResults }（cache-miss dirty，供 stage-channel 写 cache）+ { viewPageBundles }（per-page-bundle，供 stage-channel 写 viewCache）；successPayload 由 runtime.ts:30 单独调并合并
	const viewCompileResults: ViewCompiledModule[] = []
	const viewPageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[] }> = []
	const main = await compileML(m.pages.mainPages, null, progress as Progress, m.viewCache ?? undefined, m.invalidatedModules)
	viewCompileResults.push(...main.results)
	viewPageBundles.push(...main.pageBundles)
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		const sub = await compileML(subPages.info as ViewModule[], root, progress as Progress, m.viewCache ?? undefined, m.invalidatedModules)
		viewCompileResults.push(...sub.results)
		viewPageBundles.push(...sub.pageBundles)
	}

	clearViewCaches()
	return { viewCompileResults, viewPageBundles }
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
