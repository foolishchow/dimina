/**
 * ConfigCompiler — 编译配置信息 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts initPhases[2] 搬迁）：
 *   compileConfig() + CONFIG_COMPILED 事件（条件 shouldPrepareConfig）
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * 不读写 sctx（纯 compileConfig 调用）。
 *
 * 文件名 config-compiler-collab.ts 区别于既有 config-compiler.ts（compileConfig 实现）。
 */

import compileConfig from './config-compiler.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator } from '../types.ts'

export interface ConfigCompilerDeps {
	lifecycle: Lifecycle
}

export function createConfigCompiler(): BuildCollaborator<ConfigCompilerDeps> {
	return {
		async run(_sctx, deps) {
			const { lifecycle } = deps
			compileConfig()
			await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COMPILED, {})
		},
	}
}
