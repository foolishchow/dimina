import fs from 'node:fs'
import path from 'node:path'
import { getAbsolutePath } from '../../../../shared/utils.ts'
import { getTemplateExts, getViewScriptExts } from '../../../core/env.ts'

/**
 * 根据扩展名列表生成匹配尾部扩展名的正则，如 ['.wxs', '.qds'] -> /(\.wxs|\.qds)$/
 */
export function buildExtStripRegex(exts: string[]) {
	const alt = exts.map((e: string) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
	return new RegExp(`(${alt})$`)
}

/**
 * 移除视图脚本文件路径末尾的扩展名，支持 .wxs 和自定义扩展名
 */
export function stripViewScriptExt(p: string) {
	return p.replace(buildExtStripRegex(getViewScriptExts()), '')
}

/**
 * 根据工作目录获取 ml 文件绝对路径
 * @param {string} workPath
 * @param {string} src
 * @returns 返回绝对路径
 */
export function getViewPath(workPath: string, src: string): string | undefined {
	const aSrc = src.startsWith('/') ? src : `/${src}`
	for (const mlType of getTemplateExts()) {
		const mlFullPath = `${workPath}${aSrc}${mlType}`
		if (fs.existsSync(mlFullPath)) {
			return mlFullPath
		}

		const indexMlFullPath = `${workPath}${aSrc}/index${mlType}`
		if (fs.existsSync(indexMlFullPath)) {
			return indexMlFullPath
		}
	}
}

/**
 * 解析 import/include 的模板文件路径。
 * 微信允许省略 .wxml；显式扩展名保持原样，无扩展名时按当前模板类型优先级补全。
 */
export function resolveTemplateDependencyPath(workPath: string, ownerPath: string, src: string) {
	const resolvedPath = getAbsolutePath(workPath, ownerPath, src)
	if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
		return resolvedPath
	}

	if (path.extname(resolvedPath)) {
		return resolvedPath
	}

	for (const ext of getTemplateExts()) {
		const candidate = `${resolvedPath}${ext}`
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return candidate
		}
	}

	return resolvedPath
}
