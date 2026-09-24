import path from 'node:path'
import process from 'node:process'
import fs from 'node:fs'
import { getAppId, getTargetPath, isTemporaryTargetPath } from '../store/env.ts'

function copyDir(src: string, dest: string): void {
	fs.mkdirSync(dest, { recursive: true })
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(dest, entry.name)
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath)
		}
		else {
			// APFS/Btrfs 等支持时创建写时复制克隆；不支持时 Node 自动回退为普通复制。
			fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE)
		}
	}
}

function createDist(seedPath: string | null | undefined): void {
	const distPath = getTargetPath()
	if (fs.existsSync(distPath)) {
		fs.rmSync(distPath, { recursive: true, force: true })
	}
	fs.mkdirSync(distPath, { recursive: true })
	if (seedPath && fs.existsSync(seedPath)) {
		copyDir(seedPath, distPath)
	}
}
/**
 * 收集目录下全部文件的相对路径集（递归）。
 */
function collectFiles(root: string, rel: string, out: Set<string>): void {
	const abs = rel ? path.join(root, rel) : root
	let entries: fs.Dirent[]
	try {
		entries = fs.readdirSync(abs, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		const childRel = rel ? `${rel}${path.sep}${entry.name}` : entry.name
		if (entry.isDirectory()) {
			collectFiles(root, childRel, out)
		}
		else if (entry.isFile()) {
			out.add(childRel)
		}
	}
}

/**
 * 字节级比较两文件（先 size 快筛，同 size 再全量字节比对）。
 */
function filesIdentical(a: string, b: string): boolean {
	const sa = fs.statSync(a)
	const sb = fs.statSync(b)
	if (sa.size !== sb.size) return false
	return fs.readFileSync(a).equals(fs.readFileSync(b))
}

/**
 * H4 Phase 2 (F-H4-2): 增量 publish——content-diff sync（targetPath → dist）。
 *
 * 语义：dist := targetPath（rsync 式——copy 差异文件 + 删除 dist 独有文件）。
 * 正确性来源：createDist(seedPath) 先把上一轮 dist 完整 seed 进 targetPath，
 * 本轮所有写入（materialize / collectAssets / config / npm）落在 targetPath——
 * targetPath vs dist 的 diff 恰为本轮变更。无需 write 跟踪（资产/配置/npm 非
 * BuildModel entry，content-diff 天然覆盖）。
 *
 * F6 deletion handling：dist 独有文件（targetPath 无）→ 移除（rsync 语义）。
 *
 * dist 稳定性（dev server）：无 rm 窗口——dist 永不短暂缺失（fallback L1
 * reload 的 fetch 不会 404）。
 */
function syncIncremental(srcDir: string, destDir: string): void {
	const destFiles = new Set<string>()
	collectFiles(destDir, '', destFiles)
	const srcFiles = new Set<string>()
	collectFiles(srcDir, '', srcFiles)

	for (const rel of srcFiles) {
		const srcPath = path.join(srcDir, rel)
		const destPath = path.join(destDir, rel)
		if (destFiles.has(rel) && filesIdentical(srcPath, destPath)) {
			continue
		}
		fs.mkdirSync(path.dirname(destPath), { recursive: true })
		fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE)
	}
	for (const rel of destFiles) {
		if (!srcFiles.has(rel)) {
			fs.rmSync(path.join(destDir, rel), { force: true })
		}
	}
}

/**
 * 发布到指定目录
 * @param {string} dist 目标路径
 * @param {boolean} useAppIdDir 是否在路径中包含appId
 * @param {boolean} incremental H4 Phase 2 (F-H4-2)：true = 增量 sync（watch/compile-cache
 *   seedPath 路径，content-diff，无 rm 窗口）；false/缺省 = 全量（one-shot，行为不变）
 */
function publishToDist(dist: string, useAppIdDir: boolean = true, incremental: boolean = false) {
	const distPath = getTargetPath()
	const appId = getAppId()
	const absolutePath = useAppIdDir
		? `${path.resolve(process.cwd(), dist)}${path.sep}${appId}`
		: `${path.resolve(process.cwd(), dist)}`
	
	if (path.resolve(distPath) === path.resolve(absolutePath)) {
		return
	}

	// H4 Phase 2 (F-H4-2): 增量路径——dist 已存在时 content-diff sync（无 rm 窗口）
	if (incremental && fs.existsSync(absolutePath)) {
		syncIncremental(distPath, absolutePath)
		return
	}

	if (fs.existsSync(absolutePath)) {
		fs.rmSync(absolutePath, { recursive: true, force: true })
	}
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true })

	// 默认构建目录由编译器独占，并且通常与发布目录位于同一磁盘。
	// 直接移动可避免把 npm、静态资源和三阶段产物完整复制第二遍。
	if (isTemporaryTargetPath()) {
		try {
			fs.renameSync(distPath, absolutePath)
			return
		}
		catch (error: unknown) {
			if ((error as { code?: string }).code !== 'EXDEV') {
				throw error
			}
			// 跨文件系统时保留原有复制语义，复制完成后清理编译器临时目录。
			fs.mkdirSync(absolutePath, { recursive: true })
			copyDir(distPath, absolutePath)
			fs.rmSync(distPath, { recursive: true, force: true })
			return
		}
	}

	fs.mkdirSync(absolutePath, { recursive: true })

	copyDir(distPath, absolutePath)
}

export { createDist, publishToDist }
