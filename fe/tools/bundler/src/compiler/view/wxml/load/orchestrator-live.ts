/**
 * Live bindings for wxs/asset helpers still in view/index.js (W1 cycle break).
 */
export let transTagWxs: ((document: unknown, scriptModule: unknown, filePath: string, graphOwnerPath?: string) => unknown) | undefined
export let transAsses: ((document: unknown, imageNodes: unknown, path: string, graphOwnerPath?: string) => unknown) | undefined
export let processIncludedFileWxsDependencies: ((componentTags: unknown, includePath: string, scriptModule: unknown, components: unknown, processedPaths?: Set<string>) => unknown) | undefined
export function bindTransformOrchestrator(deps: { transTagWxs: NonNullable<typeof transTagWxs>; transAsses: NonNullable<typeof transAsses>; processIncludedFileWxsDependencies: NonNullable<typeof processIncludedFileWxsDependencies> }) {
	transTagWxs = deps.transTagWxs
	transAsses = deps.transAsses
	processIncludedFileWxsDependencies = deps.processIncludedFileWxsDependencies
}
