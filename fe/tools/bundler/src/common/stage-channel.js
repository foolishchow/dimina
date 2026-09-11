/**
 * stage-channel — worker 阶段协议封装（build-model M1 / D-BM-7）。
 *
 * 把原先内联在 index.js runCompileInWorker 的 Worker 生命周期、消息分发、
 * 错误重建、槽位释放语义集中到一处。协议知识（消息形状、错误形状、进度、
 * 完成判定）单点维护。
 *
 * 阶段一（e5320c1c）：从 runCompileInWorker 等价搬移；
 * 阶段二（ef1ab730）：产物流式回传（collectOutput + onOutput + outputCount 对账 + D-P4 超时）。
 * 正常构建路径（onOutput 提供 → collectOutput=true）worker 不写盘；
 * 兼容分支（collectOutput=false）保留直接写盘，供直连 worker 的场景使用。
 *
 * 约束（D-BM-7）：不做通用 RPC / 请求复用 / 重连 / IDL。
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { formatCompileProgress } from './compile-progress.js'
import { LIFECYCLE_EVENTS } from './lifecycle.js'
import { workerPool } from './worker-pool.js'

/**
 * 运行单个编译阶段（view / logic / style）的 worker 任务。
 *
 * @param {object} params
 * @param {'view'|'logic'|'style'} params.script
 * @param {object} params.ctx            Listr 上下文（storeInfo / pages / dependencyGraph / compatibilityWarnings）
 * @param {object} params.task           Listr task（进度 UI）
 * @param {object} [params.options]      { pages, sourcemap, sourcemapTargetPath, compileConfig }
 * @param {object|null} [params.lifecycle] A1 lifecycle（BUILD_WARNING 事件）
 * @param {Function} [params.onOutput]   阶段二接入：接收 worker 回传产物条目
 * @returns {Promise<void>}
 */
export function runCompileStage({ script, ctx, task, options = {}, lifecycle = null, onOutput }) {
	return workerPool.runWorker(() => new Promise((resolve, reject) => {
		const worker = new Worker(
			path.join(path.dirname(fileURLToPath(import.meta.url)), `../core/${script}-compiler.js`),
			workerPool.getWorkerOptions(),
		)
		const pages = options.pages || ctx.pages
		const totalTasks = Object.keys(pages.mainPages).length
			+ Object.values(pages.subPages).reduce((sum, item) => sum + item.info.length, 0)

		let isResolved = false
		let workerError = null
		let terminationPromise
		let receivedOutputCount = 0

		// D-P4：完成消息超时（阈值由构造传入，缺省 120s，不硬编码——可用 env 覆盖）
		const stageTimeoutMs = options.stageTimeoutMs ?? Number(process.env.DIMINA_STAGE_TIMEOUT_MS ?? 120_000)
		const timeoutTimer = setTimeout(() => {
			void handleError(new Error(
				`[stage-channel] ${script} stage timed out after ${stageTimeoutMs}ms (no completion message)`,
			))
		}, stageTimeoutMs)

		const terminateWorker = () => {
			terminationPromise ||= worker.terminate().catch(() => undefined)
			return terminationPromise
		}

		// 统一的错误处理函数，防止重复 reject
		const handleError = async (error) => {
			if (isResolved) return
			clearTimeout(timeoutTimer)
			isResolved = true
			// WorkerPool 只有在 isolate 确实退出后才能释放槽位；否则排队的
			// 阶段会与仍在回收中的 Worker 重叠，突破 CPU/RSS 限制。
			await terminateWorker()
			reject(error)
		}

		worker.postMessage({
			pages,
			storeInfo: ctx.storeInfo,
			sourcemap: !!options.sourcemap,
			sourcemapTargetPath: options.sourcemapTargetPath,
			compileConfig: options.compileConfig,
			collectOutput: typeof onOutput === 'function',
		})

		// 接收 Worker 消息（进度 / 产物回传 / 完成 / 错误）
		worker.on('message', async (message) => {
			try {
				// 阶段二：产物流式回传
				if (message.type === 'output' && typeof onOutput === 'function') {
					receivedOutputCount++
					onOutput(message.entry)
					return
				}

				for (const warning of message.compatibilityWarnings || []) {
					ctx.compatibilityWarnings.add(warning)
					if (lifecycle) {
						await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_WARNING, { message: warning })
					}
				}

				if (process.stdout.isTTY && message.completedTasks !== undefined) {
					task.output = formatCompileProgress(message.completedTasks, totalTasks)
				}

				if (message.success) {
					if (isResolved) return
					if (process.stdout.isTTY && totalTasks > 0) {
						task.output = formatCompileProgress(totalTasks, totalTasks)
					}
					// outputCount 对账：worker 声明的 output 条数 vs 实收（完成消息丢失 → D-P4 超时兜底）
					if (typeof onOutput === 'function' && message.outputCount !== receivedOutputCount) {
						await handleError(new Error(
							`[stage-channel] ${script} output count mismatch: expected ${message.outputCount}, received ${receivedOutputCount}`,
						))
						return
					}
					clearTimeout(timeoutTimer)
					ctx.dependencyGraph.merge(message.dependencyGraph)
					isResolved = true
					await terminateWorker()
					resolve()
				}
				else if (message.error) {
					const error = new Error(message.error.message || message.error)
					if (message.error.name)
						error.name = message.error.name
					if (message.error.stack)
						error.stack = message.error.stack
					if (message.error.file)
						error.file = message.error.file
					if (message.error.line != null)
						error.line = message.error.line
					if (message.error.column != null)
						error.column = message.error.column
					if (message.error.stage)
						error.stage = message.error.stage
					await handleError(error)
				}
			}
			catch (err) {
				await handleError(new Error(`Error processing worker message: ${err.message}\n${err.stack}`))
			}
		})

		worker.on('error', (err) => {
			// 保存错误信息，可能在 exit 事件中使用
			workerError = err
			void handleError(err)
		})
		worker.on('exit', (code) => {
			if (code !== 0 && !isResolved) {
				// 如果已经有 workerError，使用它；否则创建新的错误
				// 退出码 1 通常表示内存溢出或其他致命错误
				const error = workerError || new Error(
					code === 1
						? 'Worker terminated due to reaching memory limit: JS heap out of memory'
						: `Worker stopped with exit code ${code}`,
				)
				void handleError(error)
			}
		})
	}))
}
