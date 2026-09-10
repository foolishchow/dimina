import { createAMap } from './amap'
import { createNativeMap } from './native'

/** @type {Record<string, import('../../../../map-provider').MapProvider>} */
const builtInProviders = Object.freeze({ amap: Object.freeze({ create: createAMap }), native: Object.freeze({ create: createNativeMap }) })

/** Resolve once per map instance; changing host configuration cannot retarget an existing map. */
export function resolveMapProvider(config) {
	const name = config.provider
	const providers = config.providers || {}
	const provider = Object.hasOwn(providers, name) ? providers[name]
		: Object.hasOwn(builtInProviders, name) ? builtInProviders[name] : null
	if (!provider || typeof provider.create !== 'function') {
		throw new Error(`map provider is not registered: ${name || '(empty)'}`)
	}
	return {
		create: provider.create.bind(provider),
		options: config.providerOptions?.[name] || {},
	}
}

export function validateMapAdapter(adapter) {
	if (!adapter || ['update', 'invoke', 'destroy'].some(method => typeof adapter[method] !== 'function')) {
		throw new Error('invalid map provider adapter: update, invoke and destroy are required')
	}
	return adapter
}
