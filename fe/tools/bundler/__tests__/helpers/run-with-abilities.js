import { abilityALS } from '../../src/packer/worker/context.ts'
import { FileSink } from '../../src/packer/worker/sinks.ts'
import { ConsoleLogger } from '../../src/packer/worker/loggers.ts'

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
