import message from './message'
import { registerStyle, styleRegistry } from './hmr-style'
import { Module } from './module'

class Loader {
	constructor() {
		this.staticModules = {}
	}

	async loadResource(opts) {
		const { bridgeId, appId, pagePath, root, baseUrl, resourceLoadId, runtimeType } = opts
		if (runtimeType === 'game') {
			this.reportResourceLoaded({ bridgeId, resourceLoadId })
			return true
		}

		const filename = pagePath.replace(/\//g, '_')
		const appStyleResourcePath = `${baseUrl}${appId}/main/app.css`
		const styleResourcePath = `${baseUrl}${appId}/${root}/${filename}.css`
		const viewResourcePath = `${baseUrl}${appId}/${root}/${filename}.js`

		const results = await Promise.allSettled([
			this.loadStyleFile(appStyleResourcePath, { scope: 'app', appId }),
			this.loadStyleFile(styleResourcePath, { scope: 'page', appId, pagePath }),
			this.loadScriptFile(viewResourcePath),
		])

		const errors = results
			.filter(result => result.status === 'rejected')
			.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason))
		if (errors.length) {
			this.reportResourceLoadFailed({ bridgeId, pagePath, errors, resourceLoadId })
			return false
		}

		try {
			window.modRequire(pagePath)
		}
		catch (error) {
			this.reportResourceLoadFailed({
				bridgeId,
				pagePath,
				resourceLoadId,
				errors: [error instanceof Error ? error.message : String(error)],
			})
			return false
		}

		this.reportResourceLoaded({ bridgeId, resourceLoadId })
		return true
	}

	reportResourceLoaded({ bridgeId, resourceLoadId }) {
		message.invoke({
			type: 'renderResourceLoaded',
			target: 'service',
			body: {
				bridgeId,
				resourceLoadId,
			},
		})
	}

	reportResourceLoadFailed({ bridgeId, pagePath, errors, resourceLoadId }) {
		console.error('[system]', '[render]', `资源加载失败: ${errors.join('; ')}`)
		message.invoke({
			type: 'renderResourceLoadFailed',
			target: 'service',
			body: {
				bridgeId,
				resourceLoadId,
				pagePath,
				errors,
			},
		})
	}

	/**
	 * @param {string} path
	 * @param {{ scope: 'app'|'page', appId?: string, pagePath?: string }} [meta]
	 *   dev HMR（A3）登记信息：供给 L2 热替换定位同资源旧 link。
	 */
	loadStyleFile(path, meta) {
		return new Promise((resolve, reject) => {
			const style = document.createElement('link')
			style.rel = 'stylesheet'
			style.href = path
			if (meta) {
				registerStyle(styleRegistry, { ...meta, url: path, el: style })
			}
			style.onload = () => {
				resolve()
			}
			style.onerror = () => {
				reject(new Error(`样式文件加载失败: ${path}`))
			}
			document.head.append(style)
		})
	}

	loadScriptFile(path) {
		return new Promise((resolve, reject) => {
			const script = document.createElement('script')
			script.src = path
			script.onload = () => {
				resolve()
			}
			script.onerror = () => {
				reject(new Error(`脚本文件加载失败: ${path}`))
			}
			document.head.append(script)
		})
	}

	/**
	 * 创建渲染层映射实例
	 * window.Module -> create
	 * @param {{path: string, scopeId: string, usingComponents: object, render: Function}} moduleInfo
	 */
	createModule(moduleInfo) {
		const { path, usingComponents, componentPlaceholder = {} } = moduleInfo
		if (this.staticModules[path]) {
			return
		}

		this.staticModules[path] = new Module(moduleInfo)

		for (const [componentName, componentPath] of Object.entries(usingComponents)) {
			try {
				window.modRequire(componentPath)
			}
			catch (error) {
				const placeholderName = componentPlaceholder[componentName]
				const placeholderPath = placeholderName && usingComponents[placeholderName]
				if (!placeholderPath) {
					throw error
				}
				window.modRequire(placeholderPath)
			}
		}
	}

	/**
	 * serviceResourceLoaded && renderResourceLoaded ->
	 * [Container]resourceLoaded -> [Service]resourceLoaded -> [Service]initialDataReady -> [Container]initialDataReady -> [Render]setInitialData
	 * @param {*} initialData
	 */
	setInitialData(initialData) {
		for (const [path, data] of Object.entries(initialData)) {
			if (!data) {
				continue
			}
			const module = this.staticModules[path]
			if (!module) {
				continue
			}
			module.setInitialData(data)
		}
	}

	getModuleByPath(path) {
		return this.staticModules[path]
	}
}

export default new Loader()
