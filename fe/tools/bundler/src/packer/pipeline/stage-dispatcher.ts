/**
 * StageDispatcher — 编译项目 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts compile task + createStageTask 搬迁）：
 *   readLoadBindings(state, storeInfo) + computeStagePlan() + createStageTask per stage +
 *   sctx 写 loadBindings/allPages/pages/compatibilityWarnings/compileConfig/sourcemap/sourcemapTargetPath
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * R7-3: loadBindings 跨 task mutable 闭包 → sctx.loadBindings 字段（result 读 appId）。
 * run() 返 ListrTask[] 交 facade newListr 渲染（facade 拥 Listr 渲染，collaborator 拥 stage plan）。
 */

import process from 'node:process'
import { computeStagePlan, readLoadBindings } from '../registry/dispatch.ts'
import type { PackerDispatchRegistry } from '../registry/dispatch.ts'
import type { CompileTarget } from './compile-target.types.ts'
import type { LoadBindings, PagesInfo } from './compile-target.types.ts'
import type { PackerSessionState } from '../state/session-state.ts'
import { runCompileStage } from '../state/stage-channel.ts'
import type { RunCompileStageParams } from '../state/stage-channel.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator, StageChannelContext } from '../types.ts'

/** renderer 阶段级薄适配（从 orchestrator 搬迁，webviewRenderer 在 orchestrator 保留 D-FC-5）。 */
export interface RendererAdapter {
	runViewStage?: (ctx: Record<string, unknown>, task: unknown, wo: Record<string, unknown>, lc: { emit: (e: string, p: unknown) => Promise<void> }) => Promise<void>
	runStyleStage?: (ctx: Record<string, unknown>, task: unknown, wo: Record<string, unknown>, lc: { emit: (e: string, p: unknown) => Promise<void> }) => Promise<void>
}

/** createStageTask（从 orchestrator 逐字搬迁，D-FC-1 collaborator 拥 stage 派发逻辑）。 */
function createStageTask(stage: string, title: string, engine: unknown, lifecycle: { emit: (e: string, p: unknown) => Promise<void> }, workerOptions: Record<string, unknown> = {}, rendererAdapter: RendererAdapter | null = null) {
	return {
		title,
		rendererOptions: { outputBar: true, persistentOutput: false },
		task: async (ctx: Record<string, unknown>, task: unknown) => {
			const sctx = ctx as unknown as StageChannelContext
			const pages = workerOptions.pages || sctx.pages
			await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_BEFORE, {
				stage,
				pages,
				sourcemap: !!workerOptions.sourcemap,
			})
			const warningsBefore = new Set(sctx.compatibilityWarnings ?? new Set())
			const startedAt = Date.now()
			const runStage = stage === 'view' || stage === 'style'
				? (rendererAdapter as { runViewStage?: (ctx: unknown, task: unknown, opts: unknown, lifecycle: unknown) => Promise<void>; runStyleStage?: (ctx: unknown, task: unknown, opts: unknown, lifecycle: unknown) => Promise<void> })?.[stage === 'view' ? 'runViewStage' : 'runStyleStage']
				: null
			try {
				if (runStage) {
					await runStage(ctx, task, workerOptions, lifecycle)
				}
				else {
					await runCompileStage({ script: stage, engine: engine as RunCompileStageParams['engine'], ctx, task: task as { output: string }, options: workerOptions, lifecycle, onOutput: (entry: unknown) => { ((sctx as { output?: { add: (e: unknown) => void } }).output)?.add(entry) } })
				}
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_AFTER, {
					stage,
					compatibilityWarnings: [...(sctx.compatibilityWarnings ?? new Set())].filter(warning =>
						!warningsBefore.has(warning)),
					durationMs: Date.now() - startedAt,
				})
			}
			catch (error) {
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_ERROR, { stage, error })
				throw error
			}
		},
	}
}

export interface StageDispatcherDeps {
	dispatchRegistry: PackerDispatchRegistry
	compileTarget: CompileTarget
	affectedEntries?: string[]
	state: PackerSessionState
	lifecycle: Lifecycle
	parallel: boolean
}

export function createStageDispatcher(): BuildCollaborator<StageDispatcherDeps> {
	return {
		async run(sctx: StageChannelContext, deps: StageDispatcherDeps) {
			const { dispatchRegistry, compileTarget, affectedEntries, state, lifecycle } = deps
			// B 切法（PC-B7）：readLoadBindings 从 state.graph + sctx.storeInfo 显式读（非 ALS）
			const si = sctx.storeInfo as { pathInfo: { workPath: string; targetPath: string }; compilerOptions: { templateExts: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[]; templateDirectivePrefixes: string[] } }
			sctx.loadBindings = readLoadBindings(state, si) as { pages?: unknown; appId?: string } | null
			sctx.allPages = (sctx.loadBindings as { pages?: unknown } | null)?.pages as unknown
			sctx.compatibilityWarnings = new Set<string>()

			const plan = computeStagePlan(dispatchRegistry, compileTarget, sctx.loadBindings as LoadBindings, {
				cwd: process.cwd(),
				affectedEntries,
			})
			sctx.pages = (plan as { filteredPages: PagesInfo }).filteredPages
			const logicOpts = (plan as { stageSpecs: Record<string, { workerOptions: Record<string, unknown> }> }).stageSpecs.logic?.workerOptions
			if (logicOpts) {
				sctx.compileConfig = logicOpts.compileConfig as unknown
				sctx.sourcemap = logicOpts.sourcemap as boolean | undefined
				sctx.sourcemapTargetPath = logicOpts.sourcemapTargetPath as string | undefined
			}
			const compileTasks = (plan as { stages: string[]; stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stageSpecs
				? (plan as { stages: string[]; stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stages.map((stage) => {
					const spec = (plan as { stageSpecs: Record<string, { workerOptions: Record<string, unknown>; renderer?: unknown }> }).stageSpecs[stage]!
					const dispatch = dispatchRegistry.get(stage)
					return createStageTask(
						stage,
						dispatch?.title ?? stage,
						dispatch?.engine ?? null,
						lifecycle,
						spec.workerOptions,
						spec.renderer as RendererAdapter | null,
					)
				})
				: []

			return compileTasks
		},
	}
}
