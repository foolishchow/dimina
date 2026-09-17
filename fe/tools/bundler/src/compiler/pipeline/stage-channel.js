/**
 * stage-channel — worker 阶段协议封装（build-model M1 / D-BM-7）。
 *
 * P-WR06：worker 生命周期 + 消息分发搬到 worker-runtime/executor.js
 * （executeTask）。stage-channel 退化成 executeTask 调用方 + ctx/lifecycle
 * 写入（F35：executor 不碰 ctx，resolve 返回 result，调用方写 ctx）。
 *
 * 约束（D-BM-7）：不做通用 RPC / 请求复用 / 重连 / IDL。
 */

import { formatCompileProgress } from '../../shared/compile-progress.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import { executeTask } from '../worker-runtime/executor.ts'
import { viewEngine } from '../view/index.js'
import { logicEngine } from '../logic/index.js'
import { styleEngine } from '../style/index.js'

const ENGINES = { view: viewEngine, logic: logicEngine, style: styleEngine }

/**
 * 运行单个编译阶段（view / logic / style）的 worker 任务。
 *
 * @param {object} params
 * @param {'view'|'logic'|'style'} params.script
 * @param {object} params.ctx            Listr 上下文（storeInfo / pages / dependencyGraph / compatibilityWarnings）
 * @param {object} params.task           Listr task（进度 UI）
 * @param {object} [params.options]      { pages, sourcemap, sourcemapTargetPath, compileConfig, stageTimeoutMs }
 * @param {object|null} [params.lifecycle] A1 lifecycle（BUILD_WARNING 事件）
 * @param {Function} [params.onOutput]   产物流式回传
 * @returns {Promise<void>}
 */
export async function runCompileStage({ script, ctx, task, options = {}, lifecycle = null, onOutput }) {
	const pages = options.pages || ctx.pages
	const totalTasks = Object.keys(pages.mainPages).length
		+ Object.values(pages.subPages).reduce((sum, item) => sum + item.info.length, 0)

	const result = await executeTask({
		engine: ENGINES[script],
		input: {
			pages,
			storeInfo: ctx.storeInfo,
			sourcemap: !!options.sourcemap,
			sourcemapTargetPath: options.sourcemapTargetPath,
			compileConfig: options.compileConfig,
			stageTimeoutMs: options.stageTimeoutMs,
			collectOutput: typeof onOutput === 'function',  // 兼容字段（worker onMessage 旧版解构，runtime 不用）
		},
		onOutput,
		onProgress: (completed, total) => {
			if (process.stdout.isTTY) {
				task.output = formatCompileProgress(completed, total)
			}
		},
	})

	// F35：executor 不碰 ctx，调用方写 ctx
	ctx.dependencyGraph.merge(result.dependencyGraph)
	for (const warning of result.compatibilityWarnings) {
		ctx.compatibilityWarnings.add(warning)
		if (lifecycle) {
			await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_WARNING, { message: warning })
		}
	}

	if (process.stdout.isTTY && totalTasks > 0) {
		task.output = formatCompileProgress(totalTasks, totalTasks)
	}
}
