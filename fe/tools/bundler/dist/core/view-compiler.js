import { t as effectiveJsMinify } from "../compile-config-DrZAAJbg.js";
import { A as resolveAssetSourcePath, D as isCollectableImageAsset, M as transformRpx, N as toMiniProgramModuleId, T as getAbsolutePath, _ as getWorkPath, a as getComponent, b as resetStoreInfo, f as getTargetPath, g as getViewScriptTags, h as getViewScriptExts, j as tagWhiteList, m as getTemplateExts, n as getAppId, o as getContentByPath, s as getDependencyGraph, w as collectAssets } from "../env-CPAAD5ub.js";
import { i as takeCompatibilityWarnings, n as getTemplateDirectiveName, t as checkTemplateCompatibility } from "../compatibility-CjsV18qy.js";
import { i as remapSourcemap, n as createLineSourcemap, r as mergeSourcemap, t as concatSourcemap } from "../sourcemap-z1b9ZOu3.js";
import path from "node:path";
import { isMainThread, parentPort } from "node:worker_threads";
import fs from "node:fs";
import { parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import MagicString from "magic-string";
import { compileTemplate } from "@vue/compiler-sfc";
import * as cheerio from "cheerio";
import { transform } from "esbuild";
import * as htmlparser2 from "htmlparser2";
//#region src/common/expression-parser.js
/**
* 表达式解析器 - 使用 Oxc AST 解析器提取依赖
*/
var KEYWORDS = /* @__PURE__ */ new Set([
	"true",
	"false",
	"null",
	"undefined",
	"NaN",
	"Infinity",
	"this",
	"arguments",
	"Array",
	"Object",
	"String",
	"Number",
	"Boolean",
	"Math",
	"Date",
	"RegExp",
	"Error",
	"JSON",
	"console",
	"window",
	"document",
	"parseInt",
	"parseFloat",
	"isNaN",
	"isFinite",
	"encodeURI",
	"encodeURIComponent",
	"decodeURI",
	"decodeURIComponent"
]);
/**
* 提取表达式中的所有变量依赖路径
* 使用 Oxc AST 解析器进行精确分析
* @param {string} expression - 表达式字符串，如 "count || defaultValue" 或 "item.name"
* @returns {Array<string>} - 依赖的变量名数组，如 ["count", "defaultValue"] 或 ["item"]
*/
function extractDependencies(expression) {
	if (!expression || typeof expression !== "string") return [];
	const dependencies = /* @__PURE__ */ new Set();
	try {
		const code = `(${expression})`;
		const ast = parseSync("expression.js", code, {
			sourceType: "module",
			lang: "js"
		}).program;
		visitExpressionAst(ast, null, dependencies);
	} catch (error) {
		console.warn("[expression-parser] AST 解析失败，表达式:", expression, "错误:", error.message);
		return [];
	}
	return Array.from(dependencies);
}
function visitExpressionAst(node, parent, dependencies) {
	if (!node || typeof node !== "object") return;
	if (node.type === "Identifier") {
		collectIdentifier(node, parent, dependencies);
		return;
	}
	if (node.type === "MemberExpression") {
		let root = node.object;
		while (root?.type === "MemberExpression" || root?.type === "ChainExpression") root = root.type === "ChainExpression" ? root.expression : root.object;
		if (root?.type === "Identifier" && !KEYWORDS.has(root.name)) dependencies.add(root.name);
		return;
	}
	for (const [key, value] of Object.entries(node)) {
		if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
		if (Array.isArray(value)) for (const child of value) visitExpressionAst(child, node, dependencies);
		else visitExpressionAst(value, node, dependencies);
	}
}
function collectIdentifier(node, parent, dependencies) {
	const name = node.name;
	if (KEYWORDS.has(name)) return;
	if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return;
	if (parent?.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return;
	dependencies.add(name);
}
/**
* 解析表达式并生成依赖路径信息
* @param {string} expression - 表达式字符串
* @returns {Object} - { expression: 原始表达式, dependencies: 依赖数组, isSimple: 是否简单绑定 }
*/
function parseExpression(expression) {
	if (!expression || typeof expression !== "string") return {
		expression: "",
		dependencies: [],
		isSimple: true
	};
	const dependencies = extractDependencies(expression);
	const isSimple = dependencies.length === 1 && expression.trim() === dependencies[0];
	return {
		expression: expression.trim(),
		dependencies,
		isSimple
	};
}
/**
* 批量解析多个属性绑定表达式
* @param {Object} bindings - 绑定对象，如 { count2: "count", value: "item.name" }
* @returns {Object} - 解析后的绑定信息
*/
function parseBindings(bindings) {
	if (!bindings || typeof bindings !== "object") return {};
	const parsed = {};
	for (const [propName, expression] of Object.entries(bindings)) parsed[propName] = parseExpression(expression);
	return parsed;
}
//#endregion
//#region src/core/view-compiler.js
/**
* 根据扩展名列表生成匹配尾部扩展名的正则，如 ['.wxs', '.qds'] -> /(\.wxs|\.qds)$/
*/
function buildExtStripRegex(exts) {
	const alt = exts.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
	return new RegExp(`(${alt})$`);
}
/**
* 移除视图脚本文件路径末尾的扩展名，支持 .wxs 和自定义扩展名
*/
function stripViewScriptExt(p) {
	return p.replace(buildExtStripRegex(getViewScriptExts()), "");
}
/**
* 解析 JavaScript 代码
* @param {string} code
* @param {string} filename
* @param {'module'|'script'} sourceType
* @returns {*} Oxc Program AST
*/
function parseJs(code, filename = "view-compiler.js", sourceType = "module") {
	return parseSync(filename, code, {
		sourceType,
		lang: "js"
	}).program;
}
/**
* 如果顶层是单个表达式语句，则只返回表达式源码
* @param {string} code
* @param {*} ast - Oxc Program AST
* @returns {string} Program code or the source of the single top-level expression.
*/
function getProgramCode(code, ast) {
	const statement = ast.body?.[0];
	if (ast.body?.length === 1 && statement?.type === "ExpressionStatement") return code.slice(statement.expression.start, statement.expression.end);
	return code;
}
function isStringLiteral(node) {
	return node?.type === "StringLiteral" || node?.type === "Literal" && typeof node.value === "string";
}
function getStringLiteralRawValue(node) {
	if (!isStringLiteral(node)) return "";
	if (typeof node.raw === "string") return node.raw.slice(1, -1);
	return String(node.value);
}
function getSource(code, node) {
	return code.slice(node.start, node.end);
}
function applyCodeReplacements(source, replacements) {
	if (replacements.length === 0) return source;
	const selected = [];
	const byLargestRange = [...replacements].sort((a, b) => {
		return b.end - b.start - (a.end - a.start) || b.start - a.start;
	});
	for (const replacement of byLargestRange) if (!selected.some((item) => replacement.start < item.end && item.start < replacement.end)) selected.push(replacement);
	const s = new MagicString(source);
	for (const replacement of selected.sort((a, b) => b.start - a.start)) if (replacement.type === "insert") s.appendLeft(replacement.start, replacement.value);
	else s.overwrite(replacement.start, replacement.end, replacement.value);
	return s.toString();
}
/**
* 为模板表达式中的成员访问补充空值保护，避免生成的 render 函数直接访问 null/undefined 属性
* 例如: stickyProps.zIndex -> stickyProps?.zIndex
* @param {string} expression
* @returns {string} 添加了可选链操作符的表达式字符串
*/
var optionalChainingCache = /* @__PURE__ */ new Map();
function addOptionalChaining(expression) {
	if (!expression || typeof expression !== "string") return expression;
	const cached = optionalChainingCache.get(expression);
	if (cached !== void 0) return cached;
	try {
		const code = `(${expression})`;
		const ast = parseJs(code);
		const insertions = [];
		walk(ast, { enter(node) {
			if (node.type !== "MemberExpression" || node.optional) return;
			if (node.computed) {
				const bracketIndex = code.lastIndexOf("[", node.property.start);
				if (bracketIndex >= 0) insertions.push({
					type: "insert",
					start: bracketIndex,
					end: bracketIndex,
					value: "?."
				});
			} else {
				const dotIndex = code.lastIndexOf(".", node.property.start);
				if (dotIndex >= 0) insertions.push({
					type: "insert",
					start: dotIndex,
					end: dotIndex,
					value: "?"
				});
			}
		} });
		const result = applyCodeReplacements(code, insertions).slice(1, -1);
		optionalChainingCache.set(expression, result);
		return result;
	} catch (error) {
		optionalChainingCache.set(expression, expression);
		return expression;
	}
}
function parseSafeBraceExp(exp) {
	return addOptionalChaining(parseBraceExp(exp));
}
function transformTextInterpolation(text) {
	if (!text || typeof text !== "string" || !isWrappedByBraces(text)) return text;
	return text.replace(braceRegex, (match, bracePart) => {
		if (!bracePart) return match;
		const matchResult = bracePart.match(noBraceRegex);
		if (!matchResult) return match;
		return `{{${addOptionalChaining(matchResult[1].trim())}}}`;
	});
}
var compileResCache = /* @__PURE__ */ new Map();
var templateRenderCache = /* @__PURE__ */ new Map();
var wxsModuleRegistry = /* @__PURE__ */ new Set();
var wxsFilePathMap = /* @__PURE__ */ new Map();
var wxsScannedWorkPath = null;
var enableSourcemap = false;
/** @type {{ minify: boolean, sourcemap: boolean, esTarget: { logic: string, view: string } }} */
var activeCompileConfig = {
	minify: true,
	sourcemap: false,
	esTarget: {
		logic: "es2023",
		view: "es2020"
	}
};
if (!isMainThread) parentPort.on("message", async ({ pages, storeInfo, sourcemap, compileConfig }) => {
	try {
		resetStoreInfo(storeInfo);
		enableSourcemap = !!sourcemap;
		activeCompileConfig = {
			minify: compileConfig?.minify !== false,
			sourcemap: !!sourcemap,
			esTarget: {
				logic: compileConfig?.esTarget?.logic || "es2023",
				view: compileConfig?.esTarget?.view || "es2020"
			}
		};
		wxsScannedWorkPath = null;
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
		await compileML(pages.mainPages, null, progress);
		for (const [root, subPages] of Object.entries(pages.subPages)) await compileML(subPages.info, root, progress);
		compileResCache.clear();
		templateRenderCache.clear();
		wxsModuleRegistry.clear();
		wxsFilePathMap.clear();
		wxsScannedWorkPath = null;
		optionalChainingCache.clear();
		parentPort.postMessage({
			success: true,
			compatibilityWarnings: takeCompatibilityWarnings(),
			dependencyGraph: getDependencyGraph().toJSON()
		});
	} catch (error) {
		compileResCache.clear();
		templateRenderCache.clear();
		wxsModuleRegistry.clear();
		wxsFilePathMap.clear();
		wxsScannedWorkPath = null;
		optionalChainingCache.clear();
		parentPort.postMessage({
			success: false,
			error: {
				message: error.message,
				stack: error.stack,
				name: error.name
			}
		});
	}
});
/**
* 编译页面视图文件
*/
async function compileML(pages, root, progress) {
	const workPath = getWorkPath();
	if (wxsScannedWorkPath !== workPath) {
		initWxsFilePathMap(workPath);
		wxsScannedWorkPath = workPath;
	}
	for (const page of pages) {
		const scriptRes = /* @__PURE__ */ new Map();
		const sourceMapRes = /* @__PURE__ */ new Map();
		buildCompileView(page, false, scriptRes, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), sourceMapRes);
		const filename = `${page.path.replace(/\//g, "_")}`;
		const outputDir = root ? `${getTargetPath()}/${root}` : `${getTargetPath()}/main`;
		if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
		if (enableSourcemap) {
			const compileRes = [...scriptRes.entries()].map(([modulePath, code]) => ({
				path: modulePath,
				code,
				map: sourceMapRes.get(modulePath)
			}));
			const sourcemapFileName = `${filename}.js.map`;
			const { bundleCode, sourcemap } = mergeSourcemap(compileRes, `${filename}.js`);
			fs.writeFileSync(`${outputDir}/${filename}.js`, `${bundleCode}//# sourceMappingURL=${sourcemapFileName}\n`);
			fs.writeFileSync(`${outputDir}/${sourcemapFileName}`, sourcemap);
		} else {
			const moduleRanges = [];
			let bundleSource = "";
			let nextLine = 1;
			for (const [key, value] of scriptRes.entries()) {
				const amdFormat = `modDefine('${key}', function(require, module, exports) {
			${value}
			});\n`;
				const lineCount = amdFormat.split("\n").length;
				moduleRanges.push({
					key,
					startLine: nextLine,
					endLine: nextLine + lineCount - 2
				});
				bundleSource += amdFormat;
				nextLine += lineCount - 1;
			}
			let mergeRender = "";
			try {
				if (effectiveJsMinify(activeCompileConfig)) {
					const { code: minifiedCode } = await transform(bundleSource, {
						minify: true,
						target: [activeCompileConfig.esTarget.view],
						platform: "browser"
					});
					mergeRender = minifiedCode;
				} else {
					const { code } = await transform(bundleSource, {
						minify: false,
						target: [activeCompileConfig.esTarget.view],
						platform: "browser"
					});
					mergeRender = code;
				}
			} catch (error) {
				const location = error.errors?.[0]?.location;
				const sourceLines = bundleSource.split("\n");
				const sourceHint = location?.line ? sourceLines.slice(Math.max(0, location.line - 3), location.line + 2).map((line, index) => `${Math.max(1, location.line - 2) + index}: ${line.trim()}`).join("\n") : "";
				error.message = `视图模块 ${moduleRanges.find((range) => location?.line >= range.startLine && location.line <= range.endLine)?.key || "bundle"} 转换失败: ${error.message}${sourceHint ? `\n${sourceHint}` : ""}`;
				throw error;
			}
			fs.writeFileSync(`${outputDir}/${filename}.js`, mergeRender);
		}
		scriptRes.clear();
		sourceMapRes.clear();
		progress.completedTasks++;
	}
}
/**
* 初始化 wxs 文件路径映射
* @param {string} workPath - 工作路径
*/
function initWxsFilePathMap(workPath) {
	wxsFilePathMap.clear();
	const npmDir = path.join(workPath, "miniprogram_npm");
	if (fs.existsSync(npmDir)) scanWxsFiles(npmDir, workPath);
}
/**
* 递归扫描目录下的所有 wxs 文件
* @param {string} dir - 目录路径
* @param {string} workPath - 工作路径
*/
function scanWxsFiles(dir, workPath) {
	try {
		const items = fs.readdirSync(dir);
		for (const item of items) {
			const fullPath = path.join(dir, item);
			const stat = fs.statSync(fullPath);
			if (stat.isDirectory()) scanWxsFiles(fullPath, workPath);
			else if (stat.isFile() && getViewScriptExts().some((ext) => item.endsWith(ext))) {
				const moduleName = stripViewScriptExt(fullPath.replace(workPath, "")).replace(/[\/\\@\-]/g, "_").replace(/^_/, "");
				wxsFilePathMap.set(moduleName, fullPath);
			}
		}
	} catch (error) {}
}
/**
* 注册 wxs 模块
* @param {string} modulePath - 模块路径
*/
function registerWxsModule(modulePath) {
	wxsModuleRegistry.add(modulePath);
}
function getTemplateCompilerOptions(scopeId) {
	return {
		prefixIdentifiers: true,
		hoistStatic: false,
		cacheHandlers: true,
		scopeId,
		mode: "function",
		inline: true,
		isCustomElement: (tag) => !tag.startsWith("dd-")
	};
}
/**
* 编译单个模板模块（<template name>）的 render 结果，并跨页面复用。
* 被多个页面 import 的同一份模板文件在每个页面里会产出完全相同的
* compileTemplate codegen 与 insertWxsToRenderResult 结果，只需计算一次。
* moduleId 不入 key：function 模式下 scopeId 不进入产物（见 templateRenderCache 处说明）。
*/
function compileTemplateModuleRender(tm, moduleId, scriptModule, scriptRes) {
	const scriptSig = scriptModule.map((sm) => `${sm.path}\u0000${sm.originalName ?? ""}`).join("");
	const sourceSig = tm.sourceInfo ? `${tm.sourceInfo.path}\u0000${tm.sourceInfo.startLine ?? ""}` : "";
	const cacheKey = `${tm.path}\u0002${sourceSig}\u0002${scriptSig}\u0002${tm.tpl}`;
	const cached = templateRenderCache.get(cacheKey);
	if (cached) {
		for (const sm of scriptModule) if (!scriptRes.has(sm.path)) scriptRes.set(sm.path, sm.code);
		return cached;
	}
	const compiledTemplate = compileTemplate({
		source: tm.tpl,
		filename: tm.path,
		id: `data-v-${moduleId}`,
		scoped: true,
		inMap: enableSourcemap && tm.sourceInfo ? createLineSourcemap(tm.tpl, tm.sourceInfo.path, tm.sourceInfo.content, tm.sourceInfo.startLine) : void 0,
		compilerOptions: getTemplateCompilerOptions(`data-v-${moduleId}`)
	});
	const result = {
		path: tm.path,
		...insertWxsToRenderResult(compiledTemplate.code, scriptModule, scriptRes, tm.path, compiledTemplate.map)
	};
	templateRenderCache.set(cacheKey, result);
	return result;
}
/**
* 检查是否为已注册的 wxs 模块
* @param {string} modulePath - 模块路径
* @returns {boolean} wxs 模块是否已注册
*/
function isRegisteredWxsModule(modulePath) {
	return wxsModuleRegistry.has(modulePath);
}
function buildCompileView(module, isComponent = false, scriptRes, activePaths = /* @__PURE__ */ new Set(), inheritedTemplatePaths = /* @__PURE__ */ new Set(), sourceMapRes = /* @__PURE__ */ new Map()) {
	const currentPath = module.path;
	if (activePaths.has(currentPath)) return;
	activePaths.add(currentPath);
	const allScriptModules = [];
	const currentInstruction = compileModule(module, isComponent, scriptRes, {
		skipTemplatePaths: isComponent ? inheritedTemplatePaths : /* @__PURE__ */ new Set(),
		sourceMapRes
	});
	if (currentInstruction && currentInstruction.scriptModule) allScriptModules.push(...currentInstruction.scriptModule);
	const childInheritedTemplatePaths = new Set(inheritedTemplatePaths);
	for (const tm of currentInstruction?.templateModule || []) childInheritedTemplatePaths.add(tm.path);
	if (module.usingComponents) {
		const graphDependencies = getDependencyGraph().getDirectDependencies(module.path, "component");
		const componentDependencies = graphDependencies.length > 0 ? graphDependencies : Object.values(module.usingComponents);
		for (const componentInfo of componentDependencies) {
			const componentModule = getComponent(componentInfo);
			if (!componentModule) continue;
			if (componentModule.path === module.path) continue;
			const componentInstruction = buildCompileView(componentModule, true, scriptRes, activePaths, childInheritedTemplatePaths, sourceMapRes);
			if (componentInstruction && componentInstruction.scriptModule) {
				for (const sm of componentInstruction.scriptModule) if (!allScriptModules.find((existing) => existing.path === sm.path)) allScriptModules.push(sm);
			}
		}
	}
	if (!isComponent && allScriptModules.length > 0) {
		for (const sm of allScriptModules) if (!scriptRes.has(sm.path)) scriptRes.set(sm.path, sm.code);
		compileModuleWithAllWxs(module, scriptRes, allScriptModules, sourceMapRes);
	}
	activePaths.delete(currentPath);
	return {
		scriptModule: allScriptModules,
		templateModule: currentInstruction?.templateModule || []
	};
}
/**
* 编译页面及自定义组件，自定义组件可认为是特殊的页面
* https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/
* @param {*} module
*/
function compileModule(module, isComponent, scriptRes, options = {}) {
	const skipTemplatePaths = options.skipTemplatePaths || /* @__PURE__ */ new Set();
	const sourceMapRes = options.sourceMapRes || /* @__PURE__ */ new Map();
	const { tpl, instruction, sourceInfo } = toCompileTemplate(isComponent, module.path, module.usingComponents, module.componentPlaceholder);
	if (!tpl) return null;
	const templateModule = instruction.templateModule || [];
	const templateModuleForCompile = templateModule.filter((tm) => !skipTemplatePaths.has(tm.path));
	const compileInstruction = {
		...instruction,
		templateModule: templateModuleForCompile
	};
	let useCache = false;
	let cachedCode = null;
	const canUseCache = skipTemplatePaths.size === 0;
	if (canUseCache && !scriptRes.has(module.path) && compileResCache.has(module.path)) {
		const cacheData = compileResCache.get(module.path);
		if (cacheData && typeof cacheData === "object" && cacheData.code && cacheData.instruction) {
			cachedCode = cacheData.code;
			useCache = true;
			for (const sm of cacheData.instruction.scriptModule) if (!scriptRes.has(sm.path)) scriptRes.set(sm.path, sm.code);
		} else if (typeof cacheData === "string") {
			cachedCode = cacheData;
			useCache = true;
		}
	}
	if (useCache && cachedCode) {
		scriptRes.set(module.path, cachedCode);
		const cachedMap = compileResCache.get(module.path)?.map;
		if (enableSourcemap && cachedMap) sourceMapRes.set(module.path, cachedMap);
		const allWxsModules = collectAllWxsModules(scriptRes, /* @__PURE__ */ new Set(), instruction.scriptModule || []);
		if (allWxsModules.length > 0) {
			const mergedModules = [...instruction.scriptModule || []];
			for (const wxsModule of allWxsModules) if (!mergedModules.find((existing) => existing.path === wxsModule.path)) mergedModules.push(wxsModule);
			instruction.scriptModule = mergedModules;
		}
		return {
			...instruction,
			scriptModule: allWxsModules
		};
	}
	const processedTpl = tpl.replace(/\bthis\./g, "_ctx.");
	const tplCode = compileTemplate({
		source: processedTpl,
		filename: module.path,
		id: `data-v-${module.id}`,
		scoped: true,
		inMap: enableSourcemap ? createLineSourcemap(processedTpl, sourceInfo.path, sourceInfo.content) : void 0,
		compilerOptions: getTemplateCompilerOptions(`data-v-${module.id}`)
	});
	const templateResults = [];
	for (const tm of compileInstruction.templateModule) templateResults.push(compileTemplateModuleRender(tm, module.id, compileInstruction.scriptModule, scriptRes));
	const renderResult = insertWxsToRenderResult(tplCode.code, compileInstruction.scriptModule, scriptRes, module.path, tplCode.map);
	const moduleChunks = [
		`Module({
		path: '${module.path}',
		id: '${module.id}',
		appStyleScopeId: ${JSON.stringify(module.appStyleScopeId || null)},
		sharedStyleScopeIds: ${JSON.stringify(module.sharedStyleScopeIds || [])},
		styleIsolation: ${JSON.stringify(module.styleIsolation || "isolated")},
		render: `,
		renderResult,
		`,
		usingComponents: ${JSON.stringify(module.usingComponents)},
		componentPlaceholder: ${JSON.stringify(module.componentPlaceholder || {})},
		customTabBar: ${JSON.stringify(module.customTabBar || null)},
		tplComponents: {`
	];
	for (const templateResult of templateResults) moduleChunks.push(`'${templateResult.path}':`, templateResult, ",");
	moduleChunks.push("},\n		});");
	const { code, sourcemap: moduleMap } = concatSourcemap(moduleChunks, module.path);
	const allWxsModules = collectAllWxsModules(scriptRes, /* @__PURE__ */ new Set(), compileInstruction.scriptModule || []);
	if (allWxsModules.length > 0) {
		const mergedModules = [...compileInstruction.scriptModule || []];
		for (const wxsModule of allWxsModules) if (!mergedModules.find((existing) => existing.path === wxsModule.path)) mergedModules.push(wxsModule);
		compileInstruction.scriptModule = mergedModules;
	}
	const cacheData = {
		code,
		instruction: compileInstruction,
		map: enableSourcemap ? moduleMap : null
	};
	if (canUseCache) compileResCache.set(module.path, cacheData);
	scriptRes.set(module.path, code);
	if (enableSourcemap) sourceMapRes.set(module.path, moduleMap);
	return {
		...compileInstruction,
		templateModule
	};
}
/**
* 处理 wxs 内容，包括注入全局方法、转换 constructor、处理 require 等
* @param {string} wxsContent - wxs 代码内容
* @param {string} wxsFilePath - wxs 文件路径（用于处理 require）
* @param {Array} scriptModule - 脚本模块数组
* @param {string} workPath - 工作路径
* @param {string} filePath - 当前处理的文件路径
* @returns {string} 处理后的 wxs 代码
*/
function processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath = filePath) {
	if (wxsFilePath && graphOwnerPath) getDependencyGraph().addFile(graphOwnerPath, wxsFilePath, "view");
	let wxsAst;
	try {
		wxsAst = parseJs(wxsContent, wxsFilePath || "inline.wxs", "script");
	} catch (error) {
		console.error(`[view] 解析 wxs 文件失败: ${wxsFilePath}`, error.message);
		return wxsContent;
	}
	const replacements = [];
	walk(wxsAst, { enter(node) {
		if (node.type === "CallExpression") {
			const calleeName = node.callee?.name;
			if (calleeName === "getRegExp") {
				const args = node.arguments;
				if (args.length > 0) {
					if (isStringLiteral(args[0]) && (!args[1] || isStringLiteral(args[1]))) {
						const pattern = getStringLiteralRawValue(args[0]);
						const flags = args.length > 1 ? getStringLiteralRawValue(args[1]) : "";
						replacements.push({
							start: node.start,
							end: node.end,
							value: `/${pattern}/${flags}`
						});
					} else {
						const newRegExpArgs = args.map((arg) => getSource(wxsContent, arg)).join(", ");
						replacements.push({
							start: node.start,
							end: node.end,
							value: `new RegExp(${newRegExpArgs})`
						});
					}
				}
			} else if (calleeName === "getDate") {
				const args = node.arguments.map((arg) => getSource(wxsContent, arg)).join(", ");
				replacements.push({
					start: node.start,
					end: node.end,
					value: `new Date(${args})`
				});
			} else if (calleeName === "require" && node.arguments.length > 0 && wxsFilePath) {
				const requirePath = node.arguments[0].value;
				if (requirePath && typeof requirePath === "string") {
					let resolvedWxsPath;
					if (filePath && filePath.includes("/miniprogram_npm/")) {
						const currentWxsDir = path.dirname(wxsFilePath);
						resolvedWxsPath = path.resolve(currentWxsDir, requirePath);
						const moduleName = stripViewScriptExt(resolvedWxsPath.replace(workPath, "")).replace(/[\/\\@\-]/g, "_").replace(/^_/, "");
						processWxsDependency(resolvedWxsPath, moduleName, scriptModule, workPath, filePath, graphOwnerPath);
						replacements.push({
							start: node.arguments[0].start,
							end: node.arguments[0].end,
							value: JSON.stringify(moduleName)
						});
					} else {
						const currentWxsDir = path.dirname(wxsFilePath);
						resolvedWxsPath = path.resolve(currentWxsDir, requirePath);
						const depModuleName = stripViewScriptExt(resolvedWxsPath.replace(workPath, "")).replace(/[\/\\@\-]/g, "_").replace(/^_/, "");
						processWxsDependency(resolvedWxsPath, depModuleName, scriptModule, workPath, filePath, graphOwnerPath);
						replacements.push({
							start: node.arguments[0].start,
							end: node.arguments[0].end,
							value: JSON.stringify(depModuleName)
						});
					}
				}
			}
		}
		if (node.type === "MemberExpression") {
			if (node.property?.name === "constructor" && !node.computed) {
				const objectCode = getSource(wxsContent, node.object);
				replacements.push({
					start: node.start,
					end: node.end,
					value: `Object.prototype.toString.call(${objectCode}).slice(8, -1)`
				});
			}
		}
	} });
	return applyCodeReplacements(wxsContent, replacements);
}
/**
* 通过代码内容判断是否为 wxs 模块
* @param {string} moduleCode - 模块代码
* @param {string} modulePath - 模块路径（可选，用于路径判断）
* @returns {boolean} 是否为 wxs 模块
*/
function isWxsModuleByContent(moduleCode, modulePath = "") {
	if (!moduleCode || typeof moduleCode !== "string") return false;
	if (modulePath && isRegisteredWxsModule(modulePath)) return true;
	return false;
}
function processWxsDependency(wxsFilePath, moduleName, scriptModule, workPath, filePath, graphOwnerPath = filePath) {
	if (!fs.existsSync(wxsFilePath)) {
		console.warn(`[view] wxs 依赖文件不存在: ${wxsFilePath}`);
		return;
	}
	if (scriptModule.find((sm) => sm.path === moduleName)) return;
	const wxsContent = getContentByPath(wxsFilePath).trim();
	if (!wxsContent) return;
	const wxsCode = processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath);
	registerWxsModule(moduleName);
	scriptModule.push({
		path: moduleName,
		code: wxsCode
	});
}
/**
* 重新编译模块，包含所有收集到的 wxs 模块
* @param {*} module
* @param {*} scriptRes
* @param {*} allScriptModules
*/
function compileModuleWithAllWxs(module, scriptRes, allScriptModules, sourceMapRes = /* @__PURE__ */ new Map()) {
	const { tpl, instruction, sourceInfo } = toCompileTemplate(false, module.path, module.usingComponents, module.componentPlaceholder);
	if (!tpl) return;
	const mergedInstruction = {
		...instruction,
		scriptModule: allScriptModules
	};
	const processedTpl = tpl.replace(/\bthis\./g, "_ctx.");
	const tplCode = compileTemplate({
		source: processedTpl,
		filename: module.path,
		id: `data-v-${module.id}`,
		scoped: true,
		inMap: enableSourcemap ? createLineSourcemap(processedTpl, sourceInfo.path, sourceInfo.content) : void 0,
		compilerOptions: getTemplateCompilerOptions(`data-v-${module.id}`)
	});
	const templateResults = [];
	for (const tm of mergedInstruction.templateModule) templateResults.push(compileTemplateModuleRender(tm, module.id, allScriptModules, scriptRes));
	const renderResult = insertWxsToRenderResult(tplCode.code, allScriptModules, scriptRes, module.path, tplCode.map);
	const moduleChunks = [
		`Module({
		path: '${module.path}',
		id: '${module.id}',
		appStyleScopeId: ${JSON.stringify(module.appStyleScopeId || null)},
		sharedStyleScopeIds: ${JSON.stringify(module.sharedStyleScopeIds || [])},
		styleIsolation: ${JSON.stringify(module.styleIsolation || "isolated")},
		render: `,
		renderResult,
		`,
		usingComponents: ${JSON.stringify(module.usingComponents)},
		componentPlaceholder: ${JSON.stringify(module.componentPlaceholder || {})},
		customTabBar: ${JSON.stringify(module.customTabBar || null)},
		tplComponents: {`
	];
	for (const templateResult of templateResults) moduleChunks.push(`'${templateResult.path}':`, templateResult, ",");
	moduleChunks.push("},\n		});");
	const { code, sourcemap: moduleMap } = concatSourcemap(moduleChunks, module.path);
	const cacheData = {
		code,
		instruction: mergedInstruction,
		map: enableSourcemap ? moduleMap : null
	};
	compileResCache.set(module.path, cacheData);
	scriptRes.set(module.path, code);
	if (enableSourcemap) sourceMapRes.set(module.path, moduleMap);
}
/**
* 处理 include 节点的条件属性，并返回处理后的内容
* @param {Object} $ - cheerio 实例
* @param {Object} elem - include 元素
* @param {string} includeContent - 要包含的内容
* @returns {string} 处理后的 HTML 字符串
*/
function processIncludeConditionalAttrs($, elem, includeContent) {
	const allAttrs = $(elem).attr();
	const conditionAttrs = {};
	let hasCondition = false;
	for (const attrName in allAttrs) if ([
		"if",
		"elif",
		"else"
	].includes(getTemplateDirectiveName(attrName))) {
		conditionAttrs[attrName] = allAttrs[attrName];
		hasCondition = true;
	}
	if (hasCondition) {
		let blockAttrs = "";
		for (const attrName in conditionAttrs) {
			const attrValue = conditionAttrs[attrName];
			if (attrValue !== void 0 && attrValue !== "") blockAttrs += ` ${attrName}="${attrValue}"`;
			else blockAttrs += ` ${attrName}`;
		}
		return `<block${blockAttrs}>${includeContent}</block>`;
	} else return includeContent;
}
/**
* 递归处理被引入文件中的组件 wxs 依赖
* @param {Set<string>} componentTags 被引入文件中使用的组件标签
* @param {*} includePath 被引入文件的路径
* @param {*} scriptModule 用于收集 wxs 模块的数组
* @param {*} components 当前可用的组件映射
* @param {Set} processedPaths 已处理的路径集合，防止循环引用和栈溢出
*/
function processIncludedFileWxsDependencies(componentTags, includePath, scriptModule, components, processedPaths = /* @__PURE__ */ new Set()) {
	if (processedPaths.has(includePath)) return;
	processedPaths.add(includePath);
	for (const tagName of componentTags) {
		const componentPath = components[tagName];
		const componentModule = getComponent(componentPath);
		if (componentModule) {
			if (processedPaths.has(componentModule.path)) continue;
			const componentTemplate = toCompileTemplate(true, componentModule.path, componentModule.usingComponents, componentModule.componentPlaceholder, processedPaths);
			if (componentTemplate && componentTemplate.instruction && componentTemplate.instruction.scriptModule) {
				for (const sm of componentTemplate.instruction.scriptModule) if (!scriptModule.find((existing) => existing.path === sm.path)) scriptModule.push(sm);
			}
		}
	}
}
function collectIncludedComponentTags($, components) {
	const componentTags = /* @__PURE__ */ new Set();
	if (!components) return componentTags;
	$("*").each((_, elem) => {
		if (components[elem.tagName]) componentTags.add(elem.tagName);
	});
	return componentTags;
}
/**
* 转换成底层框架模板
* @param {*} isComponent
* @param {*} path
* @param {*} components
* @param {*} componentPlaceholder
* @param {Set} processedPaths 已处理的路径集合,防止循环引用和栈溢出
*/
function toCompileTemplate(isComponent, path, components, componentPlaceholder, processedPaths = /* @__PURE__ */ new Set()) {
	const workPath = getWorkPath();
	const fullPath = getViewPath(workPath, path);
	if (!fullPath) return { tpl: void 0 };
	getDependencyGraph().addFile(path, fullPath, "view");
	const sourcePath = toMiniProgramModuleId(fullPath, workPath).replace(buildExtStripRegex(getTemplateExts()), "");
	const diagnosticSource = fullPath.startsWith(workPath) ? fullPath.slice(workPath.length) : path;
	const originalContent = getContentByPath(fullPath);
	let content = originalContent;
	if (!content.trim()) content = "<block></block>";
	else {
		checkTemplateCompatibility(content, diagnosticSource, components);
		if (isComponent) content = `<component-host name="${path}">${content}</component-host>`;
	}
	const templateModule = [];
	const scriptModule = [];
	const $ = cheerio.load(content, {
		xmlMode: true,
		decodeEntities: false,
		_useHtmlParser2: true,
		lowerCaseTags: false,
		lowerCaseAttributeNames: false,
		withStartIndices: true,
		withEndIndices: true
	});
	if (!isComponent && originalContent.trim()) {
		const root = $.root();
		if (root.children().length > 1) {
			const wrapper = $("<view></view>");
			wrapper.append(root.contents());
			root.append(wrapper);
		}
	}
	$("include").each((_, elem) => {
		const src = $(elem).attr("src");
		if (src) {
			const includeFullPath = resolveTemplateDependencyPath(workPath, sourcePath, src);
			getDependencyGraph().addFile(path, includeFullPath, "view");
			let includePath = includeFullPath.replace(workPath, "").replace(buildExtStripRegex(getTemplateExts()), "");
			const includeDiagnosticSource = includeFullPath.startsWith(workPath) ? includeFullPath.slice(workPath.length) : includePath;
			if (!includePath.startsWith("/")) includePath = "/" + includePath;
			const includeContent = getContentByPath(includeFullPath);
			if (includeContent.trim()) {
				checkTemplateCompatibility(includeContent, includeDiagnosticSource, components);
				const $includeContent = cheerio.load(includeContent, {
					xmlMode: true,
					decodeEntities: false,
					_useHtmlParser2: true,
					withStartIndices: true,
					withEndIndices: true
				});
				const componentTags = collectIncludedComponentTags($includeContent, components);
				transTagTemplate($includeContent, templateModule, includePath, components, componentPlaceholder, {
					path: includeDiagnosticSource,
					content: includeContent
				}, path);
				transTagWxs($includeContent, scriptModule, includePath, path);
				processIncludedFileWxsDependencies(componentTags, includePath, scriptModule, components, processedPaths);
				$includeContent("template").remove();
				$includeContent(getViewScriptTags().join(",")).remove();
				const processedContent = processIncludeConditionalAttrs($, elem, $includeContent.html());
				$(elem).replaceWith(processedContent);
			} else $(elem).remove();
		} else $(elem).remove();
	});
	transTagTemplate($, templateModule, sourcePath, components, componentPlaceholder, {
		path: diagnosticSource,
		content: originalContent
	}, path);
	transTagWxs($, scriptModule, sourcePath, path);
	const importNodes = $("import");
	importNodes.each((_, elem) => {
		const src = $(elem).attr("src");
		if (src) {
			const importFullPath = resolveTemplateDependencyPath(workPath, sourcePath, src);
			getDependencyGraph().addFile(path, importFullPath, "view");
			let importPath = importFullPath.replace(workPath, "").replace(buildExtStripRegex(getTemplateExts()), "");
			const importDiagnosticSource = importFullPath.startsWith(workPath) ? importFullPath.slice(workPath.length) : importPath;
			if (!importPath.startsWith("/")) importPath = "/" + importPath;
			const importContent = getContentByPath(importFullPath);
			if (importContent.trim()) {
				checkTemplateCompatibility(importContent, importDiagnosticSource, components);
				const $$ = cheerio.load(importContent, {
					xmlMode: true,
					decodeEntities: false,
					_useHtmlParser2: true,
					withStartIndices: true,
					withEndIndices: true
				});
				const componentTags = collectIncludedComponentTags($$, components);
				transTagTemplate($$, templateModule, importPath, components, componentPlaceholder, {
					path: importDiagnosticSource,
					content: importContent
				}, path);
				transTagWxs($$, scriptModule, importPath, path);
				processIncludedFileWxsDependencies(componentTags, importPath, scriptModule, components, processedPaths);
			}
		}
	});
	importNodes.remove();
	transAsses($, $("image"), sourcePath, path);
	const res = [];
	normalizeTemplateDom($, $.root(), components);
	transHtmlTag($.html(), res, components, componentPlaceholder);
	return {
		tpl: res.join(""),
		sourceInfo: {
			path: diagnosticSource,
			content: originalContent
		},
		instruction: {
			templateModule,
			scriptModule
		}
	};
}
function transTagTemplate($, templateModule, path, components, componentPlaceholder, sourceInfo, graphOwnerPath = path) {
	const templateNodes = $("template[name]");
	const newlineOffsets = sourceInfo ? collectNewlineOffsets(sourceInfo.content) : null;
	templateNodes.each((_, elem) => {
		const name = $(elem).attr("name");
		const templateContent = $(elem);
		templateContent.find("import").remove();
		templateContent.find("include").remove();
		templateContent.find(getViewScriptTags().join(",")).remove();
		transAsses($, templateContent.find("image"), path, graphOwnerPath);
		const res = [];
		normalizeTemplateDom($, templateContent, components);
		transHtmlTag(templateContent.html(), res, components, componentPlaceholder);
		templateModule.push({
			path: `tpl-${name}`,
			tpl: res.join(""),
			sourceInfo: sourceInfo ? {
				...sourceInfo,
				startLine: getSourceLine(newlineOffsets, elem.children?.[0]?.startIndex ?? elem.startIndex)
			} : null
		});
	});
	templateNodes.remove();
}
function collectNewlineOffsets(content) {
	const offsets = [];
	for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) offsets.push(i);
	return offsets;
}
function getSourceLine(newlineOffsets, index = 0) {
	if (!newlineOffsets) return 1;
	const target = Math.max(0, index);
	let lo = 0;
	let hi = newlineOffsets.length;
	while (lo < hi) {
		const mid = lo + hi >>> 1;
		if (newlineOffsets[mid] < target) lo = mid + 1;
		else hi = mid;
	}
	return lo + 1;
}
function transAsses($, imageNodes, path, graphOwnerPath = path) {
	imageNodes.each((_, elem) => {
		const imgSrc = $(elem).attr("src").trim();
		if (!imgSrc.startsWith("{{")) {
			if (!imgSrc.startsWith("http") && !imgSrc.startsWith("//") && isCollectableImageAsset(imgSrc)) getDependencyGraph().addFile(graphOwnerPath, resolveAssetSourcePath(getWorkPath(), path, imgSrc), "view");
			$(elem).attr("src", collectAssets(getWorkPath(), path, imgSrc, getTargetPath(), getAppId()));
		}
	});
}
var DIMINA_SLOT_GROUP_TAG = "dimina-slot-group";
var DIMINA_FOR_SCOPE_TAG = "dimina-for-scope";
function getDirectiveAttributeNames(attrs, suffixes) {
	const directiveNames = new Set(suffixes.map((suffix) => suffix.replace(/^:/, "")));
	return Object.keys(attrs || {}).filter((name) => directiveNames.has(getTemplateDirectiveName(name)));
}
function hasForAndIf(attrs) {
	return getDirectiveAttributeNames(attrs, [":for", ":for-items"]).length > 0 && getDirectiveAttributeNames(attrs, [":if"]).length > 0;
}
function groupDuplicateNamedSlots($, root, components) {
	const slotHosts = root.find("*").toArray().filter((element) => {
		const tag = element.tagName;
		return tag === "component" || Boolean(components?.[tag]);
	});
	for (const host of slotHosts) {
		const groups = /* @__PURE__ */ new Map();
		for (const child of $(host).children().toArray()) {
			const slotName = child.attribs?.slot;
			if (!slotName) continue;
			const group = groups.get(slotName) || [];
			group.push(child);
			groups.set(slotName, group);
		}
		for (const [slotName, nodes] of groups) {
			if (nodes.length === 1 && !hasForAndIf(nodes[0].attribs)) continue;
			const wrapper = $(`<${DIMINA_SLOT_GROUP_TAG}></${DIMINA_SLOT_GROUP_TAG}>`);
			wrapper.attr("name", slotName);
			$(nodes[0]).before(wrapper);
			for (const node of nodes) {
				$(node).removeAttr("slot");
				wrapper.append(node);
			}
		}
	}
}
function wrapForIfScopes($, root) {
	const nodes = root.find("*").toArray();
	for (const node of nodes) {
		if (node.tagName === DIMINA_FOR_SCOPE_TAG || !hasForAndIf(node.attribs)) continue;
		const attrsToMove = getDirectiveAttributeNames(node.attribs, [
			":for",
			":for-items",
			":for-item",
			":for-index",
			":key"
		]);
		const wrapper = $(`<${DIMINA_FOR_SCOPE_TAG}></${DIMINA_FOR_SCOPE_TAG}>`);
		for (const name of attrsToMove) {
			wrapper.attr(name, node.attribs[name]);
			$(node).removeAttr(name);
		}
		$(node).before(wrapper);
		wrapper.append(node);
	}
}
function normalizeTemplateDom($, root, components) {
	groupDuplicateNamedSlots($, root, components);
	wrapForIfScopes($, root);
}
function normalizeTemplateSyntax(html, components) {
	const $ = cheerio.load(html, {
		xmlMode: true,
		decodeEntities: false,
		_useHtmlParser2: true,
		lowerCaseTags: false,
		lowerCaseAttributeNames: false
	});
	normalizeTemplateDom($, $.root(), components);
	return $.html();
}
function transHtmlTag(html, res, components, componentPlaceholder) {
	const attrsList = [];
	const parser = new htmlparser2.Parser({
		onopentag(tag, attrs) {
			attrsList.push(attrs);
			res.push(transTag({
				isStart: true,
				tag,
				attrs,
				components,
				componentPlaceholder
			}));
		},
		ontext(text) {
			res.push(transformTextInterpolation(text));
		},
		onclosetag(tag) {
			res.push(transTag({
				tag,
				attrs: attrsList.pop(),
				components
			}));
		},
		onerror(error) {
			console.error(error);
		}
	}, { xmlMode: true });
	parser.write(html);
	parser.end();
}
/**
* 处理组件标签
* @param {*} opts
*/
function transTag(opts) {
	const { isStart, tag, attrs, components } = opts;
	let res;
	if (tag === DIMINA_SLOT_GROUP_TAG) {
		if (isStart) return `<template ${generateSlotDirective(attrs.name)}>`;
		return "</template>";
	} else if (tag === DIMINA_FOR_SCOPE_TAG) res = "template";
	else if (tag === "slot") res = tag;
	else if (components && components[tag]) res = `dd-${tag}`;
	else if (tag === "component") res = tag;
	else if (tagWhiteList.includes(tag)) res = `dd-${tag}`;
	else res = tag;
	let tagRes;
	const propsAry = isStart ? getProps(attrs, tag, components) : [];
	const multipleSlots = attrs?.slot;
	if (attrs?.slot) {
		const isDynamicSlot = isWrappedByBraces(multipleSlots);
		if (isStart) {
			const withVIf = [];
			const withoutVIf = [];
			for (let i = 0; i < propsAry.length; i++) {
				const prop = propsAry[i];
				if (prop.includes("v-if") || prop.includes("v-else-if") || prop.includes("v-else")) withVIf.push(prop);
				else if (!prop.includes("slot")) withoutVIf.push(prop);
			}
			const vIfProps = withVIf.length > 0 ? `${withVIf.join(" ")} ` : "";
			const vOtherProps = withoutVIf.length > 0 ? ` ${withoutVIf.join(" ")}` : "";
			const templateContent = `<template ${vIfProps}${generateSlotDirective(multipleSlots)}><${res}${vOtherProps}>`;
			if (isDynamicSlot) tagRes = `<dd-block>${templateContent}`;
			else tagRes = templateContent;
		} else if (isDynamicSlot) tagRes = `</${res}></template></dd-block>`;
		else tagRes = `</${res}></template>`;
	} else if (isStart) {
		const props = propsAry.join(" ");
		tagRes = props ? `<${res} ${props}>` : `<${res}>`;
	} else tagRes = `</${res}>`;
	return tagRes;
}
/**
* 处理动态slot指令生成，比如 slot="{{xxx}}"
*
* @param {string} slotValue - slot属性值
* @returns {string} 生成的slot指令
*/
function generateSlotDirective(slotValue) {
	if (isWrappedByBraces(slotValue)) return `#[${parseBraceExp(slotValue)}]`;
	else return `#${slotValue}`;
}
/**
* 转换语法
* @param {*} attrs
* @param {*} tag
* @param {*} components - 组件映射，用于判断是否为自定义组件
*/
function getProps(attrs, tag, components) {
	const attrsList = [];
	const isCustomComponent = Boolean(components && components[tag]);
	const propBindings = {};
	const hasEventBindings = Object.keys(attrs).some((name) => /^(?:capture-)?(?:bind|catch)(?::)?.+/.test(name));
	if (tag === "page-meta") attrsList.push({
		name: "dimina-rpx-unit",
		value: "vw"
	});
	if (hasEventBindings) attrsList.push({
		name: "v-c-event-node",
		value: components && components[tag] ? "'component'" : "'node'"
	});
	Object.entries(attrs).forEach(([name, value]) => {
		const templateDirective = getTemplateDirectiveName(name);
		if (templateDirective === "if") attrsList.push({
			name: "v-if",
			value: parseSafeBraceExp(value)
		});
		else if (templateDirective === "elif") attrsList.push({
			name: "v-else-if",
			value: parseSafeBraceExp(value)
		});
		else if (templateDirective === "else") attrsList.push({
			name: "v-else",
			value: ""
		});
		else if (templateDirective === "for" || templateDirective === "for-items") attrsList.push({
			name: "v-for",
			value: parseForExp(value, attrs)
		});
		else if (templateDirective === "for-item" || templateDirective === "for-index") {} else if (templateDirective === "key") {
			const tranValue = parseKeyExpression(value, getForItemName(attrs), getForIndexName(attrs));
			attrsList.push({
				name: ":key",
				value: tranValue
			});
		} else if (name === "style") {
			const parsedStyle = parseSafeBraceExp(value);
			attrsList.push({
				name: "v-c-style",
				value: transformRpx(parsedStyle)
			});
			if (isCustomComponent) {
				attrsList.push({
					name: ":dimina-wxml-style",
					value: parsedStyle
				});
				if (isWrappedByBraces(value) && parsedStyle) propBindings.style = parsedStyle;
			}
		} else if (name === "class") {
			if (isWrappedByBraces(value)) attrsList.push({
				name: ":class",
				value: parseClassRules(value)
			});
			else attrsList.push({
				name: "class",
				value
			});
			attrsList.push({
				name: "v-c-class",
				value: ""
			});
		} else if (name === "is" && tag === "component") attrsList.push({
			name: ":is",
			value: `'dd-'+${parseSafeBraceExp(value)}`
		});
		else if (name === "animation" && tag !== "movable-view" && tagWhiteList.includes(tag)) attrsList.push({
			name: "v-c-animation",
			value: parseSafeBraceExp(value)
		});
		else if (name === "value" && (tag === "input" || tag === "textarea") || (name === "x" || name === "y") && tag === "movable-view") {
			const parsedValue = parseSafeBraceExp(value);
			const conditionExp = generateVModelTemplate(parsedValue);
			if (conditionExp) {
				attrsList.push({
					name: `:${name}`,
					value: parsedValue
				});
				attrsList.push({
					name: `update:${name}`,
					value: conditionExp
				});
			} else attrsList.push({
				name: `v-model:${name}`,
				value: parsedValue
			});
		} else if (name.startsWith("data-")) {
			if (isWrappedByBraces(value)) {
				attrsList.push({
					name: "v-c-data",
					value: ""
				});
				attrsList.push({
					name: `:${name}`,
					value: parseSafeBraceExp(value)
				});
			} else attrsList.push({
				name,
				value
			});
		} else if (isWrappedByBraces(value)) {
			const pVal = tag === "template" && name === "data" ? parseTemplateDataExp(value) : parseSafeBraceExp(value);
			if (isCustomComponent) {
				if (pVal && typeof pVal === "string") propBindings[name] = pVal;
			}
			attrsList.push({
				name: `:${name}`,
				value: pVal
			});
		} else if (name !== "slot") attrsList.push({
			name,
			value
		});
	});
	const propsRes = [];
	attrsList.forEach((attr) => {
		const { name, value } = attr;
		if (value === "") propsRes.push(`${name}`);
		else if (/\$\{[^}]*\}/.test(value)) propsRes.push(`:${name}="\`${value}\`"`);
		else propsRes.push(`${name}="${escapeQuotes(value)}"`);
	});
	if (isCustomComponent && Object.keys(propBindings).length > 0) try {
		const validBindings = {};
		for (const [key, value] of Object.entries(propBindings)) if (value !== void 0 && value !== null && typeof value === "string") validBindings[key] = value;
		if (Object.keys(validBindings).length > 0) {
			const parsedBindings = parseBindings(validBindings);
			const escapedJson = JSON.stringify(parsedBindings).replace(/"/g, "&quot;");
			propsRes.push(`v-c-prop-bindings="${escapedJson}"`);
		}
	} catch (error) {
		console.warn("[compiler] 序列化 propBindings 失败:", error.message, "标签:", tag, "绑定数据:", propBindings);
	}
	return propsRes;
}
function generateVModelTemplate(expression) {
	let var1, var2, updateExpression;
	if (expression.includes("&&")) {
		[var1, var2] = expression.split("&&").map((v) => v.trim());
		updateExpression = `${var1} ? (${var2} = $event) : (${var1} = $event)`;
	} else if (expression.includes("||")) {
		[var1, var2] = expression.split("||").map((v) => v.trim());
		updateExpression = `${var1} ? (${var1} = $event) : (${var2} = $event)`;
	} else if (expression.includes("?")) {
		const parts = expression.split(/[?:]/).map((v) => v.trim());
		var1 = parts[0];
		var2 = parts[2];
		updateExpression = `${var1} ? (${var1} = $event) : (${var2} = $event)`;
	} else return false;
	return updateExpression;
}
/**
* 兼容 :key="{{ index }}" 或 :key="{{ item.index }}"的情况
*/
function parseKeyExpression(exp, itemName = "item", indexName = "index") {
	exp = exp.trim();
	if (/\*this/.test(exp) || /\*item/.test(exp)) return `${itemName}.toString()`;
	if (!exp.includes("{{")) {
		if (/^-?\d+(\.\d+)?$/.test(exp)) return exp;
		if (exp === indexName) return indexName;
		return exp.startsWith(itemName) ? `${exp}` : `${itemName}.${exp}`;
	}
	if (exp.startsWith("{{") && exp.endsWith("}}")) {
		const content = exp.slice(2, -2).trim();
		if (content === "this") return `${itemName}.toString()`;
		else if (content === indexName) return indexName;
		else return content.startsWith(itemName) ? `${content}` : `${itemName}.${content}`;
	}
	const result = exp.split(/(\{\{.*?\}\})/).map((part) => {
		if (part.startsWith("{{") && part.endsWith("}}")) {
			const content = part.slice(2, -2).trim();
			if (content === indexName) return indexName;
			return content.startsWith(itemName) ? content : `${itemName}.${content}`;
		}
		return `'${part}'`;
	}).join("+");
	return result.endsWith("+''") ? result.slice(0, -3) : result;
}
/**
* 根据工作目录获取 ml 文件绝对路径
* @param {string} workPath
* @param {string} src
* @returns 返回绝对路径
*/
function getViewPath(workPath, src) {
	const aSrc = src.startsWith("/") ? src : `/${src}`;
	for (const mlType of getTemplateExts()) {
		const mlFullPath = `${workPath}${aSrc}${mlType}`;
		if (fs.existsSync(mlFullPath)) return mlFullPath;
		const indexMlFullPath = `${workPath}${aSrc}/index${mlType}`;
		if (fs.existsSync(indexMlFullPath)) return indexMlFullPath;
	}
}
/**
* 解析 import/include 的模板文件路径。
* 微信允许省略 .wxml；显式扩展名保持原样，无扩展名时按当前模板类型优先级补全。
*/
function resolveTemplateDependencyPath(workPath, ownerPath, src) {
	const resolvedPath = getAbsolutePath(workPath, ownerPath, src);
	if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) return resolvedPath;
	if (path.extname(resolvedPath)) return resolvedPath;
	for (const ext of getTemplateExts()) {
		const candidate = `${resolvedPath}${ext}`;
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return resolvedPath;
}
/**
* 将字符串内部的双引号进行替换
* @param {*} input
*/
function escapeQuotes(input) {
	return input.replace(/"/g, "'");
}
/**
* 判断字符串是不是被{{}}包裹
* @param {*} str
*/
function isWrappedByBraces(str) {
	return /\{\{.*\}\}/.test(str);
}
function splitWithBraces(str) {
	const result = [];
	let temp = "";
	let inBraces = false;
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		if (char === "{" && i + 1 < str.length && str[i + 1] === "{") {
			inBraces = true;
			temp += "{{";
			i++;
		} else if (char === "}" && i + 1 < str.length && str[i + 1] === "}") {
			inBraces = false;
			temp += "}}";
			i++;
		} else if (!inBraces && char === " ") {
			if (temp) {
				result.push(temp);
				temp = "";
			}
		} else temp += char;
	}
	if (temp) result.push(temp);
	return result;
}
function parseClassRules(cssRule) {
	let list = splitWithBraces(cssRule);
	list = list.map((item) => {
		return parseSafeBraceExp(item);
	});
	if (list.length === 1) return list.pop();
	return `[${list.join(",")}]`;
}
/**
* https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/list.html#wx-for
* 使用 :for-item 可以指定数组当前元素的变量名
* @param {*} attrs
*/
function getForItemName(attrs) {
	for (const key in attrs) if (getTemplateDirectiveName(key) === "for-item") return attrs[key];
	return "item";
}
/**
* 使用 :for-index 可以指定数组当前下标的变量名
* @param {*} attrs
*/
function getForIndexName(attrs) {
	for (const key in attrs) if (getTemplateDirectiveName(key) === "for-index") return attrs[key];
	return "index";
}
/**
* 解析 for 表达式的值
* @param {*} exp
* @param {*} attrs
*/
function parseForExp(exp, attrs) {
	return `(${getForItemName(attrs)}, ${getForIndexName(attrs)}) in ${parseSafeBraceExp(exp)}`;
}
var braceRegex = /(\{\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}\})|([^{}]+)/g;
var noBraceRegex = /\{\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\}/;
var ternaryRegex = /[^?]+\?.+:.+/;
var RESERVED_TEMPLATE_CONTEXT_ALIASES = /* @__PURE__ */ new Map([["class", "__dimina_reserved_class"]]);
var RESERVED_TEMPLATE_CONTEXT_NAMES = new Map([...RESERVED_TEMPLATE_CONTEXT_ALIASES].map(([name, alias]) => [alias, name]));
function encodeReservedTemplateContextIdentifier(expression) {
	return RESERVED_TEMPLATE_CONTEXT_ALIASES.get(expression) || expression;
}
/**
* 解析 {{}} 表达式的值
* @param {*} exp
*/
function parseBraceExp(exp) {
	let result;
	const group = [];
	while (result = braceRegex.exec(exp)) {
		if (result[1]) {
			const matchResult = result[1].match(noBraceRegex);
			if (matchResult) {
				const statement = encodeReservedTemplateContextIdentifier(matchResult[1].trim());
				if (ternaryRegex.test(statement)) group.push(`(${statement})`);
				else group.push(statement);
			}
		}
		if (result[2]) group.push(`+'${result[2].replace(/'/g, "\\'")}'+`);
	}
	return group.join("").replace(/^\+|\+$/g, "");
}
/**
* 解析 template 的 data 对象表达式，保留对象字面量和内部三元表达式
* @param {string} exp
* @returns {string} 解析后的对象表达式字符串
*/
function parseTemplateDataExp(exp) {
	const matchResult = exp.trim().match(/^\{\{([\s\S]*)\}\}$/);
	if (matchResult) return addOptionalChaining(`{${matchResult[1].trim()}}`);
	return `{${parseSafeBraceExp(exp)}}`;
}
function transTagWxs($, scriptModule, filePath, graphOwnerPath = filePath) {
	const wxsNodes = $(getViewScriptTags().join(","));
	wxsNodes.each((_, elem) => {
		const smName = $(elem).attr("module");
		if (smName) {
			let wxsContent;
			let uniqueModuleName = smName;
			let cacheKey = smName;
			const src = $(elem).attr("src");
			let wxsFilePath = null;
			const workPath = getWorkPath();
			if (src) {
				if (filePath.includes("/miniprogram_npm/")) {
					const componentFullPath = workPath + filePath.split("/").slice(0, -1).join("/");
					wxsFilePath = path.resolve(componentFullPath, src);
				} else wxsFilePath = getAbsolutePath(workPath, filePath, src);
				if (wxsFilePath) {
					getDependencyGraph().addFile(graphOwnerPath, wxsFilePath, "view");
					uniqueModuleName = stripViewScriptExt(wxsFilePath.replace(workPath, "")).replace(/[\/\\@\-]/g, "_").replace(/^_/, "");
					cacheKey = wxsFilePath;
				}
			}
			if (compileResCache.has(cacheKey)) wxsContent = compileResCache.get(cacheKey);
			else {
				if (src && wxsFilePath) {
					if (fs.existsSync(wxsFilePath)) wxsContent = getContentByPath(wxsFilePath).trim();
					else {
						console.warn(`[view] wxs 文件不存在: ${wxsFilePath}`);
						return;
					}
				} else wxsContent = $(elem).html();
				if (!wxsContent) return;
				wxsContent = processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, filePath, graphOwnerPath);
				compileResCache.set(cacheKey, wxsContent);
			}
			if (wxsContent) {
				registerWxsModule(uniqueModuleName);
				scriptModule.push({
					path: uniqueModuleName,
					code: wxsContent,
					originalName: smName
				});
			}
		}
	});
	wxsNodes.remove();
}
/**
* 递归收集 wxs 模块的所有依赖
* @param {Map} scriptRes - 脚本资源映射
* @param {Set} collectedPaths - 已收集的路径集合，避免重复处理
* @param {Array} scriptModule - 用于收集新加载的 wxs 模块
* @returns {Array} 所有 wxs 模块的数组
*/
function collectAllWxsModules(scriptRes, collectedPaths = /* @__PURE__ */ new Set(), scriptModule = []) {
	const allWxsModules = [];
	const workPath = getWorkPath();
	for (const [modulePath, moduleCode] of scriptRes.entries()) {
		if (collectedPaths.has(modulePath)) continue;
		if (isWxsModuleByContent(moduleCode, modulePath)) {
			collectedPaths.add(modulePath);
			allWxsModules.push({
				path: modulePath,
				code: moduleCode
			});
			const dependencies = extractWxsDependencies(moduleCode);
			for (const depPath of dependencies) if (!collectedPaths.has(depPath)) {
				if (scriptRes.has(depPath)) {
					const depModules = collectAllWxsModules(/* @__PURE__ */ new Map([[depPath, scriptRes.get(depPath)]]), collectedPaths, scriptModule);
					allWxsModules.push(...depModules);
				} else {
					const loaded = loadWxsModule(depPath, workPath, scriptModule);
					if (loaded) {
						scriptRes.set(depPath, loaded.code);
						allWxsModules.push(loaded);
						collectedPaths.add(depPath);
						const depModules = collectAllWxsModules(/* @__PURE__ */ new Map([[depPath, loaded.code]]), collectedPaths, scriptModule);
						allWxsModules.push(...depModules);
					}
				}
			}
		}
	}
	return allWxsModules;
}
/**
* 尝试从文件系统加载 wxs 模块
* @param {string} modulePath - 模块路径
* @param {string} workPath - 工作路径
* @param {Array} scriptModule - 脚本模块数组
* @returns {Object|null} 加载的模块对象或 null
*/
function loadWxsModule(modulePath, workPath, scriptModule) {
	const wxsFilePath = wxsFilePathMap.get(modulePath);
	if (!wxsFilePath) return null;
	try {
		const wxsContent = getContentByPath(wxsFilePath).trim();
		if (!wxsContent) return null;
		const processedContent = processWxsContent(wxsContent, wxsFilePath, scriptModule, workPath, "");
		registerWxsModule(modulePath);
		return {
			path: modulePath,
			code: processedContent
		};
	} catch (error) {
		console.warn(`[view] 加载 wxs 模块失败: ${modulePath}`, error.message);
		return null;
	}
}
/**
* 从 wxs 模块代码中提取依赖的模块路径
* @param {string} moduleCode - 模块代码
* @returns {Array} 依赖的模块路径数组
*/
function extractWxsDependencies(moduleCode) {
	const dependencies = [];
	const requirePattern = /(?:require|_)\s*\(\s*["']([^"']+)["']\s*\)/g;
	let match;
	while ((match = requirePattern.exec(moduleCode)) !== null) {
		const depPath = match[1];
		if (depPath && !dependencies.includes(depPath)) dependencies.push(depPath);
	}
	return dependencies;
}
function insertWxsToRenderResult(code, scriptModule, scriptRes, filename = "render.js", inputMap = null) {
	const wxsBindings = [];
	const codeReplacements = [];
	const ast = parseJs(code, filename);
	const statement = ast.body?.[0];
	const renderBody = (statement?.type === "ExpressionStatement" ? statement.expression : null)?.body;
	const declarations = [];
	for (const [index, sm] of scriptModule.entries()) {
		if (!scriptRes.has(sm.path)) scriptRes.set(sm.path, sm.code);
		const templatePropertyName = sm.originalName || sm.path;
		const requireModuleName = sm.path;
		const localIdentifier = `__wxs_${index}`;
		wxsBindings.push({
			localIdentifier,
			templatePropertyName
		});
		declarations.push(`const ${localIdentifier} = require(${JSON.stringify(requireModuleName)});`);
	}
	if (wxsBindings.length > 0 && renderBody?.type === "BlockStatement") codeReplacements.push({
		type: "insert",
		start: renderBody.start + 1,
		end: renderBody.start + 1,
		value: `\n${declarations.join("\n")}`
	});
	walk(ast, { enter(node) {
		if (node.type === "MemberExpression" && node.object?.type === "Identifier" && node.object.name === "_ctx" && !node.computed && node.property?.type === "Identifier") {
			const reservedName = RESERVED_TEMPLATE_CONTEXT_NAMES.get(node.property.name);
			if (reservedName) {
				codeReplacements.push({
					start: node.property.start,
					end: node.property.end,
					value: reservedName
				});
				return;
			}
			const replacement = wxsBindings.find((item) => item.templatePropertyName === node.property.name);
			if (replacement) codeReplacements.push({
				start: node.start,
				end: node.end,
				value: replacement.localIdentifier
			});
		}
	} });
	if (codeReplacements.length === 0) return {
		code: getProgramCode(code, ast),
		map: inputMap
	};
	const transformed = applyCodeReplacements(code, codeReplacements);
	let map = inputMap;
	if (enableSourcemap) {
		const generatedMap = new MagicString(code);
		const selected = [];
		for (const replacement of [...codeReplacements].sort((a, b) => b.end - b.start - (a.end - a.start))) if (!selected.some((item) => replacement.start < item.end && item.start < replacement.end)) selected.push(replacement);
		for (const replacement of selected.sort((a, b) => b.start - a.start)) if (replacement.type === "insert") generatedMap.appendLeft(replacement.start, replacement.value);
		else generatedMap.overwrite(replacement.start, replacement.end, replacement.value);
		const wxsTransformMap = generatedMap.generateMap({
			file: filename,
			source: filename,
			includeContent: true,
			hires: true
		}).toString();
		map = inputMap ? remapSourcemap(wxsTransformMap, inputMap) : wxsTransformMap;
	}
	return {
		code: getProgramCode(transformed, parseJs(transformed, filename)),
		map
	};
}
//#endregion
export { compileML, generateSlotDirective, generateVModelTemplate, initWxsFilePathMap, loadWxsModule, normalizeTemplateSyntax, parseBraceExp, parseClassRules, parseKeyExpression, parseTemplateDataExp, processIncludeConditionalAttrs, processWxsContent, splitWithBraces };
