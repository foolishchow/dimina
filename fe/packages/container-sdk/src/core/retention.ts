export interface RetentionPolicy {
	/** Number of cached background apps. Zero disables retention. */
	maxBackgroundApps?: number
	/** Milliseconds since last hide; zero disables expiry. */
	backgroundTimeoutMs?: number
}

export function resolveRetentionPolicy(policy: RetentionPolicy = {}): Required<RetentionPolicy> {
	const maxBackgroundApps = policy.maxBackgroundApps ?? 3
	const backgroundTimeoutMs = policy.backgroundTimeoutMs ?? 300000
	if (!Number.isSafeInteger(maxBackgroundApps) || maxBackgroundApps < 0
		|| !Number.isSafeInteger(backgroundTimeoutMs) || backgroundTimeoutMs < 0) {
		throw new RangeError('Retention limits must be non-negative safe integers')
	}
	return { maxBackgroundApps, backgroundTimeoutMs }
}

/** One deadline per container, no polling and no timer per retained app. */
export class RetentionManager<T> {
	policy = resolveRetentionPolicy()
	private hidden = new Map<T, number>()
	private timer?: ReturnType<typeof setTimeout>
	private pressure = false

	constructor(private reconcile: () => void, private now = () => performance.now()) {}

	configure(policy: RetentionPolicy): void {
		this.policy = resolveRetentionPolicy(policy)
		this.reconcile()
	}

	hide(app: T): void {
		if (!this.hidden.has(app)) this.hidden.set(app, this.now())
		this.reconcile()
	}

	forget(app: T): void {
		this.hidden.delete(app)
		if (!this.hidden.size) clearTimeout(this.timer)
	}

	memoryPressure(): void {
		this.pressure = true
		this.reconcile()
	}

	collect(canEvict: (app: T) => boolean): T[] {
		clearTimeout(this.timer)
		const candidates = [...this.hidden].filter(([app]) => canEvict(app)).sort((a, b) => a[1] - b[1])
		const now = this.now()
		const { maxBackgroundApps, backgroundTimeoutMs } = this.policy
		const victims: T[] = []
		for (const [app, since] of candidates) {
			if (this.pressure || candidates.length - victims.length > maxBackgroundApps
				|| (backgroundTimeoutMs > 0 && now - since >= backgroundTimeoutMs)) {
				victims.push(app)
				this.hidden.delete(app)
			}
		}
		this.pressure = false
		const next = candidates.find(([app]) => this.hidden.has(app))
		if (next && backgroundTimeoutMs > 0) {
			this.timer = setTimeout(this.reconcile, Math.min(2147483647, Math.max(1, next[1] + backgroundTimeoutMs - now)))
		}
		return victims
	}
}
