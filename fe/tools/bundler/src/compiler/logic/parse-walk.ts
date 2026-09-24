import fs from 'node:fs'
import { resolve, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import MagicString from 'magic-string'
import type { Node } from 'oxc-parser'
type AstNode = Node & { loc?: { start?: { line?: number } } }
import { getWxMemberName, warnUnsupportedWxApi } from '../core/compatibility.ts'
import { collectAssets, isCollectableImageAsset, resolveAssetSourcePath } from '../../shared/utils.ts'
import { getAppId, getDependencyGraph, getNpmResolver, getTargetPath, getWorkPath, resolveAppAlias } from '../../packer/store/env.ts'
import { errorMessage } from '../../shared/utils.ts'
import type { EmitModule } from '../pipeline/emit.ts'

// 用于缓存已处理的模块
export const processedModules = new Set()

export interface LogicParseWalkOptions {
	isTypeScript: boolean
	sourcemap: boolean
}

export interface LogicParseWalkResult {
	emitModule: EmitModule
	dependenciesToProcess: string[]
	logicDeps: string[]
}

/**
 * parse+walk：oxc parseSync + walk（依赖收集 + MagicString 路径重写）+ sourcemap。
 * 不含 esbuild。graph 写入 + env.ts 直调保留（side effect）。
 */
export async function logicParseWalk(
	source: string,
	modulePath: string,
	currentPath: string,
	sourceFile: string | null,
	packageName: string | null,
	extraInfoCode: string | undefined,
	options: LogicParseWalkOptions,
): Promise<LogicParseWalkResult> {
	const { isTypeScript, sourcemap } = options

	// 使用 oxc-parser 解析代码
	const parseResult = parseSync(modulePath, source, {
		sourceType: 'module',
		lang: isTypeScript ? 'ts' : 'js',
	})
	const ast = parseResult.program

	// 使用 MagicString 进行代码修改
	const s = new MagicString(source)

	// 如果需要添加 extraInfo，在代码开头注入
	if (extraInfoCode) {
		if (sourcemap) {
			// 存到 extraInfoCode，在 modDefine header 中注入，避免影响 sourcemap 行号
			// 不 prepend 到 MagicString
		} else {
			s.prepend(extraInfoCode)
		}
	}

	// 收集需要修改的路径信息和依赖模块
	const pathReplacements: Array<{ start: number; end: number; newValue: string }> = []
	const dependenciesToProcess: string[] = []
	const logicDeps: string[] = [] // M2: 全量 require/import dep ID（AST walk 捕获，供 cache）

	const src = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
	const diagnosticSource = modulePath.startsWith(getWorkPath())
		? modulePath.slice(getWorkPath().length)
		: src

	walk(ast, {
		enter(node: AstNode, _parent: Node | null) {
			const wxMemberName = getWxMemberName(node)
			if (wxMemberName) {
				warnUnsupportedWxApi(
					wxMemberName,
					sourceFile || diagnosticSource,
					node.loc?.start?.line || getLineByIndex(source, node.start),
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
							logicDeps.push(id)
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
						logicDeps.push(id)
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
						logicDeps.push(id)
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
						logicDeps.push(id)
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
		},
	})

	// 反向遍历修改，避免位置偏移
	for (const replacement of pathReplacements.reverse()) {
		s.overwrite(replacement.start, replacement.end, `'${replacement.newValue}'`)
	}

	const modifiedCode = s.toString()
	let preEsbuildMap: string | null = null
	if (sourcemap && sourceFile) {
		const generatedMap = JSON.parse(s.generateMap({
			file: sourceFile,
			source: sourceFile,
			includeContent: true,
			hires: true,
		}).toString())
		generatedMap.file = sourceFile
		generatedMap.sources = [sourceFile]
		generatedMap.sourcesContent = [source]
		preEsbuildMap = JSON.stringify(generatedMap)
	}

	return {
		emitModule: {
			moduleId: currentPath,
			code: modifiedCode,
			map: preEsbuildMap,
			extraInfoCode: sourcemap ? extraInfoCode : undefined,
		},
		dependenciesToProcess,
		logicDeps,
	}
}

function isLocalAssetString(value: unknown): value is string {
	return typeof value === 'string'
		&& !value.startsWith('http')
		&& !value.startsWith('//')
		&& (value.startsWith('/') || value.startsWith('./') || value.startsWith('../'))
		&& isCollectableImageAsset(value)
}

export function getLineByIndex(content: string, index: number | undefined): number | null {
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
export function getJSAbsolutePath(modulePath: string): string | null {
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

export function resolveDependencyId(specifier: string, modulePath: string, allowAbsolute: boolean): { id: string; shouldProcess: boolean } {
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
