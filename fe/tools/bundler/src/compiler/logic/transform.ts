import { transform } from 'esbuild'
import type { TransformOptions } from 'esbuild'
import { remapSourcemap } from '../core/sourcemap.ts'
import { errorMessage } from '../../shared/utils.ts'
import type { EmitModule } from '../pipeline/emit.ts'

export interface CjsTransformOptions {
	target: string // esTarget.logic
	loader: 'js' | 'ts'
	sourcemap: boolean
	sourceFile?: string
}

/**
 * esbuild CJS 转换（ESM→CJS），logic 专有。
 * format:'cjs' + platform:'neutral' 硬编码（固有语义）。
 * sourcemap remap：remapSourcemap(esbuildMap, module.map)。
 * 错误回退：map: null（匹配当前行为——esbuild 失败丢 sourcemap）。
 * extraInfoCode 透传。
 */
export async function transformCjs(
	module: EmitModule,
	options: CjsTransformOptions,
): Promise<EmitModule> {
	const { target, loader, sourcemap, sourceFile } = options

	const esbuildOpts: TransformOptions = {
		format: 'cjs',
		// CF-3：与 bundle minify 同读 esTarget.logic（消除同车道硬编码漂移）
		target,
		platform: 'neutral',
		loader,
	}

	/*
	 * 当前 sourcemap 会串联 MagicString 和 esbuild 两步 map：
	 * - JS / TS 都先经过 MagicString 路径重写，再交给 esbuild 生成 map
	 * - 这样可避免 TS 先被 transpile 成 JS 后再伪装为 .ts 输出 sourcemap
	 * - bundle 阶段只做 modDefine 包裹和模块拼接，因此 sourcemap 模式会跳过最终 minify
	 */
	if (sourcemap && sourceFile) {
		esbuildOpts.sourcemap = true
		esbuildOpts.sourcefile = sourceFile
		esbuildOpts.sourcesContent = true
	}

	try {
		const esbuildResult = await transform(module.code, esbuildOpts)

		const map = (sourcemap && esbuildResult.map)
			? (module.map
				? remapSourcemap(esbuildResult.map!, module.map)
				: esbuildResult.map)
			: null

		return {
			moduleId: module.moduleId,
			code: esbuildResult.code,
			map: sourcemap ? map : null,
			extraInfoCode: module.extraInfoCode,
		}
	} catch (error) {
		console.error(`[logic] esbuild 转换失败 ${sourceFile || module.moduleId}:`, errorMessage(error))
		// 如果 esbuild 转换失败，使用路径改写后的源码
		return {
			moduleId: module.moduleId,
			code: module.code,
			map: null,
			extraInfoCode: module.extraInfoCode,
		}
	}
}
