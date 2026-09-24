/**
 * 构建命令入口 — 薄适配 PackerOrchestrator（D-OR-5 / D-OR-8）。
 *
 * build() 是唯一公开编译入口；内部组 state/store/lifecycle → orchestrate。
 * 过程体与 ALS 在 orch 内；本文件不持 Listr / 写权。
 */
import { createProjectStore } from './packer/store/project-store.ts'
import { PackerSessionState } from './packer/session-state.ts'
import { createPackerOrchestrator } from './packer/orchestrator.ts'

const ORCH_OPTION_KEYS = new Set([
	'store',
	'state',
	'cache',
	'dependencyGraph',
	'lifecycle',
	'fileTypes',
	'stages',
	'affectedEntries',
	'seedPath',
	'prepareConfig',
	'prepareNpm',
	'skipMaterialize',
	'invalidatedModules',
	'incremental',
	'configChanged',
	'parallel',
	'targetPath',
	'workPath',
	'useAppIdDir',
])

export default function build(targetPath: string, workPath: string, useAppIdDir = true, options: Record<string, unknown> = {}) {
	return runBuild(targetPath, workPath, useAppIdDir, options)
}

async function runBuild(targetPath: string, workPath: string, useAppIdDir = true, options: Record<string, unknown> = {}) {
	const state = (options.state as PackerSessionState | undefined) ?? new PackerSessionState()
	const store = options.store ?? createProjectStore()
	const lifecycle = options.lifecycle as
		| { emit: (e: string, p: unknown) => Promise<void>; isolatedListenerErrors: unknown[] }
		| undefined

	const compileOptions: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(options)) {
		if (!ORCH_OPTION_KEYS.has(key)) compileOptions[key] = value
	}

	const affectedEntries = options.affectedEntries as string[] | undefined
	const incremental = options.incremental === true
		|| (Array.isArray(affectedEntries) && affectedEntries.length > 0)
	const configChanged = options.configChanged === true

	const orch = createPackerOrchestrator({
		store: store as ReturnType<typeof createProjectStore>,
		lifecycle,
	})

	return orch.orchestrate({
		targetPath,
		workPath,
		useAppIdDir,
		state,
		store,
		lifecycle,
		fileTypes: options.fileTypes,
		compileOptions,
		parallel: options.parallel !== false,
		incremental,
		configChanged,
		affectedEntries,
		stages: options.stages as string[] | undefined,
		invalidatedModules: options.invalidatedModules as string[] | undefined,
		seedPath: options.seedPath as string | undefined,
		prepareConfig: options.prepareConfig as boolean | undefined,
		prepareNpm: options.prepareNpm as boolean | undefined,
		skipMaterialize: options.skipMaterialize as boolean | undefined,
	})
}
