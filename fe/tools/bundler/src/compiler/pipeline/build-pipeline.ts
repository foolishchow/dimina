/**
 * build-pipeline — dead shim（D-OR-5 P2）。
 *
 * 编排脑已迁入 `src/packer/orchestrator.ts`。本文件仅兼容旧 import，
 * **零**过程体 / Listr / 写权。新代码请用 `createPackerOrchestrator`。
 */
import { createPackerOrchestrator, type OrchestrateRequest } from '../../packer/orchestrator.ts'
import { PackerSessionState } from '../../packer/session-state.ts'

/**
 * @deprecated 使用 createPackerOrchestrator().orchestrate
 */
export function createBuildPipeline({
	store: providedStore,
	lifecycle: pipelineLifecycle,
}: {
	store?: unknown
	lifecycle?: { emit: (e: string, p: unknown) => Promise<void>; isolatedListenerErrors: unknown[] }
} = {}): { run: (options: Record<string, unknown>) => Promise<Record<string, unknown>> } {
	const orch = createPackerOrchestrator({ store: providedStore, lifecycle: pipelineLifecycle })
	return {
		async run(runOptions: Record<string, unknown>) {
			const state = (runOptions.state as PackerSessionState | undefined) ?? new PackerSessionState()
			const {
				targetPath,
				workPath,
				useAppIdDir = true,
				store,
				lifecycle,
				fileTypes,
				stages,
				affectedEntries,
				seedPath,
				prepareConfig,
				prepareNpm,
				skipMaterialize,
				invalidatedModules,
				incremental,
				configChanged,
				parallel,
				state: _state,
				cache: _cache,
				dependencyGraph: _dg,
				...compileOptions
			} = runOptions as OrchestrateRequest & Record<string, unknown>

			return orch.orchestrate({
				targetPath: targetPath as string,
				workPath: workPath as string,
				useAppIdDir: useAppIdDir as boolean,
				state,
				store: store ?? providedStore,
				lifecycle: (lifecycle as OrchestrateRequest['lifecycle']) ?? pipelineLifecycle,
				fileTypes,
				compileOptions,
				parallel: parallel !== false,
				incremental: incremental === true
					|| (Array.isArray(affectedEntries) && (affectedEntries as string[]).length > 0),
				configChanged: configChanged === true,
				affectedEntries: affectedEntries as string[] | undefined,
				stages: stages as string[] | undefined,
				invalidatedModules: invalidatedModules as string[] | undefined,
				seedPath: seedPath as string | undefined,
				prepareConfig: prepareConfig as boolean | undefined,
				prepareNpm: prepareNpm as boolean | undefined,
				skipMaterialize: skipMaterialize as boolean | undefined,
			})
		},
	}
}
