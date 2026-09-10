import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
import { parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import crypto from "node:crypto";
//#region src/common/dependency-graph.js
function normalizeFilePath(filePath) {
	return path.resolve(filePath);
}
function normalizeKinds(kinds) {
	if (!kinds) return null;
	return new Set(Array.isArray(kinds) ? kinds : [kinds]);
}
var DependencyGraph = class DependencyGraph {
	constructor(snapshot) {
		this.nodes = /* @__PURE__ */ new Map();
		this.dependencies = /* @__PURE__ */ new Map();
		this.dependents = /* @__PURE__ */ new Map();
		this.fileOwners = /* @__PURE__ */ new Map();
		this.fileKinds = /* @__PURE__ */ new Map();
		if (snapshot) this.merge(snapshot);
	}
	addNode(id, metadata = {}) {
		if (!id) return null;
		const current = this.nodes.get(id) || {
			id,
			type: "module",
			entry: false,
			packageRoot: null,
			files: /* @__PURE__ */ new Set()
		};
		if (metadata.type) current.type = metadata.type;
		if (metadata.entry === true) current.entry = true;
		if (metadata.packageRoot !== void 0) current.packageRoot = metadata.packageRoot;
		this.nodes.set(id, current);
		for (const filePath of metadata.files || []) this.addFile(id, filePath);
		return current;
	}
	addFile(id, filePath, kind = "module") {
		if (!id || !filePath) return;
		const node = this.addNode(id);
		const normalizedPath = normalizeFilePath(filePath);
		node.files.add(normalizedPath);
		const owners = this.fileOwners.get(normalizedPath) || /* @__PURE__ */ new Set();
		owners.add(id);
		this.fileOwners.set(normalizedPath, owners);
		const ownerKinds = this.fileKinds.get(normalizedPath) || /* @__PURE__ */ new Map();
		const kinds = ownerKinds.get(id) || /* @__PURE__ */ new Set();
		kinds.add(kind);
		ownerKinds.set(id, kinds);
		this.fileKinds.set(normalizedPath, ownerKinds);
	}
	addDependency(from, to, kind = "module") {
		if (!from || !to) return;
		this.addNode(from);
		this.addNode(to);
		const outgoing = this.dependencies.get(from) || /* @__PURE__ */ new Map();
		const kinds = outgoing.get(to) || /* @__PURE__ */ new Set();
		kinds.add(kind);
		outgoing.set(to, kinds);
		this.dependencies.set(from, outgoing);
		const incoming = this.dependents.get(to) || /* @__PURE__ */ new Map();
		const reverseKinds = incoming.get(from) || /* @__PURE__ */ new Set();
		reverseKinds.add(kind);
		incoming.set(from, reverseKinds);
		this.dependents.set(to, incoming);
	}
	getDirectDependencies(id, kinds) {
		return this.#filterEdges(this.dependencies.get(id), kinds);
	}
	getDirectDependents(id, kinds) {
		return this.#filterEdges(this.dependents.get(id), kinds);
	}
	getAffectedEntries(filePath) {
		const pending = [...this.fileOwners.get(normalizeFilePath(filePath)) || /* @__PURE__ */ new Set()];
		const visited = /* @__PURE__ */ new Set();
		const entries = /* @__PURE__ */ new Set();
		while (pending.length > 0) {
			const id = pending.pop();
			if (visited.has(id)) continue;
			visited.add(id);
			if (this.nodes.get(id)?.entry) entries.add(id);
			for (const dependent of this.getDirectDependents(id)) pending.push(dependent);
		}
		return [...entries].sort();
	}
	hasFile(filePath) {
		return this.fileOwners.has(normalizeFilePath(filePath));
	}
	getFileKinds(filePath) {
		const ownerKinds = this.fileKinds.get(normalizeFilePath(filePath));
		if (!ownerKinds) return [];
		return [...new Set([...ownerKinds.values()].flatMap((kinds) => [...kinds]))].sort();
	}
	merge(snapshotOrGraph) {
		const snapshot = snapshotOrGraph instanceof DependencyGraph ? snapshotOrGraph.toJSON() : snapshotOrGraph;
		const fileEdges = snapshot?.fileEdges || [];
		for (const node of snapshot?.nodes || []) {
			this.addNode(node.id, {
				...node,
				files: []
			});
			if (fileEdges.length === 0) for (const filePath of node.files || []) this.addFile(node.id, filePath);
		}
		for (const fileEdge of fileEdges) for (const kind of fileEdge.kinds || ["module"]) this.addFile(fileEdge.owner, fileEdge.file, kind);
		for (const edge of snapshot?.edges || []) for (const kind of edge.kinds || ["module"]) this.addDependency(edge.from, edge.to, kind);
		return this;
	}
	toJSON() {
		return {
			nodes: [...this.nodes.values()].map((node) => ({
				id: node.id,
				type: node.type,
				entry: node.entry,
				packageRoot: node.packageRoot,
				files: [...node.files].sort()
			})).sort((a, b) => a.id.localeCompare(b.id)),
			edges: [...this.dependencies.entries()].flatMap(([from, targets]) => [...targets.entries()].map(([to, kinds]) => ({
				from,
				to,
				kinds: [...kinds].sort()
			}))).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
			fileEdges: [...this.fileKinds.entries()].flatMap(([file, owners]) => [...owners.entries()].map(([owner, kinds]) => ({
				file,
				owner,
				kinds: [...kinds].sort()
			}))).sort((a, b) => a.file.localeCompare(b.file) || a.owner.localeCompare(b.owner))
		};
	}
	#filterEdges(edges, kinds) {
		if (!edges) return [];
		const acceptedKinds = normalizeKinds(kinds);
		return [...edges.entries()].filter(([, edgeKinds]) => !acceptedKinds || [...edgeKinds].some((kind) => acceptedKinds.has(kind))).map(([id]) => id);
	}
};
//#endregion
//#region src/common/path-utils.js
var WINDOWS_FS_PATH_RE = /^(?:[a-zA-Z]:[\\/]|\\\\)/;
function isWindowsFsPath(targetPath) {
	return typeof targetPath === "string" && (WINDOWS_FS_PATH_RE.test(targetPath) || targetPath.includes("\\"));
}
function getFsPathApi(targetPath) {
	return isWindowsFsPath(targetPath) ? path.win32 : path.posix;
}
function normalizeToPosixPath(targetPath) {
	return targetPath.replace(/\\/g, "/");
}
function resolveMiniProgramPath(workPath, importerPath, sourcePath) {
	const pathApi = getFsPathApi(importerPath || workPath);
	return sourcePath.startsWith("/") ? pathApi.join(workPath, sourcePath) : pathApi.resolve(pathApi.dirname(importerPath), sourcePath);
}
function toMiniProgramModuleId(resolvedPath, workPath) {
	const normalizedResolvedPath = normalizeToPosixPath(resolvedPath);
	const normalizedWorkPath = normalizeToPosixPath(workPath);
	let moduleId = normalizedResolvedPath.startsWith(normalizedWorkPath) ? normalizedResolvedPath.slice(normalizedWorkPath.length) : normalizedResolvedPath;
	moduleId = moduleId.replace(/\/+/g, "/");
	if (!moduleId.startsWith("/")) moduleId = `/${moduleId}`;
	return moduleId;
}
function getRelativePosixPath(targetPath, rootPath) {
	return normalizeToPosixPath(targetPath).replace(normalizeToPosixPath(rootPath), "").replace(/^\//, "");
}
//#endregion
//#region src/common/utils.js
function hasCompileInfo(modulePath, list, preList) {
	for (const element of list) if (element.path === modulePath) return true;
	if (!Array.isArray(preList)) return false;
	for (const element of preList) if (element.path === modulePath) return true;
	return false;
}
function getAbsolutePath(workPath, pagePath, src) {
	if (src.startsWith("/")) return path.join(workPath, src);
	if (pagePath.includes("/miniprogram_npm/")) {
		const componentFullPath = workPath + pagePath.split("/").slice(0, -1).join("/");
		return path.resolve(componentFullPath, src);
	}
	const relativePath = pagePath.split("/").filter((part) => part !== "").slice(0, -1).join("/");
	return path.resolve(workPath, relativePath, src);
}
var assetsMap = {};
var copiedAssetGroups = /* @__PURE__ */ new Set();
var collectableImageAssetPattern = /\.(?:png|jpe?g|gif|svg|webp|heic|heif)$/i;
function splitAssetReference(src) {
	const suffixIndex = src.search(/[?#]/);
	return suffixIndex === -1 ? {
		sourcePath: src,
		suffix: ""
	} : {
		sourcePath: src.slice(0, suffixIndex),
		suffix: src.slice(suffixIndex)
	};
}
function resetAssetCache() {
	for (const assetPath of Object.keys(assetsMap)) delete assetsMap[assetPath];
	copiedAssetGroups.clear();
}
function isCollectableImageAsset(src) {
	return typeof src === "string" && collectableImageAssetPattern.test(splitAssetReference(src).sourcePath);
}
function isPathInside(rootPath, targetPath) {
	const relativePath = path.relative(rootPath, targetPath);
	return relativePath === "" || !relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath);
}
function resolveAssetSourcePath(workPath, pagePath, src) {
	const projectRoot = path.resolve(workPath);
	if (src.startsWith("/")) return path.resolve(projectRoot, `.${src}`);
	const normalizedPagePath = path.resolve(pagePath);
	const pageDirectory = path.isAbsolute(pagePath) && isPathInside(projectRoot, normalizedPagePath) ? path.dirname(normalizedPagePath) : path.resolve(projectRoot, path.dirname(pagePath.replace(/^[/\\]+/, "")));
	const resolvedPath = path.resolve(pageDirectory, src);
	if (isPathInside(projectRoot, resolvedPath)) return resolvedPath;
	return path.resolve(projectRoot, src.replace(/^(?:\.\.[/\\])+/, ""));
}
/**
* 将静态资源存储到 static 文件夹
*/
function collectAssets(workPath, pagePath, src, targetPath, appId) {
	if (src.startsWith("http") || src.startsWith("//")) return src;
	if (!isCollectableImageAsset(src)) return src;
	const { sourcePath, suffix } = splitAssetReference(src);
	const absolutePath = resolveAssetSourcePath(workPath, pagePath, sourcePath);
	const cacheKey = `${path.resolve(targetPath)}\0${absolutePath}`;
	if (assetsMap[cacheKey]) return `${assetsMap[cacheKey]}${suffix}`;
	try {
		const ext = path.extname(sourcePath);
		const dirPath = absolutePath.split(path.sep).slice(0, -1).join("/");
		const prefix = uuid(dirPath);
		const targetStatic = `${targetPath}/main/static`;
		if (!fs.existsSync(targetStatic)) fs.mkdirSync(targetStatic, { recursive: true });
		const pathPrefix = process.env.ASSETS_PATH_PREFIX ? "" : "/";
		const groupKey = `${path.resolve(targetPath)}\0${dirPath}\0${ext}`;
		if (!copiedAssetGroups.has(groupKey)) {
			for (const file of getFilesWithExtension(dirPath, ext)) {
				const sourceFile = path.resolve(dirPath, file);
				fs.copyFileSync(sourceFile, `${targetStatic}/${prefix}_${file}`);
				assetsMap[`${path.resolve(targetPath)}\0${sourceFile}`] = `${pathPrefix}${appId}/main/static/${prefix}_${file}`;
			}
			copiedAssetGroups.add(groupKey);
		}
	} catch (error) {
		console.log(error);
	}
	return assetsMap[cacheKey] ? `${assetsMap[cacheKey]}${suffix}` : src;
}
function getFilesWithExtension(directory, extension) {
	return fs.readdirSync(directory).filter((file) => path.extname(file) === extension);
}
function isObjectEmpty(objectName) {
	if (!objectName) return true;
	return Object.keys(objectName).length === 0 && objectName.constructor === Object;
}
function isString(o) {
	return Object.prototype.toString.call(o) === "[object String]";
}
function transformRpx(styleText) {
	if (!isString(styleText)) return styleText;
	return styleText.replace(/([+-]?\d+(?:\.\d+)?)rpx/g, (_, pixel) => {
		const viewportWidth = Number((Number(pixel) / 7.5).toFixed(6));
		return `${Object.is(viewportWidth, -0) ? 0 : viewportWidth}vw`;
	});
}
function uuid(str) {
	return crypto.createHash("sha256").update(str).digest().readBigUInt64BE(0).toString(36);
}
var tagWhiteList = [
	"page",
	"component-host",
	"block",
	"button",
	"camera",
	"canvas",
	"checkbox-group",
	"checkbox",
	"cover-image",
	"cover-view",
	"form",
	"icon",
	"image",
	"input",
	"keyboard-accessory",
	"label",
	"map",
	"movable-area",
	"movable-view",
	"navigation-bar",
	"navigator",
	"open-data",
	"page-meta",
	"picker-view-column",
	"picker-view",
	"picker",
	"progress",
	"radio-group",
	"radio",
	"rich-text",
	"root-portal",
	"scroll-view",
	"slider",
	"swiper-item",
	"swiper",
	"switch",
	"template",
	"text",
	"textarea",
	"video",
	"view",
	"web-view"
];
var miniProgramBuiltinTags = /* @__PURE__ */ new Set([
	...tagWhiteList,
	"match-media",
	"page-container",
	"share-element",
	"editor",
	"audio",
	"channel-live",
	"channel-video",
	"live-player",
	"live-pusher",
	"voip-room",
	"ad",
	"ad-custom",
	"official-account",
	"xr-frame"
]);
//#endregion
//#region src/common/npm-resolver.js
/**
* npm 组件解析器
* 根据微信小程序 npm 支持规范实现组件寻址
* https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html
*/
var NpmResolver = class {
	constructor(workPath) {
		this.workPath = workPath;
		this.miniprogramNpmCache = /* @__PURE__ */ new Map();
		this.packageCache = /* @__PURE__ */ new Map();
	}
	/**
	* 解析组件路径，支持 npm 包组件
	* @param {string} componentPath 组件路径
	* @param {string} pageFilePath 页面文件路径
	* @returns {string} 解析后的组件路径
	*/
	resolveComponentPath(componentPath, pageFilePath) {
		if (componentPath.startsWith("./") || componentPath.startsWith("../") || componentPath.startsWith("/")) return this.resolveRelativePath(componentPath, pageFilePath);
		const npmPath = this.resolveNpmComponent(componentPath, pageFilePath);
		if (npmPath) return npmPath;
		return this.resolveRelativePath(componentPath, pageFilePath);
	}
	/**
	* 解析相对路径组件
	* @param {string} componentPath 组件路径
	* @param {string} pageFilePath 页面文件路径
	* @returns {string} 解析后的路径
	*/
	resolveRelativePath(componentPath, pageFilePath) {
		return toMiniProgramModuleId(resolveMiniProgramPath(this.workPath, pageFilePath, componentPath), this.workPath);
	}
	/**
	* 解析 npm 组件
	* @param {string} componentName 组件名称
	* @param {string} pageFilePath 页面文件路径
	* @returns {string|null} 解析后的组件路径，如果找不到返回 null
	*/
	resolveNpmComponent(componentName, pageFilePath) {
		const searchPaths = this.generateSearchPaths(pageFilePath);
		for (const searchPath of searchPaths) {
			const componentPath = this.findComponentInMiniprogramNpm(componentName, searchPath);
			if (componentPath) return componentPath;
		}
		return null;
	}
	/**
	* 解析脚本模块路径，支持微信小程序 npm 逐级寻址和 package.json 入口
	* @param {string} specifier 模块导入路径
	* @param {string} modulePath 当前模块绝对文件路径
	* @param {(moduleId: string) => string | null} resolveExistingModuleId 解析真实存在模块的回调
	* @returns {string|null} 解析后的模块 id
	*/
	resolveScriptModule(specifier, modulePath, resolveExistingModuleId) {
		if (!specifier || !resolveExistingModuleId) return null;
		for (const searchPath of this.generateSearchPaths(modulePath)) {
			const resolvedModuleId = resolveExistingModuleId(this.normalizeModuleId(`/${searchPath}/${specifier}`));
			if (resolvedModuleId) return resolvedModuleId;
		}
		return null;
	}
	/**
	* 生成 miniprogram_npm 搜索路径
	* 按照微信小程序的寻址顺序生成搜索路径
	* @param {string} pageFilePath 页面文件路径
	* @returns {string[]} 搜索路径数组
	*/
	generateSearchPaths(pageFilePath) {
		const pathParts = getRelativePosixPath(pageFilePath, this.workPath).split("/").slice(0, -1);
		const searchPaths = [];
		for (let i = pathParts.length; i >= 0; i--) {
			const currentPath = pathParts.slice(0, i).join("/");
			const miniprogramNpmPath = currentPath ? `${currentPath}/miniprogram_npm` : "miniprogram_npm";
			searchPaths.push(miniprogramNpmPath);
		}
		return searchPaths;
	}
	/**
	* 在指定的 miniprogram_npm 目录中查找组件
	* @param {string} componentName 组件名称
	* @param {string} miniprogramNpmPath miniprogram_npm 路径
	* @returns {string|null} 组件路径，如果找不到返回 null
	*/
	findComponentInMiniprogramNpm(componentName, miniprogramNpmPath) {
		const fullMiniprogramNpmPath = path.join(this.workPath, miniprogramNpmPath);
		if (!fs.existsSync(fullMiniprogramNpmPath)) return null;
		const cacheKey = `${miniprogramNpmPath}/${componentName}`;
		if (this.miniprogramNpmCache.has(cacheKey)) return this.miniprogramNpmCache.get(cacheKey);
		const candidatePaths = [componentName, `${componentName}/index`];
		for (const candidatePath of candidatePaths) {
			const componentDir = path.join(fullMiniprogramNpmPath, candidatePath);
			if (this.isValidComponent(componentDir)) {
				const resolvedPath = `/${miniprogramNpmPath}/${candidatePath}`.replace(/\/+/g, "/");
				this.miniprogramNpmCache.set(cacheKey, resolvedPath);
				return resolvedPath;
			}
		}
		this.miniprogramNpmCache.set(cacheKey, null);
		return null;
	}
	normalizeModuleId(moduleId) {
		let normalized = moduleId.replace(/\.(js|ts)$/, "").replace(/\\/g, "/");
		if (!normalized.startsWith("/")) normalized = `/${normalized}`;
		return normalized;
	}
	/**
	* 检查是否为有效的组件
	* @param {string} componentPath 组件路径
	* @returns {boolean} 是否为有效组件
	*/
	isValidComponent(componentPath) {
		const requiredFiles = [".json", ".js"];
		if (!requiredFiles.some((ext) => {
			return fs.existsSync(`${componentPath}${ext}`);
		})) {
			if (!requiredFiles.some((ext) => {
				return fs.existsSync(path.join(componentPath, `index${ext}`));
			})) return false;
			const indexJsonFile = path.join(componentPath, "index.json");
			if (fs.existsSync(indexJsonFile)) try {
				return JSON.parse(fs.readFileSync(indexJsonFile, "utf-8")).component === true;
			} catch (e) {
				return false;
			}
			return true;
		}
		const jsonFile = `${componentPath}.json`;
		if (fs.existsSync(jsonFile)) try {
			return JSON.parse(fs.readFileSync(jsonFile, "utf-8")).component === true;
		} catch (e) {
			return false;
		}
		return true;
	}
	/**
	* 获取 npm 包信息
	* @param {string} packageName 包名
	* @param {string} searchPath 搜索路径
	* @returns {object|null} 包信息，如果找不到返回 null
	*/
	getPackageInfo(packageName, searchPath) {
		const cacheKey = `${searchPath}/${packageName}`;
		if (this.packageCache.has(cacheKey)) return this.packageCache.get(cacheKey);
		const packageJsonPath = path.join(this.workPath, searchPath, packageName, "package.json");
		if (!fs.existsSync(packageJsonPath)) {
			this.packageCache.set(cacheKey, null);
			return null;
		}
		try {
			const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
			this.packageCache.set(cacheKey, packageInfo);
			return packageInfo;
		} catch (e) {
			this.packageCache.set(cacheKey, null);
			return null;
		}
	}
	/**
	* 清除缓存
	*/
	clearCache() {
		this.miniprogramNpmCache.clear();
		this.packageCache.clear();
	}
};
//#endregion
//#region src/env.js
var compilerContextStorage = new AsyncLocalStorage();
var defaultCompilerContext;
function createCompilerContext() {
	return {
		pathInfo: {},
		configInfo: {},
		npmResolver: null,
		dependencyGraph: new DependencyGraph(),
		compilerOptions: normalizeFileTypes()
	};
}
function getCompilerContext() {
	defaultCompilerContext ||= createCompilerContext();
	return compilerContextStorage.getStore() || defaultCompilerContext;
}
var pathInfo = new Proxy({}, {
	get: (_, key) => getCompilerContext().pathInfo[key],
	set: (_, key, value) => {
		getCompilerContext().pathInfo[key] = value;
		return true;
	}
});
var configInfo = new Proxy({}, {
	get: (_, key) => getCompilerContext().configInfo[key],
	set: (_, key, value) => {
		getCompilerContext().configInfo[key] = value;
		return true;
	}
});
var DEFAULT_TEMPLATE_EXTS = [".wxml", ".ddml"];
var DEFAULT_TEMPLATE_DIRECTIVE_PREFIXES = [
	"wx",
	"dd",
	"a"
];
var DEFAULT_STYLE_EXTS = [
	".wxss",
	".ddss",
	".less",
	".scss",
	".sass"
];
var DEFAULT_VIEW_SCRIPT_EXTS = [".wxs"];
var DEFAULT_VIEW_SCRIPT_TAGS = ["wxs", "dds"];
var CUSTOM_TAB_BAR_COMPONENT_PATH = "/custom-tab-bar/index";
var STYLE_ISOLATION_VALUES = /* @__PURE__ */ new Set([
	"isolated",
	"apply-shared",
	"shared"
]);
var MINI_PROGRAM_RUNTIME_TYPE = "miniProgram";
var MINI_GAME_RUNTIME_TYPE = "game";
var MINI_GAME_ENTRY_PATH = "game";
var RESERVED_EXTS = /* @__PURE__ */ new Set([
	...DEFAULT_TEMPLATE_EXTS,
	...DEFAULT_STYLE_EXTS,
	...DEFAULT_VIEW_SCRIPT_EXTS,
	".js",
	".ts",
	".json"
]);
/**
* 将单项规范化为扩展名：去除首尾空白、转小写并补一个前导点。
* 仅接受字母、数字、连字符和下划线；空字符串、路径分隔符或其他元字符
* 均返回 null，由调用方丢弃。扩展名会用于生成尾部匹配正则和查找文件，
* 放行元字符可能导致误匹配。
*/
function normalizeExt(raw) {
	if (typeof raw !== "string") return null;
	const v = raw.trim().toLowerCase().replace(/^\.+/, "");
	if (!/^[a-z0-9_-]+$/.test(v)) return null;
	return `.${v}`;
}
/**
* 将单项规范化为内联标签名：去除首尾空白、转小写并移除前导点。
* 标签名会用于拼接 Cheerio 选择器（如 transTagWxs），因此必须以字母开头，
* 且只能包含字母、数字、连字符和下划线。拒绝选择器元字符，避免 'qds,view'
* 误选并删除 <view>，破坏编译产物。
*/
function normalizeTag(raw) {
	if (typeof raw !== "string") return null;
	const v = raw.trim().toLowerCase().replace(/^\.+/, "");
	if (!/^[a-z][a-z0-9_-]*$/.test(v)) return null;
	return v;
}
/**
* 合并并去重内置项和自定义项；内置项在前，顺序即同名文件的查找优先级。
* 传入 reserved 时，落在其中的自定义项被丢弃（防止占用其他角色/逻辑/配置的扩展名）。
*/
function mergeUnique(builtins, custom, normalizer, reserved) {
	const out = [...builtins];
	const seen = new Set(builtins);
	if (Array.isArray(custom)) for (const raw of custom) {
		const n = normalizer(raw);
		if (n && !seen.has(n) && !reserved?.has(n)) {
			seen.add(n);
			out.push(n);
		}
	}
	return out;
}
/**
* 根据 options.fileTypes 生成本次构建使用的自定义扩展名和标签。
* viewScript 同时用于生成文件扩展名和内联标签。
*/
function normalizeFileTypes(fileTypes = {}) {
	const ft = fileTypes || {};
	const templateExts = mergeUnique(DEFAULT_TEMPLATE_EXTS, ft.template, normalizeExt, RESERVED_EXTS);
	return {
		templateExts,
		templateDirectivePrefixes: [.../* @__PURE__ */ new Set([...DEFAULT_TEMPLATE_DIRECTIVE_PREFIXES, ...templateExts.map((extension) => {
			const name = extension.slice(1);
			return name.endsWith("ml") ? name.slice(0, -2) : name;
		}).filter(Boolean)])],
		styleExts: mergeUnique(DEFAULT_STYLE_EXTS, ft.style, normalizeExt, RESERVED_EXTS),
		viewScriptExts: mergeUnique(DEFAULT_VIEW_SCRIPT_EXTS, ft.viewScript, normalizeExt, RESERVED_EXTS),
		viewScriptTags: mergeUnique(DEFAULT_VIEW_SCRIPT_TAGS, ft.viewScript, normalizeTag)
	};
}
/**
* 持久化编译过程的上下文
* @param {string} workPath 编译工作目录
* @param {{ fileTypes?: { template?: string[], style?: string[], viewScript?: string[] } }} [options] 构建选项
*/
function storeInfo(workPath, options = {}) {
	const context = getCompilerContext();
	context.compilerOptions = normalizeFileTypes(options.fileTypes);
	storePathInfo(workPath);
	storeProjectConfig();
	storeAppConfig();
	storePageConfig();
	context.dependencyGraph = createInitialDependencyGraph();
	context.dependencyGraph.merge(options.dependencyGraph);
	return {
		pathInfo: context.pathInfo,
		configInfo: context.configInfo,
		compilerOptions: context.compilerOptions,
		dependencyGraph: context.dependencyGraph.toJSON()
	};
}
function resetStoreInfo(opts) {
	const context = getCompilerContext();
	context.pathInfo = opts.pathInfo;
	context.configInfo = opts.configInfo;
	context.compilerOptions = opts.compilerOptions || normalizeFileTypes();
	context.dependencyGraph = new DependencyGraph(opts.dependencyGraph);
	if (pathInfo.workPath) context.npmResolver = new NpmResolver(pathInfo.workPath);
}
function runWithCompilerContext(callback) {
	return compilerContextStorage.run(createCompilerContext(), callback);
}
function getTemplateExts() {
	return getCompilerContext().compilerOptions.templateExts;
}
function getTemplateDirectivePrefixes() {
	const compilerOptions = getCompilerContext().compilerOptions;
	return compilerOptions.templateDirectivePrefixes || normalizeFileTypes({ template: compilerOptions.templateExts }).templateDirectivePrefixes;
}
function getStyleExts() {
	return getCompilerContext().compilerOptions.styleExts;
}
function getViewScriptExts() {
	return getCompilerContext().compilerOptions.viewScriptExts;
}
function getViewScriptTags() {
	return getCompilerContext().compilerOptions.viewScriptTags;
}
function getDependencyGraph() {
	return getCompilerContext().dependencyGraph;
}
function storePathInfo(workPath) {
	pathInfo.workPath = workPath;
	if (process.env.TARGET_PATH) {
		pathInfo.targetPath = process.env.TARGET_PATH;
		pathInfo.temporaryTargetPath = false;
	} else {
		const tempDir = process.env.GITHUB_WORKSPACE || os.tmpdir();
		pathInfo.targetPath = fs.mkdtempSync(path.join(tempDir, "dimina-fe-dist-"));
		pathInfo.temporaryTargetPath = true;
	}
	getCompilerContext().npmResolver = new NpmResolver(workPath);
}
function storeProjectConfig() {
	const privateConfigPath = `${pathInfo.workPath}/project.private.config.json`;
	const defaultConfigPath = `${pathInfo.workPath}/project.config.json`;
	let privateConfig = {};
	let defaultConfig = {};
	if (fs.existsSync(defaultConfigPath)) try {
		defaultConfig = parseContentByPath(defaultConfigPath);
	} catch (e) {
		console.warn("Failed to parse project.config.json:", e.message);
	}
	if (fs.existsSync(privateConfigPath)) try {
		privateConfig = parseContentByPath(privateConfigPath);
	} catch (e) {
		console.warn("Failed to parse project.private.config.json:", e.message);
	}
	configInfo.projectInfo = {
		...defaultConfig,
		...privateConfig
	};
}
function storeAppConfig() {
	const runtimeType = detectRuntimeType();
	const configFileName = runtimeType === MINI_GAME_RUNTIME_TYPE ? "game.json" : "app.json";
	const content = parseContentByPath(`${pathInfo.workPath}/${configFileName}`);
	if (runtimeType === MINI_GAME_RUNTIME_TYPE) {
		configInfo.runtimeType = MINI_GAME_RUNTIME_TYPE;
		configInfo.appInfo = {
			...content,
			runtimeType: MINI_GAME_RUNTIME_TYPE,
			entryPagePath: MINI_GAME_ENTRY_PATH,
			pages: [MINI_GAME_ENTRY_PATH],
			window: {
				backgroundColor: content.backgroundColor || "#000000",
				navigationStyle: "custom"
			}
		};
		return;
	}
	const newObj = {};
	for (const key in content) if (Object.prototype.hasOwnProperty.call(content, key)) {
		if (key === "subpackages") newObj.subPackages = content[key];
		else newObj[key] = content[key];
	}
	configInfo.runtimeType = MINI_PROGRAM_RUNTIME_TYPE;
	newObj.runtimeType = MINI_PROGRAM_RUNTIME_TYPE;
	configInfo.appInfo = newObj;
}
function detectRuntimeType() {
	const compileType = configInfo.projectInfo?.compileType;
	const hasMiniProgramConfig = fs.existsSync(path.join(pathInfo.workPath, "app.json"));
	const hasMiniGameConfig = fs.existsSync(path.join(pathInfo.workPath, "game.json"));
	const hasMiniGameEntry = ["game.js", "game.ts"].some((fileName) => fs.existsSync(path.join(pathInfo.workPath, fileName)));
	if (compileType === "game") return MINI_GAME_RUNTIME_TYPE;
	if (compileType === "miniprogram") return MINI_PROGRAM_RUNTIME_TYPE;
	if (!hasMiniProgramConfig && hasMiniGameConfig && hasMiniGameEntry) return MINI_GAME_RUNTIME_TYPE;
	return MINI_PROGRAM_RUNTIME_TYPE;
}
function getRuntimeType() {
	return configInfo.runtimeType || MINI_PROGRAM_RUNTIME_TYPE;
}
function isMiniGame() {
	return getRuntimeType() === MINI_GAME_RUNTIME_TYPE;
}
function getContentByPath(path) {
	return fs.readFileSync(path, { encoding: "utf-8" });
}
function parseContentByPath(path) {
	return JSON.parse(getContentByPath(path));
}
/**
* 收集页面 json 信息
*/
function storePageConfig() {
	if (isMiniGame()) {
		configInfo.pageInfo = {};
		configInfo.componentInfo = {};
		return;
	}
	const { pages, subPackages } = configInfo.appInfo;
	configInfo.pageInfo = {};
	configInfo.componentInfo = {};
	if (configInfo.appInfo.usingComponents) {
		const appFilePath = `${pathInfo.workPath}/app.json`;
		storeComponentConfig(configInfo.appInfo, appFilePath);
	}
	collectionPageJson(pages);
	if (subPackages) subPackages.forEach((subPkg) => {
		collectionPageJson(subPkg.pages, subPkg.root);
	});
	storeCustomTabBarConfig();
}
/**
* 微信会把 custom-tab-bar/index 作为每个 tab 页的直属组件创建。业务页面
* 不需要在 usingComponents 中显式声明它，因此编译阶段补一个内部组件引用，
* 让逻辑、视图和样式三个编译器都能沿现有依赖图收集该组件。
*/
function storeCustomTabBarConfig() {
	const tabBar = configInfo.appInfo?.tabBar;
	if (tabBar?.custom !== true || !Array.isArray(tabBar.list)) return;
	const componentJsonPath = path.join(pathInfo.workPath, "custom-tab-bar/index.json");
	if (!fs.existsSync(componentJsonPath)) {
		console.warn("[env] tabBar.custom 已启用，但找不到 custom-tab-bar/index.json");
		return;
	}
	const dependencyName = `dimina-${uuid(CUSTOM_TAB_BAR_COMPONENT_PATH)}`;
	storeComponentConfig({ usingComponents: { [dependencyName]: CUSTOM_TAB_BAR_COMPONENT_PATH } }, path.join(pathInfo.workPath, "app.json"));
	const componentConfig = configInfo.componentInfo[CUSTOM_TAB_BAR_COMPONENT_PATH];
	if (componentConfig) componentConfig.customTabBar = true;
	for (const item of tabBar.list) {
		const pagePath = typeof item?.pagePath === "string" ? item.pagePath.replace(/^\/+/, "") : "";
		if (!pagePath || !configInfo.appInfo.pages?.includes(pagePath)) continue;
		const pageConfig = configInfo.pageInfo[pagePath] ||= {};
		pageConfig.usingComponents ||= {};
		const declaredComponents = {
			...configInfo.appInfo.usingComponents || {},
			...pageConfig.usingComponents
		};
		let componentName = Object.entries(declaredComponents).find(([, componentPath]) => componentPath === CUSTOM_TAB_BAR_COMPONENT_PATH)?.[0] || dependencyName;
		let suffix = 0;
		while (declaredComponents[componentName] && declaredComponents[componentName] !== CUSTOM_TAB_BAR_COMPONENT_PATH) {
			suffix++;
			componentName = `${dependencyName}-${suffix}`;
		}
		pageConfig.usingComponents[componentName] = CUSTOM_TAB_BAR_COMPONENT_PATH;
		pageConfig.customTabBar = { componentName };
	}
}
/**
* 匹配页面和对应的配置信息
* @param {*} pages
*/
function collectionPageJson(pages, root) {
	if (!Array.isArray(pages)) return;
	pages.forEach((pagePath) => {
		let np = pagePath;
		if (root) {
			if (!root.endsWith("/")) root += "/";
			np = root + np;
		}
		const pageFilePath = `${pathInfo.workPath}/${np}.json`;
		if (fs.existsSync(pageFilePath)) {
			const pageJsonContent = parseContentByPath(pageFilePath);
			if (root) pageJsonContent.root = transSubDir(root);
			configInfo.pageInfo[np] = pageJsonContent;
			storeComponentConfig(pageJsonContent, pageFilePath);
		}
	});
}
/**
* 按页面收集组件 json 信息
* @param {*} pageJsonContent
* @param {*} pageFilePath
*/
function storeComponentConfig(pageJsonContent, pageFilePath) {
	if (isObjectEmpty(pageJsonContent.usingComponents)) return;
	for (const [componentName, componentPath] of Object.entries(pageJsonContent.usingComponents)) {
		const moduleId = getModuleId(componentPath, pageFilePath);
		pageJsonContent.usingComponents[componentName] = moduleId;
		if (configInfo.componentInfo[moduleId]) continue;
		let componentFilePath = path.resolve(getWorkPath(), `./${moduleId}.json`);
		let cContent = null;
		if (fs.existsSync(componentFilePath)) cContent = parseContentByPath(componentFilePath);
		else {
			const indexJsonPath = path.resolve(getWorkPath(), `./${moduleId}/index.json`);
			if (fs.existsSync(indexJsonPath)) {
				componentFilePath = indexJsonPath;
				cContent = parseContentByPath(componentFilePath);
			} else if (moduleId.includes("/miniprogram_npm/")) {
				console.log(`[env] 为 npm 组件创建默认配置: ${moduleId}`);
				cContent = {
					component: true,
					usingComponents: {}
				};
			} else {
				console.warn(`[env] 组件配置文件不存在: ${componentFilePath}`);
				continue;
			}
		}
		const cUsing = cContent.usingComponents || {};
		const isComponent = cContent.component || false;
		const styleIsolation = resolveComponentStyleIsolation(cContent, componentFilePath);
		const cComponents = Object.keys(cUsing).reduce((acc, key) => {
			acc[key] = getModuleId(cUsing[key], componentFilePath);
			return acc;
		}, {});
		configInfo.componentInfo[moduleId] = {
			id: uuid(moduleId),
			path: moduleId,
			component: isComponent,
			styleIsolation,
			usingComponents: cComponents,
			componentPlaceholder: { ...cContent.componentPlaceholder || {} }
		};
		if (cContent.usingComponents && Object.keys(cContent.usingComponents).length > 0) storeComponentConfig(configInfo.componentInfo[moduleId], componentFilePath);
	}
}
function getStaticProperty(objectExpression, propertyName) {
	if (objectExpression?.type !== "ObjectExpression") return;
	return objectExpression.properties?.find((property) => {
		if (property.type !== "Property" || property.computed) return false;
		return property.key?.name === propertyName || property.key?.value === propertyName;
	})?.value;
}
function normalizeStyleIsolation(value) {
	return STYLE_ISOLATION_VALUES.has(value) ? value : void 0;
}
/**
* styleIsolation can be declared either in component.json or in
* Component({ options }). The style compiler must know it before service
* runtime starts, so only statically-declared literal options participate.
* addGlobalClass is the legacy equivalent of apply-shared.
*/
function resolveComponentStyleIsolation(componentConfig, componentJsonPath) {
	const jsonValue = normalizeStyleIsolation(componentConfig?.styleIsolation);
	if (jsonValue) return jsonValue;
	const basePath = componentJsonPath.replace(/\.json$/i, "");
	const scriptPath = [".js", ".ts"].map((ext) => `${basePath}${ext}`).find((candidate) => fs.existsSync(candidate));
	if (!scriptPath) return "isolated";
	try {
		const source = getContentByPath(scriptPath);
		const { program } = parseSync(scriptPath, source, { sourceType: "unambiguous" });
		let extractedValue;
		walk(program, { enter(expression) {
			if (extractedValue) return;
			if (expression?.type !== "CallExpression" || expression.callee?.type !== "Identifier" || expression.callee.name !== "Component") return;
			const definition = expression.arguments?.[0];
			const options = getStaticProperty(definition, "options");
			const styleIsolation = getStaticProperty(options, "styleIsolation")?.value;
			const normalized = normalizeStyleIsolation(styleIsolation);
			if (normalized) {
				extractedValue = normalized;
				return;
			}
			if (getStaticProperty(options, "addGlobalClass")?.value === true) extractedValue = "apply-shared";
		} });
		if (extractedValue) return extractedValue;
	} catch (error) {
		console.warn(`[env] 无法解析组件样式隔离配置 ${scriptPath}: ${error.message}`);
	}
	return "isolated";
}
/**
* 转化为相对小程序根目录的绝对路径，作为模块唯一性 id
* 支持 npm 组件解析
* @param {string} src
*/
function getModuleId(src, pageFilePath) {
	const resolvedAlias = resolveAppAlias(src);
	if (resolvedAlias) return resolvedAlias;
	const npmResolver = getCompilerContext().npmResolver;
	if (!npmResolver) {
		const workPath = getWorkPath();
		return toMiniProgramModuleId(resolveMiniProgramPath(workPath, pageFilePath, src), workPath);
	}
	return npmResolver.resolveComponentPath(src, pageFilePath);
}
function resolveAppAlias(src) {
	const resolveAlias = configInfo.appInfo?.resolveAlias;
	if (!resolveAlias || typeof src !== "string") return null;
	for (const [alias, target] of Object.entries(resolveAlias)) if (alias.endsWith("/*") && target.endsWith("/*")) {
		const aliasPrefix = alias.slice(0, -1);
		const targetPrefix = target.slice(0, -1);
		if (src.startsWith(aliasPrefix)) return src.replace(aliasPrefix, targetPrefix);
	} else if (src === alias) return target;
	return null;
}
function getTargetPath() {
	return pathInfo.targetPath;
}
function getComponent(src) {
	return configInfo.componentInfo[src];
}
function getPageConfigInfo() {
	return configInfo.pageInfo;
}
function getAppConfigInfo() {
	return configInfo.appInfo;
}
function getWorkPath() {
	return pathInfo.workPath;
}
function getNpmResolver() {
	return getCompilerContext().npmResolver;
}
function getAppId() {
	return configInfo.projectInfo.appid;
}
function getAppName() {
	if (configInfo.projectInfo.projectname) return decodeURIComponent(configInfo.projectInfo.projectname);
	return getAppId();
}
function transSubDir(name) {
	return `sub_${name.replace(/\/$/, "")}`;
}
/**
* 获取页面及其配置信息，并生成id（输出的 json 文件没有 id)
*/
function getPages() {
	if (isMiniGame()) return {
		mainPages: [{
			id: uuid(MINI_GAME_ENTRY_PATH),
			path: MINI_GAME_ENTRY_PATH,
			game: true,
			usingComponents: {}
		}],
		subPages: {}
	};
	const { pages, subPackages = [], usingComponents: globalComponents = {} } = getAppConfigInfo();
	const pageInfo = getPageConfigInfo();
	const mainPages = pages.map((path) => {
		const pageComponents = pageInfo[path]?.usingComponents || {};
		const mergedComponents = {
			...globalComponents,
			...pageComponents
		};
		return {
			id: uuid(path),
			path,
			appStyleScopeId: getAppStyleScopeId(),
			sharedStyleScopeIds: collectSharedStyleScopeIds(mergedComponents),
			usingComponents: mergedComponents,
			componentPlaceholder: { ...pageInfo[path]?.componentPlaceholder || {} },
			customTabBar: pageInfo[path]?.customTabBar
		};
	});
	const subPages = {};
	subPackages.forEach((subPkg) => {
		const rootPath = subPkg.root.endsWith("/") ? subPkg.root : `${subPkg.root}/`;
		const independent = subPkg.independent ? subPkg.independent : false;
		subPages[transSubDir(rootPath)] = {
			independent,
			info: subPkg.pages.map((path) => {
				const fullPath = rootPath + path;
				const pageComponents = pageInfo[fullPath]?.usingComponents || {};
				const mergedComponents = {
					...globalComponents,
					...pageComponents
				};
				return {
					id: uuid(fullPath),
					path: fullPath,
					appStyleScopeId: getAppStyleScopeId(),
					sharedStyleScopeIds: collectSharedStyleScopeIds(mergedComponents),
					usingComponents: mergedComponents,
					componentPlaceholder: { ...pageInfo[fullPath]?.componentPlaceholder || {} },
					customTabBar: pageInfo[fullPath]?.customTabBar
				};
			})
		};
	});
	return {
		mainPages,
		subPages
	};
}
function addExistingModuleFiles(graph, moduleId) {
	const relativeId = moduleId.replace(/^\/+/, "");
	const basePath = path.resolve(getWorkPath(), relativeId);
	const baseCandidates = [basePath, path.join(basePath, "index")];
	const extensions = [
		".json",
		".js",
		".ts",
		...getTemplateExts(),
		...getStyleExts(),
		...getViewScriptExts()
	];
	for (const candidateBase of baseCandidates) for (const extension of extensions) {
		const filePath = `${candidateBase}${extension}`;
		if (fs.existsSync(filePath)) graph.addFile(moduleId, filePath, getFileDependencyKind(filePath));
	}
}
function getFileDependencyKind(filePath) {
	const extension = path.extname(filePath).toLowerCase();
	if (extension === ".json") return "config";
	if (extension === ".js" || extension === ".ts") return "logic";
	if (getTemplateExts().includes(extension) || getViewScriptExts().includes(extension)) return "view";
	if (getStyleExts().includes(extension)) return "style";
	return "module";
}
function createInitialDependencyGraph() {
	const graph = new DependencyGraph();
	if (isMiniGame()) {
		graph.addNode(MINI_GAME_ENTRY_PATH, {
			type: MINI_GAME_RUNTIME_TYPE,
			entry: true
		});
		for (const fileName of [
			"game.json",
			"game.js",
			"game.ts",
			"project.config.json",
			"project.private.config.json"
		]) {
			const filePath = path.resolve(getWorkPath(), fileName);
			if (fs.existsSync(filePath)) graph.addFile(MINI_GAME_ENTRY_PATH, filePath, getFileDependencyKind(filePath));
		}
		return graph;
	}
	graph.addNode("app", { type: "app" });
	for (const fileName of [
		"app.json",
		"app.js",
		"app.ts",
		"project.config.json",
		"project.private.config.json"
	]) {
		const filePath = path.resolve(getWorkPath(), fileName);
		if (fs.existsSync(filePath)) graph.addFile("app", filePath, getFileDependencyKind(filePath));
	}
	addExistingModuleFiles(graph, "app");
	for (const item of getAppConfigInfo().tabBar?.list || []) for (const field of ["iconPath", "selectedIconPath"]) {
		if (!item[field]) continue;
		const assetPath = resolveAssetSourcePath(getWorkPath(), "", item[field]);
		if (fs.existsSync(assetPath)) graph.addFile("app", assetPath, "config");
	}
	for (const component of Object.values(configInfo.componentInfo || {})) {
		graph.addNode(component.path, { type: "component" });
		addExistingModuleFiles(graph, component.path);
	}
	for (const component of Object.values(configInfo.componentInfo || {})) for (const dependencyPath of Object.values(component.usingComponents || {})) graph.addDependency(component.path, dependencyPath, "component");
	const pages = getPages();
	const addEntry = (page, packageRoot) => {
		graph.addNode(page.path, {
			type: "page",
			entry: true,
			packageRoot
		});
		addExistingModuleFiles(graph, page.path);
		graph.addDependency(page.path, "app", "app");
		for (const dependencyPath of Object.values(page.usingComponents || {})) graph.addDependency(page.path, dependencyPath, "component");
	};
	for (const page of pages.mainPages) addEntry(page, null);
	for (const [packageRoot, subPackage] of Object.entries(pages.subPages)) for (const page of subPackage.info) addEntry(page, packageRoot);
	return graph;
}
function collectSharedStyleScopeIds(usingComponents) {
	const result = [];
	const visited = /* @__PURE__ */ new Set();
	const visit = (componentPath) => {
		if (visited.has(componentPath)) return;
		visited.add(componentPath);
		const component = configInfo.componentInfo[componentPath];
		if (!component) return;
		if (component.styleIsolation === "shared") result.push(component.id);
		for (const childPath of Object.values(component.usingComponents || {})) visit(childPath);
	};
	for (const componentPath of Object.values(usingComponents || {})) visit(componentPath);
	return result;
}
function getAppStyleScopeId() {
	return uuid("app");
}
function isTemporaryTargetPath() {
	return pathInfo.temporaryTargetPath === true;
}
//#endregion
export { resolveAssetSourcePath as A, storeInfo as C, isCollectableImageAsset as D, hasCompileInfo as E, transformRpx as M, toMiniProgramModuleId as N, miniProgramBuiltinTags as O, DependencyGraph as P, runWithCompilerContext as S, getAbsolutePath as T, getWorkPath as _, getComponent as a, resetStoreInfo as b, getNpmResolver as c, getStyleExts as d, getTargetPath as f, getViewScriptTags as g, getViewScriptExts as h, getAppStyleScopeId as i, tagWhiteList as j, resetAssetCache as k, getPageConfigInfo as l, getTemplateExts as m, getAppId as n, getContentByPath as o, getTemplateDirectivePrefixes as p, getAppName as r, getDependencyGraph as s, getAppConfigInfo as t, getPages as u, isMiniGame as v, collectAssets as w, resolveAppAlias as x, isTemporaryTargetPath as y };
