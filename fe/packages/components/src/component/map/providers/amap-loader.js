// Configuration is owned by the page-frame host, never by mini-program attributes.
// A document can use one AMap key/security configuration. Different frames remain isolated.
const loads = new WeakMap()
export function loadAMap(config, doc = document) {
	if (config.AMap) return Promise.resolve(config.AMap)
	if (!config.key) return Promise.reject(new Error('AMap Web key is required'))
	const signature = JSON.stringify([config.key, config.securityJsCode, config.serviceHost])
	const previous = loads.get(doc)
	if (previous) {
		return previous.signature === signature ? previous.promise : Promise.reject(new Error('conflicting AMap configuration'))
	}
	const win = doc.defaultView
	if (win.AMap) return Promise.reject(new Error('AMap already loaded; pass config.AMap explicitly'))
	win._AMapSecurityConfig = config.serviceHost
		? { serviceHost: config.serviceHost }
		: { securityJsCode: config.securityJsCode }
	const script = doc.createElement('script')
	const query = new URLSearchParams({ v: '2.0', key: config.key, plugin: 'AMap.Scale,AMap.ControlBar' })
	script.src = `https://webapi.amap.com/maps?${query}`
	script.async = true
	const promise = new Promise((resolve, reject) => {
		const timer = setTimeout(() => finish(new Error('AMap script load timed out')), config.timeout ?? 15000)
		const finish = (error) => {
			clearTimeout(timer)
			script.onload = script.onerror = null
			if (error) {
				script.remove()
				reject(error)
			}
			else resolve(win.AMap)
		}
		script.onload = () => finish(win.AMap ? null : new Error('AMap SDK is unavailable'))
		script.onerror = () => finish(new Error('AMap script load failed'))
		doc.head.appendChild(script)
	})
	loads.set(doc, { signature, promise })
	return promise
}
