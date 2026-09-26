import { abilityALS } from '../../src/packer/worker/context.ts'
import { FileSink } from '../../src/packer/worker/sinks.ts'
import { ConsoleLogger } from '../../src/packer/worker/loggers.ts'
import { buildPackerContextFromOptions } from '../../src/packer/graph/config-fixpoint.ts'
import { getAppConfigInfo, getAppId, getComponent, getDependencyGraph, getNpmResolver, getRuntimeType } from '../../src/packer/store/env.ts'

/**
 * P-WR07: 测试直连注入——包 compileML/compileJS/compileSS 调用，
 * 提供 FileSink（写盘）+ ConsoleLogger（warn console）。
 *
 * @param {string} writeDir  产物写盘目录
 * @param {Function} fn      被包裹的异步函数（如 async () => await compileML(...)）
 * @returns {Promise<*>} fn 的返回值
 */
export function runWithAbilities(writeDir, fn) {
	return abilityALS.run(
		{ sink: new FileSink(writeDir), logger: new ConsoleLogger() },
		fn,
	)
}

/**
 * D-SRC-3a: 从 storeInfo 返回值建立 PackerContext（测试传 ctx 替代 ALS fallback）。
 * getter try/catch——测试 fixture 可能缺 project.config.json 等，fallback undefined。
 * @param {{ pathInfo: { workPath: string; targetPath: string }; compilerOptions: Record<string, unknown> }} si  storeInfo 返回值
 * @returns {import('../../src/packer/types.ts').PackerContext}
 */
export function buildCtxFromStoreInfo(si) {
	const safe = (fn) => { try { return fn() } catch { return undefined } }
	return buildPackerContextFromOptions(
		si.pathInfo.workPath,
		si.pathInfo.targetPath,
		si.compilerOptions,
		{
			graph: getDependencyGraph(),
			appId: safe(() => getAppId()),
			component: (src) => safe(() => getComponent(src)),
			configInfo: safe(() => getAppConfigInfo()),
			npmResolver: safe(() => getNpmResolver()) ?? undefined,
			runtimeType: safe(() => getRuntimeType()),
			appInfo: safe(() => getAppConfigInfo()),
		},
	)
}
