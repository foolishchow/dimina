#if canImport(MAMapKit) && canImport(AMapFoundationKit)
import UIKit
import CoreLocation
import MAMapKit
import AMapFoundationKit

/// Optional provider, compiled only when the host links the official AMap frameworks.
@MainActor public final class DMPAMapProvider: DMPMapProvider {
    private let apiKey: String
    private let hasPrivacyConsent: () -> Bool
    public init(apiKey: String, hasPrivacyConsent: @escaping () -> Bool) {
        self.apiKey = apiKey; self.hasPrivacyConsent = hasPrivacyConsent
    }
    public func create(events: DMPMapEvents) throws -> any DMPMapInstance {
        guard hasPrivacyConsent() else { throw DMPMapError("Map privacy authorization denied") }
        guard !apiKey.isEmpty else { throw DMPMapError("AMap iOS key is required") }
        MAMapView.updatePrivacyShow(.didShow, privacyInfo: .didContain)
        MAMapView.updatePrivacyAgree(.didAgree)
        AMapServices.shared().apiKey = apiKey
        return DMPAMapInstance(events: events)
    }
}

@MainActor private final class DMPAMapInstance: NSObject, DMPMapInstance, @preconcurrency MAMapViewDelegate, @preconcurrency CLLocationManagerDelegate {
    private let map = MAMapView(frame: .zero)
    private let events: DMPMapEvents
    private var previous: [String: Any] = [:]
    private var markers: [Int: MAPointAnnotation] = [:]
    private var anonymousMarkers: [MAPointAnnotation] = []
    private var arcs: [Int: MAPolyline] = [:]
    private var geometry: [String: [any MAOverlay]] = [:]
    private var overlayStyles: [ObjectIdentifier: [String: Any]] = [:]
    private var rotations: [ObjectIdentifier: Double] = [:]
    private var motions: [Int: DMPMarkerMotion] = [:]
    private var displayLink: CADisplayLink?
    private var destroyed = false
    private var wantsLocation = false
    private let locationManager = CLLocationManager()
    private var pendingMoves: [(Result<[String: Any], Error>) -> Void] = []
    var view: UIView { map }
    init(events: DMPMapEvents) {
        self.events = events
        super.init()
        map.delegate = self
        locationManager.delegate = self
        NotificationCenter.default.addObserver(self, selector: #selector(pauseLocation), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(resumeLocation), name: UIApplication.didBecomeActiveNotification, object: nil)
    }
    func update(_ props: [String: Any]) throws {
        guard !destroyed else { throw DMPMapError("Map destroyed") }
        func changed(_ key: String) -> Bool {
            !NSDictionary(dictionary: ["value": props[key] ?? NSNull()]).isEqual(to: ["value": previous[key] ?? NSNull()])
        }
        if changed("longitude") || changed("latitude") { map.setCenter(try point(props), animated: false) }
        if changed("scale") { map.setZoomLevel((props["scale"] as? NSNumber)?.doubleValue ?? 16, animated: false) }
        map.minZoomLevel = (props["minScale"] as? NSNumber)?.doubleValue ?? 3
        map.maxZoomLevel = (props["maxScale"] as? NSNumber)?.doubleValue ?? 22
        map.isScrollEnabled = props["enableScroll"] as? Bool ?? true
        map.isZoomEnabled = props["enableZoom"] as? Bool ?? true
        map.isRotateEnabled = props["enableRotate"] as? Bool ?? false
        map.isRotateCameraEnabled = props["enableOverlooking"] as? Bool ?? false
        map.showsScale = props["showScale"] as? Bool ?? false
        map.showsCompass = props["showCompass"] as? Bool ?? false
        if changed("rotate") { map.setRotationDegree((props["rotate"] as? NSNumber)?.doubleValue ?? 0, animated: false, duration: 0) }
        if changed("skew") { map.setCameraDegree((props["skew"] as? NSNumber)?.doubleValue ?? 0, animated: false, duration: 0) }
        for kind in ["polyline", "polygons", "circles"] {
            if changed(kind) { try replaceGeometry(kind, values: props[kind] as? [[String: Any]] ?? []) }
        }
        if changed("markers") { try addMarkers(props["markers"] as? [[String: Any]] ?? [], clear: true) }
        if changed("includePoints"), let points = props["includePoints"] as? [[String: Any]], !points.isEmpty { try fit(points, padding: []) }
        if changed("showLocation") {
            wantsLocation = props["showLocation"] as? Bool ?? false
            if wantsLocation { startLocation() } else { map.showsUserLocation = false }
        }
        previous = props
    }
    private var locationAuthorized: Bool {
        let status = locationManager.authorizationStatus
        return status == .authorizedAlways || status == .authorizedWhenInUse
    }
    func invoke(_ command: String, args: [String: Any], completion: @escaping (Result<[String: Any], Error>) -> Void) {
        if command == "moveToLocation", args["longitude"] == nil, args["latitude"] == nil {
            guard !destroyed else { completion(.failure(DMPMapError("Map destroyed"))); return }
            pendingMoves.append(completion)
            startLocation()
            return
        }
        do {
            guard !destroyed else { throw DMPMapError("Map destroyed") }
            var result: [String: Any] = [:]
            switch command {
            case "getCenterLocation": result = coordinate(map.centerCoordinate)
            case "getRotate": result = ["rotate": map.rotationDegree]
            case "getSkew": result = ["skew": map.cameraDegree]
            case "setCenterOffset":
                guard let values = args["offset"] as? [Double], values.count == 2, values.allSatisfy({ $0.isFinite && (0.25...0.75).contains($0) }) else { throw DMPMapError("Invalid offset") }
                map.screenAnchor = CGPoint(x: values[0], y: values[1])
            case "toScreenLocation":
                let pixel = map.convert(try point(args), toPointTo: map)
                let viewport = args["viewport"] as? [String: Double] ?? [:]
                guard map.bounds.width > 0, map.bounds.height > 0 else { throw DMPMapError("Map has no size") }
                result = ["x": pixel.x * (viewport["width"] ?? map.bounds.width) / map.bounds.width,
                          "y": pixel.y * (viewport["height"] ?? map.bounds.height) / map.bounds.height]
            case "fromScreenLocation":
                let viewport = args["viewport"] as? [String: Double] ?? [:]
                let width = viewport["width"] ?? map.bounds.width; let height = viewport["height"] ?? map.bounds.height
                guard let x = args["x"] as? Double, let y = args["y"] as? Double, x.isFinite, y.isFinite, width > 0, height > 0 else { throw DMPMapError("Invalid screen coordinate") }
                result = coordinate(map.convert(CGPoint(x: x * map.bounds.width / width, y: y * map.bounds.height / height), toCoordinateFrom: map))
            case "setBoundary":
                let sw = try point(args["southwest"] as? [String: Any] ?? [:]); let ne = try point(args["northeast"] as? [String: Any] ?? [:])
                guard sw.longitude < ne.longitude, sw.latitude < ne.latitude else { throw DMPMapError("Invalid boundary") }
                map.limitRegion = MACoordinateRegion(center: CLLocationCoordinate2D(latitude: (sw.latitude + ne.latitude) / 2, longitude: (sw.longitude + ne.longitude) / 2),
                    span: MACoordinateSpan(latitudeDelta: ne.latitude - sw.latitude, longitudeDelta: ne.longitude - sw.longitude))
            case "translateMarker", "moveAlong":
                try animateMarker(command, args: args, completion: completion)
                return
            case "addArc":
                guard let id = args["id"] as? Int, let values = args["arcPoints"] as? [[String: Any]], values.count >= 2 else { throw DMPMapError("Invalid arc") }
                var coordinates = try values.map(point)
                let arc = MAPolyline(coordinates: &coordinates, count: UInt(coordinates.count))!
                overlayStyles[ObjectIdentifier(arc)] = args.merging(["width": args["width"] ?? 5]) { _, new in new }
                map.add(arc)
                if let old = arcs.updateValue(arc, forKey: id) { removeOverlay(old) }
            case "removeArc":
                guard let id = args["id"] as? Int else { throw DMPMapError("Invalid arc id") }
                if let old = arcs.removeValue(forKey: id) { removeOverlay(old) }
            case "getScale": result = ["scale": map.zoomLevel]
            case "getRegion":
                let rect = map.visibleMapRect
                let southwest = MACoordinateForMapPoint(MAMapPoint(x: rect.origin.x, y: rect.origin.y + rect.size.height))
                let northeast = MACoordinateForMapPoint(MAMapPoint(x: rect.origin.x + rect.size.width, y: rect.origin.y))
                result = ["southwest": coordinate(southwest), "northeast": coordinate(northeast)]
            case "moveToLocation":
                let target: CLLocationCoordinate2D
                if args["longitude"] != nil || args["latitude"] != nil { target = try point(args) }
                else {
                    guard locationAuthorized else { throw DMPMapError("Location permission denied") }
                    guard let location = map.userLocation.location else { throw DMPMapError("Location is not ready; enable show-location first") }
                    target = location.coordinate
                }
                map.setCenter(target, animated: false)
            case "addMarkers":
                guard let values = args["markers"] as? [[String: Any]] else { throw DMPMapError("Markers must be an array") }
                try addMarkers(values, clear: args["clear"] as? Bool ?? false)
            case "removeMarkers":
                guard let ids = args["markerIds"] as? [Int] else { throw DMPMapError("markerIds must be an array") }
                for id in ids { cancelMotion(id); if let marker = markers.removeValue(forKey: id) { rotations.removeValue(forKey: ObjectIdentifier(marker)); map.removeAnnotation(marker) } }
            case "includePoints":
                guard let values = args["points"] as? [[String: Any]] else { throw DMPMapError("Points must be an array") }
                try fit(values, padding: args["padding"] as? [Double] ?? [])
            default: throw DMPMapError("AMap iOS provider does not support \(command)")
            }
            completion(.success(result))
        } catch { completion(.failure(error)) }
    }
    private func cancelMotion(_ id: Int) {
        motions.removeValue(forKey: id)?.completion(.failure(DMPMapError("Marker animation cancelled")))
        if motions.isEmpty { displayLink?.invalidate(); displayLink = nil }
    }
    private func animateMarker(_ command: String, args: [String: Any], completion: @escaping (Result<[String: Any], Error>) -> Void) throws {
        guard let id = args["markerId"] as? Int, let marker = markers[id] else { throw DMPMapError("Marker not found") }
        let path: [CLLocationCoordinate2D]
        if command == "translateMarker" { path = [marker.coordinate, try point(args["destination"] as? [String: Any] ?? [:])] }
        else { path = try (args["path"] as? [[String: Any]] ?? []).map(point) }
        let separate = command == "translateMarker" && !(args["moveWithRotate"] as? Bool ?? false) && !(args["autoRotate"] as? Bool ?? false)
        let duration = (args["duration"] as? Double ?? 1000) * (separate ? 2 : 1) / 1000
        guard path.count >= 2, duration.isFinite, duration >= 0 else { throw DMPMapError("Invalid animation") }
        let angle = rotations[ObjectIdentifier(marker)] ?? 0
        let motion = DMPMarkerMotion(path: path, angle: angle, rotate: args["rotate"] as? Double ?? angle,
            autoRotate: args["autoRotate"] as? Bool ?? false, separate: separate, duration: duration,
            precision: args["precision"] as? Double ?? 0, completion: completion)
        cancelMotion(id)
        motions[id] = motion
        if duration == 0 { tickMotion(id, motion, now: motion.start); return }
        tickMotion(id, motion, now: motion.start)
        if displayLink == nil {
            let link = CADisplayLink(target: self, selector: #selector(animateFrame(_:)))
            displayLink = link; link.add(to: .main, forMode: .common)
        }
    }
    @objc private func animateFrame(_ link: CADisplayLink) {
        for (id, motion) in motions { tickMotion(id, motion, now: link.timestamp) }
        if motions.isEmpty { displayLink?.invalidate(); displayLink = nil }
    }
    private func tickMotion(_ id: Int, _ motion: DMPMarkerMotion, now: CFTimeInterval) {
        guard let marker = markers[id] else { cancelMotion(id); return }
        let progress = motion.duration == 0 ? 1 : min(1, max(0, (now - motion.start) / motion.duration))
        let sample = motion.sample(progress)
        marker.coordinate = sample.0
        rotations[ObjectIdentifier(marker)] = sample.1
        map.view(for: marker)?.transform = CGAffineTransform(rotationAngle: (sample.1 - map.rotationDegree) * .pi / 180)
        if motion.precision > 0 && (progress == 1 || sample.2 - motion.lastDistance >= motion.precision) {
            motion.lastDistance = sample.2
            events.event("interpolatepoint", coordinate(sample.0).merging(["markerId": id, "animationStatus": progress == 1 ? "complete" : "interpolating"]) { _, new in new })
        }
        if progress == 1 { motions.removeValue(forKey: id); motion.completion(.success([:])) }
    }
    private func removeOverlay(_ overlay: any MAOverlay) {
        map.remove(overlay); overlayStyles.removeValue(forKey: ObjectIdentifier(overlay))
    }
    private func replaceGeometry(_ kind: String, values: [[String: Any]]) throws {
        var next: [(any MAOverlay, [String: Any])] = []
        for value in values {
            let overlay: any MAOverlay
            if kind == "circles" {
                guard let radius = value["radius"] as? Double, radius.isFinite, radius >= 0 else { throw DMPMapError("Invalid radius") }
                overlay = MACircle(center: try point(value), radius: radius)
            } else {
                var coordinates = try (value["points"] as? [[String: Any]] ?? []).map(point)
                guard coordinates.count >= (kind == "polyline" ? 2 : 3) else { throw DMPMapError("Invalid geometry points") }
                if kind == "polyline" { overlay = MAPolyline(coordinates: &coordinates, count: UInt(coordinates.count)) }
                else { overlay = MAPolygon(coordinates: &coordinates, count: UInt(coordinates.count)) }
            }
            _ = try mapColor(value["color"] as? String ?? value["strokeColor"] as? String ?? "#000000")
            _ = try mapColor(value["fillColor"] as? String ?? "#00000000")
            next.append((overlay, value))
        }
        geometry[kind]?.forEach(removeOverlay)
        geometry[kind] = next.map { $0.0 }
        for (overlay, style) in next { overlayStyles[ObjectIdentifier(overlay)] = style; map.add(overlay) }
    }
    func mapView(_ mapView: MAMapView!, rendererFor overlay: MAOverlay!) -> MAOverlayRenderer? {
        let renderer: MAOverlayPathRenderer
        if let line = overlay as? MAPolyline { renderer = MAPolylineRenderer(polyline: line) }
        else if let polygon = overlay as? MAPolygon { renderer = MAPolygonRenderer(polygon: polygon) }
        else if let circle = overlay as? MACircle { renderer = MACircleRenderer(circle: circle) }
        else { return nil }
        let style = overlayStyles[ObjectIdentifier(overlay)] ?? [:]
        renderer.strokeColor = try? mapColor(style["color"] as? String ?? style["strokeColor"] as? String ?? "#000000")
        renderer.fillColor = try? mapColor(style["fillColor"] as? String ?? "#00000000")
        renderer.lineWidth = style["width"] as? Double ?? style["strokeWidth"] as? Double ?? 1
        if style["dottedLine"] as? Bool == true { renderer.lineDashType = kMALineDashTypeSquare }
        return renderer
    }
    private func mapColor(_ value: String) throws -> UIColor {
        guard value.hasPrefix("#"), value.count == 7 || value.count == 9, let raw = UInt64(value.dropFirst(), radix: 16) else { throw DMPMapError("Invalid color") }
        let rgba = value.count == 7 ? (raw << 8) | 255 : raw
        return UIColor(red: Double((rgba >> 24) & 255) / 255, green: Double((rgba >> 16) & 255) / 255,
                       blue: Double((rgba >> 8) & 255) / 255, alpha: Double(rgba & 255) / 255)
    }
    private func addMarkers(_ values: [[String: Any]], clear: Bool) throws {
        var next: [Int: MAPointAnnotation] = [:]
        var anonymous: [MAPointAnnotation] = []
        var nextRotations: [ObjectIdentifier: Double] = [:]
        for value in values {
            let annotation = MAPointAnnotation()
            annotation.coordinate = try point(value)
            annotation.title = value["title"] as? String ?? ""
            nextRotations[ObjectIdentifier(annotation)] = value["rotate"] as? Double ?? 0
            annotation.subtitle = (value["callout"] as? [String: Any])?["content"] as? String
            if let rawID = value["id"] {
                guard let number = rawID as? NSNumber, number.doubleValue.isFinite,
                      number.doubleValue >= Double(Int32.min), number.doubleValue <= Double(Int32.max),
                      number.doubleValue == Double(number.intValue), next[number.intValue] == nil else { throw DMPMapError("Marker id must be a unique integer") }
                next[number.intValue] = annotation
            } else {
                anonymous.append(annotation)
            }
        }
        if clear {
            Array(motions.keys).forEach(cancelMotion)
            rotations.removeAll()
            map.removeAnnotations(Array(markers.values) + anonymousMarkers)
            markers.removeAll(); anonymousMarkers.removeAll()
        }
        rotations.merge(nextRotations) { _, new in new }
        for (id, annotation) in next {
            cancelMotion(id)
            if let old = markers.removeValue(forKey: id) { rotations.removeValue(forKey: ObjectIdentifier(old)); map.removeAnnotation(old) }
            markers[id] = annotation
            map.addAnnotation(annotation)
        }
        anonymousMarkers.append(contentsOf: anonymous)
        map.addAnnotations(anonymous)
    }
    private func fit(_ values: [[String: Any]], padding: [Double]) throws {
        guard !values.isEmpty, padding.isEmpty || padding.count == 4, padding.allSatisfy({ $0.isFinite && $0 >= 0 }) else { throw DMPMapError("Invalid points or padding") }
        let annotations = try values.map { value -> MAPointAnnotation in
            let annotation = MAPointAnnotation(); annotation.coordinate = try point(value); return annotation
        }
        let edges = padding.isEmpty ? [0, 0, 0, 0] : padding
        map.showAnnotations(annotations, edgePadding: UIEdgeInsets(top: edges[0], left: edges[3], bottom: edges[2], right: edges[1]), animated: false)
    }
    @objc private func pauseLocation() {
        Array(motions.keys).forEach(cancelMotion)
        map.showsUserLocation = false
    }
    @objc private func resumeLocation() {
        if !destroyed && (wantsLocation || !pendingMoves.isEmpty) { startLocation() }
    }
    private func startLocation() {
        guard UIApplication.shared.applicationState != .background else { return }
        if locationAuthorized { map.showsUserLocation = true; return }
        guard locationManager.authorizationStatus == .notDetermined else { failLocation("Location permission denied"); return }
        guard Bundle.main.object(forInfoDictionaryKey: "NSLocationWhenInUseUsageDescription") != nil else {
            failLocation("NSLocationWhenInUseUsageDescription is required"); return
        }
        locationManager.requestWhenInUseAuthorization()
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard !destroyed, wantsLocation || !pendingMoves.isEmpty else { return }
        if locationAuthorized { map.showsUserLocation = true }
        else if manager.authorizationStatus != .notDetermined { failLocation("Location permission denied") }
    }
    func mapView(_ mapView: MAMapView!, didUpdate userLocation: MAUserLocation!, updatingLocation: Bool) {
        guard !destroyed, updatingLocation, let userLocation else { return }
        let callbacks = pendingMoves
        pendingMoves.removeAll()
        if !callbacks.isEmpty { map.setCenter(userLocation.coordinate, animated: false) }
        callbacks.forEach { $0(.success([:])) }
        if !wantsLocation { map.showsUserLocation = false }
    }
    private func failLocation(_ message: String) {
        let callbacks = pendingMoves
        pendingMoves.removeAll()
        callbacks.forEach { $0(.failure(DMPMapError(message))) }
        events.error(message)
    }
    func mapInitComplete(_ mapView: MAMapView!) { if !destroyed { events.ready() } }
    func mapView(_ mapView: MAMapView!, didSingleTappedAt coordinate: CLLocationCoordinate2D) { events.event("tap", self.coordinate(coordinate)) }
    func mapView(_ mapView: MAMapView!, regionWillChangeAnimated animated: Bool, wasUserAction: Bool) { region("begin", wasUserAction) }
    func mapView(_ mapView: MAMapView!, regionDidChangeAnimated animated: Bool, wasUserAction: Bool) { region("end", wasUserAction) }
    private func region(_ type: String, _ userAction: Bool) {
        events.event("regionchange", ["type": type, "causedBy": userAction ? "drag" : "update", "centerLocation": coordinate(map.centerCoordinate), "scale": map.zoomLevel])
    }
    func mapView(_ mapView: MAMapView!, viewFor annotation: MAAnnotation!) -> MAAnnotationView? {
        guard annotation is MAPointAnnotation else { return nil }
        let view = mapView.dequeueReusableAnnotationView(withIdentifier: "dimina-map-marker") as? MAPinAnnotationView
            ?? MAPinAnnotationView(annotation: annotation, reuseIdentifier: "dimina-map-marker")!
        view.annotation = annotation
        view.canShowCallout = true
        view.transform = CGAffineTransform(rotationAngle: ((rotations[ObjectIdentifier(annotation)] ?? 0) - map.rotationDegree) * .pi / 180)
        return view
    }
    func mapView(_ mapView: MAMapView!, didSelect view: MAAnnotationView!) { markerEvent("markertap", view) }
    func mapView(_ mapView: MAMapView!, didAnnotationViewCalloutTapped view: MAAnnotationView!) { markerEvent("callouttap", view) }
    private func markerEvent(_ type: String, _ view: MAAnnotationView) {
        if let id = markers.first(where: { $0.value === view.annotation })?.key { events.event(type, ["markerId": id]) }
        else if anonymousMarkers.contains(where: { $0 === view.annotation }) { events.event(type, [:]) }
    }
    func mapView(_ mapView: MAMapView!, didFailToLocateUserWithError error: Error!) { failLocation("Location failed") }
    func destroy() {
        guard !destroyed else { return }
        destroyed = true
        Array(motions.keys).forEach(cancelMotion)
        displayLink?.invalidate(); displayLink = nil
        overlayStyles.removeAll(); geometry.removeAll(); arcs.removeAll(); rotations.removeAll()
        map.removeOverlays(map.overlays)
        pendingMoves.removeAll()
        NotificationCenter.default.removeObserver(self)
        locationManager.delegate = nil
        map.showsUserLocation = false
        map.delegate = nil
        map.removeAnnotations(Array(markers.values) + anonymousMarkers)
        markers.removeAll(); anonymousMarkers.removeAll()
        map.removeFromSuperview()
    }
    private func point(_ value: [String: Any]) throws -> CLLocationCoordinate2D {
        guard let longitude = (value["longitude"] as? NSNumber)?.doubleValue, let latitude = (value["latitude"] as? NSNumber)?.doubleValue,
              longitude.isFinite, latitude.isFinite, (-180...180).contains(longitude), (-90...90).contains(latitude) else { throw DMPMapError("Invalid coordinate") }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
    private func coordinate(_ value: CLLocationCoordinate2D) -> [String: Any] { ["longitude": value.longitude, "latitude": value.latitude] }
}
@MainActor private final class DMPMarkerMotion {
    let path: [CLLocationCoordinate2D]
    let angle: Double; let rotate: Double; let autoRotate: Bool; let separate: Bool
    let duration: Double; let precision: Double
    let completion: (Result<[String: Any], Error>) -> Void
    let start = CACurrentMediaTime()
    var lastDistance = 0.0
    private let lengths: [Double]
    init(path: [CLLocationCoordinate2D], angle: Double, rotate: Double, autoRotate: Bool, separate: Bool,
         duration: Double, precision: Double, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        self.path = path; self.angle = angle; self.rotate = rotate; self.autoRotate = autoRotate; self.separate = separate
        self.duration = duration; self.precision = precision; self.completion = completion
        var lengths = [0.0]
        for i in 1..<path.count {
            let a = path[i - 1]; let b = path[i]
            lengths.append(lengths[i - 1] + CLLocation(latitude: a.latitude, longitude: a.longitude).distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)))
        }
        self.lengths = lengths
    }
    func sample(_ progress: Double) -> (CLLocationCoordinate2D, Double, Double) {
        let rotation = separate ? min(1, progress * 2) : progress
        let movement = separate ? max(0, progress * 2 - 1) : progress
        let traveled = lengths.last! * movement
        var low = 1; var high = path.count - 1
        while low < high { let mid = (low + high) / 2; if lengths[mid] < traveled { low = mid + 1 } else { high = mid } }
        let a = path[low - 1]; let b = path[low]
        let fraction = lengths[low] == lengths[low - 1] ? movement : (traveled - lengths[low - 1]) / (lengths[low] - lengths[low - 1])
        let dx = delta(b.longitude - a.longitude) * .pi / 180
        let latA = a.latitude * .pi / 180; let latB = b.latitude * .pi / 180
        let bearing = atan2(sin(dx) * cos(latB), cos(latA) * sin(latB) - sin(latA) * cos(latB) * cos(dx)) * 180 / .pi
        let coordinate = CLLocationCoordinate2D(latitude: a.latitude + (b.latitude - a.latitude) * fraction,
            longitude: movement == 1 ? b.longitude : delta(a.longitude + delta(b.longitude - a.longitude) * fraction))
        return (coordinate, autoRotate && movement > 0 && lengths.last! > 0 ? (bearing + 360).truncatingRemainder(dividingBy: 360) : angle + delta(rotate - angle) * rotation, traveled)
    }
    private func delta(_ value: Double) -> Double { ((value + 540).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) - 180 }
}
#endif
