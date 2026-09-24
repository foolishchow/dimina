import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { getCompileStagesForFiles } from '../compiler/pipeline/compile-stages.ts'
import { DependencyGraph } from '../packer/graph/dependency-graph.ts'

const COMPILE_CACHE_VERSION = 2

function getProjectFileManifest(workPath: string): string[] {
	const files: string[] = []
	const visit = (directory: string) => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const filePath = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				visit(filePath)
			}
			else if (entry.isFile()) {
				files.push(path.relative(workPath, filePath).split(path.sep).join('/'))
			}
		}
	}
	visit(workPath)
	return files.sort()
}

function getRawDependencyFiles(dependencyGraph: { nodes?: Array<{ files?: string[] }> } | null | undefined): string[] {
	return [...new Set(
		(dependencyGraph?.nodes || []).flatMap(node => node.files || []),
	)].sort()
}

function resolveDependencyFilePath(filePath: string, workPath: string): string {
	return path.isAbsolute(filePath) ? filePath : path.resolve(workPath, filePath)
}

function getDependencyFiles(dependencyGraph: { nodes?: Array<{ files?: string[] }> } | null | undefined, workPath: string = process.cwd()): string[] {
	return getRawDependencyFiles(dependencyGraph)
		.map(filePath => resolveDependencyFilePath(filePath, workPath))
}

function toCachePath(workPath: string, filePath: string): string {
	return path.relative(workPath, path.resolve(filePath)).split(path.sep).join('/')
}

function serializeDependencyGraphForCache(dependencyGraph: Record<string, unknown> | null | undefined, workPath: string): Record<string, unknown> {
	return {
		...dependencyGraph,
		pathFormat: 'relative',
		nodes: ((dependencyGraph?.nodes as Array<{ files?: string[] }>) || []).map(node => ({
			...node,
			files: (node.files || []).map((filePath: string) => toCachePath(workPath, filePath)),
		})),
		fileEdges: ((dependencyGraph?.fileEdges as Array<{ file: string }>) || []).map(fileEdge => ({
			...fileEdge,
			file: toCachePath(workPath, fileEdge.file),
		})),
	}
}

function hydrateDependencyGraphFromCache(dependencyGraph: Record<string, unknown> | null | undefined, workPath: string): Record<string, unknown> | null | undefined {
	if (dependencyGraph?.pathFormat !== 'relative') {
		return dependencyGraph
	}
	const snapshot: Record<string, unknown> = { ...dependencyGraph }
	delete snapshot.pathFormat
	return {
		...snapshot,
		nodes: ((snapshot.nodes as Array<{ files?: string[] }>) || []).map(node => ({
			...node,
			files: (node.files || []).map((filePath: string) => path.resolve(workPath, filePath)),
		})),
		fileEdges: ((snapshot.fileEdges as Array<{ file: string }>) || []).map(fileEdge => ({
			...fileEdge,
			file: path.resolve(workPath, fileEdge.file),
		})),
	}
}

interface FileFingerprint { missing?: boolean; mtimeMs?: number; ctimeMs?: number; size?: number; hash?: string }
function fingerprintFile(filePath: string, previousFingerprint: FileFingerprint | undefined): FileFingerprint {
	let stat: fs.Stats
	try {
		stat = fs.statSync(filePath)
	}
	catch {
		return { missing: true }
	}
	if (!stat.isFile()) {
		return { missing: true }
	}
	if (previousFingerprint
		&& !previousFingerprint.missing
		&& previousFingerprint.mtimeMs === stat.mtimeMs
		&& previousFingerprint.ctimeMs === stat.ctimeMs
		&& previousFingerprint.size === stat.size
		&& previousFingerprint.hash) {
		return previousFingerprint
	}
	return {
		mtimeMs: stat.mtimeMs,
		ctimeMs: stat.ctimeMs,
		size: stat.size,
		hash: crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
	}
}

function createDependencyFileFingerprints(dependencyGraph: { nodes?: Array<{ files?: string[] }> } | null | undefined, previousFingerprints: Record<string, FileFingerprint> = {}, workPath: string = process.cwd()): Record<string, FileFingerprint> {
	return Object.fromEntries(
		getRawDependencyFiles(dependencyGraph).map(cachePath => [
			cachePath,
			fingerprintFile(
				resolveDependencyFilePath(cachePath, workPath),
				previousFingerprints[cachePath],
			),
		]),
	)
}

function inspectDependencyFileChanges(dependencyGraph: { nodes?: Array<{ files?: string[] }> } | null | undefined, previousFingerprints: Record<string, FileFingerprint> | undefined, workPath: string = process.cwd()): { changedFiles: Array<{ filePath: string; event: string }>; currentFingerprints: Record<string, FileFingerprint>; invalidFiles: string[] } {
	const currentFingerprints = createDependencyFileFingerprints(dependencyGraph, previousFingerprints, workPath)
	const changedFiles = []
	const invalidFiles = []
	for (const cachePath of getRawDependencyFiles(dependencyGraph)) {
		const filePath = resolveDependencyFilePath(cachePath, workPath)
		const previous = previousFingerprints?.[cachePath]
		const current = currentFingerprints[cachePath]
		if (!previous || (!previous.missing && !previous.hash)) {
			invalidFiles.push(filePath)
			continue
		}
		if (previous.missing !== current!.missing) {
			changedFiles.push({
				filePath,
				event: current!.missing ? 'unlink' : 'add',
			})
		}
		else if (!current!.missing && previous.hash !== current!.hash) {
			changedFiles.push({ filePath, event: 'change' })
		}
	}
	return { changedFiles, currentFingerprints, invalidFiles }
}

