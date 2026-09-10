import { createMapContext } from '../src/api/core/map'
import router from '../src/core/router'
import message from '../src/core/message'
import { callback } from '@dimina/common'

beforeEach(() => {
	vi.spyOn(router, 'getPageInfo').mockReturnValue({ id: 'page-a', bridgeId: 'page-a', __id__: 'module-a' })
	vi.spyOn(message, 'send').mockImplementation(() => {})
})
afterEach(() => { callback.remove(); vi.restoreAllMocks() })

it('routes a retained context to its owner after navigation and preserves callbacks', () => {
	const context = createMapContext('map', { __id__: 'component-a' })
	vi.mocked(router.getPageInfo).mockReturnValue({ id: 'page-b' })
	const success = vi.fn()
	const complete = vi.fn()
	context.getScale({ success, complete, mapId: 'spoof', moduleId: 'spoof', mapBridgeId: 'spoof' })
	const msg = message.send.mock.calls[0][0]
	expect(msg.target).toBe('render')
	expect(msg.body.bridgeId).toBe('page-a')
	expect(msg.body.params).toMatchObject({ mapId: 'map', moduleId: 'component-a', command: 'getScale' })
	callback.invoke(msg.body.params.success, { scale: 17 })
	callback.invoke(msg.body.params.complete, { scale: 17 })
	expect(success).toHaveBeenCalledWith({ scale: 17 })
	expect(complete).toHaveBeenCalledWith({ scale: 17 })
})
it('returns a promise when no callbacks are supplied', async () => {
	const result = createMapContext('map').getRegion()
	const { params } = message.send.mock.calls[0][0].body
	expect(params.moduleId).toBe('module-a')
	callback.invoke(params.fail, { errMsg: 'getRegion:fail map not found' })
	await expect(result).rejects.toMatchObject({ errMsg: 'getRegion:fail map not found' })
})

it.each(['includePoints', 'getCenterLocation', 'moveToLocation'])('routes the demo command %s with the page module ID', (command) => {
	const context = createMapContext('places')
	vi.mocked(router.getPageInfo).mockReturnValue({ id: 'page-b', bridgeId: 'page-b', __id__: 'module-b' })
	context[command]({ fail: vi.fn() })
	expect(message.send.mock.calls[0][0].body).toMatchObject({
		bridgeId: 'page-a', params: { mapId: 'places', moduleId: 'module-a', command },
	})
})

it('uses an explicitly supplied component owner even when another page is current', () => {
	const context = createMapContext('places', { bridgeId: 'previous-page', __id__: 'previous-component' })
	context.getScale({ fail: vi.fn() })
	expect(message.send.mock.calls[0][0].body).toMatchObject({
		bridgeId: 'previous-page', params: { moduleId: 'previous-component' },
	})
})

it.each(['getRotate', 'getSkew', 'toScreenLocation', 'fromScreenLocation', 'moveAlong', 'setBoundary'])('forwards %s to the owning map', (command) => {
    createMapContext('places')[command]({ success: vi.fn(), x: 3 })
    expect(message.send.mock.calls[0][0].body).toMatchObject({ bridgeId: 'page-a', params: { command, mapId: 'places', moduleId: 'module-a', x: 3 } })
})
it('keeps animationEnd on the service side and fires it once after successful movement', () => {
    const animationEnd = vi.fn(); const success = vi.fn(); const complete = vi.fn()
    createMapContext('places').translateMarker({ markerId: 0, animationEnd, success, complete })
    const { params } = message.send.mock.lastCall[0].body
    expect(params).not.toHaveProperty('animationEnd')
    callback.invoke(params.success, { errMsg: 'translateMarker:ok' })
    callback.invoke(params.success, { errMsg: 'translateMarker:ok' })
    callback.invoke(params.complete, {})
    expect(success).toHaveBeenCalledTimes(1)
    expect(animationEnd).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(1)
})
it('does not call animationEnd after cancellation', () => {
    const animationEnd = vi.fn(); const fail = vi.fn()
    createMapContext('places').translateMarker({ markerId: 0, animationEnd, fail })
    const { params } = message.send.mock.lastCall[0].body
    callback.invoke(params.fail, { errMsg: 'translateMarker:fail cancelled' })
    callback.invoke(params.success, {})
    expect(fail).toHaveBeenCalledTimes(1)
    expect(animationEnd).not.toHaveBeenCalled()
})
