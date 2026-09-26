/**
 * LogicEmitter — Logic emit collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts Logic emit task 搬迁）：
 *   deriveLogicBuckets + executeTask(emitEngine) per bucket + buildModel.add +
 *   STAGE_ERROR（F-PA-6 特例路径）
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * 读 sctx：pages/compileConfig/sourcemap/sourcemapTargetPath（P4 写）+
 * buildModel（P3 设，写 .add）+ storeInfo（P3 设）+ state.graph/moduleCache
 * ctx→sctx 统一（R12-3：原 L37-38 ctx.buildModel/ctx.storeInfo → sctx）。
 */

import { deriveLogicBuckets } from './convergence.ts'
import { executeTask } from '../worker/executor.ts'
import { emitEngine } from './emit-engine.ts'
import { buildResetStoreInfoData } from '../store/env.ts'
import type { Output } from '../types.ts'
import type { EmitEntry } from './emit.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator, StageChannelContext } from '../types.ts'
import type { PagesInfo } from '../pipeline/compile-target.types.ts'
import type { PackerSessionState } from '../state/session-state.ts'

export interface LogicEmitterDeps {
	state: PackerSessionState
	lifecycle: Lifecycle
}

export function createLogicEmitter(): BuildCollaborator<LogicEmitterDeps> {
	return {
		async run(sctx: StageChannelContext, deps: LogicEmitterDeps) {
			const { state, lifecycle } = deps
			// H1 (D-ED-1 B2+E): deriveFromGraph 接线 — graph + cache 派生 logic emit buckets (非 ctx.emitBuckets)
			const pages = sctx.pages as PagesInfo | undefined
			const compileConfigOpts = sctx.compileConfig as { minify: boolean; esTarget: { logic: string } } | undefined
			if (!pages || !compileConfigOpts) return  // logic stage 未跑（partial-stage）→ skip emit
			const output = (sctx as { output?: Output }).output
			const storeInfo = buildResetStoreInfoData(sctx.ctx!, sctx.state!)
			const sourcemap = !!sctx.sourcemap
			const sourcemapTargetPath = sctx.sourcemapTargetPath as string | undefined
			const transform = { strategy: 'perModule', minify: compileConfigOpts.minify, target: compileConfigOpts.esTarget.logic, platform: 'neutral' }
			// B2+E: graph closure union → cache 插入序迭代 → cross-bucket dedup
			const innerGraph = state.graph.getInnerGraph()
			const mainEntryIds = pages.mainPages.map(p => p.path)
			const subBuckets = (Object.entries(pages.subPages ?? {}) as [string, { info: { path: string }[]; independent?: boolean }][])
				.map(([root, sub]) => ({ root, entryIds: sub.info.map(p => p.path), independent: sub.independent }))
			const { main, subs } = deriveLogicBuckets(innerGraph, state.moduleCache, mainEntryIds, subBuckets)
			try {
				for (const { root, modules } of subs) {
					const { entry } = await executeTask({ engine: emitEngine, input: {
						entryId: 'logic:' + root, kind: 'logic' as const, modules,
						transform, sourcemap, sourcemapTargetPath, filename: 'logic', relPrefix: root, storeInfo,
					} }) as { entry: EmitEntry }
					output?.add(entry)
				}
				const { entry } = await executeTask({ engine: emitEngine, input: {
					entryId: 'logic', kind: 'logic' as const, modules: main,
					transform, sourcemap, sourcemapTargetPath, filename: 'logic', relPrefix: 'main', storeInfo,
				} }) as { entry: EmitEntry }
				output?.add(entry)
			} catch (error) {
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_ERROR, { stage: 'logic', error })
				throw error
			}
		},
	}
}
