/**
 * stage-channel — worker 阶段协议封装（build-model M1 / D-BM-7）。
 *
 * P-WR06：worker 生命周期 + 消息分发搬到 worker-runtime/executor.js
 * （executeTask）。stage-channel 退化成 executeTask 调用方 + ctx/lifecycle
 * 写入（F35：executor 不碰 ctx，resolve 返回 result，调用方写 ctx）。
 *
 * 约束（D-BM-7）：不做通用 RPC / 请求复用 / 重连 / IDL。
 */

import { formatCompileProgress } from '../../shared/compile-progress.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import { executeTask } from '../worker-runtime/executor.ts'
import { viewEngine } from '../view/index.ts'
import { logicEngine } from '../logic/index.ts'
import { styleEngine } from '../style/index.ts'

const ENGINES = { view: viewEngine, logic: logicEngine, style: styleEngine }

/**
 * 运行单个编译阶段（view / logic / style）的 worker 任务。
 *
 * @param {object} params
 * @param {'view'|'logic'|'style'} params.script
 * @param {object} params.ctx            Listr 上下文（storeInfo / pages / dependencyGraph / compatibilityWarnings）
 * @param {object} params.task           Listr task（进度 UI）
 * @param {object} [params.options]      { pages, sourcemap, sourcemapTargetPath, compileConfig, stageTimeoutMs }
 * @param {object|null} [params.lifecycle] A1 lifecycle（BUILD_WARNING 事件）
 * @param {Function} [params.onOutput]   产物流式回传
 * @returns {Promise<void>}
 */
export interface RunCompileStageParams { script: string; engine?: typeof viewEngine | typeof logicEngine | typeof styleEngine; ctx: Record<string, unknown>; task: { output: string }; options: Record<string, unknown>; lifecycle: { emit: (e: string, p: unknown) => Promise<void> } | null; onOutput?: (entry: unknown) => void }
export async function runCompileStage({ script, engine, ctx, task, options = {}, lifecycle = null, onOutput }: RunCompileStageParams): Promise<void> {
	const pages = (options.pages || ctx.pages) as { mainPages: Record<string, unknown>[]; subPages: Record<string, { info: unknown[] }> }
	const totalTasks = Object.keys(pages.mainPages).length
		+ Object.values(pages.subPages).reduce((sum: number, item: { info: unknown[] }) => sum + item.info.length, 0)
	const result = await executeTask({
		engine: engine ?? ENGINES[script as 'view' | 'logic' | 'style'],
		input: {
			pages,
			storeInfo: ctx.storeInfo,
			sourcemap: !!options.sourcemap,
			sourcemapTargetPath: options.sourcemapTargetPath,
			compileConfig: options.compileConfig,
			stageTimeoutMs: options.stageTimeoutMs as number | undefined,
			collectOutput: typeof onOutput === 'function',  // 兼容字段（worker onMessage 旧版解构，runtime 不用）
			cache: (() => { const c = (ctx as { cache?: { toJSON: () => [string, unknown][] } }).cache; return c ? new Map(c.toJSON()) : null })(),
			// G5 D-G5-2/F12: view/style cache 快照——bare Map 用 new Map(c)（非 toJSON——ModuleResultCache 有 toJSON，bare Map 没有）
			viewCache: (() => { const c = (ctx as { viewCache?: Map<string, unknown> }).viewCache; return c ? new Map(c) : null })(),
			viewOrderList: (() => { const c = (ctx as { viewOrderList?: Map<string, string[]> }).viewOrderList; return c ? new Map(c) : null })(),
			styleCache: (() => { const c = (ctx as { styleCache?: Map<string, unknown> }).styleCache; return c ? new Map(c) : null })(),
			invalidatedModules: (ctx as { invalidatedModules?: string[] }).invalidatedModules ?? null,
		},
		onOutput,
		onProgress: (completed: number, total: number) => {
			if (process.stdout.isTTY) {
				task.output = formatCompileProgress(completed, total)
			}
		},
	});

	// F35：executor 不碰 ctx，调用方写 ctx
	((ctx as { dependencyGraph: { merge: (g: unknown) => void } }).dependencyGraph).merge((result as { dependencyGraph: unknown }).dependencyGraph);
	for (const warning of (result as { compatibilityWarnings?: string[] }).compatibilityWarnings || []) {
		((ctx as { compatibilityWarnings: Set<string> }).compatibilityWarnings).add(warning)
		if (lifecycle) {
			await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_WARNING, { message: warning })
		}
	}

	// M2 D-RC-3：从 worker 响应更新 cache（仅 dirty 模块）
	const cacheInstance = (ctx as { cache?: { set: (id: string, val: unknown) => void } }).cache
	const compileRes = (result as { compileRes?: Array<{ path: string }> }).compileRes
	const logicDeps = (result as { logicDependencies?: Record<string, string[]> }).logicDependencies
	if (cacheInstance && compileRes) {
		for (const info of compileRes) {
			const deps = logicDeps?.[info.path] ?? []
			cacheInstance.set(info.path, { compileInfo: info, logicDependencies: deps })
		}
	}

	// H3 D-PMC-1: split pageBundles into per-module viewCache + viewOrderList
	// (was G5 per-page-bundle: viewCache.set(pagePath, modules))
	// H3 Phase 2: selective 条目（modules 只带 dirty 子集）——orderList 显式回传（不从子集派生）
	const viewPageBundles = (result as { viewPageBundles?: Array<{ pagePath: string; modules: Array<{ moduleId: string; code: string; map: string | null }>; selective?: boolean; orderList?: string[] }> }).viewPageBundles
	const viewCache = (ctx as { viewCache?: { set: (id: string, val: unknown) => void } }).viewCache
	const viewOrderList = (ctx as { viewOrderList?: { set: (id: string, val: string[]) => void } }).viewOrderList
	if (viewCache && viewPageBundles) {
		for (const b of viewPageBundles) {
			const orderList = b.selective && b.orderList ? b.orderList : b.modules.map(m => m.moduleId)
			if (viewOrderList) viewOrderList.set(b.pagePath, orderList)
			for (const m of b.modules) {
				viewCache.set(m.moduleId, { moduleId: m.moduleId, kind: 'view' as const, code: m.code, map: m.map, dependencies: [] })
			}
		}
	}
	const styleResults = (result as { styleCompileResults?: Array<{ moduleId: string }> }).styleCompileResults
	const styleCache = (ctx as { styleCache?: { set: (id: string, val: unknown) => void } }).styleCache
	if (styleCache && styleResults) {
		for (const mod of styleResults) {
			styleCache.set(mod.moduleId, mod)
		}
	}


	if (process.stdout.isTTY && (totalTasks as number) > 0) {
		task.output = formatCompileProgress(totalTasks as number, totalTasks as number)
	}
}
