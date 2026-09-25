/**
 * ConfigCollector — 收集配置信息 collaborator（facade-collaborator D-FC-1）。
 *
 * 拥有的逻辑（从 orchestrator.ts initPhases[0] 搬迁）：
 *   store.load → storeInfo + 9 sctx 字段设置（buildModel/storeInfo/dependencyGraph/
 *   cache/viewCache/viewOrderList/styleCache/loadedModules/invalidatedModules）+
 *   loaderRegistry.kinds() 派发 + getPages 显式 FixpointCtx（PC-B5）+ state.graph.isMiniGame + CONFIG_COLLECTED 事件
 *
 * 无状态 collaborator（createPackerOrchestrator 闭包内一次构造复用）。
 * 写 sctx 供 P4-P6 读（sctx 所有权矩阵：ConfigCollector 写 9 字段）。
 * ctx→sctx 统一（R12-3：原 L23 ctx.storeInfo → sctx.storeInfo）。
 */

import fs from 'node:fs'
import { BuildModel } from '../emit/build-model.ts'
import { getPagesImpl } from '../graph/config-fixpoint.ts'
import { NpmResolver } from '../graph/npm-resolver.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import type { BuildCollaborator, LoaderRegistry, PackerContext, StageChannelContext } from '../types.ts'
import type { FixpointCtx } from '../graph/config-fixpoint.ts'
import type { ProjectStore } from './project-store.ts'
import type { PackerSessionState } from '../state/session-state.ts'

export interface ConfigCollectorDeps {
	store: ProjectStore
	state: PackerSessionState
	lifecycle: Lifecycle
	loaderRegistry: LoaderRegistry
	workPath: string
	fileTypes?: unknown
	invalidatedModules?: string[]
}

export function createConfigCollector(): BuildCollaborator<ConfigCollectorDeps> {
	return {
		async run(sctx: StageChannelContext, deps: ConfigCollectorDeps) {
			const { store, state, lifecycle, loaderRegistry, workPath, fileTypes, invalidatedModules } = deps
			sctx.buildModel = new BuildModel()
			sctx.storeInfo = store.load(workPath, { fileTypes, graph: state.graph })
			sctx.dependencyGraph = store.getDependencyGraph()
			sctx.cache = state.moduleCache
			// D-HR-1：loaderRegistry 生产消费点——kinds() 派发配置查询（grep 非零）。
			// 阶段函数形状适配是后续门，dispatch 不接线（locked B：compile/emit 维持 worker）。
			// loadedModules 供后续门消费。
			sctx.loadedModules = new Map()
			for (const kind of loaderRegistry.kinds()) {
				void loaderRegistry.get(kind as 'logic' | 'view' | 'style' | 'config')
			}
			// G5 D-G5-2: plumbing view/style cache（镜像 logic cache 模式）
			sctx.viewCache = state.viewCache
			sctx.viewOrderList = state.viewOrderList
			sctx.styleCache = state.styleCache
			if (invalidatedModules) sctx.invalidatedModules = invalidatedModules
			// B 切法（PC-B5）：getPages 显式 FixpointCtx 路由（非 ALS getPages）。
			// 镜像 env.ts toPackerContext：workPath/targetPath/readContent/fileTypes 从 sctx.storeInfo 读；
			// configData 从 state.graph.getConfigData()（store.load 已建图）；npm 从 workPath 建。
			const si = sctx.storeInfo as { pathInfo: { workPath: string; targetPath: string }; compilerOptions: { templateExts: string[]; styleExts: string[]; viewScriptExts: string[]; viewScriptTags: string[]; templateDirectivePrefixes: string[] } }
			const packerCtx: PackerContext = {
				workPath: si.pathInfo.workPath,
				targetPath: si.pathInfo.targetPath,
				readContent: (p: string) => fs.readFileSync(p, { encoding: 'utf-8' }),
				resolveAlias: (_src: string) => null,
				resolveNpm: (src: string) => src,
				fileTypes: {
					templateExts: si.compilerOptions.templateExts,
					styleExts: si.compilerOptions.styleExts,
					viewScriptExts: si.compilerOptions.viewScriptExts,
					viewScriptTags: si.compilerOptions.viewScriptTags,
					directivePrefixes: si.compilerOptions.templateDirectivePrefixes,
				},
			}
			const fc: FixpointCtx = { ctx: packerCtx, configData: state.graph.getConfigData(), npm: new NpmResolver(si.pathInfo.workPath) }
			const allPages = getPagesImpl(fc)
			await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COLLECTED, {
				fileTypes: ((sctx.storeInfo as { compilerOptions?: unknown }).compilerOptions),
				pagesCount: allPages.mainPages.length
					+ Object.values(allPages.subPages).reduce((sum: number, item: { info: unknown[] }) => sum + item.info.length, 0),
				miniGame: state.graph.isMiniGame(),
			})
		},
	}
}
