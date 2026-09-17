import { runWorker } from '../worker-runtime/runtime.ts'
import { viewEngine } from './index.ts'
// @ts-expect-error P-TM05: type narrowing needed
runWorker(viewEngine)