function createFullBuildPlan(reason: string): { mode: string; reason: string; options: Record<string, unknown> } {
	return { mode: 'full', reason, options: {} }
}

function isNpmPackageFile(filePath: string): boolean {
	return path.normalize(filePath).split(path.sep).includes('miniprogram_npm')
}

function createCachedAppBuildPlan({ cacheEntry, workPath, publishedPath }: { cacheEntry: Record<string, unknown> | null | undefined; workPath: string; publishedPath: string }): Record<string, unknown> {
	if (!cacheEntry?.appInfo || !cacheEntry?.dependencyGraph || !cacheEntry?.fileFingerprints) {
		return createFullBuildPlan('missing-cache-data')
	}
	if (!fs.existsSync(publishedPath)) {
		return createFullBuildPlan('missing-output')
	}
	if (!Array.isArray((cacheEntry?.dependencyGraph as { fileEdges?: unknown })?.fileEdges)) {
		return createFullBuildPlan('untyped-dependency-graph')
	}
	const cachedFiles = cacheEntry?.projectFiles
	if (!Array.isArray(cachedFiles)) {
		return createFullBuildPlan('missing-project-manifest')
	}
	const projectFiles = getProjectFileManifest(workPath)
	if (projectFiles.length !== cachedFiles.length
		|| projectFiles.some((filePath, index) => filePath !== cachedFiles[index])) {
		return createFullBuildPlan('file-structure-changed')
	}

	const inspection = inspectDependencyFileChanges(
		(cacheEntry?.dependencyGraph as { nodes?: Array<{ files?: string[] }> }),
		(cacheEntry?.fileFingerprints as Record<string, FileFingerprint>),
		workPath,
	)
	if (inspection.invalidFiles.length > 0) {
		return createFullBuildPlan('invalid-file-fingerprints')
	}
	if (inspection.changedFiles.length === 0) {
		return {
			mode: 'skip',
			reason: 'unchanged',
			fileFingerprints: inspection.currentFingerprints,
		}
	}
	if (inspection.changedFiles.some(change => change.event !== 'change')) {
		return createFullBuildPlan('file-structure-changed')
	}
	if (inspection.changedFiles.some(change => path.extname(change.filePath).toLowerCase() === '.json')) {
		return createFullBuildPlan('config-changed')
	}

	const hydratedDependencyGraph = hydrateDependencyGraphFromCache(cacheEntry?.dependencyGraph as Record<string, unknown>, workPath)
	const dependencyGraph = new DependencyGraph(hydratedDependencyGraph)
	const changedFilePaths = inspection.changedFiles.map(change => change.filePath)
	const { stages, unknownKinds } = getCompileStagesForFiles(dependencyGraph, changedFilePaths)
	if (unknownKinds.length > 0 || changedFilePaths.some(filePath => dependencyGraph.getFileKinds(filePath).length === 0)) {
		return createFullBuildPlan('unknown-dependency-kind')
	}
	const affectedEntries = [...new Set(
		changedFilePaths.flatMap(filePath => dependencyGraph.getAffectedEntries(filePath)),
	)].sort()
	if (affectedEntries.length === 0) {
		return {
			mode: 'skip',
			reason: 'no-affected-entry',
			fileFingerprints: inspection.currentFingerprints,
		}
	}

	return {
		mode: 'incremental',
		reason: 'dependency-change',
		changedFiles: changedFilePaths,
		fileFingerprints: inspection.currentFingerprints,
		options: {
			affectedEntries,
			stages,
			seedPath: publishedPath,
			dependencyGraph: hydratedDependencyGraph,
			prepareConfig: changedFilePaths.some(filePath => dependencyGraph.getFileKinds(filePath).includes('config')),
			prepareNpm: changedFilePaths.some(isNpmPackageFile),
		},
	}
}

function createAppCacheEntry(buildResult: Record<string, unknown>, workPath: string, previousFingerprints: Record<string, FileFingerprint> = {}): Record<string, unknown> {
	const { dependencyGraph, ...appInfo } = buildResult as { dependencyGraph: Record<string, unknown> }
	const cachedDependencyGraph = serializeDependencyGraphForCache(dependencyGraph, workPath)
	return {
		lastCompileTime: Date.now(),
		appInfo,
		dependencyGraph: cachedDependencyGraph,
		projectFiles: getProjectFileManifest(workPath),
		fileFingerprints: createDependencyFileFingerprints(
			cachedDependencyGraph,
			previousFingerprints,
			workPath,
		),
	}
}

export {
	COMPILE_CACHE_VERSION,
	createAppCacheEntry,
	createCachedAppBuildPlan,
	createDependencyFileFingerprints,
	getDependencyFiles,
	getProjectFileManifest,
	hydrateDependencyGraphFromCache,
	inspectDependencyFileChanges,
	serializeDependencyGraphForCache,
}
