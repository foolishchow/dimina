/**
 * DistPreparer — 准备产物目录 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts initPhases[1] 搬迁）：
 *   createDist(scratch, seedPath) + DIST_PREPARED 事件
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * 读 sctx.storeInfo.pathInfo.targetPath（per-request scratch，并发安全）。
 */

import { createDist } from './output.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator, StageChannelContext } from '../types.ts'

export interface DistPreparerDeps {
	seedPath?: string
	lifecycle: Lifecycle
}

export function createDistPreparer(): BuildCollaborator<DistPreparerDeps> {
	return {
		async run(sctx: StageChannelContext, deps: DistPreparerDeps) {
			const { seedPath, lifecycle } = deps
			const scratch = (sctx.storeInfo as { pathInfo: { targetPath: string } }).pathInfo.targetPath
			createDist(scratch, seedPath)
			await lifecycle.emit(LIFECYCLE_EVENTS.DIST_PREPARED, { seedPath })
		},
	}
}
