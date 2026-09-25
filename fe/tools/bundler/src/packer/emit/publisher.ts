/**
 * Publisher — 写入编译产物 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts 写入产物 task 搬迁）：
 *   materialize（skipMaterialize guard）+ publishToDist（增量/全量）+ BUNDLE_PUBLISHED 事件
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * 读 sctx.buildModel（P3 设 + P4/P5 add，materialize 消费）+ ALS getTargetPath（D-FC-4 保留）。
 */

import { materialize } from './build-model.ts'
import { publishToDist } from './publish.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator, StageChannelContext } from '../types.ts'
import type { BuildModel } from './build-model.ts'

export interface PublisherDeps {
	targetPath: string
	useAppIdDir: boolean
	seedPath?: string
	skipMaterialize?: boolean
	lifecycle: Lifecycle
}

export function createPublisher(): BuildCollaborator<PublisherDeps> {
	return {
		async run(sctx: StageChannelContext, deps: PublisherDeps) {
			const { targetPath, useAppIdDir, seedPath, skipMaterialize, lifecycle } = deps
			if (!skipMaterialize) {
				// B 切法（PC-B2）：build dir 从 sctx.storeInfo 显式读（非 ALS getTargetPath）
				const buildDir = (sctx.storeInfo as { pathInfo: { targetPath: string } }).pathInfo.targetPath
				materialize(sctx.buildModel as BuildModel, buildDir)
			}
			// H4 Phase 2 (F-H4-2): seedPath（watch/compile-cache 增量）→ 增量 sync publish
			// （content-diff，无 rm 窗口）；否则全量（one-shot，行为不变，F8 guard）
			publishToDist(targetPath, useAppIdDir, !!seedPath)
			await lifecycle.emit(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, { targetPath, useAppIdDir })
		},
	}
}
