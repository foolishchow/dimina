export class BufferingLogger {
	#buffer: string[] = []
	warn(msg: string): void { this.#buffer.push(msg) }
	flush(): string[] { const out = this.#buffer.slice(); this.#buffer.length = 0; return out }
}

export class ConsoleLogger {
	warn(msg: string): void { console.warn(msg) }
	flush(): string[] { return [] }
}

// F54：D-WR-4 兜底——无 context 时 warnOnce 走 consoleFallback
export const consoleFallback = new ConsoleLogger()
