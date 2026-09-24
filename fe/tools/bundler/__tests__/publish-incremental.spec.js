import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { publishToDist } from '../src/compiler/pipeline/publish.ts'

// H4 Phase 2 (F-H4-2): publishToDist 增量 sync——content-diff（无 rm 窗口）+ deletion handling (F6)。
// 测试用 TARGET_PATH 环境变量（temporaryTargetPath=false → copy 路径）+ useAppIdDir=false（免 config）。

describe('publishToDist — incremental sync (H4 Phase 2 F-H4-2)', () => {
	let tempDir
	let targetDir   // 编译临时目录（getTargetPath）
	let workDir     // 工作区（storePathInfo 参数）
	let distDir     // 发布目录
	let originalTargetPath

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-incr-'))
		targetDir = path.join(tempDir, 'build')
		workDir = path.join(tempDir, 'work')
		distDir = path.join(tempDir, 'dist')
		fs.mkdirSync(targetDir, { recursive: true })
		fs.mkdirSync(workDir, { recursive: true })
		originalTargetPath = process.env.TARGET_PATH
		process.env.TARGET_PATH = targetDir
		// 最小 config（app.json + project.config.json）—— storeInfo fixpoint 为 getAppId 提供 projectInfo
		fs.writeFileSync(path.join(workDir, 'app.json'), JSON.stringify({ pages: [] }))
		fs.writeFileSync(path.join(workDir, 'project.config.json'), JSON.stringify({ appid: 'publish-test' }))
	})

	afterEach(() => {
		if (originalTargetPath) process.env.TARGET_PATH = originalTargetPath
		else delete process.env.TARGET_PATH
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	async function setupEnv() {
		// await import 保证与 publish.ts 同一 ESM 实例（require 会产生独立 CJS 实例——dual-instance trap）
		const { storeInfo } = await import('../src/compiler/core/env.ts')
		storeInfo(workDir)
	}

	function writeFile(root, relPath, content) {
		const filePath = path.join(root, relPath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	it('增量 sync：只 copy 差异文件，相同文件保留 mtime（未触碰）', async () => {
		await setupEnv()
		// dist 已有上一轮产物（seed 来源）
		writeFile(distDir, 'main/logic.js', 'old-logic')
		writeFile(distDir, 'main/view.js', 'same-view')
		writeFile(distDir, 'stale/removed.js', 'orphan')
		// targetPath = seed + 本轮变更（logic 变更；view 未变；无 stale）
		writeFile(targetDir, 'main/logic.js', 'new-logic')
		writeFile(targetDir, 'main/view.js', 'same-view')

		const viewMtimeBefore = fs.statSync(path.join(distDir, 'main/view.js')).mtimeMs
		publishToDist(distDir, false, true)

		expect(fs.readFileSync(path.join(distDir, 'main/logic.js'), 'utf8')).toBe('new-logic')
		expect(fs.readFileSync(path.join(distDir, 'main/view.js'), 'utf8')).toBe('same-view')
		// 未变文件未被重写（mtime 不变）
		expect(fs.statSync(path.join(distDir, 'main/view.js')).mtimeMs).toBe(viewMtimeBefore)
		// F6: dist 独有文件（targetPath 无）→ 移除
		expect(fs.existsSync(path.join(distDir, 'stale/removed.js'))).toBe(false)
		// 最终 dist == targetPath
		expect(fs.existsSync(path.join(distDir, 'main/logic.js'))).toBe(true)
	})

	it('增量 sync：新增子目录文件（mkdirSync recursive）', async () => {
		await setupEnv()
		writeFile(distDir, 'main/logic.js', 'old')
		writeFile(targetDir, 'main/logic.js', 'old')
		writeFile(targetDir, 'pages/new/deep/view.js', 'brand-new')

		publishToDist(distDir, false, true)

		expect(fs.readFileSync(path.join(distDir, 'pages/new/deep/view.js'), 'utf8')).toBe('brand-new')
	})

	it('增量与全量产物等价（rsync 语义 == rm+copy）', async () => {
		await setupEnv()
		// targetPath 完整状态
		writeFile(targetDir, 'main/logic.js', 'logic-v2')
		writeFile(targetDir, 'main/view.js', 'view')
		writeFile(targetDir, 'main/app.json', '{}')
		// dist 旧状态
		writeFile(distDir, 'main/logic.js', 'logic-v1')
		writeFile(distDir, 'gone/old.js', 'stale')

		publishToDist(distDir, false, true)

		// 等价基准：全量 copy 到另一目录
		const fullDist = path.join(tempDir, 'dist-full')
		fs.mkdirSync(fullDist, { recursive: true })
		writeFile(fullDist, 'placeholder', 'x')
		process.env.TARGET_PATH = targetDir
		publishToDist(fullDist, false, false)

		// 目录树等价（除 placeholder 被 rm 后重 copy）
		const listDir = (root) => {
			const out = []
			const walk = (rel) => {
				const abs = rel ? path.join(root, rel) : root
				for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
					const r = rel ? `${rel}/${e.name}` : e.name
					if (e.isDirectory()) walk(r)
					else out.push(r)
				}
			}
			walk('')
			return out.sort()
		}
		expect(listDir(distDir)).toEqual(listDir(fullDist))
		for (const rel of listDir(distDir)) {
			expect(fs.readFileSync(path.join(distDir, rel), 'utf8'))
				.toBe(fs.readFileSync(path.join(fullDist, rel), 'utf8'))
		}
	})

	it('增量但 dist 不存在 → 走全量路径（fallback）', async () => {
		await setupEnv()
		writeFile(targetDir, 'main/logic.js', 'only')
		const missingDist = path.join(tempDir, 'not-yet')

		publishToDist(missingDist, false, true)

		expect(fs.readFileSync(path.join(missingDist, 'main/logic.js'), 'utf8')).toBe('only')
	})

	it('同 size 不同内容 → 字节比对捕获（非 mtime/size 快筛误判 identical）', async () => {
		await setupEnv()
		writeFile(distDir, 'main/logic.js', 'aaaa')
		writeFile(targetDir, 'main/logic.js', 'bbbb')

		publishToDist(distDir, false, true)

		expect(fs.readFileSync(path.join(distDir, 'main/logic.js'), 'utf8')).toBe('bbbb')
	})
})
