export class BufferingLogger {
	#buffer = []
	warn(msg) { this.#buffer.push(msg) }
	flush() { const out = this.#buffer.slice(); this.#buffer.length = 0; return out }
}

export class ConsoleLogger {
	warn(msg) { console.warn(msg) }
	flush() { return [] }
}

// F54：D-WR-4 兜底——无 context 时 warnOnce 走 consoleFallback
export const consoleFallback = new ConsoleLogger()
