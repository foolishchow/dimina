import { emitEngine } from './emit-engine.ts'
import { runWorker } from '../worker-runtime/runtime.ts'

runWorker(emitEngine)
