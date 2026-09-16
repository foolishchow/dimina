import { Worker } from 'node:worker_threads'
import { workerPool } from '../../watch/worker-pool.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXECUTOR_DIR = path.dirname(fileURLToPath(import.meta.url))
const ENTRY_PATH = { view: '../view/worker-entry.js', logic: '../logic/worker-entry.js', style: '../style/worker-entry.js' }

// F33/F37：消息分流 + 生命周期照 stage-channel 现状搬军（D-BM-7 协议知识单点）
// F36：executeTask 包在 workerPool.runWorker 里（限流协同）
export function executeTask({ engine, input, onOutput, onProgress }) {
	const script = engine.name  // 'view' | 'logic' | 'style'
	const totalTasks = Object.keys(input.pages.mainPages).length
	return workerPool.runWorker(() => new Promise((resolve, reject) => {  // F36：workerPool 限流包裹
		let receivedOutputCount = 0
		let isResolved = false
		// F43：超时照搬现状 stage-channel（stageTimeoutMs ?? env ?? 120_000）
		const stageTimeoutMs = input.stageTimeoutMs ?? Number(process.env.DIMINA_STAGE_TIMEOUT_MS ?? 120_000)
		let timeoutTimer = setTimeout(() => reject(new Error(`[executor] ${script} stage timed out after ${stageTimeoutMs}ms`)), stageTimeoutMs)
		const worker = new Worker(
			path.join(EXECUTOR_DIR, ENTRY_PATH[script]),
			{ ...workerPool.getWorkerOptions(),
				...(import.meta.url.includes('/src/') ? { execArgv: [...process.execArgv, '--experimental-strip-types'] } : {}) },  // D-TD-20
		)
		const terminateWorker = () => { clearTimeout(timeoutTimer); worker.terminate() }
		worker.postMessage(input)
		worker.on('message', async (message) => {
			if (message.type === 'output' && typeof onOutput === 'function') { receivedOutputCount++; onOutput(message.entry); return }
			if (message.completedTasks !== undefined) { onProgress(message.completedTasks, totalTasks); return }
			if (message.success) {
				if (isResolved) return
				if (typeof onOutput === 'function' && message.outputCount !== receivedOutputCount) {
					await terminateWorker(); reject(new Error(`[executor] ${script} output count mismatch: expected ${message.outputCount}, received ${receivedOutputCount}`)); return
				}
				isResolved = true; await terminateWorker()
				resolve({ dependencyGraph: message.dependencyGraph, compatibilityWarnings: message.compatibilityWarnings || [] })  // F35：result 回传，不碰 ctx
			} else if (message.error) { await terminateWorker(); reject(Object.assign(new Error(message.error.message), message.error)) }
		})
		worker.on('error', async (err) => { await terminateWorker(); reject(err) })
		worker.on('exit', (code) => { if (code !== 0 && !isResolved) reject(new Error(`worker exit code ${code}`)) })
	}))
}
