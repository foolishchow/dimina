/**
 * CompileTarget 契约类型（fe-tools-bundler-typecheck · D-TC-10）。
 * 仅 JSDoc typedef；无运行时导出值。
 */

/**
 * @typedef {object} CompileTarget
 * @property {string} mode
 * @property {string} platform
 * @property {unknown} esTarget
 * @property {unknown} minify
 * @property {boolean} sourcemap
 * @property {unknown} sourcemapStrategy
 * @property {object} compileConfig
 * @property {{ name: string, adapter: object }} renderer
 * @property {Set<string>} requestedStages
 * @property {string} targetPath
 * @property {boolean} useAppIdDir
 * @property {string} workPath
 */

/**
 * @typedef {object} LoadBindings
 * @property {boolean} miniGame
 * @property {string|undefined} appId
 * @property {any} pages
 * @property {string|undefined} [appStyleScopeId]
 */

/**
 * @typedef {object} StagePlan
 * @property {object[]} stages
 * @property {object} workerOptions
 * @property {object} [paths]
 */

export {}
