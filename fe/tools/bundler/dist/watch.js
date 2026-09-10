import { P as DependencyGraph } from "./env-CPAAD5ub.js";
import build from "./index.js";
import path from "node:path";
import chokidar from "chokidar";
//#region src/common/compile-stages.js
var COMPILE_STAGE_ORDER = [
	"view",
	"logic",
	"style"
];
var COMPILE_STAGE_SET = new Set(COMPILE_STAGE_ORDER);
function getCompileStagesForFiles(dependencyGraph, filePaths) {
	const selected = /* @__PURE__ */ new Set();
	const unknownKinds = /* @__PURE__ */ new Set();
	for (const filePath of filePaths) for (const kind of dependencyGraph.getFileKinds(filePath)) if (COMPILE_STAGE_SET.has(kind)) selected.add(kind);
	else if (kind !== "config") unknownKinds.add(kind);
	return {
		stages: COMPILE_STAGE_ORDER.filter((stage) => selected.has(stage)),
		unknownKinds: [...unknownKinds].sort()
	};
}
//#endregion
//#region src/common/watch-plan.js
var WATCH_FILE_EVENTS = /* @__PURE__ */ new Set([
	"add",
	"change",
	"unlink"
]);
function isNpmPackageFile(filePath) {
	return path.normalize(filePath).split(path.sep).includes("miniprogram_npm");
}
function createWatchRebuildScheduler({ rebuild, onRebuild = () => {}, onError = () => {} }) {
	let pendingChange;
	let running = false;
	let idlePromise = Promise.resolve();
	let resolveIdle;
	const drain = async () => {
		while (pendingChange) {
			const change = pendingChange;
			pendingChange = void 0;
			try {
				onRebuild(change);
				await rebuild(change);
			} catch (error) {
				onError(error, change);
			}
		}
		running = false;
		resolveIdle?.();
		resolveIdle = void 0;
	};
	return {
		schedule(event, filePath) {
			if (!WATCH_FILE_EVENTS.has(event)) return false;
			pendingChange = {
				event,
				filePath,
				count: (pendingChange?.count || 0) + 1
			};
			if (!running) {
				running = true;
				idlePromise = new Promise((resolve) => {
					resolveIdle = resolve;
				});
				drain();
			}
			return true;
		},
		waitForIdle() {
			return idlePromise;
		}
	};
}
function getPublishedOutputPath(targetPath, useAppIdDir, appId) {
	return path.resolve(targetPath, useAppIdDir ? appId : ".");
}
function createWatchBuildPlan({ event, filePath, count = 1, dependencyGraph, publishedPath }) {
	if (count > 1 || event !== "change" || path.extname(filePath).toLowerCase() === ".json") return {
		skip: false,
		incremental: false,
		options: {}
	};
	if (!dependencyGraph.hasFile(filePath)) return {
		skip: true,
		incremental: false,
		options: {}
	};
	const affectedEntries = dependencyGraph.getAffectedEntries(filePath);
	if (affectedEntries.length === 0) return {
		skip: true,
		incremental: false,
		options: {}
	};
	const { stages, unknownKinds } = getCompileStagesForFiles(dependencyGraph, [filePath]);
	if (unknownKinds.length > 0) return {
		skip: false,
		incremental: false,
		options: {}
	};
	return {
		skip: false,
		incremental: true,
		options: {
			affectedEntries,
			stages,
			seedPath: publishedPath,
			dependencyGraph: dependencyGraph.toJSON(),
			prepareConfig: dependencyGraph.getFileKinds(filePath).includes("config"),
			prepareNpm: isNpmPackageFile(filePath)
		}
	};
}
function isSameOrDescendantPath(candidatePath, directoryPath) {
	const relativePath = path.relative(directoryPath, candidatePath);
	return relativePath === "" || !relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath);
}
function createIgnoredPathMatcher(ignoredPaths) {
	return (watchedPath) => {
		const absolutePath = path.resolve(watchedPath);
		for (const ignoredPath of ignoredPaths) if (isSameOrDescendantPath(absolutePath, ignoredPath)) return true;
		return false;
	};
}
//#endregion
//#region src/common/watch-runner.js
/**
* 可编程 watch API（CF-4 / watch-api 冻结契约 v1）。
*
* @param {object} params
* @param {string} params.targetPath
* @param {string} params.workPath
* @param {boolean} params.useAppIdDir
* @param {object} [params.options]
* @param {boolean} [params.autoListen=true]
* @param {(change: { event: string, filePath: string, count: number }) => void} [params.onRebuild]
* @param {(ctx: { event: string, filePath: string, count: number, plan: object, appId: string }) => void | Promise<void>} [params.beforeBuild]
* @param {(error: Error, change: { event: string, filePath: string, count: number }) => void} [params.onError]
*/
function createBuildWatcher({ targetPath, workPath, useAppIdDir, options = {}, autoListen = true, onRebuild = () => {}, beforeBuild, onError = () => {} }) {
	let buildResult;
	let dependencyGraph;
	let scheduler;
	let fsWatcher;
	let started = false;
	let listening = false;
	const ignoredOutputPaths = /* @__PURE__ */ new Set();
	const publishedPathFor = (appId) => getPublishedOutputPath(targetPath, useAppIdDir, appId);
	const ensureStarted = () => {
		if (!started) throw new Error("createBuildWatcher: call start() before listen()");
	};
	async function listen() {
		ensureStarted();
		if (listening) throw new Error("createBuildWatcher: already listening");
		fsWatcher = chokidar.watch(workPath, {
			persistent: true,
			ignoreInitial: true,
			ignored: createIgnoredPathMatcher(ignoredOutputPaths)
		});
		fsWatcher.on("all", (event, filePath) => {
			if (createWatchBuildPlan({
				event,
				filePath,
				dependencyGraph,
				publishedPath: publishedPathFor(buildResult.appId)
			}).skip) return;
			scheduler.schedule(event, filePath);
		});
		listening = true;
	}
	async function start() {
		if (started) throw new Error("createBuildWatcher: already started");
		buildResult = await build(targetPath, workPath, useAppIdDir, { ...options });
		dependencyGraph = new DependencyGraph(buildResult.dependencyGraph);
		ignoredOutputPaths.add(publishedPathFor(buildResult.appId));
		scheduler = createWatchRebuildScheduler({
			onRebuild,
			onError,
			rebuild: async (change) => {
				const publishedPath = publishedPathFor(buildResult.appId);
				const plan = createWatchBuildPlan({
					...change,
					dependencyGraph,
					publishedPath
				});
				if (plan.skip) return;
				if (beforeBuild) await beforeBuild({
					...change,
					plan,
					appId: buildResult.appId
				});
				const result = await build(targetPath, workPath, useAppIdDir, {
					...options,
					...plan.options
				});
				buildResult = result;
				dependencyGraph = new DependencyGraph(result.dependencyGraph);
				ignoredOutputPaths.add(publishedPathFor(result.appId));
			}
		});
		started = true;
		if (autoListen) await listen();
		return buildResult;
	}
	async function stop() {
		if (fsWatcher) {
			await fsWatcher.close();
			fsWatcher = void 0;
		}
		listening = false;
		if (scheduler) await scheduler.waitForIdle();
	}
	return {
		start,
		listen,
		stop,
		/** @internal 测试用 */
		waitForIdle() {
			return scheduler?.waitForIdle() ?? Promise.resolve();
		}
	};
}
//#endregion
export { createBuildWatcher, createBuildWatcher as default };
