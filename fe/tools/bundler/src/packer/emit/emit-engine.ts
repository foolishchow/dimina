import { defineEngine } from '../worker/define-engine.ts'
import { buildPackerContextFromOptions } from '../graph/config-fixpoint.ts'
import type { ResetStoreInfoOptions } from '../store/env-compute.ts'
import { produceEntry } from './emit.ts'
import type { EmitEntryParams } from './emit.ts'

/** D-ER-4：emit-worker 引擎。compile = resetStoreInfo + produceEntry → { entry } */
export const emitEngine = defineEngine({
	name: 'emit',
	buildConfig: () => ({}),  // compile 不用 config
	compile: async ({ msg }) => {
		const params = msg as EmitEntryParams & { storeInfo: ResetStoreInfoOptions }
		const { storeInfo, ...emitParams } = params
		const ctx = buildPackerContextFromOptions(storeInfo.pathInfo.workPath!, storeInfo.pathInfo.targetPath!, storeInfo.compilerOptions!, { configInfo: storeInfo.configInfo as Record<string, unknown> })
		const entry = await produceEntry(emitParams as EmitEntryParams, ctx)
		return { entry }
	},
	successPayload: () => ({}),  // 无 graph
	cleanup: () => {},
})
