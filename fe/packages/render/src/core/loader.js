import message from './message'
import { registerStyle, styleRegistry } from './hmr-style'
import { Module } from './module'

class Loader {
	constructor() {
		this.staticModules = {}
		this.lastHmrBuildId = 0
		this.hmrCapture = null
		this.resourceContext = null
	}

	async loadResource(opts) {
		const { bridgeId, appId, pagePath, root, baseUrl, resourceLoadId, runtimeType } = opts
		if (runtimeType === 'game') {
			this.reportResourceLoaded({ bridgeId, resourceLoadId })
			return true
		}

		this.resourceContext = { appId, root, baseUrl }
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
	 * dev-only：重新加载当前 app 的 view 脚本，捕获 window.Module 注册的新 moduleInfo。
	 * @param {string} pagePath
	 * @param {number} buildId
	 * @returns {Promise<object>} 新注册的 moduleInfo；加载/注册失败时 reject。
	 */
	async reloadViewModule(pagePath, buildId) {
		const context = this.resourceContext
		if (!context) throw new Error('render resource context is unavailable')
		if (!Number.isInteger(buildId) || buildId <= this.lastHmrBuildId) {
			throw new Error('stale-build-id')
		}
		const filename = pagePath.replace(/\//g, '_')
		const base = `${context.baseUrl}${context.appId}/${context.root}/${filename}.js`
		const separator = base.includes('?') ? '&' : '?'
		this.hmrCapture = { path: pagePath, moduleInfo: null }
		try {
			await this.loadScriptFile(`${base}${separator}__dmcc_hmr=${buildId}`)
			window.modRequire(pagePath)
			const nextModuleInfo = this.hmrCapture.moduleInfo
			if (!nextModuleInfo) throw new Error('view module did not register during HMR load')
			return nextModuleInfo
		}
		finally {
			this.hmrCapture = null
		}
	}

	/**
	 * dev-only HMR：以事务方式替换已加载 view module。
	 * 依赖解析全部成功后才提交缓存；调用方可在 remount/replay 失败时 rollback。
	 * @param {string} path
	 * @param {object} nextModuleInfo
	 * @param {number} buildId
	 * @returns {{ committed: boolean, rollback: () => boolean, previous: Module|null }} 事务结果；
	 *   committed=true 时缓存已切换，rollback 可恢复旧模块。
	 */
	replaceModule(path, nextModuleInfo, buildId) {
		if (typeof path !== 'string' || path.length === 0 || !nextModuleInfo || nextModuleInfo.path !== path) {
			return { committed: false, reason: 'invalid-module', rollback: () => false, previous: null }
		}
		if (!Number.isInteger(buildId) || buildId <= this.lastHmrBuildId) {
			return { committed: false, reason: 'stale-build-id', rollback: () => false, previous: this.staticModules[path] || null }
		}

		const previous = this.staticModules[path] || null
		try {
			this.resolveComponents(nextModuleInfo)
		}
		catch (error) {
			return { committed: false, reason: 'dependency-resolution-failed', error, rollback: () => false, previous }
		}

		const replacement = new Module(nextModuleInfo)
		this.staticModules[path] = replacement
		this.lastHmrBuildId = buildId
		let active = true
		return {
			committed: true,
			previous,
			rollback: () => {
				if (!active || this.staticModules[path] !== replacement) return false
				if (previous) this.staticModules[path] = previous
				else delete this.staticModules[path]
				active = false
				return true
			},
		}
	}

	resolveComponents(moduleInfo) {
		const { usingComponents = {}, componentPlaceholder = {} } = moduleInfo
		for (const [componentName, componentPath] of Object.entries(usingComponents)) {
			try {
				window.modRequire(componentPath)
			}
			catch (error) {
				const placeholderName = componentPlaceholder[componentName]
				const placeholderPath = placeholderName && usingComponents[placeholderName]
				if (!placeholderPath) throw error
				window.modRequire(placeholderPath)
			}
		}
	}

	/**
	 * 创建渲染层映射实例
	 * window.Module -> create
	 * @param {{path: string, scopeId: string, usingComponents: object, render: Function}} moduleInfo
	 */
	createModule(moduleInfo) {
		const { path, usingComponents, componentPlaceholder = {} } = moduleInfo
		if (this.staticModules[path]) {
			if (this.hmrCapture?.path === path) {
				this.hmrCapture.moduleInfo = moduleInfo
			}
			return
		}
		if (this.hmrCapture?.path === path) {
			this.hmrCapture.moduleInfo = moduleInfo
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
