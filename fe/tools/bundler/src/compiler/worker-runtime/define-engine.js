import { getDependencyGraph } from '../core/env.ts'  // F26：successPayload 默认读 dependencyGraph（业务状态）

export function defineEngine(overrides) {
	if (!overrides.name) throw new Error('defineEngine: name 必填')  // F38：engine 标识（executor 选 thin entry）
	return {
		name: overrides.name,  // F38：'view' | 'logic' | 'style'
		buildConfig: msg => ({ sourcemap: !!msg.sourcemap, minify: msg.compileConfig?.minify !== false }),
		cleanup: () => {},  // F46：引擎级资源释放（如未来 wxsModuleRegistry.clear）；compile 内部 clear（compileResCache/templateRenderCache 等）照现状不动，不迁入 cleanup；默认空，引擎可选覆盖
		successPayload: ({ logger }) => ({ dependencyGraph: getDependencyGraph().toJSON() }),  // F24/F27：收 ctx，默认含 dependencyGraph（不用 logger）
		normalizeError: e => ({ message: e.message, stack: e.stack, name: e.name }),
		...overrides,  // 覆盖=替换；view/logic 覆盖 successPayload 时显式含 dependencyGraph + compatibilityWarnings
	}
}
