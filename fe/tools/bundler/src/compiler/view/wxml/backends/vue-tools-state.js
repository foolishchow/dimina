/**
 * Shared compile state for vue-tools (W1) — owned here so index + vue-tools share one Map/flag.
 */
export const templateRenderCache = new Map()

/** @type {boolean} */
export let enableSourcemap = false

export function setEnableSourcemap(value) {
	enableSourcemap = !!value
}
