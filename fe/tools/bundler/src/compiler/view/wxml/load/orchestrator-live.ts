/**
 * Live bindings for wxs/asset helpers still in view/index.js (W1 cycle break).
 */
// @ts-expect-error P-TM05: type narrowing needed
export let transTagWxs
// @ts-expect-error P-TM05: type narrowing needed
export let transAsses
// @ts-expect-error P-TM05: type narrowing needed
export let processIncludedFileWxsDependencies

// @ts-expect-error P-TM05: type narrowing needed
export function bindTransformOrchestrator(deps) {
	transTagWxs = deps.transTagWxs
	transAsses = deps.transAsses
	processIncludedFileWxsDependencies = deps.processIncludedFileWxsDependencies
}
