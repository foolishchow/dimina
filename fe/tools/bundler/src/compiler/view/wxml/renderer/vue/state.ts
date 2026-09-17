/**
 * Shared compile state for vue renderer tools (W1) — owned here so index + tools share one Map/flag.
 */
export const templateRenderCache = new Map()

/** @type {boolean} */
export let enableSourcemap = false

// @ts-expect-error P-TM05: type narrowing needed
export function setEnableSourcemap(value) {
	enableSourcemap = !!value
}
