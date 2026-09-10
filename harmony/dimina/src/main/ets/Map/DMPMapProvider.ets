import { DMPMap } from '../Utils/DMPMap'
import { DMPApp } from '../DApp/DMPApp'
import { DMPChannelProxyNext } from '../Service/DMPChannelProxyNext'

export interface DMPNativeMapEvents {
  ready: () => void
  event: (name: string, detail: DMPMap) => void
  error: (message: string) => void
}
export interface DMPNativeMapHandle {
  builder: WrappedBuilder<[DMPMap]>
  builderParams: DMPMap
  update(props: DMPMap): void
  invoke(command: string, args: DMPMap): Promise<DMPMap>
  detach?: () => void
  destroy(): void
}
export interface DMPNativeMapProvider {
  create(params: DMPMap, events: DMPNativeMapEvents): DMPNativeMapHandle
}
export class DMPMapProviders {
  private static providers: Map<string, DMPNativeMapProvider> = new Map()
  private static selected: string = ''
  static register(name: string, provider: DMPNativeMapProvider, select: boolean = true): void {
    DMPMapProviders.providers.set(name, provider)
    if (select) DMPMapProviders.selected = name
  }
  static select(name: string): void {
    if (!DMPMapProviders.providers.has(name)) throw new Error(`Map provider is not registered: ${name}`)
    DMPMapProviders.selected = name
  }
  static create(params: DMPMap, events: DMPNativeMapEvents): DMPNativeMapHandle {
    const provider = DMPMapProviders.providers.get(DMPMapProviders.selected)
    if (!provider) throw new Error('Native map provider is not configured')
    return provider.create(params, events)
  }
}
class MapSession {
  app: DMPApp
  webViewId: number
  params: DMPMap
  handle: DMPNativeMapHandle
  constructor(app: DMPApp, webViewId: number, params: DMPMap, handle: DMPNativeMapHandle) {
    this.app = app; this.webViewId = webViewId; this.params = params; this.handle = handle
  }
}
export class DMPNativeMapManager {
  private static sessions: Map<string, MapSession> = new Map()
  private static key(appIndex: number, webViewId: number, id: string): string { return `${appIndex}/${webViewId}/${id}` }
  static get(appIndex: number, webViewId: number, id: string): DMPNativeMapHandle | undefined {
    return DMPNativeMapManager.sessions.get(DMPNativeMapManager.key(appIndex, webViewId, id))?.handle
  }
  private static send(app: DMPApp, webViewId: number, type: string, body: DMPMap): void {
    DMPChannelProxyNext.ContainerToRender(new DMPMap({ type: type, body: body.toJSON() }), app, webViewId)
  }
  private static result(app: DMPApp, webViewId: number, params: DMPMap, ok: boolean, data: DMPMap): void {
    const requestId = params.getString('requestId')
    if (!requestId) return
    DMPNativeMapManager.send(app, webViewId, 'mapResult', new DMPMap({
      id: params.getString('id'), requestId: requestId, ok: ok, data: data.toJSON()
    }))
  }
  static mount(app: DMPApp, webViewId: number, params: DMPMap): void {
    const id = params.getString('id') ?? ''
    const key = DMPNativeMapManager.key(app.appIndex, webViewId, id)
    DMPNativeMapManager.remove(app.appIndex, webViewId, id)
    try {
      let settled = false
      let stored = false
      let pendingReady = false
      const events: DMPNativeMapEvents = {
        ready: () => {
          if (!stored) { pendingReady = true; return }
          if (!DMPNativeMapManager.sessions.has(key) || settled) return
          settled = true
          DMPNativeMapManager.result(app, webViewId, params, true, new DMPMap())
          events.event('rendersuccess', new DMPMap())
        },
        event: (name: string, detail: DMPMap) => {
          if (!DMPNativeMapManager.sessions.has(key)) return
          DMPNativeMapManager.send(app, webViewId, 'mapEvent', new DMPMap({ id: id, event: name, detail: detail.toJSON() }))
        },
        error: (message: string) => {
          if (!settled) { settled = true; DMPNativeMapManager.result(app, webViewId, params, false, new DMPMap({ errMsg: message })) }
          events.event('error', new DMPMap({ errMsg: message }))
        }
      }
      const handle = DMPMapProviders.create(params, events)
      DMPNativeMapManager.sessions.set(key, new MapSession(app, webViewId, params, handle))
      stored = true
      if (pendingReady) events.ready()
    } catch (error) {
      DMPNativeMapManager.result(app, webViewId, params, false, new DMPMap({ errMsg: (error as Error).message }))
    }
  }
  static update(app: DMPApp, webViewId: number, params: DMPMap): void {
    try {
      const handle = DMPNativeMapManager.get(app.appIndex, webViewId, params.getString('id') ?? '')
      if (!handle) throw new Error('Map not found')
      if (!params.getBoolean('layoutOnly')) handle.update(new DMPMap(params.get('props')))
      DMPNativeMapManager.result(app, webViewId, params, true, new DMPMap())
    } catch (error) {
      DMPNativeMapManager.result(app, webViewId, params, false, new DMPMap({ errMsg: (error as Error).message }))
    }
  }
  static async invoke(app: DMPApp, webViewId: number, params: DMPMap): Promise<void> {
    const id = params.getString('id') ?? ''
    const handle = DMPNativeMapManager.get(app.appIndex, webViewId, id)
    try {
      if (!handle) throw new Error('Map not found')
      const result = await handle.invoke(params.getString('command') ?? '', new DMPMap(params.get('args')))
      if (handle === DMPNativeMapManager.get(app.appIndex, webViewId, id)) DMPNativeMapManager.result(app, webViewId, params, true, result)
    } catch (error) {
      DMPNativeMapManager.result(app, webViewId, params, false, new DMPMap({ errMsg: (error as Error).message }))
    }
  }
  static clearPage(appIndex: number, webViewId: number): void {
    const prefix = `${appIndex}/${webViewId}/`
    const keys: string[] = []
    DMPNativeMapManager.sessions.forEach((_session, key) => { if (key.startsWith(prefix)) keys.push(key) })
    keys.forEach(key => {
      const session = DMPNativeMapManager.sessions.get(key)
      DMPNativeMapManager.sessions.delete(key)
      session?.handle.destroy()
    })
  }
  static remove(appIndex: number, webViewId: number, id: string): void {
    const key = DMPNativeMapManager.key(appIndex, webViewId, id)
    const session = DMPNativeMapManager.sessions.get(key)
    DMPNativeMapManager.sessions.delete(key)
    session?.handle.destroy()
  }
}
