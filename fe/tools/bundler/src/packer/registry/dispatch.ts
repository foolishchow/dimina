/**
 * PackerDispatchRegistry — orchestrator 派发配置（D-REG-1, D-PCS-5）。
 *
 * 拆分自 registry.ts（fe-tools-packer-directory-convergence D-DC-1 packer/registry/ 收敛）。
 * 本文件含 dispatch registry + stage 计算（createDispatchRegistry / computeStagePlan /
 * readLoadBindings / assertLoadBindings / filterPagesByEntries）。
 * L/C/E registry 实体（LoaderRegistryImpl/CompileRegistryImpl/EmitRegistryImpl）移入 lce.ts。
 */

import path from 'node:path'
import type { CompileTarget, LoadBindings, PagesInfo, StageSpec, SubPackage } from '../pipeline/compile-target.types.ts'
import { getAppStyleScopeId } from '../store/env.ts'
import { getPagesImpl, buildFixpointCtx } from '../graph/config-fixpoint.ts'
import type { PackerSessionState } from '../state/session-state.ts'
import { viewEngine } from '../../compiler/view/index.ts'
import { logicEngine } from '../../compiler/logic/index.ts'
import { styleEngine } from '../../compiler/style/index.ts'

// Engine 类型——defineEngine 返回值（三车道 union）
type Engine = typeof viewEngine | typeof logicEngine | typeof styleEngine

/** kind 派发配置。 */
export interface KindDispatch {
	kind: string
	engine: Engine
	title: string
}

/**
 * Orchestrator 的派发配置（D-PCS-5: kind → dispatch 映射）。
 *
 * 不同于 types.ts 的 LoaderRegistry/CompileRegistry/EmitRegistry（Phase 2 L/C/E
 * 拆分后实体化），此处是 stage 级派发——kind → {engine, title}。
 */
export class PackerDispatchRegistry {
	private dispatches = new Map<string, KindDispatch>()

	register(dispatch: KindDispatch): void {
		this.dispatches.set(dispatch.kind, dispatch)
	}

	get(kind: string): KindDispatch | undefined {
		return this.dispatches.get(kind)
	}

	kinds(): string[] {
		return [...this.dispatches.keys()]
	}
}

/**
 * 创建实体 dispatch registry——注册 view/logic/style 三车道。
 *
 * kind 顺序 = COMPILE_STAGE_ORDER（view → logic → style），Map 保插入序。
 */
export function createDispatchRegistry(): PackerDispatchRegistry {
	const registry = new PackerDispatchRegistry()
	registry.register({ kind: 'view', engine: viewEngine, title: '编译视图' })
	registry.register({ kind: 'logic', engine: logicEngine, title: '编译逻辑' })
	registry.register({ kind: 'style', engine: styleEngine, title: '编译样式' })
	return registry
}

// ── stage 计算（从 compile-target.ts 移入）──

function assertLoadBindings(bindings: unknown): asserts bindings is LoadBindings {
	if (!bindings || typeof bindings !== 'object') {
		throw new TypeError('computeStagePlan: incomplete load bindings (call readLoadBindings after collect-config)')
	}
	const b = bindings as Record<string, unknown>
	if (typeof b.miniGame !== 'boolean' || !('appId' in b) || b.pages == null || !('appStyleScopeId' in b)) {
		throw new TypeError('computeStagePlan: incomplete load bindings (call readLoadBindings after collect-config)')
	}
}

/**
 * 过滤受影响页面（affectedEntries 为 undefined 时返回原 pages——全量路径）。
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
 * 阶段组装侧 load bindings 读取（时机：collect-config 之后）。
 * B 切法（PC-B7）：isMiniGame/getAppId 从 state.graph 读，getPages 从显式 FixpointCtx（非 ALS）。
 * getAppStyleScopeId 是纯 uuid('app')（非 ALS）。
 */
export function readLoadBindings(state: PackerSessionState, storeInfo: { pathInfo: { workPath: string; targetPath: string }; compilerOptions: { templateExts: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[]; templateDirectivePrefixes: string[] } }): LoadBindings {
	const fc = buildFixpointCtx(storeInfo.pathInfo.workPath, storeInfo.pathInfo.targetPath, storeInfo.compilerOptions, state.graph.getConfigData())
	return {
		miniGame: state.graph.isMiniGame(),
		appId: state.graph.getAppId(),
		pages: getPagesImpl(fc) as PagesInfo,
		appStyleScopeId: getAppStyleScopeId(),
	}
}

/**
 * 纯函数：由 registry + 静态 CompileTarget + 动态 bindings 派生阶段计划。
 *
 * 替代 compile-target.deriveStagePlan（D-REG-1: compile-target compile 段移入 registry）。
 * stages 从 registry.kinds() 派生（非 COMPILE_STAGE_ORDER 硬编码）。
 */
export function computeStagePlan(
	registry: PackerDispatchRegistry,
	compileTarget: CompileTarget,
	bindings: LoadBindings,
	{ cwd, affectedEntries }: { cwd?: string, affectedEntries?: string[] } = {},
): {
	stages: string[]
	stageSpecs: Record<string, StageSpec>
	sourcemapTargetPath: string
	stylePages: PagesInfo
	filteredPages: PagesInfo
} {
	assertLoadBindings(bindings)
	if (typeof cwd !== 'string' || !cwd) {
		throw new TypeError('computeStagePlan: cwd must be a non-empty string')
	}

	const filteredPages = filterPagesByEntries(bindings.pages, affectedEntries)
	const pagesForStyle = filteredPages
	const allKinds = registry.kinds()
	const stages = allKinds.filter((kind) => {
		if (!compileTarget.requestedStages.has(kind)) {
			return false
		}
		if ((kind === 'view' || kind === 'style') && bindings.miniGame) {
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
