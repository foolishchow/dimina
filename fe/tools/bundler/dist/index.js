import { n as resolveCompileConfig, r as assertRendererSupportsPlatform } from "./compile-config-DrZAAJbg.js";
import { C as storeInfo, P as DependencyGraph, S as runWithCompilerContext, _ as getWorkPath, d as getStyleExts, f as getTargetPath, h as getViewScriptExts, i as getAppStyleScopeId, k as resetAssetCache, l as getPageConfigInfo, m as getTemplateExts, n as getAppId, r as getAppName, t as getAppConfigInfo, u as getPages, v as isMiniGame, w as collectAssets, y as isTemporaryTargetPath } from "./env-CPAAD5ub.js";
import path from "node:path";
import process$1 from "node:process";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { Listr, PRESET_TIMER, isUnicodeSupported } from "listr2";
import fs from "node:fs";
import os from "node:os";
//#region src/common/compile-progress.js
var DEFAULT_TERMINAL_COLUMNS = 80;
var MIN_PROGRESS_WIDTH = 8;
var MAX_PROGRESS_WIDTH = 28;
var RENDERER_CHROME_WIDTH = 14;
var PROGRESS_BRACKETS_WIDTH = 2;
var RESET_FOREGROUND = "\x1B[39m";
var PROGRESS_BODY_COLOR = "\x1B[38;2;101;116;217m";
var PROGRESS_HIGHLIGHT_COLOR = "\x1B[38;2;168;178;245m";
var PROGRESS_HIGHLIGHT_WIDTH = 2;
/**
* Format worker progress without assuming a fixed terminal width.
* The completed count remains the source of truth. Whole cells avoid the
* visible gap that partial block glyphs leave before the unfilled section.
*/
function formatCompileProgress(completed, total, options = {}) {
	const unicode = options.unicode ?? isUnicodeSupported();
	const color = options.color ?? shouldUseColor();
	const columns = normalizePositiveInteger(options.columns) || process$1.stdout.columns || DEFAULT_TERMINAL_COLUMNS;
	const safeTotal = normalizePositiveInteger(total);
	const safeCompleted = Math.min(normalizePositiveInteger(completed), safeTotal);
	const ratio = safeTotal === 0 ? 0 : safeCompleted / safeTotal;
	const percentage = Math.round(ratio * 100);
	const separator = unicode ? "·" : "|";
	const metadata = `${String(safeCompleted).padStart(String(safeTotal).length)}/${safeTotal} ${separator} ${String(percentage).padStart(3)}%`;
	const availableWidth = columns - metadata.length - RENDERER_CHROME_WIDTH - PROGRESS_BRACKETS_WIDTH;
	if (availableWidth < MIN_PROGRESS_WIDTH) return metadata;
	const width = Math.min(availableWidth, MAX_PROGRESS_WIDTH);
	return `[${unicode ? createUnicodeBar(ratio, width, color) : createAsciiBar(ratio, width, color)}]  ${metadata}`;
}
function createUnicodeBar(ratio, width, color) {
	const completeWidth = Math.round(ratio * width);
	const emptyWidth = width - completeWidth;
	return `${colorizeCompleteSegment("█".repeat(completeWidth), color)}${"░".repeat(emptyWidth)}`;
}
function createAsciiBar(ratio, width, color) {
	const completeWidth = Math.floor(ratio * width);
	const showHead = ratio > 0 && ratio < 1;
	const bodyWidth = Math.max(0, completeWidth - (showHead ? 1 : 0));
	const emptyWidth = width - bodyWidth - (showHead ? 1 : 0);
	return `${colorizeCompleteSegment(`${"=".repeat(bodyWidth)}${showHead ? ">" : ""}`, color)}${"-".repeat(emptyWidth)}`;
}
function colorizeCompleteSegment(segment, color) {
	if (!color || segment.length === 0) return segment;
	const highlightWidth = Math.min(PROGRESS_HIGHLIGHT_WIDTH, segment.length);
	const bodyWidth = segment.length - highlightWidth;
	return `${bodyWidth > 0 ? `${PROGRESS_BODY_COLOR}${segment.slice(0, bodyWidth)}` : ""}${`${PROGRESS_HIGHLIGHT_COLOR}${segment.slice(bodyWidth)}`}${RESET_FOREGROUND}`;
}
function shouldUseColor() {
	if (process$1.env.FORCE_COLOR === "0" || "NO_COLOR" in process$1.env) return false;
	if (process$1.env.FORCE_COLOR !== void 0) return true;
	return Boolean(process$1.stdout.isTTY && process$1.env.TERM !== "dumb");
}
function normalizePositiveInteger(value) {
	return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
//#endregion
//#region src/common/lifecycle.js
/**
* 构建生命周期事件与注册表（compiler-hook-layer 契约 v1）。
*
* 契约要点（docs/actions/compiler-hook-layer/technical-design.md）：
* - 每次 build() 创建独立实例，与 AsyncLocalStorage 并发构建上下文隔离；
* - 监听器按注册顺序依次 await，阶段边界触发，不影响阶段并发；
* - 监听器错误隔离：捕获后记入 isolatedListenerErrors 并打印统一前缀日志，
*   不中断事件流与构建；
* - 载荷在触发前浅冻结（Object.freeze），深层数据按约定只读；
*   监听器改动载荷不产生构建影响；
* - emit 永不 reject。
*/
var LIFECYCLE_EVENTS = Object.freeze({
	BUILD_START: "build:start",
	CONFIG_COLLECTED: "config:collected",
	DIST_PREPARED: "dist:prepared",
	CONFIG_COMPILED: "config:compiled",
	NPM_BUILT: "npm:built",
	STAGE_BEFORE: "stage:before",
	STAGE_AFTER: "stage:after",
	STAGE_ERROR: "stage:error",
	BUNDLE_PUBLISHED: "bundle:published",
	BUILD_WARNING: "build:warning",
	BUILD_END: "build:end",
	BUILD_ERROR: "build:error"
});
function logIsolatedListenerError(event, error) {
	console.error(`[lifecycle] listener error on ${event}: ${error?.stack || error?.message || error}`);
}
function createLifecycle() {
	const listeners = /* @__PURE__ */ new Map();
	const isolatedListenerErrors = [];
	const on = (event, listener) => {
		if (typeof event !== "string" || event.length === 0) throw new TypeError("lifecycle event name must be a non-empty string");
		if (typeof listener !== "function") throw new TypeError("lifecycle listener must be a function");
		const bucket = listeners.get(event) || [];
		bucket.push(listener);
		listeners.set(event, bucket);
	};
	const emit = async (event, payload) => {
		const bucket = listeners.get(event);
		if (!bucket || bucket.length === 0) return;
		const frozenPayload = payload !== null && typeof payload === "object" ? Object.freeze(payload) : payload;
		for (const listener of bucket) try {
			await listener(frozenPayload);
		} catch (error) {
			isolatedListenerErrors.push({
				event,
				error
			});
			logIsolatedListenerError(event, error);
		}
	};
	return {
		on,
		emit,
		/**
		* 被隔离的监听器错误（只读约定：消费方不得修改）。
		* build:end 载荷的 isolatedListenerErrors 计数由此派生。
		*/
		isolatedListenerErrors
	};
}
//#endregion
//#region src/common/renderers.js
/**
* renderer 抽象（A4 P-001 修订，方案 A：对齐微信 renderer 配置模型）。
*
* A4 只做抽象边界，不暴露 renderer 选择能力：
* - 识别 `app.json.renderer`（全局）与各页面 `page.json.renderer`（页面级字段）；
* - 缺省均为 webview；
* - 当前仅支持 webview；未知 renderer（如微信 skyline、未来 lynx）在构建前
*   以结构化 InvalidRendererError 失败，不静默当作 webview；
* - 不提供 CLI/API renderer 覆盖（本门无第二个 renderer，无切换需求）；
* - 页面级混合 renderer 编译留待未来（届时需运行时/容器按页识别与 A2/A3 扩展）。
*/
var DEFAULT_RENDERER = "webview";
var SUPPORTED_RENDERERS = Object.freeze([DEFAULT_RENDERER]);
var RENDERER_FIELD = "renderer";
var APP_CONFIG_FILE = "app.json";
/** renderer 注册表：adapter 由宿主（index.js）注入，避免本模块反向依赖编译编排。 */
var rendererRegistry = /* @__PURE__ */ new Map();
function registerRenderer(renderer) {
	if (!renderer || typeof renderer.name !== "string" || !renderer.name) throw new TypeError("registerRenderer: renderer must have a non-empty name");
	rendererRegistry.set(renderer.name, renderer);
}
function getRenderer(name) {
	return rendererRegistry.get(name) ?? null;
}
var InvalidRendererError = class extends TypeError {
	constructor(renderer, context = "") {
		const scope = context ? ` in ${context}` : "";
		super(`Unsupported renderer: ${String(renderer)} (expected: ${SUPPORTED_RENDERERS.join(", ")})${scope}`);
		this.name = "InvalidRendererError";
		this.code = "DIMINA_INVALID_RENDERER";
		this.renderer = renderer;
		this.context = context;
	}
};
function readJsonFile(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}
function extractRenderer(config) {
	return typeof config?.[RENDERER_FIELD] === "string" ? config[RENDERER_FIELD] : void 0;
}
/** 轻量读取全局 renderer（app.json.renderer）；缺省/缺失/解析失败 → undefined。 */
function readAppRenderer(workPath) {
	return extractRenderer(readJsonFile(path.join(workPath, APP_CONFIG_FILE)));
}
/**
* 轻量读取各页面 renderer（page.json.renderer）。页面路径取自 app.json 的
* pages 与 subPackages（root/path），与 env 解析规则一致；缺失页面文件 → undefined。
* @returns {Map<string, string|undefined>} pagePath -> renderer|undefined
*/
function readPageRenderers(workPath) {
	const pageRenderers = /* @__PURE__ */ new Map();
	const appConfig = readJsonFile(path.join(workPath, APP_CONFIG_FILE));
	if (!appConfig) return pageRenderers;
	const pagePaths = Array.isArray(appConfig.pages) ? [...appConfig.pages] : [];
	for (const subPackage of appConfig.subPackages || []) {
		if (!Array.isArray(subPackage.pages)) continue;
		for (const page of subPackage.pages) pagePaths.push(`${subPackage.root}/${page}`);
	}
	for (const pagePath of pagePaths) {
		const pageConfig = readJsonFile(path.join(workPath, `${pagePath}.json`));
		pageRenderers.set(pagePath, extractRenderer(pageConfig));
	}
	return pageRenderers;
}
function resolveRenderer(renderer, context = "") {
	const resolved = renderer === void 0 ? DEFAULT_RENDERER : renderer;
	if (!SUPPORTED_RENDERERS.includes(resolved)) throw new InvalidRendererError(resolved, context);
	return resolved;
}
/**
* 解析并校验项目 renderer 声明（app + page）。
* A4 v1 仅 webview：任何非 webview 声明（含未来 renderer）都在构建前失败。
* @returns {{ appRenderer: string, pageRenderers: Map<string, string> }} 解析结果；
*   任一未知 renderer 声明时抛 InvalidRendererError（携带声明上下文）。
*/
function resolveProjectRenderers(workPath) {
	const appRenderer = resolveRenderer(readAppRenderer(workPath), "app.json");
	const pageRenderers = /* @__PURE__ */ new Map();
	for (const [pagePath, declared] of readPageRenderers(workPath)) pageRenderers.set(pagePath, resolveRenderer(declared, `${pagePath}.json`));
	return {
		appRenderer,
		pageRenderers
	};
}
//#endregion
//#region src/common/art.js
var artCode = `
██████╗ ██╗███╗   ███╗██╗███╗   ██╗ █████╗
██╔══██╗██║████╗ ████║██║████╗  ██║██╔══██╗
██║  ██║██║██╔████╔██║██║██╔██╗ ██║███████║
██║  ██║██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║
██████╔╝██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║
╚═════╝ ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
`;
function art_default() {
	console.log(artCode);
}
//#endregion
//#region src/common/publish.js
function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) copyDir(srcPath, destPath);
		else fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE);
	}
}
function createDist(seedPath) {
	const distPath = getTargetPath();
	if (fs.existsSync(distPath)) fs.rmSync(distPath, {
		recursive: true,
		force: true
	});
	fs.mkdirSync(distPath, { recursive: true });
	if (seedPath && fs.existsSync(seedPath)) copyDir(seedPath, distPath);
}
/**
* 发布到指定目录
* @param {string} dist 目标路径
* @param {boolean} useAppIdDir 是否在路径中包含appId
*/
function publishToDist(dist, useAppIdDir = true) {
	const distPath = getTargetPath();
	const appId = getAppId();
	const absolutePath = useAppIdDir ? `${path.resolve(process$1.cwd(), dist)}${path.sep}${appId}` : `${path.resolve(process$1.cwd(), dist)}`;
	if (path.resolve(distPath) === path.resolve(absolutePath)) return;
	if (fs.existsSync(absolutePath)) fs.rmSync(absolutePath, {
		recursive: true,
		force: true
	});
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	if (isTemporaryTargetPath()) try {
		fs.renameSync(distPath, absolutePath);
		return;
	} catch (error) {
		if (error.code !== "EXDEV") throw error;
		fs.mkdirSync(absolutePath, { recursive: true });
		copyDir(distPath, absolutePath);
		fs.rmSync(distPath, {
			recursive: true,
			force: true
		});
		return;
	}
	fs.mkdirSync(absolutePath, { recursive: true });
	copyDir(distPath, absolutePath);
}
//#endregion
//#region src/common/worker-pool.js
function getCGroupCPUCount() {
	try {
		const unifiedPath = "/sys/fs/cgroup/cpu.max";
		if (fs.existsSync(unifiedPath)) {
			const [quota, period] = fs.readFileSync(unifiedPath, "utf8").trim().split(/\s+/);
			if (quota !== "max") return Math.max(1, Math.floor(Number(quota) / Number(period)));
		}
		const quotaPath = "/sys/fs/cgroup/cpu/cpu.cfs_quota_us";
		const periodPath = "/sys/fs/cgroup/cpu/cpu.cfs_period_us";
		if (fs.existsSync(quotaPath) && fs.existsSync(periodPath)) {
			const quota = Number.parseInt(fs.readFileSync(quotaPath, "utf8"));
			const period = Number.parseInt(fs.readFileSync(periodPath, "utf8"));
			if (quota > 0) return Math.max(1, Math.floor(quota / period));
		}
	} catch (e) {
		console.warn("Failed to read CPU limits from cgroup:", e.message);
	}
	return typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
}
function getCGroupMemoryLimit() {
	try {
		const unifiedPath = "/sys/fs/cgroup/memory.max";
		if (fs.existsSync(unifiedPath)) {
			const rawLimit = fs.readFileSync(unifiedPath, "utf8").trim();
			if (rawLimit !== "max") {
				const memoryLimit = Number.parseInt(rawLimit);
				if (Number.isFinite(memoryLimit) && memoryLimit > 0) return memoryLimit;
			}
		}
		const memLimitPath = "/sys/fs/cgroup/memory/memory.limit_in_bytes";
		if (fs.existsSync(memLimitPath)) {
			const memLimit = Number.parseInt(fs.readFileSync(memLimitPath, "utf8"));
			if (memLimit < Number.Infinity && memLimit > 0) return memLimit;
		}
	} catch (e) {
		console.warn("Failed to read memory limits from cgroup:", e.message);
	}
	return os.totalmem();
}
function readPositiveInteger(name) {
	const value = Number.parseInt(process.env[name], 10);
	return Number.isInteger(value) && value > 0 ? value : null;
}
var MAX_WORKERS = readPositiveInteger("DIMINA_COMPILER_MAX_WORKERS") ?? Math.max(1, Math.min(2, Math.floor(getCGroupCPUCount() / 4)));
var WorkerPool = class {
	constructor(maxWorkers = MAX_WORKERS) {
		this.maxWorkers = maxWorkers;
		this.activeWorkers = 0;
		this.queue = [];
		this.memoryLimit = Math.floor(getCGroupMemoryLimit() * .6 / maxWorkers);
	}
	async runWorker(workerCreator) {
		if (this.activeWorkers >= this.maxWorkers) await new Promise((resolve) => this.queue.push(resolve));
		this.activeWorkers++;
		try {
			return await workerCreator();
		} finally {
			this.activeWorkers--;
			if (this.queue.length > 0) this.queue.shift()();
		}
	}
	getWorkerOptions() {
		const memoryMb = readPositiveInteger("DIMINA_COMPILER_WORKER_MEMORY_MB") ?? Math.min(2048, Math.floor(this.memoryLimit / 1048576));
		return { resourceLimits: {
			maxOldGenerationSizeMb: Math.max(256, memoryMb),
			maxYoungGenerationSizeMb: Math.max(64, Math.floor(memoryMb / 4)),
			codeRangeSizeMb: 64
		} };
	}
};
var workerPool = new WorkerPool();
//#endregion
//#region src/common/npm-builder.js
/**
* npm 构建工具
* 用于处理小程序 npm 包的构建和管理
*/
var NpmBuilder = class {
	constructor(workPath, targetPath, dependencyGraph = null) {
		this.workPath = workPath;
		this.targetPath = targetPath;
		this.dependencyGraph = dependencyGraph;
		this.builtPackages = /* @__PURE__ */ new Set();
		this.packageDependencies = /* @__PURE__ */ new Map();
		this.miniprogramExts = /* @__PURE__ */ new Set([
			".js",
			".json",
			".ts",
			...getTemplateExts(),
			...getStyleExts(),
			...getViewScriptExts()
		]);
	}
	/**
	* 构建 npm 包
	* 扫描 miniprogram_npm 目录并构建相关包
	*/
	async buildNpmPackages() {
		const miniprogramNpmPaths = this.findMiniprogramNpmDirs();
		for (const npmPath of miniprogramNpmPaths) await this.buildNpmDir(npmPath);
	}
	/**
	* 查找所有 miniprogram_npm 目录
	* @returns {string[]} miniprogram_npm 目录路径数组
	*/
	findMiniprogramNpmDirs() {
		const npmDirs = [];
		const scanDir = (dir, relativePath = "") => {
			if (!fs.existsSync(dir)) return;
			const items = fs.readdirSync(dir, { withFileTypes: true });
			for (const item of items) if (item.isDirectory()) {
				const itemPath = path.join(dir, item.name);
				const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
				if (item.name === "miniprogram_npm") npmDirs.push(itemRelativePath);
				else scanDir(itemPath, itemRelativePath);
			}
		};
		scanDir(this.workPath);
		return npmDirs;
	}
	/**
	* 构建指定的 miniprogram_npm 目录
	* @param {string} npmDirPath miniprogram_npm 目录路径
	*/
	async buildNpmDir(npmDirPath) {
		const fullNpmPath = path.join(this.workPath, npmDirPath);
		if (!fs.existsSync(fullNpmPath)) return;
		const packages = fs.readdirSync(fullNpmPath, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name);
		for (const packageName of packages) await this.buildPackage(packageName, npmDirPath);
	}
	/**
	* 构建单个 npm 包
	* @param {string} packageName 包名
	* @param {string} npmDirPath miniprogram_npm 目录路径
	*/
	async buildPackage(packageName, npmDirPath) {
		const packageKey = `${npmDirPath}/${packageName}`;
		if (this.builtPackages.has(packageKey)) return;
		const packagePath = path.join(this.workPath, npmDirPath, packageName);
		const targetPackagePath = path.join(this.targetPath, npmDirPath, packageName);
		if (!fs.existsSync(path.dirname(targetPackagePath))) fs.mkdirSync(path.dirname(targetPackagePath), { recursive: true });
		await this.copyPackageFiles(packagePath, targetPackagePath);
		await this.processDependencies(packageName, packagePath, npmDirPath);
		this.builtPackages.add(packageKey);
	}
	/**
	* 复制包文件
	* @param {string} sourcePath 源路径
	* @param {string} targetPath 目标路径
	*/
	async copyPackageFiles(sourcePath, targetPath) {
		if (!fs.existsSync(sourcePath)) return;
		if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
		const items = fs.readdirSync(sourcePath, { withFileTypes: true });
		for (const item of items) {
			const sourceItemPath = path.join(sourcePath, item.name);
			const targetItemPath = path.join(targetPath, item.name);
			if (item.isDirectory()) await this.copyPackageFiles(sourceItemPath, targetItemPath);
			else if (this.isMiniprogramFile(item.name)) {
				this.dependencyGraph?.addFile("app", sourceItemPath, "config");
				fs.copyFileSync(sourceItemPath, targetItemPath);
			}
		}
	}
	/**
	* 检查是否为小程序相关文件
	* @param {string} filename 文件名
	* @returns {boolean} 是否为小程序文件
	*/
	isMiniprogramFile(filename) {
		const ext = path.extname(filename).toLowerCase();
		return this.miniprogramExts.has(ext) || filename === "package.json" || filename === "README.md" || filename.startsWith(".");
	}
	/**
	* 处理包依赖
	* @param {string} packageName 包名
	* @param {string} packagePath 包路径
	* @param {string} npmDirPath npm 目录路径
	*/
	async processDependencies(packageName, packagePath, npmDirPath) {
		const packageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) return;
		try {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
			const dependencies = {
				...packageJson.dependencies,
				...packageJson.peerDependencies
			};
			if (dependencies && Object.keys(dependencies).length > 0) {
				this.packageDependencies.set(packageName, dependencies);
				for (const depName of Object.keys(dependencies)) await this.buildPackage(depName, npmDirPath);
			}
		} catch (e) {
			console.warn(`[npm-builder] 解析 package.json 失败: ${packageJsonPath}`, e.message);
		}
	}
	/**
	* 验证 npm 包的完整性
	* @param {string} packageName 包名
	* @param {string} packagePath 包路径
	* @returns {boolean} 是否有效
	*/
	validatePackage(packageName, packagePath) {
		for (const file of ["package.json"]) if (!fs.existsSync(path.join(packagePath, file))) {
			console.warn(`[npm-builder] 包 ${packageName} 缺少必要文件: ${file}`);
			return false;
		}
		try {
			const packageJsonPath = path.join(packagePath, "package.json");
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
			if (!packageJson.name || !packageJson.version) {
				console.warn(`[npm-builder] 包 ${packageName} 的 package.json 格式不正确`);
				return false;
			}
		} catch (e) {
			console.warn(`[npm-builder] 包 ${packageName} 的 package.json 解析失败:`, e.message);
			return false;
		}
		return true;
	}
	/**
	* 获取已构建的包列表
	* @returns {string[]} 已构建的包列表
	*/
	getBuiltPackages() {
		return Array.from(this.builtPackages);
	}
	/**
	* 获取包依赖关系
	* @returns {Map} 包依赖关系映射
	*/
	getPackageDependencies() {
		return this.packageDependencies;
	}
	/**
	* 清理构建缓存
	*/
	clearCache() {
		this.builtPackages.clear();
		this.packageDependencies.clear();
	}
};
//#endregion
//#region src/core/config-compiler.js
/**
* 处理 tabBar.list 中的 iconPath / selectedIconPath。
* 视为相对小程序根目录的资源，复用 collectAssets 拷贝到 main/static/，
* 并把 list 中的路径改写成产物 URL，避免容器侧再做特殊解析。
*
* 注意：会在原 app 配置上原地修改，不影响后续输出（compileConfig 是
* 整个流水线最后才走到的环节，不会被再次读取）。
*/
function processTabBarIcons(app) {
	const list = app?.tabBar?.list;
	if (!Array.isArray(list) || list.length === 0) return;
	const workPath = getWorkPath();
	const targetPath = getTargetPath();
	const appId = getAppId();
	for (const item of list) {
		if (item.iconPath) item.iconPath = collectAssets(workPath, "", item.iconPath, targetPath, appId);
		if (item.selectedIconPath) item.selectedIconPath = collectAssets(workPath, "", item.selectedIconPath, targetPath, appId);
	}
}
/**
*
* 编译项目配置文件 app-config.json
*/
function compileConfig() {
	const app = getAppConfigInfo();
	processTabBarIcons(app);
	if (!app.entryPagePath && Array.isArray(app.pages) && app.pages.length > 0) app.entryPagePath = app.pages[0];
	const compileResInfo = {
		app,
		modules: getPageConfigInfo(),
		projectName: getAppName()
	};
	const json = JSON.stringify(compileResInfo, null, 4);
	const mainDir = `${getTargetPath()}/main`;
	if (!fs.existsSync(mainDir)) fs.mkdirSync(mainDir, { recursive: true });
	fs.writeFileSync(`${mainDir}/app-config.json`, json);
}
//#endregion
//#region src/index.js
var isPrinted = false;
var previousCompatibilityWarnings = /* @__PURE__ */ new Map();
var COMPILE_STAGE_ORDER = [
	"view",
	"logic",
	"style"
];
var MAX_WARNING_PROJECTS = 32;
registerRenderer({
	name: "webview",
	runViewStage: (ctx, task, workerOptions, lifecycle) => runCompileInWorker("view", ctx, task, workerOptions, lifecycle),
	runStyleStage: (ctx, task, workerOptions, lifecycle) => runCompileInWorker("style", ctx, task, workerOptions, lifecycle)
});
/**
* 构建命令入口
* @param {string} targetPath 编译产物目标路径
* @param {string} workPath 编译工作目录
* @param {boolean} useAppIdDir 产物根目录是否包含 appId
* @param {object} [options] 构建选项
* @param {'build'|'dev'} [options.mode] 编译 mode preset（CF-1；缺省 build）
* @param {boolean} [options.minify] 是否压缩（覆盖 mode 缺省）
* @param {boolean} [options.sourcemap] 是否生成 sourcemap
* @param {{ logic?: string, view?: string }} [options.esTarget] 双线程 ES target（CF-1）
* @param {'native'|'web'} [options.platform] 运行时宿主（CF-2；缺省 native）
* @param {{ template?: string[], style?: string[], viewScript?: string[] }} [options.fileTypes]
*   自定义文件类型，在内置 wx/dd 类型基础上追加；template 为模板扩展名，style 为样式扩展名，
*   viewScript 为视图脚本扩展名和内联标签名
* @param {string[]} [options.affectedEntries] 仅重编这些页面的视图和样式；逻辑仍按包重建
* @param {string} [options.seedPath] 增量构建前用于保留未受影响产物的已发布目录
* @param {object} [options.dependencyGraph] 上一次构建的依赖图快照
* @param {Array<'view'|'logic'|'style'>} [options.stages] 仅运行指定编译阶段
* @param {boolean} [options.prepareConfig] 是否重新生成配置产物
* @param {boolean} [options.prepareNpm] 是否重新复制 miniprogram_npm 产物
* @param {object} [options.lifecycle] 内部选项：外部传入的生命周期实例
*   （createLifecycle() 创建，供测试与后续 dev server 挂监听）；不属于公开稳定契约
*/
function build(targetPath, workPath, useAppIdDir = true, options = {}) {
	return runWithCompilerContext(() => runBuild(targetPath, workPath, useAppIdDir, options));
}
async function runBuild(targetPath, workPath, useAppIdDir = true, options = {}) {
	const { fileTypes, affectedEntries, seedPath, dependencyGraph, stages, prepareConfig = true, prepareNpm = true } = options;
	if (stages !== void 0 && (!Array.isArray(stages) || stages.some((stage) => !COMPILE_STAGE_ORDER.includes(stage)))) throw new TypeError(`Invalid compiler stages: ${JSON.stringify(stages)}`);
	const compileConfiguration = resolveCompileConfig({ apiOptions: options });
	const { sourcemap } = compileConfiguration;
	const lifecycle = options.lifecycle || createLifecycle();
	const { appRenderer } = resolveProjectRenderers(workPath);
	const activeRenderer = getRenderer(appRenderer);
	if (!activeRenderer) throw new Error(`Renderer adapter not registered: ${appRenderer}`);
	assertRendererSupportsPlatform(activeRenderer, compileConfiguration.platform);
	const { dependencyGraph: _graphPayload, lifecycle: _lifecyclePayload, ...serializableOptions } = options;
	try {
		await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_START, {
			workPath,
			targetPath,
			useAppIdDir,
			options: serializableOptions
		});
		const enabledStages = new Set(stages === void 0 ? COMPILE_STAGE_ORDER : COMPILE_STAGE_ORDER.filter((stage) => stages.includes(stage)));
		const shouldPrepareConfig = !seedPath || prepareConfig;
		const shouldPrepareNpm = !seedPath || prepareNpm;
		resetAssetCache();
		if (!isPrinted) {
			art_default();
			isPrinted = true;
		}
		const initPhases = [
			{
				title: "收集配置信息",
				task: async (ctx) => {
					ctx.storeInfo = storeInfo(workPath, {
						fileTypes,
						dependencyGraph
					});
					ctx.dependencyGraph = new DependencyGraph(ctx.storeInfo.dependencyGraph);
					const allPages = getPages();
					await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COLLECTED, {
						fileTypes: ctx.storeInfo.compilerOptions,
						pagesCount: allPages.mainPages.length + Object.values(allPages.subPages).reduce((sum, item) => sum + item.info.length, 0),
						miniGame: isMiniGame()
					});
				}
			},
			{
				title: "准备产物目录",
				task: async () => {
					createDist(seedPath);
					await lifecycle.emit(LIFECYCLE_EVENTS.DIST_PREPARED, { seedPath });
				}
			},
			...shouldPrepareConfig ? [{
				title: "编译配置信息",
				task: async () => {
					compileConfig();
					await lifecycle.emit(LIFECYCLE_EVENTS.CONFIG_COMPILED, {});
				}
			}] : [],
			...shouldPrepareNpm ? [{
				title: "构建 npm 包",
				task: async (ctx) => {
					await new NpmBuilder(getWorkPath(), getTargetPath(), ctx.dependencyGraph).buildNpmPackages();
					await lifecycle.emit(LIFECYCLE_EVENTS.NPM_BUILT, {});
				}
			}] : []
		];
		const context = await new Listr([
			{
				title: "初始化项目",
				task: (_, task) => task.newListr(initPhases, { concurrent: false })
			},
			{
				title: `编译项目 · ${path.basename(path.resolve(workPath))}`,
				task: (ctx, task) => {
					const allPages = getPages();
					const miniGame = isMiniGame();
					ctx.allPages = allPages;
					ctx.pages = filterPagesByEntries(allPages, affectedEntries);
					ctx.compatibilityWarnings = /* @__PURE__ */ new Set();
					const compileTasks = [];
					if (enabledStages.has("view") && !miniGame) compileTasks.push(createStageTask("view", "编译视图", lifecycle, {
						sourcemap,
						compileConfig: compileConfiguration
					}, activeRenderer.name));
					if (enabledStages.has("logic")) {
						const sourcemapTargetPath = path.resolve(process$1.cwd(), targetPath, useAppIdDir ? getAppId() : "");
						compileTasks.push(createStageTask("logic", "编译逻辑", lifecycle, {
							sourcemap,
							pages: ctx.allPages,
							sourcemapTargetPath,
							compileConfig: compileConfiguration
						}));
					}
					if (enabledStages.has("style") && !miniGame) {
						const stylePages = {
							...ctx.pages,
							mainPages: [{
								path: "app",
								id: getAppStyleScopeId()
							}, ...ctx.pages.mainPages]
						};
						compileTasks.push(createStageTask("style", "编译样式", lifecycle, {
							sourcemap,
							pages: stylePages,
							compileConfig: compileConfiguration
						}, activeRenderer.name));
					}
					if (compileTasks.length > 0) return task.newListr(compileTasks, { concurrent: true });
				}
			},
			{
				title: "写入编译产物",
				task: async () => {
					publishToDist(targetPath, useAppIdDir);
					await lifecycle.emit(LIFECYCLE_EVENTS.BUNDLE_PUBLISHED, {
						targetPath,
						useAppIdDir
					});
				}
			}
		], {
			concurrent: false,
			rendererOptions: {
				collapseSubtasks: true,
				formatOutput: "truncate",
				timer: PRESET_TIMER
			},
			fallbackRendererOptions: { timer: PRESET_TIMER }
		}).run();
		printCompatibilityWarnings(workPath, context.compatibilityWarnings);
		const result = {
			appId: getAppId(),
			name: getAppName(),
			path: getAppConfigInfo().entryPagePath || context.allPages.mainPages[0].path,
			dependencyGraph: context.dependencyGraph.toJSON()
		};
		await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_END, {
			result,
			isolatedListenerErrors: lifecycle.isolatedListenerErrors.length
		});
		return result;
	} catch (error) {
		await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_ERROR, {
			error,
			stage: error?.stage ?? null
		});
		throw error;
	}
}
/**
* 包装单个编译阶段：触发 stage:before / stage:after / stage:error 事件。
* 并发语义与进度 UI 与原实现一致（rendererOptions、worker 池均不变）。
*/
function createStageTask(stage, title, lifecycle, workerOptions = {}, renderer = "webview") {
	return {
		title,
		rendererOptions: {
			outputBar: true,
			persistentOutput: false
		},
		task: async (ctx, task) => {
			const pages = workerOptions.pages || ctx.pages;
			await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_BEFORE, {
				stage,
				pages,
				sourcemap: !!workerOptions.sourcemap
			});
			const warningsBefore = new Set(ctx.compatibilityWarnings);
			const startedAt = Date.now();
			const runStage = stage === "view" || stage === "style" ? getRenderer(renderer)?.[stage === "view" ? "runViewStage" : "runStyleStage"] : null;
			try {
				if (runStage) await runStage(ctx, task, workerOptions, lifecycle);
				else await runCompileInWorker(stage, ctx, task, workerOptions, lifecycle);
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_AFTER, {
					stage,
					compatibilityWarnings: [...ctx.compatibilityWarnings].filter((warning) => !warningsBefore.has(warning)),
					durationMs: Date.now() - startedAt
				});
			} catch (error) {
				await lifecycle.emit(LIFECYCLE_EVENTS.STAGE_ERROR, {
					stage,
					error
				});
				throw error;
			}
		}
	};
}
function filterPagesByEntries(pages, affectedEntries) {
	if (!Array.isArray(affectedEntries)) return pages;
	const selected = new Set(affectedEntries);
	return {
		mainPages: pages.mainPages.filter((page) => selected.has(page.path)),
		subPages: Object.fromEntries(Object.entries(pages.subPages).map(([root, subPackage]) => [root, {
			...subPackage,
			info: subPackage.info.filter((page) => selected.has(page.path))
		}]).filter(([, subPackage]) => subPackage.info.length > 0))
	};
}
function runCompileInWorker(script, ctx, task, options = {}, lifecycle = null) {
	return workerPool.runWorker(() => new Promise((resolve, reject) => {
		const worker = new Worker(path.join(path.dirname(fileURLToPath(import.meta.url)), `core/${script}-compiler.js`), workerPool.getWorkerOptions());
		const pages = options.pages || ctx.pages;
		const totalTasks = Object.keys(pages.mainPages).length + Object.values(pages.subPages).reduce((sum, item) => sum + item.info.length, 0);
		let isResolved = false;
		let workerError = null;
		let terminationPromise;
		const terminateWorker = () => {
			terminationPromise ||= worker.terminate().catch(() => void 0);
			return terminationPromise;
		};
		const handleError = async (error) => {
			if (isResolved) return;
			isResolved = true;
			await terminateWorker();
			reject(error);
		};
		worker.postMessage({
			pages,
			storeInfo: ctx.storeInfo,
			sourcemap: !!options.sourcemap,
			sourcemapTargetPath: options.sourcemapTargetPath,
			compileConfig: options.compileConfig
		});
		worker.on("message", async (message) => {
			try {
				for (const warning of message.compatibilityWarnings || []) {
					ctx.compatibilityWarnings.add(warning);
					if (lifecycle) await lifecycle.emit(LIFECYCLE_EVENTS.BUILD_WARNING, { message: warning });
				}
				if (process$1.stdout.isTTY && message.completedTasks !== void 0) task.output = formatCompileProgress(message.completedTasks, totalTasks);
				if (message.success) {
					if (isResolved) return;
					if (process$1.stdout.isTTY && totalTasks > 0) task.output = formatCompileProgress(totalTasks, totalTasks);
					ctx.dependencyGraph.merge(message.dependencyGraph);
					isResolved = true;
					await terminateWorker();
					resolve();
				} else if (message.error) {
					const error = new Error(message.error.message || message.error);
					if (message.error.name) error.name = message.error.name;
					if (message.error.stack) error.stack = message.error.stack;
					if (message.error.file) error.file = message.error.file;
					if (message.error.line != null) error.line = message.error.line;
					if (message.error.column != null) error.column = message.error.column;
					if (message.error.stage) error.stage = message.error.stage;
					await handleError(error);
				}
			} catch (err) {
				await handleError(/* @__PURE__ */ new Error(`Error processing worker message: ${err.message}\n${err.stack}`));
			}
		});
		worker.on("error", (err) => {
			workerError = err;
			handleError(err);
		});
		worker.on("exit", (code) => {
			if (code !== 0 && !isResolved) {
				const error = workerError || /* @__PURE__ */ new Error(code === 1 ? "Worker terminated due to reaching memory limit: JS heap out of memory" : `Worker stopped with exit code ${code}`);
				handleError(error);
			}
		});
	}));
}
function printCompatibilityWarnings(workPath, warnings = /* @__PURE__ */ new Set()) {
	const projectPath = path.resolve(workPath);
	const hasPreviousResult = previousCompatibilityWarnings.has(projectPath);
	const previousWarnings = previousCompatibilityWarnings.get(projectPath) || /* @__PURE__ */ new Set();
	const currentWarnings = new Set(warnings);
	const newWarnings = [...currentWarnings].filter((warning) => !previousWarnings.has(warning));
	previousCompatibilityWarnings.delete(projectPath);
	previousCompatibilityWarnings.set(projectPath, currentWarnings);
	if (previousCompatibilityWarnings.size > MAX_WARNING_PROJECTS) previousCompatibilityWarnings.delete(previousCompatibilityWarnings.keys().next().value);
	if (newWarnings.length === 0) return;
	const qualifier = hasPreviousResult ? " new" : "";
	const suffix = newWarnings.length === 1 ? "" : "s";
	console.warn(`\n[compat] ${newWarnings.length}${qualifier} compatibility warning${suffix}`);
	for (const warning of newWarnings) console.warn(`  - ${warning.replace(/^\[compat\]\s*/, "")}`);
}
//#endregion
export { build as default, createLifecycle as n, LIFECYCLE_EVENTS as t };
