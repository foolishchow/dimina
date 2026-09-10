import { isWebWorker } from '@dimina/common'

/** Cooperative suspension shared by Worker, QuickJS and JavaScriptCore services. */
export class BackgroundScheduler {
	constructor(clock) {
		this.clock = clock
		this.paused = false
		this.timers = new Map()
		this.nextId = 0
		this.pending = []
		this.drainHandle = undefined
		this.draining = false
		this.pendingHead = 0
		this.epoch = 0
		this.postTask = clock.postTask ?? (fn => clock.setTimeout(fn, 0))
		this.cancelTask = clock.cancelTask ?? (id => clock.clearTimeout(id))
	}

	set(callback, delay = 0, repeat = false, args = []) {
		if (typeof callback !== 'function') throw new TypeError('Timer callback must be a function')
		const ms = Math.min(2147483647, Math.max(0, Number(delay) || 0))
		const id = ++this.nextId
		const timer = { callback, args, delay: ms, remaining: ms, repeat, handle: undefined, due: 0 }
		this.timers.set(id, timer)
		if (!this.paused) this.arm(id, timer)
		return id
	}

	arm(id, timer) {
		const generation = timer.generation = (timer.generation ?? 0) + 1
		timer.due = this.clock.now() + timer.remaining
		timer.handle = this.clock.setTimeout(() => {
			if (this.paused || timer.generation !== generation || this.timers.get(id) !== timer) return
			if (!timer.repeat) this.timers.delete(id)
			try { timer.callback(...timer.args) }
			finally {
				if (timer.repeat && this.timers.has(id)) {
					timer.remaining = Math.max(1, timer.delay)
					if (!this.paused) this.arm(id, timer)
				}
			}
		}, timer.remaining)
	}

	dispatch(action) {
		if (this.paused || this.draining || this.pendingHead < this.pending.length || this.drainHandle !== undefined) {
			this.pending.push(action)
			this.scheduleDrain()
		}
		else action()
	}

	scheduleDrain() {
		if (this.paused || this.draining || this.pendingHead >= this.pending.length || this.drainHandle !== undefined) return
		const epoch = this.epoch
		// Each message needs a host task boundary so its entire Promise chain finishes
		// before the next message. Keep only one scheduled task, not a timer per backlog item.
		this.drainHandle = this.postTask(() => {
			if (epoch !== this.epoch) return
			this.drainHandle = undefined
			if (this.paused) return
			const action = this.pending[this.pendingHead]
			this.pending[this.pendingHead++] = undefined
			this.draining = true
			try { action() }
			finally {
				this.draining = false
				if (this.pendingHead === this.pending.length) {
					this.pending = []
					this.pendingHead = 0
				}
				else if (this.pendingHead >= 64 && this.pendingHead >= this.pending.length / 2) {
					this.pending = this.pending.slice(this.pendingHead)
					this.pendingHead = 0
				}
				this.scheduleDrain()
			}
		})
	}

	clear(id) {
		const timer = this.timers.get(id)
		if (!timer) return
		this.clock.clearTimeout(timer.handle)
		this.timers.delete(id)
	}

	pause() {
		if (this.paused) return
		this.paused = true
		this.epoch++
		if (this.drainHandle !== undefined) this.cancelTask(this.drainHandle)
		this.drainHandle = undefined
		for (const timer of this.timers.values()) {
			timer.generation = (timer.generation ?? 0) + 1
			timer.remaining = Math.max(0, timer.due - this.clock.now())
			this.clock.clearTimeout(timer.handle)
		}
	}

	resume() {
		if (!this.paused) return
		this.paused = false
		for (const [id, timer] of this.timers) this.arm(id, timer)
		this.scheduleDrain()
	}
}

let scheduler
export function installBackgroundScheduler(target = globalThis) {
	if (scheduler) return scheduler
	// MessageChannel avoids nested browser timer throttling while retaining task boundaries.
	let channel
	let serial = 0
	const tasks = new Map()
	const taskClock = isWebWorker && typeof target.MessageChannel === 'function' ? {
		postTask(fn) {
			if (!channel) {
				channel = new target.MessageChannel()
				channel.port1.onmessage = ({ data }) => {
					const task = tasks.get(data)
					tasks.delete(data)
					task?.()
				}
			}
			const id = ++serial
			tasks.set(id, fn)
			channel.port2.postMessage(id)
			return id
		},
		cancelTask(id) { tasks.delete(id) },
	} : {}
	scheduler = new BackgroundScheduler({
		...taskClock,
		now: () => target.performance?.now?.() ?? Date.now(),
		setTimeout: target.setTimeout.bind(target),
		clearTimeout: target.clearTimeout.bind(target),
	})
	target.setTimeout = (fn, delay, ...args) => scheduler.set(fn, delay, false, args)
	target.setInterval = (fn, delay, ...args) => scheduler.set(fn, delay, true, args)
	target.clearTimeout = target.clearInterval = id => scheduler.clear(id)
	return scheduler
}
export function dispatchBackgroundWork(action) {
	if (scheduler) scheduler.dispatch(action)
	else action()
}
export function pauseBackgroundWork() { scheduler?.pause() }
export function resumeBackgroundWork() { scheduler?.resume() }
