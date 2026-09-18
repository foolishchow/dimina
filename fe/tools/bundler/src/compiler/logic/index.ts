import fs from 'node:fs'
import { resolve, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import MagicString from 'magic-string'
import { transform } from 'esbuild'
import type { Node } from 'oxc-parser'
type AstNode = Node & { loc?: { start?: { line?: number } } }
import type { TransformOptions } from 'esbuild'
import { getWxMemberName, warnUnsupportedWxApi } from '../core/compatibility.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import { collectAssets, hasCompileInfo, isCollectableImageAsset, resolveAssetSourcePath } from '../../shared/utils.ts'
import { getAppConfigInfo, getAppId, getComponent, getContentByPath, getDependencyGraph, getNpmResolver, getTargetPath, getWorkPath, isMiniGame, resetStoreInfo, resolveAppAlias } from '../core/env.ts'
import { remapSourcemap } from '../core/sourcemap.ts'
import { emitEntry } from '../pipeline/emit.ts'
import { errorMessage } from '../../shared/utils.ts'

// 用于缓存已处理的模块
const processedModules = new Set()

// 是否生成 sourcemap
let enableSourcemap = false
let sourcemapTargetPath: string | null = null
interface ActiveCompileConfig {
	minify: boolean
	sourcemap: boolean
	esTarget: { logic: string; view: string }
}
let activeCompileConfig: ActiveCompileConfig = {
	minify: true,
	sourcemap: false,
	esTarget: { logic: 'es2023', view: 'es2020' },
}
interface CompileInfo {
	path: string
	code: string
	map?: string | null
	sourceFile: string | null
	extraInfoCode?: string
	component?: boolean
	usingComponents?: Record<string, string>
}
async function writeCompileRes(compileRes: CompileInfo[], root: string | null) {
	// 相对发布根的物化路径前缀（D-P2）
	const relPrefix = root ? `${root}` : 'main'

	await emitEntry({
		entryId: `logic${root ? ':' + root : ''}`,
		kind: 'logic',
		modules: compileRes.map((m: CompileInfo) => ({ moduleId: m.path, code: m.code, map: m.map || null, extraInfoCode: m.extraInfoCode })),
		transform: {
			strategy: 'perModule',
			minify: activeCompileConfig.minify,
			target: activeCompileConfig.esTarget.logic,
			platform: 'neutral',
		},
		sourcemap: enableSourcemap,
		sourcemapTargetPath,
		filename: 'logic',
		relPrefix,
	})
}

/**
 * 编译 js 文件
 */
interface Progress {
	completedTasks: number
}
interface PageModule {
	path: string
	component?: boolean
	usingComponents?: Record<string, string>
}
async function compileJS(pages: PageModule[], root: string | null, mainCompileRes: CompileInfo[] | null, progress: Progress): Promise<CompileInfo[]> {
	const compileRes: CompileInfo[] = []
	if (!root && !isMiniGame()) {
		await buildJSByPath(root, { path: 'app' }, compileRes, mainCompileRes, false)
	}

	for (const page of pages) {
		await buildJSByPath(root, page, compileRes, mainCompileRes, true)
		progress.completedTasks++
	}
	return compileRes
}
async function buildJSByPath(packageName: string | null, module: PageModule, compileRes: CompileInfo[], mainCompileRes: CompileInfo[] | null, addExtra: boolean, activePaths: Set<string> = new Set(), putMain = false): Promise<void> {
	const currentPath = module.path

	if (!currentPath) {
		// 业务逻辑不存在
		return
	}
	// Module cycles are valid dependency graphs. Stop only a back edge on the
	// current traversal path, without truncating a finite deep dependency chain.
	if (activePaths.has(currentPath)) {
		return
	}
	// 防止添加相同的 js
	if (hasCompileInfo(module.path, compileRes, mainCompileRes)) {
		return
	}
	const compileInfo: CompileInfo = {
		path: module.path,
		code: '',
		sourceFile: null,
	}

	const src = module.path.startsWith('/') ? module.path : `/${module.path}`
	const modulePath = getJSAbsolutePath(src)
	if (!modulePath) {
		console.warn('[logic]', `找不到模块文件: ${src}`)
		return
	}
	getDependencyGraph().addFile(currentPath, modulePath, 'logic')
	const diagnosticSource = modulePath.startsWith(getWorkPath())
		? modulePath.slice(getWorkPath().length)
		: src
	
	const sourceCode = getContentByPath(modulePath)
	if (!sourceCode) {
		console.warn('[logic]', `无法读取模块文件: ${modulePath}`)
		return
	}
	const isTypeScript = modulePath.endsWith('.ts')

	// 记录源文件路径，用于 sourcemap
	if (enableSourcemap) {
		const workPath = getWorkPath()
		compileInfo.sourceFile = modulePath.startsWith(workPath)
			? modulePath.slice(workPath.length)
			: src
	}

	// 使用 oxc-parser 解析代码
	const parseResult = parseSync(modulePath, sourceCode, {
		sourceType: 'module',
		lang: isTypeScript ? 'ts' : 'js'
	})
	const ast = parseResult.program
	
	// 使用 MagicString 进行代码修改
	const s = new MagicString(sourceCode)

	// 构建 extraInfo 对象（使用 JSON 而不是 AST）
	const extraInfo: Record<string, unknown> = {
		path: module.path
	}
	activePaths.add(currentPath)

	// https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/
	// 将 component 字段设为 true 可将这一组文件设为自定义组件
	if (module.component) {
		extraInfo.component = true
	}

	if (module.usingComponents) {
		const componentsObj: Record<string, string> = {}
		const allSubPackages = getAppConfigInfo().subPackages as Array<{ root: string }>
		const graphDependencies = getDependencyGraph().getDirectDependencies(module.path, 'component')
		const componentDependencies = graphDependencies.length > 0
			? new Set(graphDependencies)
			: null

		for (const [name, path] of Object.entries(module.usingComponents)) {
			if (componentDependencies && !componentDependencies.has(path)) {
				continue
			}
			let toMainSubPackage = true
			if (packageName) {
				// 如果依赖的组件不在当前的分包，则跳过该组件的编译逻辑，保证分包代码的独立性
				// 考虑到路径可能是 'test/src' 这样的格式，使用前缀匹配而不是分割比较
				const normalizedPath = path.startsWith('/') ? path.substring(1) : path

				// 如果不属于任意分包则将逻辑移动到主包
				for (const subPackage of allSubPackages) {
					if (normalizedPath.startsWith(`${subPackage.root}/`)) {
						toMainSubPackage = false
						break
					}
				}
			}
			else {
				toMainSubPackage = false
			}
			const componentModule = getComponent(path) as PageModule | null
			if (!componentModule) {
				continue
			}

			if (componentModule) {
				await buildJSByPath(packageName, componentModule, compileRes, mainCompileRes, true, activePaths, putMain || toMainSubPackage)
			}
			componentsObj[name] = path
		}
		extraInfo.usingComponents = componentsObj
	}

	// 如果需要添加 extraInfo，在代码开头注入
	if (addExtra) {
		const extraInfoCode = `globalThis.__extraInfo = ${JSON.stringify(extraInfo)};\n`
		if (enableSourcemap) {
			// 存到 compileInfo，在 modDefine header 中注入，避免影响 sourcemap 行号
			compileInfo.extraInfoCode = extraInfoCode
		} else {
			s.prepend(extraInfoCode)
		}
	}

	if (putMain) {
		mainCompileRes!.push(compileInfo)
	}
	else {
		compileRes.push(compileInfo)
	}

	// 收集需要修改的路径信息和依赖模块
	const pathReplacements: Array<{ start: number; end: number; newValue: string }> = []
	const dependenciesToProcess: string[] = []

	walk(ast, {
		enter(node: AstNode, _parent: Node | null) {
			const wxMemberName = getWxMemberName(node)
			if (wxMemberName) {
				warnUnsupportedWxApi(
					wxMemberName,
					compileInfo.sourceFile || diagnosticSource,
					node.loc?.start?.line || getLineByIndex(sourceCode, node.start),
				)
			}
			if ((node.type === 'Literal' && typeof node.value === 'string') && isLocalAssetString(node.value)) {
				getDependencyGraph().addFile(
					currentPath,
					resolveAssetSourcePath(getWorkPath(), modulePath, node.value),
					'logic',
				)
				pathReplacements.push({
					start: node.start,
					end: node.end,
					newValue: collectAssets(getWorkPath(), modulePath, node.value, getTargetPath(), getAppId()!),
				})
			}

			// 处理 require() 调用
			if (node.type === 'CallExpression') {
				// 检查是否是 require() 调用
				const isRequire = node.callee.type === 'Identifier' && node.callee.name === 'require'
				const isRequireProperty = node.callee.type === 'MemberExpression'
					&& node.callee.object?.type === 'Identifier'
					&& node.callee.object?.name === 'require'

				if (
					(isRequire || isRequireProperty)
					&& node.arguments.length > 0
					&& node.arguments[0]!.type === 'Literal' && typeof node.arguments[0]!.value === 'string'
				) {
					const arg = node.arguments[0]!
					const requirePath = (arg as { value?: string }).value

					if (requirePath) {
						const { id, shouldProcess } = resolveDependencyId(requirePath, modulePath, false)

						if (shouldProcess) {
							getDependencyGraph().addDependency(currentPath, id, 'logic')
							pathReplacements.push({
								start: arg.start,
								end: arg.end,
								newValue: id,
							})

							if (!processedModules.has(packageName + id)) {
								dependenciesToProcess.push(id)
							}
						}
					}
				}
			}

			// 处理 ES6 import 语句
			if (node.type === 'ImportDeclaration') {
				const importPath = node.source.value
				if (importPath) {
					const { id, shouldProcess } = resolveDependencyId(importPath, modulePath, true)

					if (shouldProcess) {
						getDependencyGraph().addDependency(currentPath, id, 'logic')
						pathReplacements.push({
							start: node.source.start,
							end: node.source.end,
							newValue: id,
						})

						if (!processedModules.has(packageName + id)) {
							dependenciesToProcess.push(id)
						}
					}
				}
			}

			// 处理 TypeScript import equals，如 import helper = require('./helper')
			if (
				node.type === 'TSImportEqualsDeclaration'
				&& node.moduleReference?.type === 'TSExternalModuleReference'
			) {
				const importPathNode = node.moduleReference.expression
				const importPath = importPathNode?.value
				if (importPath) {
					const { id, shouldProcess } = resolveDependencyId(importPath, modulePath, false)

					if (shouldProcess) {
						getDependencyGraph().addDependency(currentPath, id, 'logic')
						pathReplacements.push({
							start: importPathNode.start,
							end: importPathNode.end,
							newValue: id,
						})

						if (!processedModules.has(packageName + id)) {
							dependenciesToProcess.push(id)
						}
					}
				}
			}

			// 处理 re-export 语句，如 export * from '../core/foo.js'
			// 这类语句不会出现在运行时 require 中，必须在这里提前收集依赖。
			if (
				(node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration')
				&& node.source
			) {
				const exportPath = node.source.value
				if (exportPath) {
					const { id, shouldProcess } = resolveDependencyId(exportPath, modulePath, true)

					if (shouldProcess) {
						getDependencyGraph().addDependency(currentPath, id, 'logic')
						pathReplacements.push({
							start: node.source.start,
							end: node.source.end,
							newValue: id,
						})

						if (!processedModules.has(packageName + id)) {
							dependenciesToProcess.push(id)
						}
					}
				}
			}
		}
	})

	// 处理所有依赖模块（异步）
	for (const depId of dependenciesToProcess) {
		await buildJSByPath(packageName, { path: depId }, compileRes, mainCompileRes, false, activePaths, putMain)
	}

	// 反向遍历修改，避免位置偏移
	for (const replacement of pathReplacements.reverse()) {
		s.overwrite(replacement.start, replacement.end, `'${replacement.newValue}'`)
	}

	const modifiedCode = s.toString()
	let preEsbuildMap = null
	if (enableSourcemap && compileInfo.sourceFile) {
		const generatedMap = JSON.parse(s.generateMap({
			file: compileInfo.sourceFile,
			source: compileInfo.sourceFile,
			includeContent: true,
			hires: true,
		}).toString())
		generatedMap.file = compileInfo.sourceFile
		generatedMap.sources = [compileInfo.sourceFile]
		generatedMap.sourcesContent = [sourceCode]
		preEsbuildMap = JSON.stringify(generatedMap)
	}

	// 使用 esbuild 进行最终的 CommonJS 转换和压缩
	try {
		const esbuildOpts: TransformOptions = {
			format: 'cjs',
			// CF-3：与 bundle minify 同读 esTarget.logic（消除同车道硬编码漂移）
			target: activeCompileConfig.esTarget.logic,
			platform: 'neutral',
			loader: isTypeScript ? 'ts' : 'js',
		}
		/*
		 * 当前 sourcemap 会串联 MagicString 和 esbuild 两步 map：
		 * - JS / TS 都先经过 MagicString 路径重写，再交给 esbuild 生成 map
		 * - 这样可避免 TS 先被 transpile 成 JS 后再伪装为 .ts 输出 sourcemap
		 * - bundle 阶段只做 modDefine 包裹和模块拼接，因此 sourcemap 模式会跳过最终 minify
		 */
		if (enableSourcemap && compileInfo.sourceFile) {
			esbuildOpts.sourcemap = true
			esbuildOpts.sourcefile = compileInfo.sourceFile
			esbuildOpts.sourcesContent = true
		}
		const esbuildResult = await transform(modifiedCode, esbuildOpts)

		if (enableSourcemap && esbuildResult.map) {
			compileInfo.map = (preEsbuildMap
				? remapSourcemap(esbuildResult.map!, preEsbuildMap)
				: esbuildResult.map)
		}
		compileInfo.code = esbuildResult.code
	} catch (error) {
		console.error(`[logic] esbuild 转换失败 ${modulePath}:`, errorMessage(error))
		// 如果 esbuild 转换失败，使用路径改写后的源码
		compileInfo.code = modifiedCode
	}
	
	// 将当前模块标记为已处理
	processedModules.add(packageName + currentPath)
	activePaths.delete(currentPath)
}
function isLocalAssetString(value: unknown): value is string {
	return typeof value === 'string'
		&& !value.startsWith('http')
		&& !value.startsWith('//')
		&& (value.startsWith('/') || value.startsWith('./') || value.startsWith('../'))
		&& isCollectableImageAsset(value)
}
function getLineByIndex(content: string, index: number | undefined): number | null {
	if (typeof index !== 'number' || index < 0) {
		return null
	}

	let line = 1
	for (let i = 0; i < index; i++) {
		if (content.charCodeAt(i) === 10) {
			line++
		}
	}
	return line
}

/**
 * 获取 JavaScript 或 TypeScript 文件的绝对路径
 * @param {string} modulePath - 模块路径
 * @returns {string|null} - 文件的绝对路径，如果找不到则返回 null
 */
function getJSAbsolutePath(modulePath: string): string | null {
	const workPath = getWorkPath()
	const resolvedModuleId = resolveModuleIdToExistingPath(modulePath)
	if (!resolvedModuleId) {
		return null
	}

	const fileTypes = ['.js', '.ts']
	for (const ext of fileTypes) {
		const fullPath = `${workPath}${resolvedModuleId}${ext}`
		if (fs.existsSync(fullPath)) {
			return fullPath
		}
	}

	return null
}
function resolveDependencyId(specifier: string, modulePath: string, allowAbsolute: boolean): { id: string; shouldProcess: boolean } {
	if (!specifier) {
		return { id: specifier, shouldProcess: false }
	}

	if (specifier.startsWith('miniprogram_npm/')) {
		const npmModuleId = normalizeModuleId(`/${specifier}`)
		return {
			id: resolveModuleIdToExistingPath(npmModuleId) || npmModuleId,
			shouldProcess: true,
		}
	}

	if (specifier.startsWith('./') || specifier.startsWith('../')) {
		return {
			id: resolveRelativeModuleId(specifier, modulePath),
			shouldProcess: true,
		}
	}

	if (specifier.startsWith('/')) {
		return {
			id: allowAbsolute ? normalizeModuleId(specifier) : resolveRelativeModuleId(specifier, modulePath),
			shouldProcess: true,
		}
	}

	const aliasResolved = resolveAppAlias(specifier)
	if (aliasResolved) {
		return {
			id: normalizeModuleId(aliasResolved),
			shouldProcess: true,
		}
	}

	if (specifier.startsWith('@') || isBareModuleSpecifier(specifier)) {
		const npmModuleId = resolveNpmModuleId(specifier, modulePath)
		if (npmModuleId) {
			return {
				id: npmModuleId,
				shouldProcess: true,
			}
		}

		const siblingModuleId = resolveBareSiblingModuleId(specifier, modulePath)
		return {
			id: siblingModuleId || specifier,
			shouldProcess: Boolean(siblingModuleId),
		}
	}

	return { id: specifier, shouldProcess: false }
}
function isBareModuleSpecifier(specifier: string): boolean {
	return !specifier.startsWith('.') && !specifier.startsWith('/')
}
function resolveRelativeModuleId(specifier: string, modulePath: string): string {
	const requireFullPath = resolve(modulePath, `../${specifier}`)
	const relativeId = requireFullPath.split(`${getWorkPath()}${sep}`)[1]!
	return normalizeModuleId(relativeId)
}
function resolveBareSiblingModuleId(specifier: string, modulePath: string): string | null {
	const siblingModuleId = resolveRelativeModuleId(`./${specifier}`, modulePath)
	return resolveModuleIdToExistingPath(siblingModuleId)
}
function normalizeModuleId(moduleId: string): string {
	let normalized = moduleId.replace(/\.(js|ts)$/, '').replace(/\\/g, '/')
	if (!normalized.startsWith('/')) {
		normalized = `/${normalized}`
	}
	return normalized
}
function resolveNpmModuleId(specifier: string, modulePath: string): string | null {
	const npmResolver = getNpmResolver()
	if (!npmResolver) {
		return null
	}
	return npmResolver.resolveScriptModule(specifier, modulePath, resolveModuleIdToExistingPath)
}
function resolveModuleIdToExistingPath(moduleId: string): string | null {
	const normalizedModuleId = normalizeModuleId(moduleId)
	const workPath = getWorkPath()

	for (const ext of ['.js', '.ts']) {
		if (fs.existsSync(`${workPath}${normalizedModuleId}${ext}`)) {
			return normalizedModuleId
		}
	}

	for (const ext of ['.js', '.ts']) {
		if (fs.existsSync(`${workPath}${normalizedModuleId}/index${ext}`)) {
			return `${normalizedModuleId}/index`
		}
	}

	const packageJsonPath = `${workPath}${normalizedModuleId}/package.json`
	if (fs.existsSync(packageJsonPath)) {
		try {
			const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
			for (const entryField of ['miniprogram', 'main']) {
				if (typeof packageInfo[entryField] === 'string' && packageInfo[entryField]) {
					const entryModuleId = normalizeModuleId(resolve(normalizedModuleId, String(packageInfo[entryField])))
					const resolvedEntry = resolveModuleIdToExistingPath(entryModuleId)
					if (resolvedEntry) {
						return resolvedEntry
					}
				}
			}
		}
		catch (error) {
			console.warn('[logic]', `解析 package.json 失败: ${packageJsonPath}`, errorMessage(error))
		}
	}

	return null
}

export { compileJS, buildJSByPath }

/** 测试专用：覆盖 worker 消息下发的 compileConfig（非公开契约）。 */
export function _setActiveCompileConfigForTest(config?: { minify?: boolean; sourcemap?: boolean; esTarget?: { logic?: string; view?: string } }): void {
	activeCompileConfig = {
		minify: config?.minify !== false,
		sourcemap: !!config?.sourcemap,
		esTarget: {
			logic: config?.esTarget?.logic || 'es2023',
			view: config?.esTarget?.view || 'es2020',
		},
	}
}

// P-WR02: engine export（不动调度，F47）
function logicBuildConfig(msg: Record<string, any>): { sourcemap: boolean; minify: boolean; sourcemapTargetPath: string; esTarget: { logic: string; view: string } } {
	return {
		sourcemap: !!msg.sourcemap,
		minify: msg.compileConfig?.minify !== false,
		sourcemapTargetPath: msg.sourcemapTargetPath || getTargetPath(),
		esTarget: {
			logic: msg.compileConfig?.esTarget?.logic || 'es2023',
			view: msg.compileConfig?.esTarget?.view || 'es2020',
		},
	}
}
async function logicCompile({ msg, progress, config }: CompileOptions) {
	resetStoreInfo((msg as { storeInfo: Parameters<typeof resetStoreInfo>[0] }).storeInfo)
	enableSourcemap = !!(msg as { sourcemap?: boolean }).sourcemap
	sourcemapTargetPath = (config as { sourcemapTargetPath: string | null }).sourcemapTargetPath
	activeCompileConfig = config as ActiveCompileConfig

	const mainCompileRes = await compileJS((msg as { pages: { mainPages: PageModule[]; subPages: Record<string, { info: PageModule[]; independent: boolean }> } }).pages.mainPages, null, null, progress as Progress)
	for (const [root, subPages] of Object.entries((msg as { pages: { subPages: Record<string, { info: PageModule[]; independent: boolean }> } }).pages.subPages)) {
		const subCompileRes = await compileJS(
			subPages.info, root, subPages.independent ? [] as CompileInfo[] : mainCompileRes, progress as Progress,
		)
		await writeCompileRes(subCompileRes, root)
	}
	await writeCompileRes(mainCompileRes, null)

	processedModules.clear()
}
function logicSuccessPayload({ logger }: { logger: { warn: (msg: string) => void; flush: () => string[] } }): Record<string, unknown> {
	return {
		dependencyGraph: getDependencyGraph().toJSON(),
		compatibilityWarnings: logger.flush(),
	}
}

export const logicEngine = defineEngine({
	name: 'logic',
	compile: logicCompile,
	cleanup: () => {},
	successPayload: logicSuccessPayload,
	buildConfig: logicBuildConfig,
})

