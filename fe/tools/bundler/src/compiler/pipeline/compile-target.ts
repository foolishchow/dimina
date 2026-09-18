/**
 * CompileTarget — 编译产物形态描述（fe-tools-compiler-target）。
 *
 * E1 不变量（R-CT4 / D-CT-4）：
 * - 管线侧必须自调用 resolveCompileConfig（直调 build() 路径自洽，L3）；
 * - session 层另经 resolveBundlerConfig 解析（D-R2 seeds）；
 * - 两合法路径，同一纯函数；不得在 build-pipeline 内联 MODE_PRESETS /
 *   sourcemapStrategyFor / 平台合法性判断。
 *
 * 两段性（E6 / D-CT-3）：
 *   createCompileTarget(runOptions)           // 静态段（Listr 前 fail-fast）
 *   → readLoadBindings()                     // 动态段：阶段组装侧唯一 env 读取点
 *   → deriveStagePlan(target, bindings, opts) // 纯派生：stages / workerOptions / paths
 *
 * 「形态条件单源于 compile-target」：新增形态轴须经描述 + 派生，不得在闭包内散算。
 */
import type { CompileTarget, LoadBindings, PagesInfo, StageSpec, SubPackage } from './compile-target.types.ts'

import path from 'node:path'
import { resolveCompileConfig } from '../../shared/compile-config.ts'
import { assertRendererSupportsPlatform } from '../../shared/platforms.ts'
import { getAppId, getAppStyleScopeId, getPages, isMiniGame } from '../core/env.ts'
import { getRenderer, resolveProjectRenderers } from '../core/renderers.ts'

const COMPILE_STAGE_ORDER = ['view', 'logic', 'style']
const STAGE_TITLES: Record<string, string> = Object.freeze({
	view: '编译视图',
	logic: '编译逻辑',
	style: '编译样式',
})

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

/**
 * 阶段组装侧唯一 env 读取点（时机：collect-config 之后，ALS 已就绪）。
 * worker / 编译器内部读取不迁移（R-CT2 / F1）。
 */
export function readLoadBindings(): LoadBindings {
	return {
		miniGame: isMiniGame(),
		appId: getAppId(),
		pages: getPages() as PagesInfo,
		appStyleScopeId: getAppStyleScopeId(),
	}
}

function assertLoadBindings(bindings: unknown): asserts bindings is LoadBindings {
	if (!bindings || typeof bindings !== 'object') {
		throw new TypeError('deriveStagePlan: incomplete load bindings (call readLoadBindings after collect-config)')
	}
	const b = bindings as Record<string, unknown>
	if (typeof b.miniGame !== 'boolean' || !('appId' in b) || b.pages == null || !('appStyleScopeId' in b)) {
		throw new TypeError('deriveStagePlan: incomplete load bindings (call readLoadBindings after collect-config)')
	}
}


/**
 * 过滤受影响页面（S9 改道：从 build-pipeline.ts 搬入 derive）。
 * affectedEntries 为 undefined 时返回原 pages（全量路径）。
 */
function filterPagesByEntries(pages: PagesInfo, affectedEntries: string[] | undefined): PagesInfo {
	if (!Array.isArray(affectedEntries)) {
		return pages
	}
	const selected = new Set(affectedEntries)
	return {
		...pages,
		mainPages: pages.mainPages.filter(page => selected.has(page.path)),
		subPages: Object.fromEntries(
			(Object.entries(pages.subPages) as [string, SubPackage][])
				.map(([root, subPackage]) => [root, {
					...subPackage,
					info: subPackage.info.filter(page => selected.has(page.path)),
				}] as [string, SubPackage])
				.filter(([, subPackage]) => subPackage.info.length > 0),
		),
	}
}

/**
 * 纯函数：由静态 CompileTarget + 动态 bindings 派生阶段计划（返回新对象，无突变）。
 *
 * `affectedEntries` 为增量契约输入；derive 内部经 `filterPagesByEntries` 产出 filteredPages。
 */
export function deriveStagePlan(compileTarget: CompileTarget, bindings: LoadBindings, { cwd, affectedEntries }: { cwd?: string, affectedEntries?: string[] } = {}): {
	stages: string[]
	stageSpecs: Record<string, StageSpec>
	sourcemapTargetPath: string
	stylePages: PagesInfo
	filteredPages: PagesInfo
} {
	assertLoadBindings(bindings)
	if (typeof cwd !== 'string' || !cwd) {
		throw new TypeError('deriveStagePlan: cwd must be a non-empty string')
	}

	const filteredPages = filterPagesByEntries(bindings.pages, affectedEntries)
	const pagesForStyle = filteredPages
	const stages = COMPILE_STAGE_ORDER.filter((stage) => {
		if (!compileTarget.requestedStages.has(stage)) {
			return false
		}
		if ((stage === 'view' || stage === 'style') && bindings.miniGame) {
			return false
		}
		return true
	})

	const sourcemapTargetPath = path.resolve(
		cwd,
		compileTarget.targetPath,
		compileTarget.useAppIdDir ? (bindings.appId ?? '') : '',
	)

	const stylePages = {
		...pagesForStyle,
		mainPages: [
			{ path: 'app', id: bindings.appStyleScopeId },
			...pagesForStyle.mainPages,
		],
	}

	const { sourcemap, compileConfig, renderer } = compileTarget
	const stageSpecs: Record<string, StageSpec> = {}

	if (stages.includes('view')) {
		stageSpecs.view = {
			workerOptions: {
				sourcemap,
				compileConfig,
			},
			renderer: renderer.adapter,
		}
	}
	if (stages.includes('logic')) {
		stageSpecs.logic = {
			workerOptions: {
				sourcemap,
				pages: bindings.pages,
				sourcemapTargetPath,
				compileConfig,
			},
			renderer: null,
		}
	}
	if (stages.includes('style')) {
		stageSpecs.style = {
			workerOptions: {
				sourcemap,
				pages: stylePages,
				compileConfig,
			},
			renderer: renderer.adapter,
		}
	}

	return {
		stages,
		stageSpecs,
		sourcemapTargetPath,
		stylePages,
		filteredPages,
	}
}

export { COMPILE_STAGE_ORDER, STAGE_TITLES }
