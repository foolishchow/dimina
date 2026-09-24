/**
 * PackerGraph — config fixpoint 的拥有者（Graph 接口的默认实现）。
 *
 * 职责：
 * - build(ctx): 读 app.json → 递归发现组件 → 建图（config fixpoint）
 * - reconcile(ctx): 重新 config fixpoint + 合入旧图 source-level edges + 删 stale
 * - 查询: 委托 DependencyGraph
 * - ALS getter 兼容: getComponent / getAppConfigInfo / getRuntimeType / isMiniGame
 * - 快照: toJSON / restoreFromSnapshot / getConfigData / getInnerGraph
 *
 * D-GB-1 三阶段：
 *   现在（路 2）: build 从 ctx.readContent 直接读文件，不经 ALS。
 *   D-PC-0/6: config fixpoint 迁入 Graph，关路 1。
 *
 * D-GB-2: ALS getters 委托 Graph（this.configData），ALS 持 Graph ref。
 * D-GB-3: reconcile = build + merge old + remove stale。
 * D-GB-4: storeInfo 瘦身为 steps 1-2（paths + fileTypes），steps 3-6 委托 Graph。
 */

import type { Graph, PackerContext } from '../types.ts'
import { DependencyGraph } from './dependency-graph.ts'
import type { GraphSnapshot } from './dependency-graph.ts'
import type { PageConfig, ComponentConfig } from '../store/env.ts'
import {
	type FixpointCtx,
	readProjectConfig,
	readAppConfig,
	readPageConfig,
	buildInitialGraph,
} from './config-fixpoint.ts'
import { NpmResolver } from './npm-resolver.ts'

type DependencyGraphSnapshot = ConstructorParameters<typeof DependencyGraph>[0]

const MINI_PROGRAM_RUNTIME_TYPE = 'miniProgram'
const MINI_GAME_RUNTIME_TYPE = 'game'

/**
 * ConfigInfo 的类型安全子集（无索引签名）。
 * 字段 optional 匹配 ConfigInfo 运行时形状。
 */
export interface GraphConfigData {
	projectInfo?: Record<string, unknown>
	appInfo?: Record<string, unknown>
	componentInfo?: Record<string, ComponentConfig>
	pageInfo?: Record<string, PageConfig>
	runtimeType?: string
}

/**
 * PackerGraph — Graph 接口的默认实现。
 * 持有 config fixpoint 结果（configData）和活依赖图（graph）。
 */
export class PackerGraph implements Graph {
	/** 活依赖图。 */
	private graph: DependencyGraph = new DependencyGraph()

	/** config fixpoint 结果。 */
	private configData: GraphConfigData = {}

	/**
	 * config fixpoint（读 app.json → 递归发现组件 → 扫文件 → 建图）。
	 *
	 * 路 2（D-PC-0/6）: 从 ctx.readContent 直接读文件，不经 ALS。
	 * D-PC-9: build 过程只读写 Graph 局部 configData；禁止 ALS getter 回环。
	 * D-PC-8: NpmResolver(ctx.workPath) for config fixpoint。
	 * D-PC-10: ctx.fileTypes 建图。
	 */
	build(ctx: PackerContext): void {
		const fc: FixpointCtx = {
			ctx,
			configData: this.configData,
			npm: new NpmResolver(ctx.workPath),
		}
		readProjectConfig(fc)
		readAppConfig(fc)
		readPageConfig(fc)
		this.graph = buildInitialGraph(fc)
	}

	/**
	 * 配置变更时重新 config fixpoint + reconcile。
	 *
	 * D-GB-3: build 后合入旧图 source-level edges，删除 stale entries。
	 * 旧图来自 this.graph（reconcile 前由 restoreFromSnapshot 设置）。
	 */
	reconcile(ctx: PackerContext): void {
		// 保存旧图（由 restoreFromSnapshot 在 reconcile 前设置）
		const oldGraph = this.graph

		// 1. 重新 config fixpoint → fresh graph
		this.build(ctx)

		// 2. 记录 fresh entries（pages + components from new config）
		const freshEntryIds = new Set<string>()
		for (const [id, node] of this.graph.nodes) {
			if (node.type === 'page' || node.type === 'component') {
				freshEntryIds.add(id)
			}
		}

		// 3. 合入旧图 source-level edges
		this.graph.merge(oldGraph)

		// 4. 删除 stale entries（旧 config 有但新 config 没有的 page/component）
		for (const [id, node] of this.graph.nodes) {
			if ((node.type === 'page' || node.type === 'component') && !freshEntryIds.has(id)) {
				this.graph.removeNode(id)
			}
		}
	}

	/** 合并 worker source-level delta。 */
	mergeDelta(delta: GraphSnapshot): void {
		this.graph.merge(delta)
	}

	/** 跨线程序列化。 */
	toJSON(): GraphSnapshot {
		return this.graph.toJSON() as GraphSnapshot
	}

	// ── 查询（委托 DependencyGraph）──

	/** entry 集（Orchestrator 查要编哪些）。 */
	getEntries(): string[] {
		return [...this.graph.nodes.values()].filter(n => n.entry).map(n => n.id)
	}

	/** file ownership（Orchestrator 查要 parse 哪些文件）。 */
	getFileOwners(moduleId: string): string[] {
		return [...(this.graph.nodes.get(moduleId)?.files ?? [])]
	}

	/** 受影响的 entry 列表。 */
	getAffectedEntries(file: string): string[] {
		return this.graph.getAffectedEntries(file)
	}

	/** 失效模块列表。 */
	getInvalidatedModules(file: string): string[] {
		return this.graph.getInvalidatedModules(file)
	}

	/** 文件是否在图中。 */
	hasFile(file: string): boolean {
		return this.graph.hasFile(file)
	}

	/** 文件的 kind 列表。 */
	getFileKinds(file: string): string[] {
		return this.graph.getFileKinds(file)
	}

	// ── ALS getter 兼容 ──

	/** 获取组件配置。 */
	getComponent(src: string): unknown {
		return (this.configData.componentInfo!)[src]
	}

	/** 获取 app 配置信息。 */
	getAppConfigInfo(): Record<string, unknown> {
		return this.configData.appInfo!
	}

	/** 获取运行时类型。 */
	getRuntimeType(): string {
		return this.configData.runtimeType || MINI_PROGRAM_RUNTIME_TYPE
	}

	/** 是否为小游戏。 */
	isMiniGame(): boolean {
		return this.getRuntimeType() === MINI_GAME_RUNTIME_TYPE
	}

	// ── 快照 ──

	/**
	 * 从快照恢复（worker 重建上下文用）。
	 * configData 从 configInfo 快照复制，graph 从 dependencyGraph 快照重建。
	 */
	restoreFromSnapshot(configInfo: GraphConfigData, dependencyGraph: DependencyGraphSnapshot): void {
		this.configData = { ...configInfo }
		this.graph = new DependencyGraph(dependencyGraph)
	}

	/** 获取 config fixpoint 结果。 */
	getConfigData(): GraphConfigData {
		return this.configData
	}

	/** 获取内部 DependencyGraph 引用。 */
	getInnerGraph(): DependencyGraph {
		return this.graph
	}
}
