import { getDependencyGraph } from '../core/env.ts'  // F26：successPayload 默认读 dependencyGraph（业务状态）

interface EngineOverrides { name: string; [key: string]: unknown }
export function defineEngine(overrides: EngineOverrides): { name: string; buildConfig: (msg: Record<string, unknown>) => Record<string, unknown>; cleanup: () => void; successPayload: (ctx: { logger: { warn: (msg: string) => void; flush: () => string[] } }) => Record<string, unknown>; normalizeError: (e: Error) => Record<string, unknown>; [key: string]: unknown } {
	if (!(overrides as { name?: string }).name) throw new Error('defineEngine: name 必填')  // F38：engine 标识（executor 选 thin entry）
	return {
		// name will be overwritten by ...overrides below
		buildConfig: (msg: Record<string, unknown>) => ({ sourcemap: !!msg.sourcemap, minify: (msg.compileConfig as { minify?: boolean } | undefined)?.minify !== false }),
		cleanup: () => {},  // F46：引擎级资源释放（如未来 wxsModuleRegistry.clear）；compile 内部 clear（compileResCache/templateRenderCache 等）照现状不动，不迁入 cleanup；默认空，引擎可选覆盖
		successPayload: ({ logger }) => ({ dependencyGraph: getDependencyGraph().toJSON() }),  // F24/F27：收 ctx，默认含 dependencyGraph（不用 logger）
		normalizeError: (e: Error) => ({ message: e.message, stack: e.stack, name: e.name }),
		...(overrides as EngineOverrides),  // 覆盖=替换；view/logic 覆盖 successPayload 时显式含 dependencyGraph + compatibilityWarnings
	}
}
