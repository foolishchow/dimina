/**
 * Live bindings for wxs/asset helpers still in view/index.js (W1 cycle break).
 */
export let transTagWxs: ((document: import('../common/document.ts').WxmlNode, scriptModule: unknown[], filePath: string, graphOwnerPath?: string) => void) | undefined
export let transAsses: ((document: import('../common/document.ts').WxmlNode, imageNodes: import('../common/document.ts').WxmlNode[], path: string, graphOwnerPath?: string) => void) | undefined
export let processIncludedFileWxsDependencies: ((componentTags: unknown, includePath: string, scriptModule: unknown[], components: Record<string, unknown>, processedPaths?: Set<string>) => void) | undefined
export function bindTransformOrchestrator(deps: { transTagWxs: NonNullable<typeof transTagWxs>; transAsses: NonNullable<typeof transAsses>; processIncludedFileWxsDependencies: NonNullable<typeof processIncludedFileWxsDependencies> }) {
	transTagWxs = deps.transTagWxs
	transAsses = deps.transAsses
	processIncludedFileWxsDependencies = deps.processIncludedFileWxsDependencies
}
