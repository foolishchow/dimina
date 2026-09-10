import { t as effectiveJsMinify } from "../compile-config-DrZAAJbg.js";
import { A as resolveAssetSourcePath, D as isCollectableImageAsset, E as hasCompileInfo, _ as getWorkPath, a as getComponent, b as resetStoreInfo, c as getNpmResolver, f as getTargetPath, n as getAppId, o as getContentByPath, s as getDependencyGraph, t as getAppConfigInfo, v as isMiniGame, w as collectAssets, x as resolveAppAlias } from "../env-CPAAD5ub.js";
import { a as warnUnsupportedWxApi, i as takeCompatibilityWarnings, r as getWxMemberName } from "../compatibility-CjsV18qy.js";
import { i as remapSourcemap, r as mergeSourcemap } from "../sourcemap-z1b9ZOu3.js";
import { relative, resolve, sep } from "node:path";
import { isMainThread, parentPort } from "node:worker_threads";
import fs from "node:fs";
import { parseSync } from "oxc-parser";
import { walk } from "oxc-walker";
import MagicString from "magic-string";
import { transform } from "esbuild";
//#region src/core/logic-compiler.js
var processedModules = /* @__PURE__ */ new Set();
var enableSourcemap = false;
var sourcemapTargetPath = null;
/** @type {{ minify: boolean, sourcemap: boolean, esTarget: { logic: string, view: string } }} */
var activeCompileConfig = {
	minify: true,
	sourcemap: false,
	esTarget: {
		logic: "es2023",
		view: "es2020"
	}
};
if (!isMainThread) parentPort.on("message", async ({ pages, storeInfo, sourcemap, sourcemapTargetPath: targetPath, compileConfig }) => {
	try {
		resetStoreInfo(storeInfo);
		enableSourcemap = !!sourcemap;
		sourcemapTargetPath = targetPath || getTargetPath();
		activeCompileConfig = {
			minify: compileConfig?.minify !== false,
			sourcemap: !!sourcemap,
			esTarget: {
				logic: compileConfig?.esTarget?.logic || "es2023",
				view: compileConfig?.esTarget?.view || "es2020"
			}
		};
		const progress = {
			_completedTasks: 0,
			get completedTasks() {
				return this._completedTasks;
			},
			set completedTasks(value) {
				this._completedTasks = value;
				parentPort.postMessage({ completedTasks: this.completedTasks });
			}
		};
		const mainCompileRes = await compileJS(pages.mainPages, null, null, progress);
		for (const [root, subPages] of Object.entries(pages.subPages)) try {
			await writeCompileRes(await compileJS(subPages.info, root, subPages.independent ? [] : mainCompileRes, progress), root);
		} catch (error) {
			throw new Error(`Error processing subpackage ${root}: ${error.message}\n${error.stack}`);
		}
		await writeCompileRes(mainCompileRes, null);
		processedModules.clear();
		parentPort.postMessage({
			success: true,
			compatibilityWarnings: takeCompatibilityWarnings(),
			dependencyGraph: getDependencyGraph().toJSON()
		});
	} catch (error) {
		processedModules.clear();
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
async function writeCompileRes(compileRes, root) {
	const outputDir = root ? `${getTargetPath()}/${root}` : `${getTargetPath()}/main`;
	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
	if (enableSourcemap) {
		const finalOutputDir = root ? resolve(sourcemapTargetPath, root) : resolve(sourcemapTargetPath, "main");
		const rebasedCompileRes = compileRes.map((module) => {
			if (!module.map) return module;
			const moduleMap = JSON.parse(module.map);
			moduleMap.sources = moduleMap.sources.map((source) => {
				const sourcePath = source.replace(/^[/\\]+/, "");
				return relative(finalOutputDir, resolve(getWorkPath(), sourcePath)).split(sep).join("/");
			});
			return {
				...module,
				map: JSON.stringify(moduleMap)
			};
		});
		const { bundleCode, sourcemap } = mergeSourcemap(rebasedCompileRes);
		const sourcemapFileName = "logic.js.map";
		fs.writeFileSync(`${outputDir}/logic.js`, `${bundleCode}//# sourceMappingURL=${sourcemapFileName}\n`);
		fs.writeFileSync(`${outputDir}/${sourcemapFileName}`, sourcemap);
	} else if (effectiveJsMinify(activeCompileConfig)) {
		let mergeCode = "";
		for (const module of compileRes) {
			const amdFormat = `modDefine('${module.path}', function(require, module, exports) {
${module.code}
});`;
			const { code: minifiedCode } = await transform(amdFormat, {
				minify: true,
				target: [activeCompileConfig.esTarget.logic],
				platform: "neutral"
			});
			mergeCode += minifiedCode;
		}
		fs.writeFileSync(`${outputDir}/logic.js`, mergeCode);
	} else {
		let mergeCode = "";
		for (const module of compileRes) mergeCode += `modDefine('${module.path}', function(require, module, exports) {
${module.code}
});
`;
		fs.writeFileSync(`${outputDir}/logic.js`, mergeCode);
	}
}
/**
* 编译 js 文件
*/
async function compileJS(pages, root, mainCompileRes, progress) {
	const compileRes = [];
	if (!root && !isMiniGame()) await buildJSByPath(root, { path: "app" }, compileRes, mainCompileRes, false);
	for (const page of pages) {
		await buildJSByPath(root, page, compileRes, mainCompileRes, true);
		progress.completedTasks++;
	}
	return compileRes;
}
async function buildJSByPath(packageName, module, compileRes, mainCompileRes, addExtra, activePaths = /* @__PURE__ */ new Set(), putMain = false) {
	const currentPath = module.path;
	if (!currentPath) return;
	if (activePaths.has(currentPath)) return;
	if (hasCompileInfo(module.path, compileRes, mainCompileRes)) return;
	const compileInfo = {
		path: module.path,
		code: "",
		sourceFile: null
	};
	const src = module.path.startsWith("/") ? module.path : `/${module.path}`;
	const modulePath = getJSAbsolutePath(src);
	if (!modulePath) {
		console.warn("[logic]", `找不到模块文件: ${src}`);
		return;
	}
	getDependencyGraph().addFile(currentPath, modulePath, "logic");
	const diagnosticSource = modulePath.startsWith(getWorkPath()) ? modulePath.slice(getWorkPath().length) : src;
	const sourceCode = getContentByPath(modulePath);
	if (!sourceCode) {
		console.warn("[logic]", `无法读取模块文件: ${modulePath}`);
		return;
	}
	const isTypeScript = modulePath.endsWith(".ts");
	if (enableSourcemap) {
		const workPath = getWorkPath();
		compileInfo.sourceFile = modulePath.startsWith(workPath) ? modulePath.slice(workPath.length) : src;
	}
	const ast = parseSync(modulePath, sourceCode, {
		sourceType: "module",
		lang: isTypeScript ? "ts" : "js"
	}).program;
	const s = new MagicString(sourceCode);
	const extraInfo = { path: module.path };
	activePaths.add(currentPath);
	if (module.component) extraInfo.component = true;
	if (module.usingComponents) {
		const componentsObj = {};
		const allSubPackages = getAppConfigInfo().subPackages;
		const graphDependencies = getDependencyGraph().getDirectDependencies(module.path, "component");
		const componentDependencies = graphDependencies.length > 0 ? new Set(graphDependencies) : null;
		for (const [name, path] of Object.entries(module.usingComponents)) {
			if (componentDependencies && !componentDependencies.has(path)) continue;
			let toMainSubPackage = true;
			if (packageName) {
				const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
				for (const subPackage of allSubPackages) if (normalizedPath.startsWith(`${subPackage.root}/`)) {
					toMainSubPackage = false;
					break;
				}
			} else toMainSubPackage = false;
			const componentModule = getComponent(path);
			if (!componentModule) continue;
			await buildJSByPath(packageName, componentModule, compileRes, mainCompileRes, true, activePaths, putMain || toMainSubPackage);
			componentsObj[name] = path;
		}
		extraInfo.usingComponents = componentsObj;
	}
	if (addExtra) {
		const extraInfoCode = `globalThis.__extraInfo = ${JSON.stringify(extraInfo)};\n`;
		if (enableSourcemap) compileInfo.extraInfoCode = extraInfoCode;
		else s.prepend(extraInfoCode);
	}
	if (putMain) mainCompileRes.push(compileInfo);
	else compileRes.push(compileInfo);
	const pathReplacements = [];
	const dependenciesToProcess = [];
	walk(ast, { enter(node, parent) {
		const wxMemberName = getWxMemberName(node);
		if (wxMemberName) warnUnsupportedWxApi(wxMemberName, compileInfo.sourceFile || diagnosticSource, node.loc?.start?.line || getLineByIndex(sourceCode, node.start));
		if ((node.type === "StringLiteral" || node.type === "Literal") && isLocalAssetString(node.value)) {
			getDependencyGraph().addFile(currentPath, resolveAssetSourcePath(getWorkPath(), modulePath, node.value), "logic");
			pathReplacements.push({
				start: node.start,
				end: node.end,
				newValue: collectAssets(getWorkPath(), modulePath, node.value, getTargetPath(), getAppId())
			});
		}
		if (node.type === "CallExpression") {
			const isRequire = node.callee.type === "Identifier" && node.callee.name === "require";
			const isRequireProperty = node.callee.type === "MemberExpression" && node.callee.object?.type === "Identifier" && node.callee.object?.name === "require";
			if ((isRequire || isRequireProperty) && node.arguments.length > 0 && (node.arguments[0].type === "StringLiteral" || node.arguments[0].type === "Literal")) {
				const arg = node.arguments[0];
				const requirePath = arg.value;
				if (requirePath) {
					const { id, shouldProcess } = resolveDependencyId(requirePath, modulePath, false);
					if (shouldProcess) {
						getDependencyGraph().addDependency(currentPath, id, "logic");
						pathReplacements.push({
							start: arg.start,
							end: arg.end,
							newValue: id
						});
						if (!processedModules.has(packageName + id)) dependenciesToProcess.push(id);
					}
				}
			}
		}
		if (node.type === "ImportDeclaration") {
			const importPath = node.source.value;
			if (importPath) {
				const { id, shouldProcess } = resolveDependencyId(importPath, modulePath, true);
				if (shouldProcess) {
					getDependencyGraph().addDependency(currentPath, id, "logic");
					pathReplacements.push({
						start: node.source.start,
						end: node.source.end,
						newValue: id
					});
					if (!processedModules.has(packageName + id)) dependenciesToProcess.push(id);
				}
			}
		}
		if (node.type === "TSImportEqualsDeclaration" && node.moduleReference?.type === "TSExternalModuleReference") {
			const importPathNode = node.moduleReference.expression;
			const importPath = importPathNode?.value;
			if (importPath) {
				const { id, shouldProcess } = resolveDependencyId(importPath, modulePath, false);
				if (shouldProcess) {
					getDependencyGraph().addDependency(currentPath, id, "logic");
					pathReplacements.push({
						start: importPathNode.start,
						end: importPathNode.end,
						newValue: id
					});
					if (!processedModules.has(packageName + id)) dependenciesToProcess.push(id);
				}
			}
		}
		if ((node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") && node.source) {
			const exportPath = node.source.value;
			if (exportPath) {
				const { id, shouldProcess } = resolveDependencyId(exportPath, modulePath, true);
				if (shouldProcess) {
					getDependencyGraph().addDependency(currentPath, id, "logic");
					pathReplacements.push({
						start: node.source.start,
						end: node.source.end,
						newValue: id
					});
					if (!processedModules.has(packageName + id)) dependenciesToProcess.push(id);
				}
			}
		}
	} });
	for (const depId of dependenciesToProcess) await buildJSByPath(packageName, { path: depId }, compileRes, mainCompileRes, false, activePaths, putMain);
	for (const replacement of pathReplacements.reverse()) s.overwrite(replacement.start, replacement.end, `'${replacement.newValue}'`);
	const modifiedCode = s.toString();
	let preEsbuildMap = null;
	if (enableSourcemap && compileInfo.sourceFile) {
		const generatedMap = JSON.parse(s.generateMap({
			file: compileInfo.sourceFile,
			source: compileInfo.sourceFile,
			includeContent: true,
			hires: true
		}).toString());
		generatedMap.file = compileInfo.sourceFile;
		generatedMap.sources = [compileInfo.sourceFile];
		generatedMap.sourcesContent = [sourceCode];
		preEsbuildMap = JSON.stringify(generatedMap);
	}
	try {
		const esbuildOpts = {
			format: "cjs",
			target: activeCompileConfig.esTarget.logic,
			platform: "neutral",
			loader: isTypeScript ? "ts" : "js"
		};
		if (enableSourcemap && compileInfo.sourceFile) {
			esbuildOpts.sourcemap = true;
			esbuildOpts.sourcefile = compileInfo.sourceFile;
			esbuildOpts.sourcesContent = true;
		}
		const esbuildResult = await transform(modifiedCode, esbuildOpts);
		if (enableSourcemap && esbuildResult.map) compileInfo.map = preEsbuildMap ? remapSourcemap(esbuildResult.map, preEsbuildMap) : esbuildResult.map;
		compileInfo.code = esbuildResult.code;
	} catch (error) {
		console.error(`[logic] esbuild 转换失败 ${modulePath}:`, error.message);
		compileInfo.code = modifiedCode;
	}
	processedModules.add(packageName + currentPath);
	activePaths.delete(currentPath);
}
function isLocalAssetString(value) {
	return typeof value === "string" && !value.startsWith("http") && !value.startsWith("//") && (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) && isCollectableImageAsset(value);
}
function getLineByIndex(content, index) {
	if (typeof index !== "number" || index < 0) return null;
	let line = 1;
	for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
	return line;
}
/**
* 获取 JavaScript 或 TypeScript 文件的绝对路径
* @param {string} modulePath - 模块路径
* @returns {string|null} - 文件的绝对路径，如果找不到则返回 null
*/
function getJSAbsolutePath(modulePath) {
	const workPath = getWorkPath();
	const resolvedModuleId = resolveModuleIdToExistingPath(modulePath);
	if (!resolvedModuleId) return null;
	for (const ext of [".js", ".ts"]) {
		const fullPath = `${workPath}${resolvedModuleId}${ext}`;
		if (fs.existsSync(fullPath)) return fullPath;
	}
	return null;
}
function resolveDependencyId(specifier, modulePath, allowAbsolute) {
	if (!specifier) return {
		id: specifier,
		shouldProcess: false
	};
	if (specifier.startsWith("miniprogram_npm/")) {
		const npmModuleId = normalizeModuleId(`/${specifier}`);
		return {
			id: resolveModuleIdToExistingPath(npmModuleId) || npmModuleId,
			shouldProcess: true
		};
	}
	if (specifier.startsWith("./") || specifier.startsWith("../")) return {
		id: resolveRelativeModuleId(specifier, modulePath),
		shouldProcess: true
	};
	if (specifier.startsWith("/")) return {
		id: allowAbsolute ? normalizeModuleId(specifier) : resolveRelativeModuleId(specifier, modulePath),
		shouldProcess: true
	};
	const aliasResolved = resolveAppAlias(specifier);
	if (aliasResolved) return {
		id: normalizeModuleId(aliasResolved),
		shouldProcess: true
	};
	if (specifier.startsWith("@") || isBareModuleSpecifier(specifier)) {
		const npmModuleId = resolveNpmModuleId(specifier, modulePath);
		if (npmModuleId) return {
			id: npmModuleId,
			shouldProcess: true
		};
		const siblingModuleId = resolveBareSiblingModuleId(specifier, modulePath);
		return {
			id: siblingModuleId || specifier,
			shouldProcess: Boolean(siblingModuleId)
		};
	}
	return {
		id: specifier,
		shouldProcess: false
	};
}
function isBareModuleSpecifier(specifier) {
	return !specifier.startsWith(".") && !specifier.startsWith("/");
}
function resolveRelativeModuleId(specifier, modulePath) {
	const relativeId = resolve(modulePath, `../${specifier}`).split(`${getWorkPath()}${sep}`)[1];
	return normalizeModuleId(relativeId);
}
function resolveBareSiblingModuleId(specifier, modulePath) {
	return resolveModuleIdToExistingPath(resolveRelativeModuleId(`./${specifier}`, modulePath));
}
function normalizeModuleId(moduleId) {
	let normalized = moduleId.replace(/\.(js|ts)$/, "").replace(/\\/g, "/");
	if (!normalized.startsWith("/")) normalized = `/${normalized}`;
	return normalized;
}
function resolveNpmModuleId(specifier, modulePath) {
	const npmResolver = getNpmResolver();
	if (!npmResolver) return null;
	return npmResolver.resolveScriptModule(specifier, modulePath, resolveModuleIdToExistingPath);
}
function resolveModuleIdToExistingPath(moduleId) {
	const normalizedModuleId = normalizeModuleId(moduleId);
	const workPath = getWorkPath();
	for (const ext of [".js", ".ts"]) if (fs.existsSync(`${workPath}${normalizedModuleId}${ext}`)) return normalizedModuleId;
	for (const ext of [".js", ".ts"]) if (fs.existsSync(`${workPath}${normalizedModuleId}/index${ext}`)) return `${normalizedModuleId}/index`;
	const packageJsonPath = `${workPath}${normalizedModuleId}/package.json`;
	if (fs.existsSync(packageJsonPath)) try {
		const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		for (const entryField of ["miniprogram", "main"]) if (typeof packageInfo[entryField] === "string" && packageInfo[entryField]) {
			const resolvedEntry = resolveModuleIdToExistingPath(normalizeModuleId(resolve(normalizedModuleId, packageInfo[entryField])));
			if (resolvedEntry) return resolvedEntry;
		}
	} catch (error) {
		console.warn("[logic]", `解析 package.json 失败: ${packageJsonPath}`, error.message);
	}
	return null;
}
/** 测试专用：覆盖 worker 消息下发的 compileConfig（非公开契约）。 */
function _setActiveCompileConfigForTest(config) {
	activeCompileConfig = {
		minify: config?.minify !== false,
		sourcemap: !!config?.sourcemap,
		esTarget: {
			logic: config?.esTarget?.logic || "es2023",
			view: config?.esTarget?.view || "es2020"
		}
	};
}
//#endregion
export { _setActiveCompileConfigForTest, buildJSByPath, compileJS };
