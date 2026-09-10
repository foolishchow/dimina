import { createApp, h, provide, nextTick } from 'vue'
import MapComponent from '../../components/src/component/map/Map.vue'
import { invokeMapContext } from '../src/core/map-context'
import { callback } from '@dimina/common'
import { createMapContext } from '../../service/src/api/core/map'
import { Page } from '../../service/src/instance/page/page'
import router from '../../service/src/core/router'
import serviceMessage from '../../service/src/core/message'

vi.hoisted(() => { globalThis.DiminaServiceBridge = { onMessage: null } })

let apps = []
let adapters = []
function mount(owner, id = 'shared') {
	const host = document.createElement('div')
	document.body.append(host)
	const app = createApp({ setup() {
		provide('bridgeId', 'page')
		// useInfo resolves the current module using the injected path name.
		provide('path', 'module-path')
		provide('module-path', { id: owner })
		return () => h(MapComponent, { id })
	} })
	app.mount(host)
	apps.push(app)
	return host
}
beforeEach(() => {
	window.__message = { send: vi.fn() }
	globalThis.__DIMINA_MAP_CONFIG__ = {
		authorize: async () => true,
		provider: 'test',
		providers: { test: { create: async () => {
			const adapter = { update: vi.fn(), destroy: vi.fn(), invoke: vi.fn(() => ({ scale: 12 + adapters.length })) }
			adapters.push(adapter)
			return adapter
		} } },
	}
})
afterEach(() => {
	apps.forEach(app => app.unmount())
	apps = []; adapters = []
	document.body.innerHTML = ''
	delete globalThis.__DIMINA_MAP_CONFIG__
	callback.remove()
	vi.restoreAllMocks()
})
async function invoke(overrides = {}) {
	const send = vi.fn()
	await invokeMapContext({ bridgeId: 'page', params: { command: 'getScale', mapId: 'shared', moduleId: 'a', success: 'ok', fail: 'fail', complete: 'complete', ...overrides } }, send)
	return send.mock.calls.map(([msg]) => msg.body)
}
it('connects a mounted map and isolates same IDs in different component instances', async () => {
	mount('a'); mount('b')
	await nextTick()
	const responses = await invoke()
	expect(adapters[0].invoke).toHaveBeenCalledTimes(1)
	expect(adapters[1].invoke).not.toHaveBeenCalled()
	expect(responses.map(r => r.id)).toEqual(['ok', 'complete'])
	expect(responses[0].args.errMsg).toBe('getScale:ok')
})
it('fails missing and ambiguous IDs exactly once', async () => {
	expect((await invoke()).map(r => r.id)).toEqual(['fail', 'complete'])
	mount('a'); mount('a')
	expect((await invoke())[0].args.errMsg).toContain('ambiguous')
})
it('removes the DOM contract when the component is destroyed', async () => {
	const host = mount('a')
	const root = host.firstElementChild
	apps.pop().unmount()
	expect(root.__diminaMap).toBeUndefined()
	expect((await invoke())[0].args.errMsg).toContain('map not found')
})
it('does not match a map from another bridge', async () => {
	const host = mount('a')
	host.firstElementChild.__diminaMap.bridgeId = 'other-page'
	expect((await invoke())[0].id).toBe('fail')
})

it.each(['includePoints', 'getCenterLocation', 'moveToLocation'])('connects %s from a real service Page to its mounted map', async (command) => {
	const page = new Page({ noReferenceData: {}, type: 'page', moduleInfo: {} }, {
		bridgeId: 'page', moduleId: 'page-module', path: 'pages/map/index', query: {},
	})
	expect(page.id).not.toBe(page.__id__)
	vi.spyOn(router, 'getPageInfo').mockReturnValue(page)
	const outbound = vi.spyOn(serviceMessage, 'send').mockImplementation(() => {})
	mount(page.__id__)
	mount('child-component')
	await nextTick()
	const success = vi.fn(); const fail = vi.fn(); const complete = vi.fn()
	createMapContext('shared')[command]({ success, fail, complete })
	const request = outbound.mock.calls[0][0].body
	await invokeMapContext(request, ({ body }) => callback.invoke(body.id, body.args))
	expect(fail).not.toHaveBeenCalled()
	expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: `${command}:ok` }))
	expect(complete).toHaveBeenCalledTimes(1)
	expect(adapters[0].invoke).toHaveBeenCalledWith(command, expect.any(Object))
	expect(adapters[1].invoke).not.toHaveBeenCalled()
})
