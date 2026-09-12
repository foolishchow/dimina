/**
 * fingerprint — 输入指纹体系（build-model M2 / D-BM-2）。
 *
 * 文件级：`(mtime, size)` 预筛 + content hash 确认（git 风格轻量版）。
 * Entry 级：inputHash = H(schemaVersion + toolStamp + contextFingerprint + sorted(relPath:contentHash))。
 *
 * D-BM-2：非纯 mtime——避免 mtime 未变但内容变的漏算窗口。
 * D-BM-3：scan/closure 单实现——状态对比替代事件推导。
 * 技术设计 §3.1：四层维度（内容/结构/参数/工具），排序稳定。
 *
 * 不应进入 inputHash 的维度（否则换目录/进程即全失效）：
 * targetPath / 临时路径 / 进程 PID / worker ID / 时间戳 / 监听事件 count。
 */

import crypto from 'node:crypto'
import fs from 'node:fs'

const FINGERPRINT_SCHEMA_VERSION = 'bm-v1'

/**
 * 计算文件的内容 hash（sha256 十六进制截取前 16 位）。
 * @param {string} filePath 绝对路径
 * @returns {string} hex hash
 */
function computeFileHash(filePath) {
	const content = fs.readFileSync(filePath)
	return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * 文件级指纹：`(mtime, size)` 预筛 + content hash 确认。
 *
 * @param {string} filePath 绝对路径
 * @param {{ mtime: number, size: number, hash: string } | undefined} prev 旧指纹
 * @returns {{ mtime: number, size: number, hash: string } | null} 新指纹（文件不存在返回 null）
 */
export function fingerprintFile(filePath, prev) {
	let stat
	try {
		stat = fs.statSync(filePath)
	}
	catch {
		return null
	}
	const mtimeMs = Math.floor(stat.mtimeMs)
	const size = stat.size

	// 预筛：mtime 和 size 均未变 → 沿用旧 hash（跳过读取）
	if (prev && prev.mtime === mtimeMs && prev.size === size) {
		return prev
	}

	// 确认：任一变化 → 重算 hash
	return { mtime: mtimeMs, size, hash: computeFileHash(filePath) }
}

/**
 * 扫描变更集（纯函数）：对比旧指纹表 vs 当前文件集。
 *
 * @param {Map<string, {mtime,size,hash}>} oldFP  旧指纹表（relPath → fingerprint）
 * @param {string[]} allFiles 当前文件清单（项目相对 POSIX 路径，已排序）
 * @param {string} workPath 项目根（绝对路径）
 * @returns {{ changed: string[], added: string[], removed: string[], fingerprints: Map<string, object> }}
 */
export function scanFingerprints(oldFP, allFiles, workPath) {
	const changed = []
	const added = []
	const removed = []
	const fingerprints = new Map()

	const currentSet = new Set(allFiles)
	const oldSet = new Set(oldFP.keys())

	for (const relPath of allFiles) {
		const absPath = `${workPath}/${relPath}`
		const prev = oldFP.get(relPath)
		const fp = fingerprintFile(absPath, prev)
		if (fp === null) {
			// 文件消失了（allFiles 可能来自 graph 而非磁盘）
			removed.push(relPath)
			continue
		}
		fingerprints.set(relPath, fp)
		if (!oldSet.has(relPath)) {
			added.push(relPath)
		}
		else if (prev && prev.hash !== fp.hash) {
			changed.push(relPath)
		}
	}

	// 旧有现无 → removed
	for (const relPath of oldSet) {
		if (!currentSet.has(relPath)) {
			removed.push(relPath)
		}
	}

	return { changed, added, removed, fingerprints }
}

/**
 * Entry 级 inputHash：四层维度聚合。
 *
 * @param {object} params
 * @param {string[]} params.inputFiles 项目相对路径列表（已排序）
 * @param {Map<string, {hash: string}>} fingerprints 文件指纹表
 * @param {string} params.contextFingerprint 编译维度聚合（minify/esTarget.view/fileTypes/renderer）
 * @param {string} params.toolStamp 编译器版本指纹
 * @returns {string} inputHash
 */
export function computeEntryInputHash({ inputFiles, fingerprints, contextFingerprint, toolStamp }) {
	const sortedEntries = inputFiles
		.slice()
		.sort()
		.map((relPath) => {
			const fp = fingerprints.get(relPath)
			return `${relPath}:${fp ? fp.hash : 'MISSING'}`
		})

	const parts = [
		FINGERPRINT_SCHEMA_VERSION,
		`tool:${toolStamp}`,
		`ctx:${contextFingerprint}`,
		...sortedEntries,
	]

	return crypto.createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16)
}

export { FINGERPRINT_SCHEMA_VERSION }
