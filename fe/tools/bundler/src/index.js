/**
 * 构建命令入口 — 薄委托 BuildPipeline（build-pipeline BP1）
 *
 * build() 是唯一公开编译入口；内部转调 BuildPipeline.run()。
 * ProjectStore 由 session 或调用方通过 options.store 注入（RR4/RR5）；
 * 无 store 时 runBuild 临时 create（L3）。
 */
import { createProjectStore } from './model/project-store.js'
import { createBuildPipeline } from './compiler/build-pipeline.js'

export default function build(targetPath, workPath, useAppIdDir = true, options = {}) {
	return runBuild(targetPath, workPath, useAppIdDir, options)
}

async function runBuild(targetPath, workPath, useAppIdDir = true, options = {}) {
	const store = options.store ?? createProjectStore()
	const { store: _s, ...pipelineOptions } = options
	const pipeline = createBuildPipeline({ store })
	return pipeline.run({ targetPath, workPath, useAppIdDir, ...pipelineOptions })
}
