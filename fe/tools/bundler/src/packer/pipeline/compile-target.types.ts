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
	pages: PagesInfo
	appStyleScopeId?: string | undefined
}

export interface PageModule {
	id?: string
	path: string
	appStyleScopeId?: string
	sharedStyleScopeIds?: string[]
	usingComponents?: Record<string, string>
	componentPlaceholder?: Record<string, unknown>
	customTabBar?: unknown
	[key: string]: unknown
}
export interface SubPackage {
	independent: boolean
	info: PageModule[]
}
export interface PagesInfo {
	mainPages: PageModule[]
	subPackages?: Array<{ root: string; pages: string[]; independent?: boolean }>
	subPages: Record<string, SubPackage>
	[key: string]: unknown
}
export interface StageSpec {
	workerOptions: Record<string, unknown>
	renderer: object | null
}
export interface StagePlan {
	stages: string[]
	stageSpecs: Record<string, StageSpec>
	sourcemapTargetPath: string
	stylePages: PagesInfo
	filteredPages: PagesInfo
}
