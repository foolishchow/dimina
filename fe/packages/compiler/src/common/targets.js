const DEFAULT_TARGET = 'webview'
const SUPPORTED_TARGETS = Object.freeze([DEFAULT_TARGET])

export class InvalidTargetError extends TypeError {
	constructor(target) {
		super(`Unsupported compiler target: ${String(target)} (expected: ${SUPPORTED_TARGETS.join(', ')})`)
		this.name = 'InvalidTargetError'
		this.code = 'DIMINA_INVALID_TARGET'
		this.target = target
	}
}

export function resolveTarget(target) {
	const resolved = target === undefined ? DEFAULT_TARGET : target
	if (!SUPPORTED_TARGETS.includes(resolved)) {
		throw new InvalidTargetError(resolved)
	}
	return resolved
}

export { DEFAULT_TARGET, SUPPORTED_TARGETS }
