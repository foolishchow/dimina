import { transform } from 'esbuild'
import { relative, resolve, sep } from 'node:path'
import { getWorkPath } from '../core/env.js'
import { mergeSourcemap } from '../core/sourcemap.js'
import { effectiveJsMinify } from '../../shared/compile-config.js'
import { write } from './output.js'

/**
 * @typedef {{ moduleId: string, code: string, map: string | null, extraInfoCode?: string }} EmitModule
 * @typedef {Iterable<EmitModule>} ModuleCollection
 */

const strategies = {
	// bundle 策略（view 整包拼接 + moduleRanges 行定位，布局私有）
	bundle: {
		/**
		 * @param {{ modules: ModuleCollection, transform: { minify: boolean, target: string, platform: string }, sourcemap: boolean, filename: string, relPrefix: string, entryId: string }} ctx
		 * @returns {Promise<{ entry: import('./output.js').EmitEntry }>}
		 */
		async apply({ modules, transform: cfg, sourcemap, filename, relPrefix, entryId }) {
			const moduleList = [...modules]
			if (sourcemap) {
				const compileRes = moduleList.map(m => ({ path: m.moduleId, code: m.code, map: m.map }))
				const sourcemapFileName = `${filename}.js.map`
				const { bundleCode, sourcemap: sm } = mergeSourcemap(compileRes, `${filename}.js`)
				return {
					entry: {
						entryId,
						kind: 'view',
						files: [{ path: `${relPrefix}/${filename}.js`, code: `${bundleCode}//# sourceMappingURL=${sourcemapFileName}\n` }],
						sourcemaps: [{ path: `${relPrefix}/${sourcemapFileName}`, map: sm }],
					},
				}
			}
			// 非 sourcemap：整包拼接（modDefine 3-tab 缩进）+ esbuild transform（CF-1 跳 minify）
			const moduleRanges = []
			let bundleSource = ''
			let nextLine = 1
			for (const m of moduleList) {
				const amdFormat = `modDefine('${m.moduleId}', function(require, module, exports) {
			${m.code}
			});\n`
				const lineCount = amdFormat.split('\n').length
				moduleRanges.push({ key: m.moduleId, startLine: nextLine, endLine: nextLine + lineCount - 2 })
				bundleSource += amdFormat
				nextLine += lineCount - 1
			}
			let mergeRender = ''
			try {
				const { code } = await transform(bundleSource, {
					minify: effectiveJsMinify({ minify: cfg.minify, sourcemap: false }),
					target: [cfg.target],
					platform: cfg.platform,
				})
				mergeRender = code
			}
			catch (error) {
				const location = error.errors?.[0]?.location
				const sourceLines = bundleSource.split('\n')
				const sourceHint = location?.line
					? sourceLines
						.slice(Math.max(0, location.line - 3), location.line + 2)
						.map((line, index) => `${Math.max(1, location.line - 2) + index}: ${line.trim()}`)
						.join('\n')
					: ''
				const failedModule = moduleRanges.find(range =>
					location?.line >= range.startLine && location.line <= range.endLine)
				error.message = `视图模块 ${failedModule?.key || 'bundle'} 转换失败: ${error.message}${sourceHint ? `\n${sourceHint}` : ''}`
				throw error
			}
			return {
				entry: {
					entryId,
					kind: 'view',
					files: [{ path: `${relPrefix}/${filename}.js`, code: mergeRender }],
				},
			}
		},
	},
	// perModule 策略（logic 逐模块 + sourcemap rebase，布局私有）
	perModule: {
		/**
		 * @param {{ modules: ModuleCollection, transform: { minify: boolean, target: string, platform: string }, sourcemap: boolean, sourcemapTargetPath: string | null, relPrefix: string, entryId: string }} ctx
		 * @returns {Promise<{ entry: import('./output.js').EmitEntry }>}
		 */
		async apply({ modules, transform: cfg, sourcemap, sourcemapTargetPath, relPrefix, entryId }) {
			const moduleList = [...modules]
			if (sourcemap) {
				// rebase（D-E-12 留策略）：module.map.sources 绝对路径 → relative(finalOutputDir, resolve(workPath, source))
				const finalOutputDir = resolve(sourcemapTargetPath, relPrefix)
				const rebasedCompileRes = moduleList.map((m) => {
					if (!m.map) return { path: m.moduleId, code: m.code, map: m.map, extraInfoCode: m.extraInfoCode }
					const moduleMap = JSON.parse(m.map)
					moduleMap.sources = moduleMap.sources.map((source) => {
						const sourcePath = source.replace(/^[/\\]+/, '')
						return relative(finalOutputDir, resolve(getWorkPath(), sourcePath)).split(sep).join('/')
					})
					return { path: m.moduleId, code: m.code, map: JSON.stringify(moduleMap), extraInfoCode: m.extraInfoCode }
				})
				const { bundleCode, sourcemap: sm } = mergeSourcemap(rebasedCompileRes)
				const sourcemapFileName = 'logic.js.map'
				return {
					entry: {
						entryId,
						kind: 'logic',
						files: [{ path: `${relPrefix}/logic.js`, code: `${bundleCode}//# sourceMappingURL=${sourcemapFileName}\n` }],
						sourcemaps: [{ path: `${relPrefix}/${sourcemapFileName}`, map: sm }],
					},
				}
			}
			// 非 sourcemap + minify：逐模块 transform（天然错误定位）
			if (effectiveJsMinify({ minify: cfg.minify, sourcemap: false })) {
				let mergeCode = ''
				for (const m of moduleList) {
					const amdFormat = `modDefine('${m.moduleId}', function(require, module, exports) {
${m.code}
});`
					const { code: minifiedCode } = await transform(amdFormat, {
						minify: true,
						target: [cfg.target],
						platform: cfg.platform,
					})
					mergeCode += minifiedCode
				}
				return {
					entry: {
						entryId,
						kind: 'logic',
						files: [{ path: `${relPrefix}/logic.js`, code: mergeCode }],
					},
				}
			}
			// 非 sourcemap + 非 minify：直接 modDefine 拼接（无 transform）
			let mergeCode = ''
			for (const m of moduleList) {
				mergeCode += `modDefine('${m.moduleId}', function(require, module, exports) {
${m.code}
});
`
			}
			return {
				entry: {
					entryId,
					kind: 'logic',
					files: [{ path: `${relPrefix}/logic.js`, code: mergeCode }],
				},
			}
		},
	},
}

/**
 * emitEntry —— 方案 A（D-E-9）：内部调 output.write，返回 number 供调用方累加 outputCount（D-E-11）。
 * D-E-1 契约 / D-E-2 策略注入 / D-E-10 纯参数+outputEnv / D-E-12 rebase 留策略。
 * @param {object} params
 * @param {string} params.entryId
 * @param {string} params.kind
 * @param {ModuleCollection} params.modules
 * @param {{ strategy: string, minify: boolean, target: string, platform: string }} params.transform
 * @param {boolean} params.sourcemap
 * @param {string | null} params.sourcemapTargetPath
 * @param {string} params.filename
 * @param {string} params.relPrefix
 * @param {{ collectOutput: boolean, writeDir: string }} outputEnv
 * @returns {Promise<number>}
 */
export async function emitEntry(params, outputEnv) {
	const strategy = strategies[params.transform.strategy]
	if (!strategy) {
		throw new Error(`emitEntry: 未知 transform 策略 ${params.transform.strategy}`)
	}
	const { entry } = await strategy.apply(params)
	write({ entry, collectOutput: outputEnv.collectOutput, writeDir: outputEnv.writeDir })
	return 1
}
