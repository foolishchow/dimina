import { getDependencyGraph } from '../store/env.ts'  // F26：successPayload 默认读 dependencyGraph（业务状态）

// 共享引擎类型：worker-entry → runWorker、defineEngine → executor 选 thin entry 均引用
export interface EngineBuildConfig {
	(msg: Record<string, unknown>): Record<string, unknown>
}
// compile 入参：worker runtime 构造 { msg, progress, config } 传入
export interface CompileOptions {
	msg: unknown
	progress: unknown
	config: unknown
}
export interface Engine {
	name: string
	buildConfig: (msg: Record<string, unknown>) => Record<string, unknown>
	compile: (opts: CompileOptions) => Promise<Record<string, unknown> | void>
	cleanup: () => void
	successPayload: (ctx: { logger: { warn: (msg: string) => void; flush: () => string[] } }) => Record<string, unknown>
	normalizeError: (e: Error) => Record<string, unknown>
}
interface EngineOverrides extends Partial<Engine> { name: string; [key: string]: unknown }
export function defineEngine(overrides: EngineOverrides): Engine {
	if (!(overrides as { name?: string }).name) throw new Error('defineEngine: name 必填')  // F38：engine 标识（executor 选 thin entry）
	return {
		// name will be overwritten by ...overrides below
		buildConfig: (msg: Record<string, unknown>) => ({ sourcemap: !!msg.sourcemap, minify: (msg.compileConfig as { minify?: boolean } | undefined)?.minify !== false }),
		cleanup: () => {},  // F46：引擎级资源释放（如未来 wxsModuleRegistry.clear）；compile 内部 clear（compileResCache/templateRenderCache 等）照现状不动，不迁入 cleanup；默认空，引擎可选覆盖
		successPayload: () => ({ dependencyGraph: getDependencyGraph().toJSON() }),  // F24/F27：收 ctx，默认含 dependencyGraph（不用 logger）
		normalizeError: (e: Error) => ({ message: e.message, stack: e.stack, name: e.name }),
		...(overrides as EngineOverrides),  // 覆盖=替换；view/logic 覆盖 successPayload 时显式含 dependencyGraph + compatibilityWarnings
	} as Engine
}
