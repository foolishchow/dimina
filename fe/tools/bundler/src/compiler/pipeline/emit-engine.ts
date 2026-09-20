import { defineEngine } from '../worker-runtime/define-engine.ts'
import { resetStoreInfo } from '../core/env.ts'
import { produceEntry } from './emit.ts'
import type { EmitEntryParams } from './emit.ts'

/** D-ER-4：emit-worker 引擎。compile = resetStoreInfo + produceEntry → { entry } */
export const emitEngine = defineEngine({
	name: 'emit',
	buildConfig: () => ({}),  // compile 不用 config
	compile: async ({ msg }) => {
		const params = msg as EmitEntryParams & { storeInfo: Parameters<typeof resetStoreInfo>[0] }
		resetStoreInfo(params.storeInfo)  // 搭建上下文（getWorkPath 等可用）
		const { storeInfo: _, ...emitParams } = params
		const entry = await produceEntry(emitParams as EmitEntryParams)
		return { entry }
	},
	successPayload: () => ({}),  // 无 graph
	cleanup: () => {},
})
