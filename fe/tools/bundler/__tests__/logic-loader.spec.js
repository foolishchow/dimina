import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runWithAbilities } from './helpers/run-with-abilities.js'

// H2 Phase 2a（D-REG-2 / F-H2-1）：logic Loader 包装 + loaderRegistry 实体化。

describe('logicLoader — Loader registry wrap（H2 Phase 2a）', () => {
	let tempDir
	let outputDir

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logic-loader-'))
		outputDir = path.join(tempDir, 'dist')
		fs.mkdirSync(outputDir, { recursive: true })
	})

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	function writeFile(relativePath, content) {
		const filePath = path.join(tempDir, relativePath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	it('load 返回字节一致 source + 依赖发现（等价 logicParseWalk）', async () => {
		writeFile('app.json', JSON.stringify({ pages: ['pages/index'] }))
		writeFile('project.config.json', JSON.stringify({ appid: 'test-app' }))
		writeFile('pages/index.js', [
			'import { helper } from "./helper"',
			'Page({ data: { msg: "hi" } })',
			'',
		].join('\n'))
		writeFile('pages/helper.js', 'export const helper = 1\n')

		const { storeInfo } = await import('../src/packer/store/env.ts')
		storeInfo(tempDir)
		const { logicLoader } = await import('../src/compiler/logic/registry-impl.js')
		const { logicParseWalk } = await import('../src/compiler/logic/parse-walk.js')

		const loaded = await runWithAbilities(outputDir, () =>
			logicLoader.load({ moduleId: 'pages/index', kind: 'logic', source: '' }, {}))

		// 等价性：直接调 logicParseWalk（同参数）
		const modulePath = path.join(tempDir, 'pages/index.js')
		const source = fs.readFileSync(modulePath, 'utf-8')
		const direct = await runWithAbilities(outputDir, () =>
			logicParseWalk(source, modulePath, 'pages/index', null, null, undefined,
				{ isTypeScript: false, sourcemap: false }))

		expect(loaded.kind).toBe('logic')
		expect(loaded.moduleId).toBe('pages/index')
		expect(loaded.metadata.sourcePath).toBe(modulePath)
		expect(loaded.source).toBe(direct.emitModule.code)
		expect(loaded.dependencies).toEqual(direct.logicDeps)
		expect(loaded.dependencies).toContain('/pages/helper')
		// MagicString 路径重写（依赖解析）："./helper" → '/pages/helper'（单引号）
		expect(loaded.source).toContain("'/pages/helper'")
		expect(loaded.source).not.toContain('"./helper"')
	})

	it('TS 模块：isTypeScript 派生 + 重写一致', async () => {
		writeFile('app.json', JSON.stringify({ pages: ['pages/index'] }))
		writeFile('project.config.json', JSON.stringify({ appid: 'test-app' }))
		writeFile('pages/index.ts', [
			'import { helper } from "./helper"',
			'const value: number = 1',
			'Page({ data: { msg: helper + value } })',
			'',
		].join('\n'))
		writeFile('pages/helper.ts', 'export const helper = 1\n')

		const { storeInfo } = await import('../src/packer/store/env.ts')
		storeInfo(tempDir)
		const { logicLoader } = await import('../src/compiler/logic/registry-impl.js')

		const loaded = await runWithAbilities(outputDir, () =>
			logicLoader.load({ moduleId: 'pages/index', kind: 'logic', source: '' }, {}))

		expect(loaded.kind).toBe('logic')
		expect(loaded.metadata.sourcePath.endsWith('.ts')).toBe(true)
		expect(loaded.dependencies).toContain('/pages/helper')
		expect(loaded.source).toContain("'/pages/helper'")
	})

	it('input.source 优先于磁盘读取', async () => {
		writeFile('app.json', JSON.stringify({ pages: ['pages/index'] }))
		writeFile('project.config.json', JSON.stringify({ appid: 'test-app' }))
		writeFile('pages/index.js', 'Page({})\n')

		const { storeInfo } = await import('../src/packer/store/env.ts')
		storeInfo(tempDir)
		const { logicLoader } = await import('../src/compiler/logic/registry-impl.js')

		// input.source 非空 → 使用它（不读磁盘）
		const loaded = await runWithAbilities(outputDir, () =>
			logicLoader.load({ moduleId: 'pages/index', kind: 'logic', source: 'const x = 1\n' }, {}))

		expect(loaded.source).toBe('const x = 1\n')
		expect(loaded.dependencies).toEqual([])
	})

	it('找不到模块 → throw', async () => {
		writeFile('app.json', JSON.stringify({ pages: ['pages/missing'] }))
		writeFile('project.config.json', JSON.stringify({ appid: 'test-app' }))
		const { storeInfo } = await import('../src/packer/store/env.ts')
		storeInfo(tempDir)
		const { logicLoader } = await import('../src/compiler/logic/registry-impl.js')

		await expect(
			runWithAbilities(outputDir, () =>
				logicLoader.load({ moduleId: 'pages/missing', kind: 'logic', source: '' }, {})),
		).rejects.toThrow(/找不到模块文件/)
	})
})

describe('LoaderRegistryImpl + orchestrator materialize（H2 Phase 2a）', () => {
	let tempDir
	let outputDir

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-materialize-'))
		outputDir = path.join(tempDir, 'dist')
		fs.mkdirSync(outputDir, { recursive: true })
	})

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	function writeFile(relativePath, content) {
		const filePath = path.join(tempDir, relativePath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	it('registry 注册/get/kinds + 未注册 kind throw', async () => {
		const { LoaderRegistryImpl } = await import('../src/packer/registry/lce.ts')
		const { logicLoader } = await import('../src/compiler/logic/registry-impl.js')

		const registry = new LoaderRegistryImpl()
		expect(registry.kinds()).toEqual([])
		registry.register('logic', logicLoader)
		expect(registry.get('logic')).toBe(logicLoader)
		expect(registry.kinds()).toEqual(['logic'])
		expect(() => registry.get('view')).toThrow(/no Loader registered for kind: view/)
	})

	it('orchestrator 私有 registry（D-FC-2b）—— orchestrate 行为验 logic 已接线', async () => {
		const { createPackerOrchestrator } = await import('../src/packer/orchestrator.js')
		const { PackerSessionState } = await import('../src/packer/state/session-state.js')
		const { storeInfo, buildPackerContext } = await import('../src/packer/store/env.ts')

		writeFile('app.json', JSON.stringify({ pages: ['pages/index'] }))
		writeFile('project.config.json', JSON.stringify({ appid: 'test-app' }))
		writeFile('pages/index.js', 'Page({ data: { msg: "hi" } })\n')
		storeInfo(tempDir)

		const orch = createPackerOrchestrator()
		// D-FC-2b: registry 私有化——orch 仅返 { orchestrate }，不再公开 loaderRegistry 等
		expect(orch.loaderRegistry).toBeUndefined()
		expect(orch.compileRegistry).toBeUndefined()
		expect(orch.emitRegistry).toBeUndefined()
		// 改验 orchestrate 行为：logic 接线 → buildModel 有 logic emit entry
		const result = await orch.orchestrate(
			buildPackerContext(tempDir, outputDir),
			new PackerSessionState(),
			{ useAppIdDir: true, prepareNpm: false, skipMaterialize: false,
				parallel: false, incremental: false, configChanged: false },
		)
		expect(result.appId).toBe('test-app')
		expect(result.entries.length).toBeGreaterThan(0)
	})
})
