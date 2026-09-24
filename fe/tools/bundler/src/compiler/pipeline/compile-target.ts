/**
 * CompileTarget — 编译产物形态描述（fe-tools-compiler-target）。
 *
 * H2 (D-REG-1)：compile 段移入 packer/registry.ts。compile-target 只留
 * 静态段（createCompileTarget + COMPILE_STAGE_ORDER 验证）。
 *
 * E1 不变量（R-CT4 / D-CT-4）：
 * - 管线侧必须自调用 resolveCompileConfig（直调 build() 路径自洽，L3）；
 * - session 层另经 resolveBundlerConfig 解析（D-R2 seeds）；
 * - 两合法路径，同一纯函数；不得在 build-pipeline 内联 MODE_PRESETS /
 *   sourcemapStrategyFor / 平台合法性判断。
 *
 * 「形态条件单源于 compile-target」：新增形态轴须经描述 + 派生，不得在闭包内散算。
 */
import type { CompileTarget } from './compile-target.types.ts'

import { resolveCompileConfig } from '../../shared/compile-config.ts'
import { assertRendererSupportsPlatform } from '../../shared/platforms.ts'
import { getRenderer, resolveProjectRenderers } from '../../packer/registry/renderers.ts'

import { COMPILE_STAGE_ORDER } from '../../model/stage-order.ts'

/**
 * 从单次 run 选项构建静态 CompileTarget（fail-fast，消息与改道前逐字一致）。
 */
export function createCompileTarget(runOptions: Record<string, unknown>): CompileTarget {
	const { targetPath, workPath, useAppIdDir = true, stages } = runOptions as { targetPath: string; workPath: string; useAppIdDir?: boolean; stages?: string[] }

	if (stages !== undefined
		&& (!Array.isArray(stages) || stages.some(stage => !COMPILE_STAGE_ORDER.includes(stage)))) {
		throw new TypeError(`Invalid compiler stages: ${JSON.stringify(stages)}`)
	}

	const compileConfig = resolveCompileConfig({ apiOptions: runOptions })

	const { appRenderer } = resolveProjectRenderers(workPath)
	const adapter = getRenderer(appRenderer)
	if (!adapter) {
		throw new Error(`Renderer adapter not registered: ${appRenderer}`)
	}
	assertRendererSupportsPlatform(adapter, compileConfig.platform)

	const requestedStages = new Set(stages === undefined
		? COMPILE_STAGE_ORDER
		: COMPILE_STAGE_ORDER.filter(stage => stages.includes(stage)))

	return {
		mode: compileConfig.mode,
		platform: compileConfig.platform,
		esTarget: compileConfig.esTarget,
		minify: compileConfig.minify,
		sourcemap: compileConfig.sourcemap,
		sourcemapStrategy: compileConfig.sourcemapStrategy,
		compileConfig,
		renderer: { name: adapter.name, adapter },
		requestedStages,
		targetPath,
		useAppIdDir,
		workPath,
	}
}

export { COMPILE_STAGE_ORDER }

// H2 (D-REG-1): compile 段移入 packer/registry.ts（readLoadBindings +
// computeStagePlan + page filtering + stage titles）。compile-target 只留静态段。
