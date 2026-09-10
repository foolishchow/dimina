import { resolveMapProvider, validateMapAdapter } from './providers/registry'
import { validateMapCommand } from './map-command'

// One session per component. Teardown settles in-flight calls even if a host provider never resolves.
export function createMapSession({ element, props, emit, bridgeId, config = globalThis.__DIMINA_MAP_CONFIG__ }) {
	const controller = new AbortController()
	let adapter
	let destroyed = false
	const close = () => {
		if (destroyed) return
		destroyed = true
		controller.abort()
		adapter?.destroy?.()
	}
	const timeout = Number.isFinite(config?.timeout) && config.timeout > 0 ? config.timeout : 15000
	const bounded = (work, allowance = 0) => {
		let timer
		let abort
		const disposed = new Promise((_, reject) => {
			abort = () => reject(new Error('map destroyed'))
			if (destroyed) abort()
			else controller.signal.addEventListener('abort', abort, { once: true })
		})
		const deadline = new Promise((_, reject) => {
			timer = setTimeout(() => {
				const error = new Error('map operation timed out')
				error.code = 'MAP_TIMEOUT'
				reject(error)
			}, timeout + allowance)
		})
		return Promise.race([work, disposed, deadline]).finally(() => {
			clearTimeout(timer)
			controller.signal.removeEventListener('abort', abort)
		})
	}
	const safeEmit = (type, detail) => { if (!destroyed) emit(type, detail) }
	const initialize = async () => {
		if (!config) throw new Error('map provider is not configured')
		if (typeof config.authorize !== 'function' || await config.authorize() !== true) {
			throw new Error('map privacy authorization denied')
		}
		if (destroyed) throw new Error('map destroyed')
		const provider = resolveMapProvider(config)
		const instance = await provider.create({
			element, props, bridgeId, emit: safeEmit, options: provider.options,
			getLocation: config.getLocation?.bind(config), signal: controller.signal,
		})
		if (destroyed) {
			instance?.destroy?.()
			throw new Error('map destroyed')
		}
		adapter = instance
		return validateMapAdapter(adapter)
	}
	const ready = bounded(initialize())
	// Report initial failure even when the page does not call MapContext.
	ready.catch((error) => {
		safeEmit('error', { errMsg: `map:fail ${error.message}` })
		close()
	})
	let queue = ready
	const enqueue = (operation, animationDuration) => {
		let work
		const started = queue.then(() => {
			if (destroyed) throw new Error('map destroyed')
			work = bounded(Promise.resolve().then(() => operation(adapter)), animationDuration || 0).catch((error) => {
				// A timed-out SDK call may still finish later. Abort its whole instance so it
				// cannot mutate the map after the mini-program has already received fail.
				if (error.code === 'MAP_TIMEOUT') {
					safeEmit('error', { errMsg: `map:fail ${error.message}` })
					close()
				}
				throw error
			})
			// Animation completion must not block marker removal, another animation,
			// camera queries or property updates. Preserve command *start* ordering.
			if (animationDuration === undefined) return work.then(() => {}, () => {})
		})
		queue = started.catch(() => ready)
		queue.catch(() => {})
		return started.then(() => work)
	}
	return {
		ready,
		update: next => enqueue(instance => instance.update(next)),
		invoke: (command, params = {}) => {
			try { validateMapCommand(command, params) } catch (error) { return Promise.reject(error) }
			const duration = command === 'translateMarker' || command === 'moveAlong' ? (params.duration ?? 1000) * 2 : undefined
			return enqueue(instance => instance.invoke(command, params), duration)
		},
		destroy: close,
	}
}
