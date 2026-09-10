import UIKit
import WebKit

@MainActor final class DMPNativeMapHost {
    private static var hosts: [Int: DMPNativeMapHost] = [:]
    private weak var app: DMPApp?
    private weak var webview: DMPWebview?
    private let webViewId: Int
    private var instances: [String: any DMPMapInstance] = [:]
    private var clips: [String: UIView] = [:]
    private var layouts: [String: DMPMap] = [:]
    private var observer: NSKeyValueObservation?
    private let overlay = MapPassthroughView()

    static func handle(_ api: String, params: DMPMap, app: DMPApp, webview: DMPWebview, webViewId: Int) {
        let host = hosts[webViewId] ?? DMPNativeMapHost(app: app, webview: webview, webViewId: webViewId)
        hosts[webViewId] = host
        host.handle(api, params)
    }
    static func clear(_ webViewId: Int) {
        hosts.removeValue(forKey: webViewId)?.destroy()
    }
    private init(app: DMPApp, webview: DMPWebview, webViewId: Int) {
        self.app = app; self.webview = webview; self.webViewId = webViewId
        let view = webview.getWebView()
        overlay.frame = view.bounds
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.clipsToBounds = true
        view.addSubview(overlay)
        observer = view.scrollView.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.updateLayouts() }
        }
    }
    private func send(_ type: String, _ body: [String: Any]) {
        DMPChannelProxy.containerToRender(msg: DMPMap(["type": type, "body": body]), app: app, webViewId: webViewId)
    }
    private func result(_ params: DMPMap, _ result: Result<[String: Any], Error>) {
        guard let requestId = params.getString(key: "requestId"), let id = params.getString(key: "id") else { return }
        switch result {
        case .success(let data): send("mapResult", ["id": id, "requestId": requestId, "ok": true, "data": data])
        case .failure(let error): send("mapResult", ["id": id, "requestId": requestId, "ok": false, "data": ["errMsg": error.localizedDescription]])
        }
    }
    private func handle(_ api: String, _ params: DMPMap) {
        guard let id = params.getString(key: "id"), !id.isEmpty else { return }
        do {
            switch api {
            case "mapMount":
                remove(id)
                var settled = false
                let events = DMPMapEvents(ready: { [weak self] in
                    DispatchQueue.main.async {
                        guard let self, self.instances[id] != nil, !settled else { return }
                        settled = true
                        self.result(params, .success([:]))
                        self.send("mapEvent", ["id": id, "event": "rendersuccess", "detail": [:]])
                    }
                }, event: { [weak self] event, detail in
                    guard let self, self.instances[id] != nil else { return }
                    self.send("mapEvent", ["id": id, "event": event, "detail": detail])
                }, error: { [weak self] message in
                    guard let self else { return }
                    if !settled { settled = true; self.result(params, .failure(DMPMapError(message))) }
                    self.send("mapEvent", ["id": id, "event": "error", "detail": ["errMsg": message]])
                })
                let instance = try DMPMapProviders.create(events: events)
                instances[id] = instance
                let clip = UIView()
                clip.clipsToBounds = true
                clips[id] = clip
                overlay.addSubview(clip)
                clip.addSubview(instance.view)
                layouts[id] = params
                updateLayouts()
                try instance.update(params.getDict(key: "props") ?? [:])
            case "mapUpdate":
                guard let instance = instances[id] else { throw DMPMapError("Map not found") }
                layouts[id] = params
                updateLayouts()
                if params.getBool(key: "layoutOnly") != true { try instance.update(params.getDict(key: "props") ?? [:]) }
                result(params, .success([:]))
            case "mapContext":
                guard let instance = instances[id] else { throw DMPMapError("Map not found") }
                var settled = false
                instance.invoke(params.getString(key: "command") ?? "", args: params.getDict(key: "args") ?? [:]) { [weak self, weak instance] response in
                    guard let self, let instance, self.instances[id] === instance, !settled else { return }
                    settled = true
                    self.result(params, response)
                }
            case "mapUnmount": remove(id)
            default: break
            }
        } catch {
            if api == "mapMount" { remove(id) }
            result(params, .failure(error))
        }
    }
    private func updateLayouts() {
        guard let webview else { return }
        let offset = webview.getWebView().scrollView.contentOffset
        for (id, params) in layouts {
            guard let instance = instances[id], let rect = params.getDMPMap(key: "rect") else { continue }
            let frame = CGRect(x: (rect.getDouble(key: "pageLeft") ?? 0) - offset.x,
                               y: (rect.getDouble(key: "pageTop") ?? 0) - offset.y,
                               width: max(0, rect.getDouble(key: "width") ?? 0), height: max(0, rect.getDouble(key: "height") ?? 0))
            guard let container = clips[id] else { continue }
            let clip = params.getDMPMap(key: "clip")
            let left = clip?.getDouble(key: "left") ?? 0
            let top = clip?.getDouble(key: "top") ?? 0
            let right = clip?.getDouble(key: "right") ?? frame.width
            let bottom = clip?.getDouble(key: "bottom") ?? frame.height
            container.frame = CGRect(x: frame.minX + left, y: frame.minY + top, width: max(0, right - left), height: max(0, bottom - top))
            instance.view.frame = CGRect(x: -left, y: -top, width: frame.width, height: frame.height)
            container.alpha = params.getDouble(key: "opacity") ?? 1
            container.isHidden = params.getBool(key: "hidden") == true || container.frame.isEmpty
        }
    }
    private func remove(_ id: String) {
        layouts.removeValue(forKey: id)
        clips.removeValue(forKey: id)?.removeFromSuperview()
        if let instance = instances.removeValue(forKey: id) { instance.destroy(); instance.view.removeFromSuperview() }
    }
    private func destroy() {
        observer = nil
        for id in Array(instances.keys) { remove(id) }
        overlay.removeFromSuperview()
    }
}
private final class MapPassthroughView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}
