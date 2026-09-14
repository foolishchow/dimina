import message from './message'
import router from './router'

const pending = []
const readyPages = new Set()
let installed = false
let serial = 0
let forwarding = false

function snapshot(value) {
	const seen = new WeakSet()
	return JSON.parse(JSON.stringify(value, (_key, item) => {
		if (typeof item === 'bigint') return String(item)
		if (item instanceof Error) return item.stack || item.message
		if (item && typeof item === 'object') {
			if (seen.has(item)) return '[Circular]'
			seen.add(item)
		}
		return item === undefined ? 'undefined' : item
	}))
}

function emit(detail, bridgeId = router.getPageInfo().id) {
	if (!globalThis.__diminaDebug || forwarding) return
	forwarding = true
	try {
		const body = { type: 'log', detail: snapshot(detail), bridgeId }
		if (readyPages.has(bridgeId)) message.send({ type: 'print', target: 'render', body })
		else {
			pending.push(body)
			if (pending.length > 200) pending.shift()
		}
	}
	catch { /* Debugging must never interrupt business code. */ }
	finally { forwarding = false }
}

export function installDebug() {
	if (!globalThis.__diminaDebug || installed) return
	installed = true
	for (const type of ['log', 'info', 'warn', 'error', 'debug']) {
		const original = console[type]
		console[type] = function (...args) {
			original?.apply(console, args)
			emit({ group: 'console', type, value: args })
		}
	}
	message.on('resourceLoaded', ({ bridgeId }) => {
		readyPages.add(bridgeId)
		for (let i = 0; i < pending.length;) {
			const body = pending[i]
			if (!body.bridgeId || body.bridgeId === bridgeId) {
				pending.splice(i, 1)
				emit(body.detail, bridgeId)
			}
			else i++
		}
	})
	message.on('pageUnload', ({ bridgeId }) => {
		readyPages.delete(bridgeId)
		for (let i = pending.length - 1; i >= 0; i--) {
			if (pending[i].bridgeId === bridgeId) pending.splice(i, 1)
		}
	})
	message.on('debugStorage', async ({ bridgeId, action, key, data, encrypted }) => {
		if (!globalThis.__diminaDebug) return
		try {
			if (action !== undefined) {
				if (!['set', 'remove'].includes(action) || typeof key !== 'string' || !key) throw new Error('Invalid storage operation')
				if (action === 'set') {
					if (data === undefined) throw new Error('Storage value is required')
					await globalThis.wx.setStorage({ key, data, encrypt: encrypted === true })
				}
				else await globalThis.wx.removeStorage({ key, encrypt: encrypted === true })
			}

			if (typeof globalThis.__diminaDebugStorageSnapshot === 'function') {
				emit({ group: 'storage', value: globalThis.__diminaDebugStorageSnapshot() }, bridgeId)
				return
			}
			const { keys } = await globalThis.wx.getStorageInfo()
			const entries = await Promise.all(keys.map(async key => {
				const { data } = await globalThis.wx.getStorage({ key })
				return { key, data }
			}))
			emit({ group: 'storage', value: entries }, bridgeId)
		}
		catch (error) {
			emit({ group: 'storage', error: error?.errMsg || String(error) }, bridgeId)
		}
	})
}

export function debugRequest(options) {
	if (!globalThis.__diminaDebug || !options || typeof options !== 'object') return options
	const bridgeId = router.getPageInfo().id
	const startTime = Date.now()
	const record = {
		id: `dimina-request-${++serial}`, url: options.url, method: options.method || 'GET',
		requestHeader: options.header || {}, postData: options.data, requestType: 'custom',
		startTime, readyState: 1, status: 0,
	}
	emit({ group: 'network', value: record }, bridgeId)
	const finish = (result, failed) => emit({
		group: 'network',
		value: { ...record, readyState: 4, endTime: Date.now(), costTime: Date.now() - startTime,
			status: failed ? 0 : result.statusCode, header: result.header || {},
			response: failed ? result.errMsg : result.data },
	}, bridgeId)
	return {
		...options,
		success(result) {
			finish(result, false)
			if (typeof options.success === 'function') options.success(result)
		},
		fail(result) {
			finish(result, true)
			if (typeof options.fail === 'function') options.fail(result)
		},
	}
}
