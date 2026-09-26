/**
 * ConfigCompiler — 编译配置信息 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts initPhases[2] 搬迁）：
 *   compileConfig() + CONFIG_COMPILED 事件（条件 shouldPrepareConfig）
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * 读写 sctx.storeInfo.pathInfo + deps.state.graph（PC-B4c4 闭合 ALS）。
 *
 * 文件名 config-compiler-collab.ts 区别于既有 config-compiler.ts（compileConfig 实现）。
 */

import compileConfig from './config-compiler.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator } from '../types.ts'
import type { PackerSessionState } from '../state/session-state.ts'

export interface ConfigCompilerDeps {
	state: PackerSessionState
	lifecycle: Lifecycle
}

export function createConfigCompiler(): BuildCollaborator<ConfigCompilerDeps> {
	return {
		async run(sctx, deps) {
			const { state, lifecycle } = deps
			if (process.env.SC_TRACE) console.error('[config-compiler-collab] sctx.ctx?', !!sctx.ctx, 'sctx.state?', !!sctx.state)
			// B 切法（PC-B4c4）：workPath/targetPath 从 sctx.ctx 读（D-SC2），appId/appConfig/pageConfig/appName 从 state.graph 读（非 ALS）
			const ctx = sctx.ctx!
			compileConfig(state.graph, { workPath: ctx.workPath, targetPath: sctx.state!.scratch })
			await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COMPILED, {})
		},
	}
}
