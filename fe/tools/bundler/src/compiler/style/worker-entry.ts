import { runWorker } from '../worker-runtime/runtime.ts'
import { styleEngine } from './index.ts'
// @ts-expect-error P-TM05: type narrowing needed
runWorker(styleEngine)
