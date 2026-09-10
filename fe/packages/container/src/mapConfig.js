import { getMapLocation } from './mapLocation'

// Each pageFrame has its own window. Configuring the outer demo window does not configure maps.
export function installDemoMapConfig(frameWindow, env) {
	if (frameWindow.__DIMINA_MAP_CONFIG__) return
	const key = env.VITE_AMAP_WEB_KEY?.trim()
	const securityJsCode = env.VITE_AMAP_SECURITY_JS_CODE?.trim()
	const serviceHost = env.VITE_AMAP_SERVICE_HOST?.trim()
	const config = {
		provider: 'amap',
		getLocation: options => getMapLocation(frameWindow, options),
		providerOptions: { amap: { key, ...(serviceHost ? { serviceHost } : securityJsCode ? { securityJsCode } : {}) } },
		authorize() {
			if (!key) throw new Error('Web 地图未配置：请在 fe/packages/container/.env.local 中设置 VITE_AMAP_WEB_KEY，保存后重启 Web 开发服务')
			if (env.VITE_AMAP_PRIVACY_CONSENT !== 'true') throw new Error('地图服务尚未授权：确认同意使用高德地图服务后，在本地演示配置中设置 VITE_AMAP_PRIVACY_CONSENT=true')
			return true
		},
	}
	// This pageFrame bundle is also packaged into native SDKs. The Web container sets this
	// marker before rendering a page; native containers must retain their native provider.
	Object.defineProperty(frameWindow, '__DIMINA_MAP_CONFIG__', {
		configurable: true,
		get: () => frameWindow.DiminaRenderBridge?.mapRenderer === 'web' ? config : undefined,
		set(value) {
			Object.defineProperty(frameWindow, '__DIMINA_MAP_CONFIG__', { value, writable: true, configurable: true })
		},
	})
}
