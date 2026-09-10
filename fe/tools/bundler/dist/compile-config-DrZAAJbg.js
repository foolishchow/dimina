Object.freeze(["native", "web"]);
var InvalidPlatformError = class extends TypeError {
	/**
	* @param {unknown} platform
	* @param {string} [detail]
	*/
	constructor(platform, detail = "") {
		const message = detail ? `Invalid platform: ${JSON.stringify(platform)} (${detail})` : `Invalid platform: expected 'native' | 'web', got ${JSON.stringify(platform)}`;
		super(message);
		this.name = "InvalidPlatformError";
		this.code = "DIMINA_INVALID_PLATFORM";
		this.platform = platform;
	}
};
/**
* @param {unknown} value
* @returns {'native' | 'web'}
*/
function resolvePlatform(value) {
	if (value === void 0 || value === null) return "native";
	if (value === "native" || value === "web") return value;
	throw new InvalidPlatformError(value);
}
/**
* @param {'native' | 'web'} platform
* @returns {'quickjs-attach' | 'devtools-url'}
*/
function sourcemapStrategyFor(platform) {
	return platform === "web" ? "devtools-url" : "quickjs-attach";
}
/**
* renderer × platform 约束（预留 lynx 等声明 unsupportedPlatforms）。
* @param {{ name: string, unsupportedPlatforms?: string[] } | null | undefined} renderer
* @param {'native' | 'web'} platform
*/
function assertRendererSupportsPlatform(renderer, platform) {
	const blocked = renderer?.unsupportedPlatforms;
	if (Array.isArray(blocked) && blocked.includes(platform)) throw new InvalidPlatformError(platform, `renderer ${renderer.name} does not support platform`);
}
//#endregion
//#region src/common/compile-config.js
var DEFAULT_ES_TARGET = Object.freeze({
	logic: "es2023",
	view: "es2020"
});
var MODE_PRESETS = Object.freeze({
	build: Object.freeze({ minify: true }),
	dev: Object.freeze({ minify: false })
});
/**
* @param {unknown} value
* @param {string} label
* @returns {{ logic: string, view: string }}
*/
function normalizeEsTarget(value, label = "esTarget") {
	if (value === void 0 || value === null) return { ...DEFAULT_ES_TARGET };
	if (typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Invalid ${label}: expected { logic, view }, got ${typeof value}`);
	const unknownKeys = Object.keys(value).filter((key) => key !== "logic" && key !== "view");
	if (unknownKeys.length > 0) throw new TypeError(`Invalid ${label}: unknown key(s) ${unknownKeys.join(", ")}`);
	const logic = value.logic === void 0 ? DEFAULT_ES_TARGET.logic : value.logic;
	const view = value.view === void 0 ? DEFAULT_ES_TARGET.view : value.view;
	if (typeof logic !== "string" || !logic) throw new TypeError(`Invalid ${label}.logic: expected non-empty string`);
	if (typeof view !== "string" || !view) throw new TypeError(`Invalid ${label}.view: expected non-empty string`);
	return {
		logic,
		view
	};
}
/**
* 合并 compile configuration（CF-1 + CF-2）。
*
* 优先级：cli > apiOptions > mode preset > platform defaults（仅派生 sourcemapStrategy）> 内部缺省
*
* @param {object} [input]
* @param {'build'|'dev'} [input.mode]
* @param {object} [input.cli]
* @param {object} [input.apiOptions]
*/
function resolveCompileConfig(input = {}) {
	const { cli = {}, apiOptions = {} } = input;
	const mode = cli.mode ?? apiOptions.mode ?? input.mode ?? "build";
	if (mode !== "build" && mode !== "dev") throw new TypeError(`Invalid mode: expected 'build' | 'dev', got ${JSON.stringify(mode)}`);
	const platform = resolvePlatform(cli.platform ?? apiOptions.platform ?? input.platform);
	if (Object.hasOwn(apiOptions, "esTarget")) normalizeEsTarget(apiOptions.esTarget, "options.esTarget");
	if (Object.hasOwn(cli, "esTarget")) normalizeEsTarget(cli.esTarget, "cli.esTarget");
	const modePreset = MODE_PRESETS[mode];
	const esTarget = normalizeEsTarget(cli.esTarget ?? apiOptions.esTarget, cli.esTarget !== void 0 ? "cli.esTarget" : "options.esTarget");
	const sourcemap = cli.sourcemap ?? apiOptions.sourcemap ?? false;
	const minify = cli.minify ?? apiOptions.minify ?? modePreset.minify;
	return {
		mode,
		platform,
		sourcemapStrategy: sourcemapStrategyFor(platform),
		minify: !!minify,
		sourcemap: !!sourcemap,
		esTarget
	};
}
/**
* sourcemap 模式下跳过最终 JS bundle minify（缺 remapping 串联）。
* @param {{ minify: boolean, sourcemap: boolean }} config
*/
function effectiveJsMinify(config) {
	return !!config.minify && !config.sourcemap;
}
//#endregion
export { resolveCompileConfig as n, assertRendererSupportsPlatform as r, effectiveJsMinify as t };
