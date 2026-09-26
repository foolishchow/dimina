/**
 * Publisher — 写入编译产物 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑：output.publish（DiskOutput 封装 materialize+publishToDist）+ BUNDLE_PUBLISHED 事件。
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * F-R11-1：删 skipMaterialize guard + 删 sctx.storeInfo.pathInfo 读（buildDir/temporaryTargetPath 内化入 DiskOutput.publish）+ 加 output deps。
 * F-R14-1：output.publish(target, { useAppIdDir, seedPath, appId, incremental: !!seedPath })。
 */

import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator, StageChannelContext, Output } from '../types.ts'

export interface PublisherDeps {
	targetPath: string
	useAppIdDir: boolean
	seedPath?: string
	appId?: string
	lifecycle: Lifecycle
	output?: Output
}

export function createPublisher(): BuildCollaborator<PublisherDeps> {
	return {
		async run(sctx: StageChannelContext, deps: PublisherDeps) {
			const { targetPath, useAppIdDir, seedPath, appId, lifecycle, output } = deps
			// P-O2 过渡：scratch = sctx.storeInfo.pathInfo.targetPath（per-request TEMP，并发安全）
			// P-O3 后：DiskOutput 内化 mkdtemp（删 sctx.storeInfo.pathInfo 读，F-R11-1）
			const scratch = sctx.state!.scratch
			// D-O3/F-R11-1：output.publish 封装 materialize+publishToDist（DiskOutput 内 dirty guard + rename/sync）
			// MemOutput.publish no-op（dev 不写盘）
			output?.publish(targetPath, { useAppIdDir, scratch, seedPath, appId, incremental: !!seedPath })
			await lifecycle.emit(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, { targetPath, useAppIdDir })
		},
	}
}
