/**
 * Live bindings for wxs/asset helpers still in view/index.js (W1 cycle break).
 */
export let transTagWxs
export let transAsses
export let processIncludedFileWxsDependencies

export function bindTransformOrchestrator(deps) {
	transTagWxs = deps.transTagWxs
	transAsses = deps.transAsses
	processIncludedFileWxsDependencies = deps.processIncludedFileWxsDependencies
}
