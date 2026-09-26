/**
 * ProjectStore — 工程上下文 + 依赖图权威的管家（build-model M1 后续 / project-store PS1）。
 *
 * 职责：装载结果的持有与图权威（load≈storeInfo）。
 * 不是 session、不做 worker 派工、不做 Listr/HTTP/ws/产品 .dev/管会话。
 *
 * 生命周期：随 session 始终存在（非可选）；load 按需。
 * 权威：主线程；worker 只持注入引用，不反改。
 *
 * D-PS-SESSION：session 是唯一会话管理者；ProjectStore 不升级为会话。
 * PS1 不做 applyChanges/subscribe（PS3+）、graphDelta、TS-2 IR。
 *
 * D-SC3/§5.4: ProjectStore 退化为 storeInfo 单调用薄包——
 * getDependencyGraph/merge/snapshot 退役（compat 写死后 ALS graph 死；
 * config-collector 改读 state.graph.getInnerGraph()）。
 */

import { storeInfoCtx } from './env.ts'
import type { PackerContext } from '../types.ts'
import type { PackerSessionState } from '../state/session-state.ts'

/**
 * ProjectStore 形状契约（facade-collaborator D-FC-1 类型来源）。
 *
 * createProjectStore 返回值的 typed 边界——collaborator deps 引用此接口
 * 而非 inferred 返回类型。load 按需（session 内首 build 调）。
 */
export interface ProjectStore {
	load(ctx: PackerContext, state: PackerSessionState): void
}

/**
 * @param {object} [_options]
 * @returns {object} ProjectStore
 */
export function createProjectStore(_options: Record<string, unknown> = {}): ProjectStore {
	return {
		/**
		 * 装载工程上下文（薄包 storeInfo）——D-SC3 纯函数。
		 * storeInfo(ctx, state.graph, state) → void（mutate state.scratch + state.graph）。
		 */
		load(ctx: PackerContext, state: PackerSessionState) {
			storeInfoCtx(ctx, state.graph, state)
		},
	}
}

/**
 * 检查 store 是否已 load（有工程状态）。
 */
export function isLoaded(store: unknown) {
	return store !== null && store !== undefined
}
