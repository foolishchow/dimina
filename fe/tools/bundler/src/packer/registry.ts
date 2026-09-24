/**
 * PackerDispatchRegistry — orchestrator 派发配置（D-REG-1, D-PCS-5）。
 *
 * H2 Phase 1：materialize emptyRegistry → 实体 dispatch registry。
 * kind → {engine, title} 映射，替代 ENGINES + STAGE_TITLES 散落查表。
 *
 * D-REG-1：compile-target compile 段（deriveStagePlan + filterPagesByEntries）
 * 移入 registry.computeStagePlan——compile-target 只留静态段（createCompileTarget）。
 *
 * D-REG-2：Loader registry 包装 domain parse-walk（load 在 domain，env.ts 提供 ctx）。
 * Phase 2（F-H2-1 L/C/E 拆分）将实体化 Loader/Compiler/Emitter 接口实现。
 *
 * D-REG-3：registry kind 派发保留 stage 概念——kinds() 返回有序 kind 列表
 * （view → logic → style），与 COMPILE_STAGE_ORDER 一致。
 */

import path from 'node:path'
import type { CompileTarget, LoadBindings, PagesInfo, StageSpec, SubPackage } from '../compiler/pipeline/compile-target.types.ts'
import { isMiniGame, getAppId, getAppStyleScopeId, getPages } from './store/env.ts'
import { viewEngine } from '../compiler/view/index.ts'
import { logicEngine } from '../compiler/logic/index.ts'
import { styleEngine } from '../compiler/style/index.ts'
import type { Loader, LoaderRegistry, CompileRegistry, EmitRegistry, Compiler, Emitter, ModuleKind } from './types.ts'

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

// ── L/C/E registry 实体化（D-REG-2, H2 Phase 2）──

/**
 * Loader registry 实体（H2 Phase 2a：logic Loader 已注册；view/style F-H2-1 拆分后注册）。
 *
 * 不同于 PackerDispatchRegistry（stage 级派发），此处是 types.ts LoaderRegistry
 * 的实体实现——管线（graph → load → compile → emit）未来接线用。
 */
export class LoaderRegistryImpl implements LoaderRegistry {
	private loaders = new Map<ModuleKind, Loader>()

	register(kind: ModuleKind, loader: Loader): void {
		this.loaders.set(kind, loader)
	}

	get(kind: ModuleKind): Loader {
		const loader = this.loaders.get(kind)
		if (!loader) {
			throw new Error(`[registry] no Loader registered for kind: ${kind}`)
		}
		return loader
	}

	kinds(): ModuleKind[] {
		return [...this.loaders.keys()]
	}
}

// ── CompileRegistry / EmitRegistry 实体化（D-HR-1：阶段函数注册基座）──
// 阶段函数（compileModuleRender / styleCompile / viewEmit / styleEmit）签名需
// page/继承上下文，不直接 fit Compiler/Emitter 单 module 接口——形状适配
// 是后续门（types.ts 接口演进）。本 registry 实体化满足"非空"档位，
// dispatch 未接线（compile/emit 维持 worker 路径，D-HR-1 locked B）。

export class CompileRegistryImpl implements CompileRegistry {
	private compilers = new Map<ModuleKind, Compiler>()

	register(kind: ModuleKind, compiler: Compiler): void {
		this.compilers.set(kind, compiler)
	}

	get(kind: ModuleKind): Compiler {
		const c = this.compilers.get(kind)
		if (!c) throw new Error(`[registry] no Compiler registered for kind: ${kind}`)
		return c
	}
}

export class EmitRegistryImpl implements EmitRegistry {
	private emitters = new Map<ModuleKind, Emitter>()

	register(kind: ModuleKind, emitter: Emitter): void {
		this.emitters.set(kind, emitter)
	}

	get(kind: ModuleKind): Emitter {
		const e = this.emitters.get(kind)
		if (!e) throw new Error(`[registry] no Emitter registered for kind: ${kind}`)
		return e
	}
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
 * 阶段组装侧唯一 env 读取点（时机：collect-config 之后，ALS 已就绪）。
 * 从 compile-target.ts 移入（D-REG-1: compile-target compile 段替代）。
 */
export function readLoadBindings(): LoadBindings {
	return {
		miniGame: isMiniGame(),
		appId: getAppId(),
		pages: getPages() as PagesInfo,
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
