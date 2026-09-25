import fs from 'node:fs'
import path from 'node:path'
import { getStyleExts, getTemplateExts, getViewScriptExts } from '../store/env.ts'

/** B 切法（PC-B3a）：normalized fileTypes（storeInfo 产物）形状 */
interface NpmFileTypes { templateExts: string[]; styleExts: string[]; viewScriptExts: string[] }
import { errorMessage } from '../../shared/utils.ts'

/**
 * npm 构建工具
 * 用于处理小程序 npm 包的构建和管理
 */
class NpmBuilder {
	workPath: string
	targetPath: string
	dependencyGraph: { addFile: (node: string, file: string, kind: string) => void } | null
	builtPackages: Set<string>
	packageDependencies: Map<string, Record<string, string>>
	miniprogramExts: Set<string>

	constructor(workPath: string, targetPath: string, dependencyGraph: { addFile: (node: string, file: string, kind: string) => void } | null = null, fileTypes?: NpmFileTypes) {
		this.workPath = workPath
		this.targetPath = targetPath
		this.dependencyGraph = dependencyGraph
		this.builtPackages = new Set()
		this.packageDependencies = new Map()
		// B 切法（PC-B3a）：fileTypes 从 storeInfo 产物显式读（非 ALS getStyleExts 等）
		const ft = fileTypes ?? { templateExts: getTemplateExts(), styleExts: getStyleExts(), viewScriptExts: getViewScriptExts() }
		this.miniprogramExts = new Set([
			'.js',
			'.json',
			'.ts',
			...ft.templateExts,
			...ft.styleExts,
			...ft.viewScriptExts,
		])
	}

	/**
	 * 构建 npm 包
	 * 扫描 miniprogram_npm 目录并构建相关包
	 */
	async buildNpmPackages(): Promise<void> {
		const miniprogramNpmPaths = this.findMiniprogramNpmDirs()
		
		for (const npmPath of miniprogramNpmPaths) {
			await this.buildNpmDir(npmPath)
		}
	}

	/**
	 * 查找所有 miniprogram_npm 目录
	 * @returns {string[]} miniprogram_npm 目录路径数组
	 */
	findMiniprogramNpmDirs(): string[] {
		const npmDirs: string[] = []
		
		const scanDir = (dir: string, relativePath: string = '') => {
			if (!fs.existsSync(dir)) {
				return
			}

			const items = fs.readdirSync(dir, { withFileTypes: true })
			
			for (const item of items) {
				if (item.isDirectory()) {
					const itemPath = path.join(dir, item.name)
					const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name

					if (item.name === 'miniprogram_npm') {
						npmDirs.push(itemRelativePath)
					} else {
						// 递归扫描子目录
						scanDir(itemPath, itemRelativePath)
					}
				}
			}
		}

		scanDir(this.workPath)
		return npmDirs
	}

	/**
	 * 构建指定的 miniprogram_npm 目录
	 * @param {string} npmDirPath miniprogram_npm 目录路径
	 */
	async buildNpmDir(npmDirPath: string): Promise<void> {
		const fullNpmPath = path.join(this.workPath, npmDirPath)
		
		if (!fs.existsSync(fullNpmPath)) {
			return
		}

		const packages = fs.readdirSync(fullNpmPath, { withFileTypes: true })
			.filter(item => item.isDirectory())
			.map(item => item.name)

		for (const packageName of packages) {
			await this.buildPackage(packageName, npmDirPath)
		}
	}

	/**
	 * 构建单个 npm 包
	 * @param {string} packageName 包名
	 * @param {string} npmDirPath miniprogram_npm 目录路径
	 */
	async buildPackage(packageName: string, npmDirPath: string): Promise<void> {
		const packageKey = `${npmDirPath}/${packageName}`
		
		if (this.builtPackages.has(packageKey)) {
			return
		}

		const packagePath = path.join(this.workPath, npmDirPath, packageName)
		const targetPackagePath = path.join(this.targetPath, npmDirPath, packageName)

		// 确保目标目录存在
		if (!fs.existsSync(path.dirname(targetPackagePath))) {
			fs.mkdirSync(path.dirname(targetPackagePath), { recursive: true })
		}

		// 复制包文件
		await this.copyPackageFiles(packagePath, targetPackagePath)

		// 处理包依赖
		await this.processDependencies(packageName, packagePath, npmDirPath)

		this.builtPackages.add(packageKey)
	}

	/**
	 * 复制包文件
	 * @param {string} sourcePath 源路径
	 * @param {string} targetPath 目标路径
	 */
	async copyPackageFiles(sourcePath: string, targetPath: string): Promise<void> {
		if (!fs.existsSync(sourcePath)) {
			return
		}

		// 确保目标目录存在
		if (!fs.existsSync(targetPath)) {
			fs.mkdirSync(targetPath, { recursive: true })
		}

		const items = fs.readdirSync(sourcePath, { withFileTypes: true })

		for (const item of items) {
			const sourceItemPath = path.join(sourcePath, item.name)
			const targetItemPath = path.join(targetPath, item.name)

			if (item.isDirectory()) {
				await this.copyPackageFiles(sourceItemPath, targetItemPath)
			} else {
				// 只复制小程序相关文件
				if (this.isMiniprogramFile(item.name)) {
					this.dependencyGraph?.addFile('app', sourceItemPath, 'config')
					fs.copyFileSync(sourceItemPath, targetItemPath)
				}
			}
		}
	}

