/**
 * fe-tools-compiler-target — createCompileTarget (T1) + computeStagePlan (T2) + P-CT05 结构锚定
 *
 * H2 (D-REG-1): deriveStagePlan + readLoadBindings 移入 packer/registry/dispatch.ts。
 * compile-target 只留 createCompileTarget (静态段) + COMPILE_STAGE_ORDER。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// 副作用：注册 webview renderer（与管线启动路径一致）
import '../src/packer/orchestrator.ts'
import {
	COMPILE_STAGE_ORDER,
	createCompileTarget,
} from '../src/packer/pipeline/compile-target.ts'
import {
	computeStagePlan,
	createDispatchRegistry,
	readLoadBindings,
} from '../src/packer/registry/dispatch.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.join(__dirname, '../src/compiler')
const repoRoot = path.join(__dirname, '..')
const packerRoot = path.join(__dirname, '../src/packer')

describe('createCompileTarget (T1)', () => {
	let workPath

	beforeEach(() => {
		workPath = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-target-'))
		fs.writeFileSync(path.join(workPath, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
	})

	afterEach(() => {
		fs.rmSync(workPath, { recursive: true, force: true })
	})

	function baseOptions(overrides = {}) {
		return {
			targetPath: path.join(workPath, 'out'),
			workPath,
			useAppIdDir: true,
			...overrides,
		}
	}

	it('returns static CompileTarget with verified renderer adapter and default stages', () => {
		const compileTarget = createCompileTarget(baseOptions())
		expect(compileTarget.mode).toBe('build')
		expect(compileTarget.platform).toBe('native')
		expect(compileTarget.sourcemap).toBe(false)
		expect(compileTarget.sourcemapStrategy).toBe('quickjs-attach')
		expect(compileTarget.compileConfig).toMatchObject({
			mode: 'build',
			platform: 'native',
			sourcemap: false,
		})
		expect(compileTarget.renderer.name).toBe('webview')
		expect(compileTarget.renderer.adapter).toBeTruthy()
		expect(typeof compileTarget.renderer.adapter.runViewStage).toBe('function')
		expect([...compileTarget.requestedStages]).toEqual(COMPILE_STAGE_ORDER)
		expect(compileTarget.workPath).toBe(workPath)
		expect(compileTarget.useAppIdDir).toBe(true)
	})

	it('honors stages whitelist subset in order', () => {
		const compileTarget = createCompileTarget(baseOptions({ stages: ['logic', 'view'] }))
		expect([...compileTarget.requestedStages]).toEqual(['view', 'logic'])
	})

	it('rejects unknown compiler stages with frozen message text', () => {
		expect(() => createCompileTarget(baseOptions({ stages: ['unknown'] })))
			.toThrow(TypeError)
		expect(() => createCompileTarget(baseOptions({ stages: ['unknown'] })))
			.toThrow('Invalid compiler stages: ["unknown"]')
	})

	it('rejects non-array stages with frozen message text', () => {
		expect(() => createCompileTarget(baseOptions({ stages: 'view' })))
			.toThrow('Invalid compiler stages: "view"')
	})

	it('rejects unregistered renderer adapter with frozen message text', () => {
		fs.writeFileSync(path.join(workPath, 'app.json'), JSON.stringify({
			pages: ['pages/index/index'],
			renderer: 'skyline',
		}))
		expect(() => createCompileTarget(baseOptions()))
			.toThrow(/Unsupported renderer: skyline/)
	})

	it('propagates Invalid platform from compile-config (message lock)', () => {
		expect(() => createCompileTarget(baseOptions({ platform: 'ios' })))
			.toThrow(/Invalid platform/)
	})

	it('carries mode/platform/sourcemap from runOptions via resolveCompileConfig (E1)', () => {
		const compileTarget = createCompileTarget(baseOptions({
			mode: 'dev',
			platform: 'web',
			sourcemap: true,
		}))
		expect(compileTarget.mode).toBe('dev')
		expect(compileTarget.platform).toBe('web')
		expect(compileTarget.sourcemap).toBe(true)
		expect(compileTarget.sourcemapStrategy).toBe('devtools-url')
		expect(compileTarget.minify).toBe(false)
	})
})

describe('computeStagePlan (T2 — registry)', () => {
	const adapter = { name: 'webview', runViewStage() {}, runStyleStage() {} }
	const registry = createDispatchRegistry()

	function makeTarget(overrides = {}) {
		const compileConfig = {
			mode: 'build',
			platform: 'native',
			sourcemap: false,
			sourcemapStrategy: 'quickjs-attach',
			minify: true,
			esTarget: { logic: 'es2023', view: 'es2020' },
		}
		return {
			...compileConfig,
			compileConfig,
			renderer: { name: 'webview', adapter },
			requestedStages: new Set(COMPILE_STAGE_ORDER),
			targetPath: '/out',
			useAppIdDir: true,
			workPath: '/work',
			...overrides,
		}
	}

	function makeBindings(overrides = {}) {
		return {
			miniGame: false,
			appId: 'app-demo',
			appStyleScopeId: 'scope-app',
			pages: {
				mainPages: [{ path: 'pages/index/index', id: 'p1' }],
				subPages: {},
			},
			...overrides,
		}
	}

	it('derives all stages with full workerOptions when not mini-game', () => {
		const plan = computeStagePlan(registry, makeTarget(), makeBindings(), { cwd: '/cwd' })
		expect(plan.stages).toEqual(['view', 'logic', 'style'])
		expect(plan.stageSpecs.view.renderer).toBe(adapter)
		expect(plan.stageSpecs.view.workerOptions).toEqual({
			sourcemap: false,
			compileConfig: makeTarget().compileConfig,
		})
		expect(plan.stageSpecs.logic.workerOptions.sourcemapTargetPath).toBe(path.resolve('/cwd', '/out', 'app-demo'))
		expect(plan.stageSpecs.logic.workerOptions.pages.mainPages).toHaveLength(1)
		expect(plan.stageSpecs.style.workerOptions.pages.mainPages[0]).toEqual({
			path: 'app',
			id: 'scope-app',
		})
		expect(plan.stylePages.mainPages[0].path).toBe('app')
	})

	it('drops view/style under mini-game (logic only)', () => {
		const plan = computeStagePlan(
			registry,
			makeTarget(),
			makeBindings({ miniGame: true }),
			{ cwd: '/cwd' },
		)
		expect(plan.stages).toEqual(['logic'])
		expect(plan.stageSpecs.view).toBeUndefined()
		expect(plan.stageSpecs.style).toBeUndefined()
		expect(plan.stageSpecs.logic).toBeTruthy()
	})

	it('intersects requestedStages with mini-game filter', () => {
		const plan = computeStagePlan(
			registry,
			makeTarget({ requestedStages: new Set(['view', 'style']) }),
			makeBindings({ miniGame: true }),
			{ cwd: '/cwd' },
		)
		expect(plan.stages).toEqual([])
		expect(plan.stageSpecs).toEqual({})
	})

	it('honors stages subset without mini-game', () => {
		const plan = computeStagePlan(
			registry,
			makeTarget({ requestedStages: new Set(['logic']) }),
			makeBindings(),
			{ cwd: '/cwd' },
		)
		expect(plan.stages).toEqual(['logic'])
	})

	it('omits appId dir from sourcemapTargetPath when useAppIdDir=false', () => {
		const plan = computeStagePlan(
			registry,
			makeTarget({ useAppIdDir: false }),
			makeBindings(),
			{ cwd: '/cwd' },
		)
		expect(plan.sourcemapTargetPath).toBe(path.resolve('/cwd', '/out', ''))
	})

	it('uses affectedEntries for style synthesis when provided', () => {
		const plan = computeStagePlan(registry, makeTarget(), makeBindings(), {
			cwd: '/cwd',
			affectedEntries: ['pages/index/index'],
		})
		expect(plan.stageSpecs.style.workerOptions.pages.mainPages).toEqual([
			{ path: 'app', id: 'scope-app' },
			{ path: 'pages/index/index', id: 'p1' },
		])
		// logic still uses full bindings.pages
		expect(plan.stageSpecs.logic.workerOptions.pages.mainPages[0].path).toBe('pages/index/index')
	})

	it('returns new objects without mutating inputs', () => {
		const compileTarget = makeTarget()
		const bindings = makeBindings()
		const pagesBefore = JSON.stringify(bindings.pages)
		const plan1 = computeStagePlan(registry, compileTarget, bindings, { cwd: '/cwd' })
		const plan2 = computeStagePlan(registry, compileTarget, bindings, { cwd: '/cwd' })
		expect(plan1).not.toBe(plan2)
		expect(plan1.stageSpecs).not.toBe(plan2.stageSpecs)
		expect(JSON.stringify(bindings.pages)).toBe(pagesBefore)
	})

	it('rejects incomplete bindings (timing misuse guard)', () => {
		expect(() => computeStagePlan(registry, makeTarget(), { miniGame: true }, { cwd: '/cwd' }))
			.toThrow(/incomplete load bindings/)
	})

	it('allows undefined appId (no project appid) like pre-T2 path.resolve', () => {
		const plan = computeStagePlan(
			registry,
			makeTarget(),
			makeBindings({ appId: undefined }),
			{ cwd: '/cwd' },
		)
		expect(plan.stages).toContain('logic')
		expect(plan.sourcemapTargetPath).toBe(path.resolve('/cwd', '/out', ''))
	})

	it('rejects missing cwd', () => {
		expect(() => computeStagePlan(registry, makeTarget(), makeBindings(), {}))
			.toThrow(/cwd must be a non-empty string/)
	})

	it('exports readLoadBindings as the assembly-side reader', () => {
		expect(typeof readLoadBindings).toBe('function')
	})
})

describe('P-CT05 ②T1 — structural anchors (packer orchestrator)', () => {
	const pipelineSrc = fs.readFileSync(path.join(repoRoot, 'src/packer/orchestrator.ts'), 'utf8')
	const stageDispatcherSrc = fs.readFileSync(path.join(packerRoot, 'pipeline/stage-dispatcher.ts'), 'utf8')
	const targetSrc = fs.readFileSync(path.join(packerRoot, 'pipeline/compile-target.ts'), 'utf8')
	const registrySrc = fs.readFileSync(path.join(packerRoot, 'registry/dispatch.ts'), 'utf8')

	it('rewires _runBuild top through createCompileTarget', () => {
		expect(pipelineSrc).toContain("from './pipeline/compile-target.ts'")
		expect(pipelineSrc).toContain('createCompileTarget(runOptions)')
		expect(targetSrc).toContain('export function createCompileTarget')
	})

	it('clears C1 private calc and stages/renderer fail-fast from pipeline (E1/E2)', () => {
		expect(pipelineSrc).not.toContain('resolveCompileConfig')
		expect(pipelineSrc).not.toContain('MODE_PRESETS')
		expect(pipelineSrc).not.toContain('sourcemapStrategyFor')
		expect(pipelineSrc).not.toContain('resolveProjectRenderers')
		expect(pipelineSrc).not.toContain('assertRendererSupportsPlatform')
		expect(pipelineSrc).not.toContain('Invalid compiler stages')
		expect(pipelineSrc).not.toContain('Renderer adapter not registered')
		expect(pipelineSrc).not.toMatch(/getRenderer\(\s*renderer\s*\)/)
		expect(pipelineSrc).not.toMatch(/getRenderer\(\s*appRenderer\s*\)/)
		expect(pipelineSrc).toMatch(/getRenderer\(\s*'webview'\s*\)/)
	})

	it('passes renderer adapter object (not name string) into createStageTask', () => {
		expect(stageDispatcherSrc).toContain('rendererAdapter')
		expect(stageDispatcherSrc).not.toContain('activeRenderer.name')
		expect(targetSrc).toContain('resolveCompileConfig')
	})
})

describe('P-CT05 ②T2 — structural anchors (stage assembly via registry)', () => {
	const pipelineSrc = fs.readFileSync(path.join(repoRoot, 'src/packer/orchestrator.ts'), 'utf8')
	const stageDispatcherSrc = fs.readFileSync(path.join(packerRoot, 'pipeline/stage-dispatcher.ts'), 'utf8')
	const targetSrc = fs.readFileSync(path.join(packerRoot, 'pipeline/compile-target.ts'), 'utf8')
	const registrySrc = fs.readFileSync(path.join(packerRoot, 'registry/dispatch.ts'), 'utf8')

	it('rewires compile assembly through readLoadBindings + computeStagePlan (registry)', () => {
		expect(stageDispatcherSrc).toContain('readLoadBindings(state')
		expect(stageDispatcherSrc).toContain('computeStagePlan(')
		expect(registrySrc).toContain('export function readLoadBindings')
		expect(registrySrc).toContain('export function computeStagePlan')
		// compile-target 不再含 compile 段
		expect(targetSrc).not.toContain('export function readLoadBindings')
		expect(targetSrc).not.toContain('deriveStagePlan')
	})

	it('clears mini-game耦合 / 内联 sourcemapTargetPath / 手工三捆 from assembly', () => {
		// E3：不再 `&& !miniGame` 直耦 stage push
		expect(pipelineSrc).not.toMatch(/!miniGame/)
		// E4：sourcemapTargetPath 计算迁入 registry.computeStagePlan
		expect(pipelineSrc).not.toMatch(/sourcemapTargetPath\s*=\s*path\.resolve/)
		expect(registrySrc).toContain('sourcemapTargetPath')
		// E5：组装处不再内联拼三捆 workerOptions 字面量键
		expect(pipelineSrc).not.toMatch(/compileConfig:\s*compileConfiguration/)
		expect(pipelineSrc).not.toMatch(/pages:\s*stylePages/)
		expect(pipelineSrc).not.toMatch(/pages:\s*ctx\.allPages/)
		// BUILD_END appId 经 bindings
		expect(pipelineSrc).toContain('loadBindings')
		expect(pipelineSrc).not.toMatch(/appId:\s*getAppId\(\)/)
		// 阶段组装侧不再直接 ALS getAppId / getAppStyleScopeId（PC-B4c：state.graph.getAppId() 是 graph 方法，允许）
		expect(pipelineSrc).not.toMatch(/[^.]getAppId\(\)/)
		expect(pipelineSrc).not.toContain('getAppStyleScopeId')
	})

	it('moves filterPagesByEntries from pipeline to registry (H2 D-REG-1)', () => {
		expect(pipelineSrc).not.toContain('filterPagesByEntries')
		expect(registrySrc).toContain('filterPagesByEntries')
		expect(targetSrc).not.toContain('filterPagesByEntries')
	})

	it('materializes dispatch registry (D-REG-1: emptyRegistry → 实体)', () => {
		expect(pipelineSrc).toContain('createDispatchRegistry')
		expect(pipelineSrc).toContain('dispatchRegistry')
		expect(registrySrc).toContain('class PackerDispatchRegistry')
		expect(registrySrc).toContain('KindDispatch')
		// 三个 kind 注册
		expect(registrySrc).toContain("kind: 'view'")
		expect(registrySrc).toContain("kind: 'logic'")
		expect(registrySrc).toContain("kind: 'style'")
	})
})
