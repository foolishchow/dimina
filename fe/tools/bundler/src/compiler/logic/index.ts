import { getAppConfigInfo, getComponent, getContentByPath, getDependencyGraph, getWorkPath, isMiniGame, resetStoreInfo } from '../../packer/store/env.ts'
import { defineEngine } from '../worker-runtime/define-engine.ts'  // P-WR02
import type { CompileOptions } from '../worker-runtime/define-engine.ts'
import type { CachedModuleResult } from '../../model/module-result-cache.ts'
import { hasCompileInfo } from '../../shared/utils.ts'
import { logicParseWalk, processedModules, getJSAbsolutePath } from './parse-walk.ts'
import { transformCjs } from './transform.ts'

// 是否生成 sourcemap
let enableSourcemap = false
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
export interface CompileInfo {
	path: string
	code: string
	map?: string | null
	sourceFile: string | null
	extraInfoCode?: string
	component?: boolean
	usingComponents?: Record<string, string>
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
/** M2 (D-RC-1): cache + invalidatedModules 可选参数；不传时退化为全量重算。 */
interface CompileJSOptions {
	/** cache snapshot（Map<string, CachedModuleResult>）；不传 = 无缓存。 */
	cache?: Map<string, CachedModuleResult> | null
	/** dirty moduleId 集；不传 = 全量（全部视为 dirty）。 */
	invalidatedModules?: Set<string> | null
	/** 输出：每 moduleId → require/import dep ID 列表（仅 dirty 模块有条目）。 */
	logicDependencies?: Record<string, string[]>
}
async function compileJS(pages: PageModule[], root: string | null, mainCompileRes: CompileInfo[] | null, progress: Progress, options?: CompileJSOptions): Promise<{ compileRes: CompileInfo[], logicDependencies: Record<string, string[]> }> {
	const compileRes: CompileInfo[] = []
	const logicDependencies = options?.logicDependencies ?? {}
	const buildOptions: CompileJSOptions = { ...options, logicDependencies }
	if (!root && !isMiniGame()) {
		await buildJSByPath(root, { path: 'app' }, compileRes, mainCompileRes, false, new Set(), false, buildOptions)
	}

	for (const page of pages) {
		await buildJSByPath(root, page, compileRes, mainCompileRes, true, new Set(), false, buildOptions)
		progress.completedTasks++
	}
	return { compileRes, logicDependencies }
}
async function buildJSByPath(packageName: string | null, module: PageModule, compileRes: CompileInfo[], mainCompileRes: CompileInfo[] | null, addExtra: boolean, activePaths: Set<string> = new Set(), putMain = false, options?: CompileJSOptions): Promise<void> {
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
	// [M2 D-RC-3] Cache hit：skip transform，用 cached CompileInfo + cached.logicDependencies
	const cached = options?.cache?.get(currentPath)
	if (cached && options?.invalidatedModules && !options.invalidatedModules.has(currentPath)) {
		activePaths.add(currentPath)
		// usingComponents 遍历（与下方非 cache 路径同逻辑，但不构建 extraInfo）
		if (module.usingComponents) {
			const allSubPackages = getAppConfigInfo().subPackages as Array<{ root: string }>
			const graphDeps = getDependencyGraph().getDirectDependencies(module.path, 'component')
			const componentDeps = graphDeps.length > 0 ? new Set(graphDeps) : null
			for (const [, componentPath] of Object.entries(module.usingComponents)) {
				if (componentDeps && !componentDeps.has(componentPath)) continue
				let toMainSubPackage = true
				if (packageName) {
					const normalizedPath = componentPath.startsWith('/') ? componentPath.substring(1) : componentPath
					for (const subPackage of allSubPackages) {
						if (normalizedPath.startsWith(`${subPackage.root}/`)) { toMainSubPackage = false; break }
					}
				} else { toMainSubPackage = false }
				const componentModule = getComponent(componentPath) as PageModule | null
				if (componentModule) {
					await buildJSByPath(packageName, componentModule, compileRes, mainCompileRes, true, activePaths, putMain || toMainSubPackage, options)
				}
			}
		}
		// push cached compileInfo
		if (putMain) { mainCompileRes!.push(cached.compileInfo) } else { compileRes.push(cached.compileInfo) }
		// 遍历 cached.logicDependencies（require/import dep ID 列表，transform 时捕获）
		for (const depId of cached.logicDependencies) {
			await buildJSByPath(packageName, { path: depId }, compileRes, mainCompileRes, false, activePaths, putMain, options)
		}
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
	// [MC0 D-MC-5] dirty 模块 AST walk 前清 outgoing 'logic' 边，避免 stale edge
	getDependencyGraph().clearOutgoingEdges(currentPath, 'logic')

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
				await buildJSByPath(packageName, componentModule, compileRes, mainCompileRes, true, activePaths, putMain || toMainSubPackage, options)
			}
			componentsObj[name] = path
		}
		extraInfo.usingComponents = componentsObj
	}

	// 如果需要添加 extraInfo，在代码开头注入
	let extraInfoCode: string | undefined
	if (addExtra) {
		extraInfoCode = `globalThis.__extraInfo = ${JSON.stringify(extraInfo)};\n`
	}

	if (putMain) {
		mainCompileRes!.push(compileInfo)
	}
	else {
		compileRes.push(compileInfo)
	}

	// parse+walk：oxc parse + walk（依赖收集 + MagicString 路径重写）+ sourcemap
	const { emitModule, dependenciesToProcess, logicDeps } = await logicParseWalk(
		sourceCode,
		modulePath,
		currentPath,
		compileInfo.sourceFile,
		packageName,
		extraInfoCode,
		{ isTypeScript, sourcemap: enableSourcemap },
	)

	// M2: 存 logicDependencies 供 cache（全量 require/import dep ID）
	if (options?.logicDependencies) {
		options.logicDependencies[currentPath] = logicDeps
	}

	// 处理所有依赖模块（异步）
	for (const depId of dependenciesToProcess) {
		await buildJSByPath(packageName, { path: depId }, compileRes, mainCompileRes, false, activePaths, putMain, options)
	}

	// transform：esbuild CJS 转换 + sourcemap remap
	const transformed = await transformCjs(emitModule, {
		target: activeCompileConfig.esTarget.logic,
		loader: isTypeScript ? 'ts' : 'js',
		sourcemap: enableSourcemap,
		sourceFile: compileInfo.sourceFile ?? undefined,
	})

	// 从 EmitModule 填充 CompileInfo
	compileInfo.code = transformed.code
	compileInfo.map = transformed.map
	compileInfo.extraInfoCode = transformed.extraInfoCode

	// 将当前模块标记为已处理
	processedModules.add(packageName + currentPath)
	activePaths.delete(currentPath)
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
function logicBuildConfig(msg: Record<string, any>): { sourcemap: boolean; minify: boolean; esTarget: { logic: string; view: string } } {
	return {
		sourcemap: !!msg.sourcemap,
		minify: msg.compileConfig?.minify !== false,
		esTarget: {
			logic: msg.compileConfig?.esTarget?.logic || 'es2023',
			view: msg.compileConfig?.esTarget?.view || 'es2020',
		},
	}
}
async function logicCompile({ msg, progress, config }: CompileOptions): Promise<{ compileRes: CompileInfo[], logicDependencies: Record<string, string[]> }> {
	resetStoreInfo((msg as { storeInfo: Parameters<typeof resetStoreInfo>[0] }).storeInfo)
	enableSourcemap = !!(msg as { sourcemap?: boolean }).sourcemap
	activeCompileConfig = config as ActiveCompileConfig

	// M2: 从 msg 读 cache snapshot + invalidatedModules
	const cache = (msg as { cache?: Map<string, CachedModuleResult> }).cache ?? null
	const invalidatedModules = (msg as { invalidatedModules?: string[] }).invalidatedModules
		? new Set((msg as { invalidatedModules: string[] }).invalidatedModules) : null
	const logicDependencies: Record<string, string[]> = {}
	const compileJSOptions = cache ? { cache, invalidatedModules, logicDependencies } : undefined

	const { compileRes: mainCompileRes } = await compileJS((msg as { pages: { mainPages: PageModule[]; subPages: Record<string, { info: PageModule[]; independent: boolean }> } }).pages.mainPages, null, null, progress as Progress, compileJSOptions)
	const subs: { root: string, modules: CompileInfo[] }[] = []
	for (const [root, subPages] of Object.entries((msg as { pages: { subPages: Record<string, { info: PageModule[]; independent: boolean }> } }).pages.subPages)) {
		const { compileRes: subCompileRes } = await compileJS(
			subPages.info, root, subPages.independent ? [] as CompileInfo[] : mainCompileRes, progress as Progress, compileJSOptions,
		)
		subs.push({ root, modules: subCompileRes })
	}
	const compileRes = [...mainCompileRes, ...subs.flatMap(s => s.modules)]  // 循环后拼（修早快照漏 putMain）

	processedModules.clear()
	return { compileRes, logicDependencies }
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
