/**
 * dev server 的 reloadLevel 合成（dmcc-dev-server 契约 v1，technical-design §4）。
 *
 * 纯函数：输入 watch 计划结果 + 变更上下文，输出 ws 推送载荷（不含 type，推送端包装）。
 *
 * 实参来源（评审 F-001 定案）：
 * - plan = createWatchBuildPlan 返回值（{ skip, incremental, options }）；
 *   本函数不触碰 src/watch/watch-plan.js —— stages 取 plan.options.stages、
 *   受影响页面取 plan.options.affectedEntries，对外载荷字段名统一为 affectedPages。
 * - event / filePath / count = createWatchRebuildScheduler 的 change 对象字段。
 * - appId / buildId 由 dev 侧持有（初始 build 结果的 appId；每次重建自增的 buildId）。
 *
 * 合成规则（对齐 RFC §4.2，最破坏性优先）：
 *   plan.skip              -> null（不推送）
 *   incremental=false      -> L0（非增量全量：合并/配置/未知类型/新增删除，保守重启）
 *   stages 含 'logic'      -> L1（本门生效级别：页面 relaunch）
 *   stages 含 'view'       -> L3（上报级别；宿主按刷新回退，A3 升级执行端）
 *   仅 'style'             -> L2（同 L3 语义）
 *   防御：affectedPages 为空但 stages 非空 -> L1
 */

const RELOAD_LEVELS = Object.freeze({
	L0: 'L0',
	L1: 'L1',
	L2: 'L2',
	L3: 'L3',
})

/**
 * @param {{ event: string, filePath: string, count: number,
 *           plan: { skip: boolean, incremental: boolean, options: object },
 *           appId: string, buildId: number }} input
 * @returns {({ appId: string, reloadLevel: string, changedStages: string[],
 *             affectedPages: string[], buildId: number } | null)} 合成后的 ws 推送载荷；
 *   plan.skip 时为 null（不推送）。
 */
function synthesizeReloadLevel(input) {
	const { plan, appId, buildId } = input
	if (!plan || plan.skip) {
		return null
	}
	if (!plan.incremental) {
		// 非增量全量：createWatchBuildPlan 对 count>1 / 配置 json / 未知 kind /
		// add/unlink 均返回 incremental=false，全部保守按 L0（容器重启）。
		return { appId, reloadLevel: RELOAD_LEVELS.L0, changedStages: [], affectedPages: [], buildId }
	}

	const stages = plan.options?.stages ?? []
	const affectedEntries = plan.options?.affectedEntries ?? []
	const affectedPages = [...affectedEntries]

	if (affectedPages.length === 0) {
		// 防御：增量但受页面为空时不能精确 relaunch，保守页面级。
		return { appId, reloadLevel: RELOAD_LEVELS.L1, changedStages: stages, affectedPages, buildId }
	}

	let reloadLevel
	const logic = stages.includes('logic')
	const view = stages.includes('view')
	const style = stages.includes('style')
	if (logic) {
		reloadLevel = RELOAD_LEVELS.L1
	}
	else if (view) {
		reloadLevel = RELOAD_LEVELS.L3
	}
	else if (style) {
		reloadLevel = RELOAD_LEVELS.L2
	}
	else {
		// stages 为空或未知组合：保守页面级 relaunch。
		reloadLevel = RELOAD_LEVELS.L1
	}

	return { appId, reloadLevel, changedStages: stages, affectedPages, buildId }
}

export { synthesizeReloadLevel, RELOAD_LEVELS }