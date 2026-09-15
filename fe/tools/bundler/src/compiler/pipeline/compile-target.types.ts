/**
 * CompileTarget 契约类型（fe-tools-bundler-typecheck · D-TC-10 →
 * fe-tools-bundler-tsc-dist · T1a 迁 .ts）。
 * 仅 `export type` / `interface`；无运行时导出值（D-TD-16）。
 */

export interface CompileTarget {
	mode: string
	platform: string
	esTarget: unknown
	minify: unknown
	sourcemap: boolean
	sourcemapStrategy: unknown
	compileConfig: object
	renderer: { name: string, adapter: object }
	requestedStages: Set<string>
	targetPath: string
	useAppIdDir: boolean
	workPath: string
}

export interface LoadBindings {
	miniGame: boolean
	appId: string | undefined
	pages: any
	appStyleScopeId?: string | undefined
}

export interface StagePlan {
	stages: object[]
	workerOptions: object
	paths?: object
}
