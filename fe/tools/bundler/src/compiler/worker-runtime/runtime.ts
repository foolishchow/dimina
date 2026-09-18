import { isMainThread, parentPort } from 'node:worker_threads'
import { abilityContext } from './context.ts'
import type { Engine } from './define-engine.ts'
import { PostMessageSink } from './sinks.ts'
import { BufferingLogger } from './loggers.ts'

// makeProgress 由 runtime 内部定义：持 parentPort（worker 侧，不持 onProgress）
// progress.completedTasks setter → parentPort.postMessage({completedTasks})
// → executor 分流 → onProgress(completed, total)（见 "progress 消息链路"）
function makeProgress(parentPort: { postMessage: (msg: unknown) => void }) {
	let _n = 0
	return {
		get completedTasks() { return _n },
		set completedTasks(v) { _n = v; parentPort.postMessage({ completedTasks: _n }) },
	}
}

export function runWorker(engine: Engine): void {
	if (isMainThread) return
	const sink = new PostMessageSink(parentPort!)
	const logger = new BufferingLogger()
	parentPort!.on('message', async (msg: unknown) => {
		abilityContext.run({ sink, logger }, async () => {
			try {
				const config = engine.buildConfig(msg as Record<string, unknown>)
				await engine.compile({ msg, progress: makeProgress(parentPort!), config })
				engine.cleanup()
				parentPort!.postMessage({
					success: true,
					...engine.successPayload({ logger }),  // F27/F28：payload 归 successPayload（含 dependencyGraph + 可选 compatibilityWarnings）
					outputCount: sink.count,  // D-WR-6
				})
			}
			catch (error) {
				engine.cleanup()
				parentPort!.postMessage({ success: false, error: engine.normalizeError(error as Error) })
			}
		})
	})
}
