import { runWorker } from '../worker-runtime/runtime.ts'
import { logicEngine } from './index.ts'
// @ts-expect-error P-TM05: type narrowing needed
runWorker(logicEngine)