	/**
	 * 检查是否为小程序相关文件
	 * @param {string} filename 文件名
	 * @returns {boolean} 是否为小程序文件
	 */
	isMiniprogramFile(filename: string): boolean {
		// 根据自定义文件类型配置组合扩展名，覆盖内置 wx/dd 类型、样式预处理器和自定义扩展名。
		// getStyleExts 已包含 .less/.scss/.sass；NpmBuilder 在主线程中构造，可直接读取 env getter。
		const ext = path.extname(filename).toLowerCase()
		
		return this.miniprogramExts.has(ext) ||
			   filename === 'package.json' ||
			   filename === 'README.md' ||
			   filename.startsWith('.')
	}

	/**
	 * 处理包依赖
	 * @param {string} packageName 包名
	 * @param {string} packagePath 包路径
	 * @param {string} npmDirPath npm 目录路径
	 */
	async processDependencies(packageName: string, packagePath: string, npmDirPath: string): Promise<void> {
		const packageJsonPath = path.join(packagePath, 'package.json')
		
		if (!fs.existsSync(packageJsonPath)) {
			return
		}

		try {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string>; name?: string; version?: string }
			const dependencies = {
				...(packageJson.dependencies || {}),
				...(packageJson.peerDependencies || {})
			}

			if (dependencies && Object.keys(dependencies).length > 0) {
				this.packageDependencies.set(packageName, dependencies)
				
				// 递归构建依赖包
				for (const depName of Object.keys(dependencies)) {
					await this.buildPackage(depName, npmDirPath)
				}
			}
		} catch (e) {
			console.warn(`[npm-builder] 解析 package.json 失败: ${packageJsonPath}`, errorMessage(e))
		}
	}

	/**
	 * 验证 npm 包的完整性
	 * @param {string} packageName 包名
	 * @param {string} packagePath 包路径
	 * @returns {boolean} 是否有效
	 */
	validatePackage(packageName: string, packagePath: string): boolean {
		// 检查必要文件是否存在
		const requiredFiles = ['package.json']
		
		for (const file of requiredFiles) {
			if (!fs.existsSync(path.join(packagePath, file))) {
				console.warn(`[npm-builder] 包 ${packageName} 缺少必要文件: ${file}`)
				return false
			}
		}

		// 检查 package.json 格式
		try {
			const packageJsonPath = path.join(packagePath, 'package.json')
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
			
			if (!packageJson.name || !packageJson.version) {
				console.warn(`[npm-builder] 包 ${packageName} 的 package.json 格式不正确`)
				return false
			}
		} catch (e) {
			console.warn(`[npm-builder] 包 ${packageName} 的 package.json 解析失败:`, errorMessage(e))
			return false
		}

		return true
	}

	/**
	 * 获取已构建的包列表
	 * @returns {string[]} 已构建的包列表
	 */
	getBuiltPackages(): string[] {
		return Array.from(this.builtPackages)
	}

	/**
	 * 获取包依赖关系
	 * @returns {Map} 包依赖关系映射
	 */
	getPackageDependencies(): Map<string, Record<string, string>> {
		return this.packageDependencies
	}

	/**
	 * 清理构建缓存
	 */
	clearCache(): void {
		this.builtPackages.clear()
		this.packageDependencies.clear()
	}
}

export { NpmBuilder }

// ── facade-collaborator D-FC-1 接线（FC-P2）──────────────────────────
// NpmBuilder 有状态（builtPackages/packageDependencies/miniprogramExts）→
// 每次 build 重新 new（不在 createPackerOrchestrator 闭包构造）。
// collaborator 自身无状态（factory），run() 内 new NpmBuilder + buildNpmPackages + emit.

import type { BuildCollaborator, StageChannelContext } from '../types.ts'
import type { Lifecycle } from '../../shared/lifecycle.ts'
import { LIFECYCLE_EVENTS } from '../../shared/lifecycle.ts'

export interface NpmBuilderDeps {
	lifecycle: Lifecycle
}

export function createNpmBuilderCollaborator(): BuildCollaborator<NpmBuilderDeps> {
	return {
		async run(sctx: StageChannelContext, deps: NpmBuilderDeps) {
			const { lifecycle } = deps
			// B 切法（PC-B2/B3a）：build dir/workPath + fileTypes 从 sctx.storeInfo 显式读（非 ALS）
			const storeInfo = sctx.storeInfo as { pathInfo: { workPath: string; targetPath: string }; compilerOptions: NpmFileTypes }
			const npmBuilder = new NpmBuilder(storeInfo.pathInfo.workPath, storeInfo.pathInfo.targetPath, (sctx.dependencyGraph as { addFile: (n: string, f: string, k: string) => void } | undefined) ?? null, storeInfo.compilerOptions)
			await npmBuilder.buildNpmPackages()
			await lifecycle.emit(LIFECYCLE_EVENTS.NPM_BUILT, {})
		},
	}
}
