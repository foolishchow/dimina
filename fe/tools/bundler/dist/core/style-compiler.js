import { A as resolveAssetSourcePath, D as isCollectableImageAsset, M as transformRpx, _ as getWorkPath, a as getComponent, b as resetStoreInfo, d as getStyleExts, f as getTargetPath, j as tagWhiteList, n as getAppId, o as getContentByPath, s as getDependencyGraph, w as collectAssets } from "../env-CPAAD5ub.js";
import { i as remapSourcemap, n as createLineSourcemap, t as concatSourcemap } from "../sourcemap-z1b9ZOu3.js";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMainThread, parentPort } from "node:worker_threads";
import fs from "node:fs";
import { compileStyle } from "@vue/compiler-sfc";
import { transform } from "esbuild";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
//#region src/core/style-compiler.js
var compileRes = /* @__PURE__ */ new Map();
var builtInTagNames = new Set(tagWhiteList);
var autoprefixerPlugin = autoprefixer({ overrideBrowserslist: ["cover 99.5%"] });
var cssnanoLoader;
var lessLoader;
var sassLoader;
function loadCssnano() {
	cssnanoLoader ||= import("cssnano").then((module) => module.default);
	return cssnanoLoader;
}
function loadLess() {
	lessLoader ||= import("less").then((module) => module.default);
	return lessLoader;
}
function loadSass() {
	sassLoader ||= import("sass");
	return sassLoader;
}
if (!isMainThread) parentPort.on("message", async ({ pages, storeInfo, sourcemap, compileConfig }) => {
	try {
		resetStoreInfo(storeInfo);
		const progress = {
			_completedTasks: 0,
			get completedTasks() {
				return this._completedTasks;
			},
			set completedTasks(value) {
				this._completedTasks = value;
				parentPort.postMessage({ completedTasks: this._completedTasks });
			}
		};
		const styleOptions = {
			sourcemap,
			minify: compileConfig?.minify !== false
		};
		await compileSS(pages.mainPages, null, progress, styleOptions);
		for (const [root, subPages] of Object.entries(pages.subPages)) await compileSS(subPages.info, root, progress, styleOptions);
		compileRes.clear();
		parentPort.postMessage({
			success: true,
			dependencyGraph: getDependencyGraph().toJSON()
		});
	} catch (error) {
		compileRes.clear();
		parentPort.postMessage({
			success: false,
			error: {
				message: error.message,
				stack: error.stack,
				name: error.name,
				file: error.file,
				line: error.line,
				column: error.column,
				stage: error.stage
			}
		});
	}
});
/**
*  编译样式文件
*/
async function compileSS(pages, root, progress, options = {}) {
	for (const page of pages) {
		const result = await buildCompileCss(page, /* @__PURE__ */ new Set(), options);
		let code = result.code;
		const filename = `${page.path.replace(/\//g, "_")}`;
		const outputDir = root ? `${getTargetPath()}/${root}` : `${getTargetPath()}/main`;
		if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
		if (options.sourcemap) {
			const mapFileName = `${filename}.css.map`;
			const map = JSON.parse(result.map);
			map.file = `${filename}.css`;
			code += `\n/*# sourceMappingURL=${mapFileName} */\n`;
			fs.writeFileSync(`${outputDir}/${mapFileName}`, JSON.stringify(map));
		}
		fs.writeFileSync(`${outputDir}/${filename}.css`, code);
		progress.completedTasks++;
	}
}
async function buildCompileCss(module, compiledPaths = /* @__PURE__ */ new Set(), options = {}) {
	const chunks = [];
	const pendingModules = [module];
	while (pendingModules.length > 0) {
		const currentModule = pendingModules.pop();
		const currentPath = currentModule.path || currentModule.absolutePath;
		if (compiledPaths.has(currentPath)) continue;
		compiledPaths.add(currentPath);
		const result = await enhanceCSS(currentModule, options);
		if (result.code) chunks.push(result);
		const graphDependencies = getDependencyGraph().getDirectDependencies(currentPath, "component");
		const componentPaths = graphDependencies.length > 0 ? graphDependencies : Object.values(currentModule.usingComponents || {});
		for (let index = componentPaths.length - 1; index >= 0; index--) {
			const componentModule = getComponent(componentPaths[index]);
			if (componentModule) pendingModules.push(componentModule);
		}
	}
	if (options.sourcemap) {
		const { code, sourcemap: map } = concatSourcemap(chunks);
		return {
			code,
			map
		};
	}
	return {
		code: chunks.map((chunk) => chunk.code).join(""),
		map: null
	};
}
function createExternalClassPlugin(moduleId) {
	const scopeAttribute = `data-v-${moduleId}`;
	const externalScopeAttribute = "data-dd-external-class-scope";
	const processedRules = /* @__PURE__ */ new WeakSet();
	const selectorProcessor = selectorParser((selectors) => {
		for (const selector of [...selectors.nodes]) {
			const boostedSelector = selector.clone();
			const scopeNodes = [];
			boostedSelector.walkAttributes((attribute) => {
				if (attribute.attribute === scopeAttribute) scopeNodes.push(attribute);
			});
			const targetScope = scopeNodes.at(-1);
			if (!targetScope) continue;
			targetScope.parent.insertAfter(targetScope, selectorParser.attribute({
				attribute: externalScopeAttribute,
				operator: "~=",
				quoteMark: "\"",
				value: scopeAttribute
			}));
			selectors.append(boostedSelector);
		}
	});
	return {
		postcssPlugin: "dimina-external-class",
		Rule(rule) {
			if (processedRules.has(rule) || !moduleId || !rule.selector.includes(`[${scopeAttribute}]`)) return;
			processedRules.add(rule);
			try {
				rule.selector = selectorProcessor.processSync(rule.selector);
			} catch (error) {
				throw rule.error(error.message, { plugin: "dimina-external-class" });
			}
		}
	};
}
function boostExternalClassSelectors(cssCode, moduleId) {
	if (!moduleId || !cssCode) return cssCode;
	return postcss([createExternalClassPlugin(moduleId)]).process(cssCode, { from: void 0 }).css;
}
function getStyleSourcePath(absolutePath) {
	const workPath = getWorkPath();
	if (absolutePath === workPath || absolutePath.startsWith(`${workPath}${path.sep}`)) return `/${path.relative(workPath, absolutePath).split(path.sep).join("/")}`;
	return absolutePath.split(path.sep).join("/");
}
function createStyleCompileError(stage, absolutePath, cause) {
	if (cause?.name === "StyleCompileError") return cause;
	const line = cause?.line ?? (Number.isInteger(cause?.span?.start?.line) ? cause.span.start.line + 1 : void 0);
	const column = cause?.column ?? (Number.isInteger(cause?.span?.start?.column) ? cause.span.start.column + 1 : void 0);
	const file = getStyleSourcePath(absolutePath);
	const location = line == null ? file : `${file}:${line}${column == null ? "" : `:${column}`}`;
	const reason = cause?.reason || cause?.sassMessage || cause?.message || String(cause);
	const error = new Error(`[style:${stage}] ${location} ${reason}`, { cause });
	error.name = "StyleCompileError";
	error.file = file;
	error.line = line;
	error.column = column;
	error.stage = stage;
	return error;
}
function normalizePreprocessorMap(inputMap, absolutePath, inputCSS) {
	const map = typeof inputMap === "string" ? JSON.parse(inputMap) : structuredClone(inputMap);
	const sourcePaths = map.sources.map((source) => {
		let resolvedPath = source;
		if (source.startsWith("file:")) resolvedPath = fileURLToPath(source);
		else if (!path.isAbsolute(source)) resolvedPath = path.resolve(path.dirname(absolutePath), source);
		return resolvedPath;
	});
	map.sources = sourcePaths.map(getStyleSourcePath);
	map.sourcesContent = map.sources.map((_, index) => {
		if (sourcePaths[index] === absolutePath) return inputCSS;
		return map.sourcesContent?.[index] ?? null;
	});
	return map;
}
function getPostcssMapOptions(sourcemap, prev) {
	if (!sourcemap) return false;
	return {
		inline: false,
		annotation: false,
		sourcesContent: true,
		prev
	};
}
function createStyleTransformPlugin(module, absolutePath, importResults, options) {
	const processedRules = /* @__PURE__ */ new WeakSet();
	const selectorProcessor = selectorParser((selectors) => {
		selectors.walkTags((tag) => {
			if (builtInTagNames.has(tag.value)) tag.value = `.dd-${tag.value}`;
		});
	});
	return {
		postcssPlugin: "dimina-style-transform",
		AtRule(node) {
			if (node.name !== "import") return;
			const importFullPath = resolveStyleImportPath(absolutePath, node.params.replace(/^['"]|['"]$/g, ""));
			node.remove();
			importResults.push(buildCompileCss({
				absolutePath: importFullPath,
				id: module.id,
				ownerPath: module.ownerPath || module.path
			}, /* @__PURE__ */ new Set(), options));
		},
		Rule(rule) {
			if (processedRules.has(rule)) return;
			processedRules.add(rule);
			if (rule.selector.includes("::v-deep")) rule.selector = rule.selector.replace(/::v-deep\s+(\S[^{]*)/g, ":deep($1)");
			if (rule.selector.includes(":host")) rule.selector = processHostSelector(rule.selector, module.id);
			try {
				rule.selector = selectorProcessor.processSync(rule.selector);
			} catch (error) {
				throw rule.error(error.message, { plugin: "dimina-style-transform" });
			}
		},
		Comment(comment) {
			comment.remove();
		},
		Declaration(declaration) {
			declaration.value = normalizeCssUrlValue(declaration.value, absolutePath, module.ownerPath || module.path);
			declaration.value = transformRpx(declaration.value);
		}
	};
}
async function enhanceCSS(module, options = {}) {
	const absolutePath = module.absolutePath ? module.absolutePath : getAbsolutePath(module.path);
	if (!absolutePath) return {
		code: "",
		map: null
	};
	const graphOwnerPath = module.ownerPath || module.path;
	if (graphOwnerPath) getDependencyGraph().addFile(graphOwnerPath, absolutePath, "style");
	const cacheKey = `${absolutePath}::${module.id || ""}::${options.sourcemap ? "map" : "plain"}`;
	const inputCSS = getContentByPath(absolutePath);
	if (!inputCSS) return {
		code: "",
		map: null
	};
	if (compileRes.has(cacheKey)) return compileRes.get(cacheKey);
	let processedCSS = normalizeRootStyleImports(inputCSS);
	let processedMap = options.sourcemap ? createLineSourcemap(processedCSS, getStyleSourcePath(absolutePath), inputCSS) : null;
	const ext = path.extname(absolutePath).toLowerCase();
	try {
		if (ext === ".less") {
			const result = await (await loadLess()).render(processedCSS, {
				filename: absolutePath,
				paths: [path.dirname(absolutePath), getWorkPath()],
				sourceMap: options.sourcemap ? {
					outputSourceFiles: true,
					disableSourcemapAnnotation: true
				} : void 0
			});
			processedCSS = result.css;
			if (options.sourcemap) processedMap = normalizePreprocessorMap(result.map, absolutePath, inputCSS);
		} else if (ext === ".scss" || ext === ".sass") {
			const result = (await loadSass()).compileString(processedCSS, {
				loadPaths: [path.dirname(absolutePath), getWorkPath()],
				syntax: ext === ".sass" ? "indented" : "scss",
				url: options.sourcemap ? pathToFileURL(absolutePath) : void 0,
				sourceMap: !!options.sourcemap,
				sourceMapIncludeSources: !!options.sourcemap
			});
			processedCSS = result.css;
			if (options.sourcemap) processedMap = normalizePreprocessorMap(result.sourceMap, absolutePath, inputCSS);
		}
	} catch (error) {
		throw createStyleCompileError("preprocess", absolutePath, error);
	}
	const fixedCSS = ensureImportSemicolons(processedCSS);
	if (options.sourcemap && fixedCSS !== processedCSS) {
		const normalizeMap = createLineSourcemap(fixedCSS, absolutePath, processedCSS);
		processedMap = remapSourcemap(normalizeMap, processedMap);
	}
	const importResults = [];
	const moduleId = module.id;
	let scopedResult;
	try {
		scopedResult = compileStyle({
			source: fixedCSS,
			filename: getStyleSourcePath(absolutePath),
			id: moduleId,
			scoped: !!moduleId,
			inMap: options.sourcemap ? processedMap : void 0,
			postcssPlugins: [createStyleTransformPlugin(module, absolutePath, importResults, options)]
		});
		if (scopedResult.errors.length > 0) throw scopedResult.errors[0];
	} catch (error) {
		throw createStyleCompileError(error?.plugin === "vue-sfc-vars" || error?.plugin === "vue-sfc-scoped" ? "scope" : "transform", absolutePath, error);
	}
	let finalResult;
	try {
		const postcssPlugins = [createExternalClassPlugin(moduleId), autoprefixerPlugin];
		const shouldMinify = options.minify !== false;
		if (options.sourcemap) {
			if (shouldMinify) {
				const cssnano = await loadCssnano();
				postcssPlugins.push(cssnano());
			}
			finalResult = await postcss(postcssPlugins).process(scopedResult.code, {
				from: void 0,
				map: getPostcssMapOptions(true, scopedResult.map)
			});
		} else {
			const prefixedResult = await postcss(postcssPlugins).process(scopedResult.code, { from: void 0 });
			if (shouldMinify) finalResult = {
				css: (await transform(prefixedResult.css, {
					loader: "css",
					minify: true
				})).code,
				map: null
			};
			else finalResult = {
				css: prefixedResult.css,
				map: null
			};
		}
	} catch (error) {
		throw createStyleCompileError(error?.plugin === "dimina-external-class" ? "external-class" : "postprocess", absolutePath, error);
	}
	const importedChunks = (await Promise.all(importResults)).filter((result) => result.code);
	let result;
	if (options.sourcemap) {
		const { code, sourcemap: map } = concatSourcemap([...importedChunks, {
			code: finalResult.css,
			map: finalResult.map.toString()
		}]);
		result = {
			code,
			map
		};
	} else result = {
		code: importedChunks.map((chunk) => chunk.code).join("") + finalResult.css,
		map: null
	};
	compileRes.set(cacheKey, result);
	return result;
}
function normalizeCssUrlValue(value, absolutePath, graphOwnerPath) {
	return value.replace(/url\(([^)]+)\)/g, (fullMatch, rawUrl) => {
		const cleanedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, "");
		if (!cleanedUrl || cleanedUrl.startsWith("data:image")) return fullMatch;
		if (cleanedUrl.startsWith("//")) return `url(https:${cleanedUrl})`;
		if (/^(https?:|blob:|data:)/.test(cleanedUrl)) return fullMatch;
		if (graphOwnerPath && isCollectableImageAsset(cleanedUrl)) getDependencyGraph().addFile(graphOwnerPath, resolveAssetSourcePath(getWorkPath(), absolutePath, cleanedUrl), "style");
		return `url(${collectAssets(getWorkPath(), absolutePath, cleanedUrl, getTargetPath(), getAppId())})`;
	});
}
function getAbsolutePath(modulePath) {
	const workPath = getWorkPath();
	const src = modulePath.startsWith("/") ? modulePath : `/${modulePath}`;
	for (const ssType of getStyleExts()) {
		const ssFullPath = `${workPath}${src}${ssType}`;
		if (fs.existsSync(ssFullPath)) return ssFullPath;
		const indexSsFullPath = `${workPath}${src}/index${ssType}`;
		if (fs.existsSync(indexSsFullPath)) return indexSsFullPath;
	}
}
function resolveStyleImportPath(absolutePath, importPath, workPath = getWorkPath()) {
	if (importPath.startsWith("/")) return path.join(workPath, importPath);
	return path.resolve(path.dirname(absolutePath), importPath);
}
function normalizeRootStyleImports(source, workPath = getWorkPath()) {
	return source.replace(/(@import\s+(?:\(.*?\)\s*)?(?:url\()?['"])(\/[^'")]+)(['"]\)?)/g, (_, prefix, importPath, suffix) => {
		return `${prefix}${path.join(workPath, importPath)}${suffix}`;
	});
}
/**
* Ensures that all @import statements in CSS end with semicolons
* @param {string} css - The CSS content to process
* @returns {string} - The processed CSS with semicolons added to @import statements as needed
*/
function ensureImportSemicolons(css) {
	return css.replace(/@import[^;\n]*$/gm, (match) => {
		return match.endsWith(";") ? match : `${match};`;
	});
}
/**
* 处理 :host 选择器，将其转换为适合组件根节点的选择器
* @param {string} selector - 包含 :host 的选择器
* @param {string} moduleId - 组件的模块ID
* @returns {string} - 转换后的选择器
*/
function processHostSelector(selector, moduleId) {
	const hostSelector = `[data-dd-style-host~="${moduleId}"]`;
	return selector.replace(/:host\(([^)]+)\)/g, `${hostSelector}$1`).replace(/:host(?![\w-])/g, hostSelector);
}
//#endregion
export { boostExternalClassSelectors, compileSS, ensureImportSemicolons, normalizeCssUrlValue, normalizeRootStyleImports, processHostSelector, resolveStyleImportPath };
