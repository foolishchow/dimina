import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { DependencyGraph } from '../src/packer/graph/dependency-graph.ts'
import { createIgnoredPathMatcher, createWatchBuildPlan, createWatchRebuildScheduler, getPublishedOutputPath } from '../src/watch/watch-plan.ts'

describe('compiler watch scheduler', () => {
	it('rebuilds for added, changed, and deleted files but ignores directory events', async () => {
		const rebuild = vi.fn().mockResolvedValue(undefined)
		const scheduler = createWatchRebuildScheduler({ rebuild })

		scheduler.schedule('change', '/project/pages/index/index.js')
		expect(rebuild).toHaveBeenCalledTimes(1)

		scheduler.schedule('addDir', '/project/pages/new')
		expect(rebuild).toHaveBeenCalledTimes(1)
	})

	it('serializes builds and coalesces events received while a build is running', async () => {
		let finishFirstBuild
		const firstBuild = new Promise((resolve) => {
			finishFirstBuild = resolve
		})
		const rebuild = vi.fn()
			.mockImplementationOnce(() => firstBuild)
			.mockResolvedValue(undefined)
		const onRebuild = vi.fn()
		const scheduler = createWatchRebuildScheduler({ rebuild, onRebuild })

		scheduler.schedule('change', '/project/app.json')
		scheduler.schedule('add', '/project/pages/new/index.js')
		scheduler.schedule('unlink', '/project/pages/old/index.js')
		expect(rebuild).toHaveBeenCalledTimes(1)

		finishFirstBuild()
		await scheduler.waitForIdle()

		expect(rebuild).toHaveBeenCalledTimes(2)
		// M2（D-BM-3）：事件合并后不再保守退全量——drain 一次处理全部脏文件
		const secondCall = onRebuild.mock.calls[1][0]
		expect(secondCall.count).toBeGreaterThanOrEqual(2)
	})

	it('keeps accepting rebuilds after a failed compilation', async () => {
		const error = new Error('invalid template')
		const rebuild = vi.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValue(undefined)
		const onError = vi.fn()
		const scheduler = createWatchRebuildScheduler({ rebuild, onError })

		scheduler.schedule('change', '/project/pages/index/index.wxml')
		await scheduler.waitForIdle()
		scheduler.schedule('change', '/project/pages/index/index.wxml')
		await scheduler.waitForIdle()

		expect(rebuild).toHaveBeenCalledTimes(2)
		expect(onError).toHaveBeenCalledWith(error, expect.objectContaining({
			filePath: '/project/pages/index/index.wxml',
		}))
	})

	it('ignores the published app directory without hiding similarly prefixed source paths', () => {
		const workPath = path.resolve('/project')
		const outputPath = getPublishedOutputPath(workPath, true, 'test-app')
		const ignoredPaths = new Set([outputPath])
		const isIgnored = createIgnoredPathMatcher(ignoredPaths)

		expect(isIgnored(outputPath)).toBe(true)
		expect(isIgnored(path.join(outputPath, 'main/logic.js'))).toBe(true)
		expect(isIgnored(path.join(workPath, 'test-app-source/index.js'))).toBe(false)
	})

	it('uses reverse dependencies for incremental changes and keeps structural changes full', () => {
		const graph = new DependencyGraph()
		graph.addNode('pages/index/index', { entry: true, type: 'page' })
		graph.addNode('/components/card/index', { type: 'component' })
		graph.addDependency('pages/index/index', '/components/card/index', 'component')
		graph.addFile('/components/card/index', '/project/components/card/index.wxml', 'view')
		graph.addFile('pages/index/index', '/project/pages/index/index.json', 'config')

		const workPath = '/project'
		const incremental = createWatchBuildPlan({
			changedFiles: ['/project/components/card/index.wxml'],
			dependencyGraph: graph,
			workPath,
			publishedPath: '/dist/app',
		})
		expect(incremental).toMatchObject({
			skip: false,
			incremental: true,
			options: {
				affectedEntries: ['pages/index/index'],
				stages: ['view'],
				seedPath: '/dist/app',
				prepareConfig: false,
				prepareNpm: false,
			},
		})

		expect(createWatchBuildPlan({
			changedFiles: ['/project/pages/index/index.json'],
			dependencyGraph: graph,
			workPath,
			publishedPath: '/dist/app',
		})).toEqual({
			skip: false,
			incremental: false,
			configChanged: true,
			options: { incremental: false, configChanged: true },
			fingerprints: expect.anything(),
		})
		// 未被图追踪 → 全量（新文件/README 等未知文件不 skip，正确触发全量 rebuild）
		expect(createWatchBuildPlan({
			changedFiles: ['/project/README.md'],
			dependencyGraph: graph,
			workPath,
			publishedPath: '/dist/app',
		})).toEqual({
			skip: false,
			incremental: false,
			configChanged: false,
			options: { incremental: false, configChanged: false },
			fingerprints: expect.anything(),
		})

		// M2（D-BM-3 / R-BM4）：合并事件不再退全量——多文件统一 scan+closure
		const merged = createWatchBuildPlan({
			changedFiles: [
				'/project/components/card/index.wxml',
				'/project/components/card/index.wxml',
			],
			dependencyGraph: graph,
			workPath,
			publishedPath: '/dist/app',
		})
		expect(merged).toMatchObject({
			skip: false,
			incremental: true,
			options: {
				affectedEntries: ['pages/index/index'],
				stages: ['view'],
			},
		})
	})

	it('skips rebuild when only mtime changed but content is identical (D-FP-5 dedup)', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'))
		try {
			const workPath = tempDir
			const filePath = path.join(workPath, 'pages/index/index.js')
			fs.mkdirSync(path.dirname(filePath), { recursive: true })
			fs.writeFileSync(filePath, 'const a = 1\n')

			const graph = new DependencyGraph()
			graph.addNode('pages/index/index', { entry: true, type: 'page' })
			graph.addFile('pages/index/index', filePath, 'logic')

			// ① 首次 plan（新文件，无 prev）→ incremental
			const first = createWatchBuildPlan({
				changedFiles: [filePath],
				dependencyGraph: graph,
				workPath,
				publishedPath: '/dist/app',
			})
			expect(first.skip).toBe(false)
			expect(first.incremental).toBe(true)
			expect(first.fingerprints.has('pages/index/index.js')).toBe(true)

			// ② mtime-only（utimesSync +10s，内容不变）→ dedup → skip
			const future = new Date(Date.now() + 10000)
			fs.utimesSync(filePath, future, future)
			const second = createWatchBuildPlan({
				changedFiles: [filePath],
				dependencyGraph: graph,
				workPath,
				publishedPath: '/dist/app',
				prevFingerprints: first.fingerprints,
			})
			expect(second.skip).toBe(true)

			// ③ 内容修改（不同长度内容，size 变化强制重算）→ incremental
			fs.writeFileSync(filePath, 'const a = 22\n')
			const third = createWatchBuildPlan({
				changedFiles: [filePath],
				dependencyGraph: graph,
				workPath,
				publishedPath: '/dist/app',
				prevFingerprints: second.fingerprints,
			})
			expect(third.skip).toBe(false)
			expect(third.incremental).toBe(true)
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})
})
