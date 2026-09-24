/**
 * view index：compileML 编排 + W1 两套 shim 注入 + viewEngine。
 * parse+walk 代码在 parse-walk.ts（D-PW-2 真抽出）。
 */

import { getDependencyGraph, getWorkPath, resetStoreInfo } from '../../packer/store/env.ts'
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
	pageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[]; selective?: boolean; orderList?: string[] }>
}

async function compileML(pages: ViewModule[], root: string | null, progress: Progress, viewCache?: Map<string, ViewCompiledModule> | null, viewOrderList?: Map<string, string[]> | null, invalidated?: string[] | null): Promise<ViewCompileMLResult> {
	const workPath = getWorkPath()

	// IRC D-IRC-3/R9：仅当至少一 page cache-miss 时才扫 wxs（全 cache-hit 跳过——hit 不消费 wxsFilePathMap）。
	// H3 D-PMC-1: per-module cache-miss 预检——order list 存在 + 全 module cached + 无 invalidated → hit
	const hasMiss = pages.some(p => {
		const orderList = viewOrderList?.get(p.path)
		if (!orderList) return true
		return orderList.some(id => !viewCache?.has(id) || (invalidated?.includes(id) ?? false))
	})
	if (hasMiss) ensureWxsScan(workPath)

	// G4 D-G4-1 / G5 D-G5-3: 收集 cache-miss ViewCompiledModule[]（cache-hit 不返——D-IU-5 只返 dirty）
	const results: ViewCompiledModule[] = []
	// G5 D-G5-4'：per-page-bundle——存 viewParseWalk 完整有序 EmitModule[]（page+transitive subs+wxs），cache-hit re-emit 原序保字节一致
	const pageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[]; selective?: boolean; orderList?: string[] }> = []

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

		// H3 D-PMC-1: per-module cache-hit 预检——order list 存在 + 全 module cached + 无 invalidated → assemble via order list
		const orderList = viewOrderList?.get(page.path)
		const allCached = orderList && orderList.every(id => {
			const m = viewCache?.get(id)
			return m && !invalidated?.includes(id)
		})

		if (allCached && orderList) {
			// ★ H3 cache-hit：assemble per-module cache via order list（= cache-miss 结构，保字节一致）
			const modules = orderList.map(id => {
				const m = viewCache!.get(id)!
				return { moduleId: m.moduleId, code: m.code, map: m.map }
			})
			await emitEntry({ ...emitParams, modules })
			// 不 push——D-G5-3 cache-hit 不返（已在 main-thread cache）
		} else if (orderList && viewCache && orderList.every(id => viewCache.has(id) || (invalidated?.includes(id) ?? false))) {
			// ★ H3 Phase 2: selective recompile——order list 存在 + 全 module（cached ∪ dirty）→
			// 只重编译 dirty（compileViewTree 内 clean+cached module 跳过 compile，seed from cache）
			const dirtySet = new Set((invalidated ?? []).filter(id => orderList.includes(id)))
			const modules = viewParseWalk(page, { sourcemap: enableSourcemap }, { viewCache, dirtySet })
			const viewMods: ViewCompiledModule[] = modules.map(mod => ({ moduleId: mod.moduleId, kind: 'view', code: mod.code, map: mod.map, dependencies: [] }))
			// dirty 子集（IPC 经济 + cache 更新）：code ≠ cached（重编译 module 或重变换 wxs）
			const dirtyMods = viewMods.filter(m => viewCache.get(m.moduleId)?.code !== m.code)
			results.push(...dirtyMods)
			// orderList 全量回传（selective：modules 只带 dirty，序不能从子集派生——wxs 集变更时
			// 新 id 须入序，否则下轮 cache-hit assemble 缺 module）
			pageBundles.push({ pagePath: page.path, modules: dirtyMods, selective: true, orderList: viewMods.map(m => m.moduleId) })
			await emitEntry({ ...emitParams, modules })
		} else {
			// cache-miss（无 order list / 未知 module → 全量 viewParseWalk）
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
async function viewCompile({ msg, progress, config }: CompileOptions): Promise<{ viewCompileResults: ViewCompiledModule[]; viewPageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[]; selective?: boolean; orderList?: string[] }> }> {
	const m = msg as { storeInfo: Parameters<typeof resetStoreInfo>[0]; sourcemap?: boolean; pages: { mainPages: ViewModule[]; subPages: Record<string, { info: ViewModule[]; independent: boolean }> }; viewCache?: Map<string, ViewCompiledModule> | null; viewOrderList?: Map<string, string[]> | null; invalidatedModules?: string[] | null }
	resetStoreInfo(m.storeInfo)
	setEnableSourcemap(!!m.sourcemap)
	activeCompileConfig = config as { minify: boolean; sourcemap: boolean; esTarget: { logic: string; view: string } }
	resetWxsScan()

	// G4 D-G4-1 / G5 D-G5-3/D-G5-4' + IRC D-IRC-2: viewCompileResults（flattened dirty ViewCompiledModule[]）G4 期供 stage-channel 写 per-module cache；
	// G5 改 stage-channel 读 viewPageBundles 后 stage-channel 不再消费该字段，但有意保留——HMR 未来作 dirty signal（vestigial-but-intentional）。
	// viewPageBundles 供 stage-channel 写 per-page-bundle viewCache（活跃）；runtime.ts:33 Object.assign(response, compileResult) 仍 postMessage（vestigial-but-intentional）。
	const viewCompileResults: ViewCompiledModule[] = []
	const viewPageBundles: Array<{ pagePath: string; modules: ViewCompiledModule[]; selective?: boolean; orderList?: string[] }> = []
	const main = await compileML(m.pages.mainPages, null, progress as Progress, m.viewCache ?? undefined, m.viewOrderList ?? undefined, m.invalidatedModules)
	viewCompileResults.push(...main.results)
	viewPageBundles.push(...main.pageBundles)
	for (const [root, subPages] of Object.entries(m.pages.subPages)) {
		const sub = await compileML(subPages.info as ViewModule[], root, progress as Progress, m.viewCache ?? undefined, m.viewOrderList ?? undefined, m.invalidatedModules)
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
