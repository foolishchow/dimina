package com.didi.dimina.map.amap

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Point
import android.view.animation.LinearInterpolator
import com.amap.api.maps.model.Polyline
import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.View
import com.amap.api.maps.AMap
import com.amap.api.maps.CameraUpdateFactory
import com.amap.api.maps.TextureMapView
import com.amap.api.maps.MapsInitializer
import com.amap.api.maps.model.CameraPosition
import com.amap.api.maps.model.LatLng
import com.amap.api.maps.model.LatLngBounds
import com.amap.api.maps.model.Marker
import com.amap.api.maps.model.MarkerOptions
import com.amap.api.maps.model.PolylineOptions
import com.amap.api.maps.model.PolygonOptions
import com.amap.api.maps.model.CircleOptions
import com.didi.dimina.ui.container.DiminaActivity
import com.amap.api.maps.model.MyLocationStyle
import com.didi.dimina.map.MapEvents
import com.didi.dimina.map.MapInstance
import com.didi.dimina.map.MapProvider
import org.json.JSONArray
import org.json.JSONObject

/** Construct/register on the UI thread. Consent must include AMap's SDK disclosure. */
class AMapProvider(private val apiKey: String, private val hasPrivacyConsent: () -> Boolean) : MapProvider {
    override fun create(activity: Activity, events: MapEvents): MapInstance {
        check(hasPrivacyConsent()) { "Map privacy authorization denied" }
        require(apiKey.isNotBlank()) { "AMap Android key is required" }
        MapsInitializer.updatePrivacyShow(activity, true, true)
        MapsInitializer.updatePrivacyAgree(activity, true)
        MapsInitializer.setApiKey(apiKey)
        return AMapInstance(activity, events)
    }
}

private class AMapInstance(private val activity: Activity, private val events: MapEvents) : MapInstance {
    // TextureView participates in the host/WebView composition and ancestor clipping.
    private val mapView = TextureMapView(activity)
    private val map: AMap
    private var previous = JSONObject()
    private val markers = mutableMapOf<Int, Marker>()
    private val anonymousMarkers = mutableListOf<Marker>()
    private var overlays = mutableMapOf<String, List<() -> Unit>>()
    private val arcs = mutableMapOf<Int, Polyline>()
    private val animations = mutableMapOf<Int, ValueAnimator>()
    private var centerOffset = doubleArrayOf(0.5, 0.5)
    private var destroyed = false
    private var resumed = false
    private var wantsLocation = false
    private val pendingLocations = mutableListOf<(LatLng) -> Unit>()
    override val view: View get() = mapView

    init {
        mapView.onCreate(Bundle())
        map = mapView.map
        mapView.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            map.setPointToCenter((mapView.width * centerOffset[0]).toInt(), (mapView.height * centerOffset[1]).toInt())
        }
        map.myLocationStyle = MyLocationStyle().myLocationType(MyLocationStyle.LOCATION_TYPE_SHOW)
        map.setOnMyLocationChangeListener { location ->
            if (!destroyed && location != null) {
                val callbacks = pendingLocations.toList()
                pendingLocations.clear()
                callbacks.forEach { it(LatLng(location.latitude, location.longitude)) }
                if (!wantsLocation) map.isMyLocationEnabled = false
            }
        }
        map.setOnMapLoadedListener { if (!destroyed) events.ready() }
        map.setOnMapClickListener { events.event("tap", coordinate(it)) }
        map.setOnMarkerClickListener { marker ->
            markerEvent("markertap", marker)
            false
        }
        map.setOnInfoWindowClickListener { marker ->
            markerEvent("callouttap", marker)
        }
        map.setOnCameraChangeListener(object : AMap.OnCameraChangeListener {
            private var changing = false
            override fun onCameraChange(position: CameraPosition) {
                if (!changing) { changing = true; region("begin", position) }
            }
            override fun onCameraChangeFinish(position: CameraPosition) {
                changing = false; region("end", position)
            }
        })
    }
    private fun region(type: String, position: CameraPosition) {
        events.event("regionchange", JSONObject().put("type", type).put("causedBy", "update")
            .put("centerLocation", coordinate(position.target)).put("scale", position.zoom))
    }
    override fun update(props: JSONObject) {
        check(!destroyed) { "Map destroyed" }
        fun changed(key: String) = props.opt(key)?.toString() != previous.opt(key)?.toString()
        if (changed("minScale")) map.minZoomLevel = props.optDouble("minScale", 3.0).toFloat()
        if (changed("maxScale")) map.maxZoomLevel = props.optDouble("maxScale", 22.0).toFloat()
        map.uiSettings.isScrollGesturesEnabled = props.optBoolean("enableScroll", true)
        map.uiSettings.isZoomGesturesEnabled = props.optBoolean("enableZoom", true)
        map.uiSettings.isRotateGesturesEnabled = props.optBoolean("enableRotate", false)
        map.uiSettings.isTiltGesturesEnabled = props.optBoolean("enableOverlooking", false)
        map.uiSettings.isScaleControlsEnabled = props.optBoolean("showScale", false)
        map.uiSettings.isCompassEnabled = props.optBoolean("showCompass", false)
        map.uiSettings.isZoomControlsEnabled = false
        val currentCamera = map.cameraPosition
        resolveCameraState(previous, props, AMapCameraState(currentCamera.target.latitude,
            currentCamera.target.longitude, currentCamera.zoom, currentCamera.tilt, currentCamera.bearing))?.let { camera ->
            val center = point(JSONObject().put("latitude", camera.latitude).put("longitude", camera.longitude))
            map.moveCamera(CameraUpdateFactory.newCameraPosition(
                CameraPosition(center, camera.scale, camera.skew, camera.rotate)))
        }
        if (changed("markers")) addMarkers(props.optJSONArray("markers") ?: JSONArray(), true)
        for (kind in listOf("polyline", "polygons", "circles")) {
            if (changed(kind)) replaceGeometry(kind, props.optJSONArray(kind) ?: JSONArray())
        }
        if (changed("includePoints")) props.optJSONArray("includePoints")?.takeIf { it.length() > 0 }?.let { fit(it, JSONArray()) }
        if (changed("showLocation")) {
            wantsLocation = props.optBoolean("showLocation")
            if (wantsLocation) ensureLocationPermission { allowed ->
                if (!destroyed && wantsLocation) {
                    if (allowed) map.isMyLocationEnabled = resumed else events.error("Location permission denied")
                }
            } else map.isMyLocationEnabled = false
        }
        previous = JSONObject(props.toString())
    }
    private fun hasLocationPermission() = listOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)
        .any { activity.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    private fun ensureLocationPermission(callback: (Boolean) -> Unit) {
        if (hasLocationPermission()) { callback(true); return }
        val host = activity as? DiminaActivity
        if (host == null) { callback(false); return }
        host.handleAuthorization(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)) {
            callback(hasLocationPermission())
        }
    }

    override fun invoke(command: String, args: JSONObject, result: (Result<JSONObject>) -> Unit) {
        if (command == "translateMarker" || command == "moveAlong") {
            try { check(!destroyed) { "Map destroyed" }; animateMarker(command, args, result) }
            catch (error: Exception) { result(Result.failure(error)) }
            return
        }
        if (command == "moveToLocation" && !args.has("longitude") && !args.has("latitude")) {
            ensureLocationPermission { allowed ->
                if (destroyed) return@ensureLocationPermission
                if (!allowed) { result(Result.failure(IllegalStateException("Location permission denied"))); return@ensureLocationPermission }
                pendingLocations.add { target ->
                    map.moveCamera(CameraUpdateFactory.changeLatLng(target))
                    result(Result.success(JSONObject()))
                }
                map.isMyLocationEnabled = resumed
            }
            return
        }
        result(runCatching {
            check(!destroyed) { "Map destroyed" }
            when (command) {
                "getCenterLocation" -> coordinate(map.cameraPosition.target)
                "getRotate" -> JSONObject().put("rotate", map.cameraPosition.bearing)
                "getSkew" -> JSONObject().put("skew", map.cameraPosition.tilt)
                "setCenterOffset" -> {
                    val offset = args.getJSONArray("offset")
                    require(offset.length() == 2) { "Offset requires two values" }
                    val values = DoubleArray(2) { offset.getDouble(it) }
                    require(values.all { it.isFinite() && it in 0.25..0.75 }) { "Invalid offset" }
                    centerOffset = values
                    map.setPointToCenter((mapView.width * values[0]).toInt(), (mapView.height * values[1]).toInt()); JSONObject()
                }
                "toScreenLocation" -> {
                    val pixel = map.projection.toScreenLocation(point(args))
                    val viewport = args.getJSONObject("viewport")
                    check(mapView.width > 0 && mapView.height > 0) { "Map has no size" }
                    JSONObject().put("x", pixel.x * viewport.getDouble("width") / mapView.width)
                        .put("y", pixel.y * viewport.getDouble("height") / mapView.height)
                }
                "fromScreenLocation" -> {
                    val viewport = args.getJSONObject("viewport")
                    require(viewport.getDouble("width") > 0 && viewport.getDouble("height") > 0) { "Map has no size" }
                    coordinate(map.projection.fromScreenLocation(Point(
                        (args.getDouble("x") * mapView.width / viewport.getDouble("width")).toInt(),
                        (args.getDouble("y") * mapView.height / viewport.getDouble("height")).toInt())))
                }
                "setBoundary" -> { map.setMapStatusLimits(LatLngBounds(point(args.getJSONObject("southwest")), point(args.getJSONObject("northeast")))); JSONObject() }
                "addArc" -> {
                    val id = args.getInt("id")
                    val overlay = map.addPolyline(PolylineOptions().addAll(points(args.getJSONArray("arcPoints")))
                        .color(color(args.optString("color", "#000000"))).width((args.optDouble("width", 5.0) * activity.resources.displayMetrics.density).toFloat()))
                    arcs.put(id, overlay)?.remove(); JSONObject()
                }
                "removeArc" -> { arcs.remove(args.getInt("id"))?.remove(); JSONObject() }
                "getScale" -> JSONObject().put("scale", map.cameraPosition.zoom)
                "getRegion" -> map.projection.visibleRegion.latLngBounds.let {
                    JSONObject().put("southwest", coordinate(it.southwest)).put("northeast", coordinate(it.northeast))
                }
                "addMarkers" -> { addMarkers(args.getJSONArray("markers"), args.optBoolean("clear")); JSONObject() }
                "removeMarkers" -> {
                    val ids = args.getJSONArray("markerIds")
                    for (i in 0 until ids.length()) { val id = ids.getInt(i); animations.remove(id)?.cancel(); markers.remove(id)?.remove() }
                    JSONObject()
                }
                "includePoints" -> { fit(args.getJSONArray("points"), args.optJSONArray("padding") ?: JSONArray()); JSONObject() }
                "moveToLocation" -> {
                    val target = if (args.has("longitude") || args.has("latitude")) point(args) else {
                        check(hasLocationPermission()) { "Location permission denied" }
                        val location = map.myLocation ?: error("Location is not ready; enable show-location first")
                        LatLng(location.latitude, location.longitude)
                    }
                    map.moveCamera(CameraUpdateFactory.changeLatLng(target)); JSONObject()
                }
                else -> error("AMap Android provider does not support $command")
            }
        })
    }
    private fun animateMarker(command: String, args: JSONObject, result: (Result<JSONObject>) -> Unit) {
        val id = args.getInt("markerId")
        val marker = markers[id] ?: error("Marker not found")
        val route = if (command == "translateMarker") listOf(marker.position, point(args.getJSONObject("destination"))) else points(args.getJSONArray("path"))
        val separate = command == "translateMarker" && !args.optBoolean("moveWithRotate") && !args.optBoolean("autoRotate")
        val duration = args.optDouble("duration", 1000.0) * if (separate) 2 else 1
        require(duration.isFinite() && duration >= 0 && duration < Long.MAX_VALUE) { "Invalid duration" }
        val motion = MarkerMotion(route.map { MotionPoint(it.longitude, it.latitude) }, -marker.rotateAngle.toDouble(),
            args.optDouble("rotate", -marker.rotateAngle.toDouble()), args.optBoolean("autoRotate"), separate)
        animations.remove(id)?.cancel()
        var lastDistance = 0.0
        var emittedComplete = false
        val precision = args.optDouble("precision", 0.0)
        fun apply(progress: Double) {
            val sample = motion.sample(progress)
            marker.position = LatLng(sample.point.latitude, sample.point.longitude)
            // AMap Android angles are counter-clockwise; mini-program angles are clockwise.
            marker.rotateAngle = -sample.rotate.toFloat()
            if (precision > 0 && !emittedComplete && (progress == 1.0 || sample.distance - lastDistance >= precision)) {
                emittedComplete = progress == 1.0
                lastDistance = sample.distance
                events.event("interpolatepoint", coordinate(marker.position).put("markerId", id).put("animationStatus", if (progress == 1.0) "complete" else "interpolating"))
            }
        }
        if (duration == 0.0) { apply(1.0); result(Result.success(JSONObject())); return }
        val animator = ValueAnimator.ofFloat(0f, 1f)
        animator.duration = duration.toLong(); animator.interpolator = LinearInterpolator()
        animator.addUpdateListener { apply((it.animatedValue as Float).toDouble()) }
        animator.addListener(object : AnimatorListenerAdapter() {
            private var cancelled = false
            override fun onAnimationCancel(animation: Animator) { cancelled = true }
            override fun onAnimationEnd(animation: Animator) {
                if (animations[id] === animator) animations.remove(id)
                if (cancelled) result(Result.failure(IllegalStateException("Marker animation cancelled")))
                else { apply(1.0); result(Result.success(JSONObject())) }
            }
        })
        animations[id] = animator; apply(0.0); animator.start()
    }
    private fun addMarkers(data: JSONArray, clear: Boolean) {
        val options = mutableMapOf<Int, MarkerOptions>()
        val anonymousOptions = mutableListOf<MarkerOptions>()
        for (i in 0 until data.length()) {
            val item = data.getJSONObject(i)
            val option = MarkerOptions().position(point(item)).title(item.optString("title"))
                .snippet(item.optJSONObject("callout")?.optString("content"))
                .rotateAngle(-item.optDouble("rotate", 0.0).toFloat()).zIndex(item.optDouble("zIndex", 0.0).toFloat())
            if (item.has("id")) {
                val rawId = item.getDouble("id")
                require(rawId.isFinite() && rawId == rawId.toInt().toDouble()) { "Marker id must be an integer" }
                val id = rawId.toInt()
                require(!options.containsKey(id)) { "Duplicate marker id" }
                options[id] = option
            } else {
                anonymousOptions.add(option)
            }
        }
        if (clear) {
            animations.values.toList().forEach { it.cancel() }; animations.clear()
            markers.values.forEach { it.remove() }; markers.clear()
            anonymousMarkers.forEach { it.remove() }; anonymousMarkers.clear()
        }
        options.forEach { (id, option) -> animations.remove(id)?.cancel(); markers.remove(id)?.remove(); markers[id] = map.addMarker(option) }
        anonymousOptions.forEach { anonymousMarkers.add(map.addMarker(it)) }
    }
    private fun markerEvent(type: String, marker: Marker) {
        val id = markers.entries.firstOrNull { it.value == marker }?.key
        if (id != null) events.event(type, JSONObject().put("markerId", id))
        else if (anonymousMarkers.contains(marker)) events.event(type)
    }
    private fun replaceGeometry(kind: String, data: JSONArray) {
        val creates: List<() -> (() -> Unit)> = (0 until data.length()).map { index ->
            val item = data.getJSONObject(index)
            val stroke = color(item.optString("color", item.optString("strokeColor", "#000000")))
            val width = item.optDouble("width", item.optDouble("strokeWidth", 1.0)).toFloat()
            val fill = color(item.optString("fillColor", "#00000000"))
            when (kind) {
                "circles" -> {
                    val center = point(item); val radius = item.getDouble("radius")
                    require(radius.isFinite() && radius >= 0) { "Invalid radius" }
                    val options = CircleOptions().center(center).radius(radius).strokeColor(stroke).strokeWidth(width).fillColor(fill)
                    val create: () -> (() -> Unit) = { map.addCircle(options).let { circle -> { circle.remove() } } }
                    create
                }
                "polyline" -> {
                    val options = PolylineOptions().addAll(points(item.getJSONArray("points"))).color(stroke).width(width).setDottedLine(item.optBoolean("dottedLine"))
                    val create: () -> (() -> Unit) = { map.addPolyline(options).let { line -> { line.remove() } } }
                    create
                }
                else -> {
                    val options = PolygonOptions().addAll(points(item.getJSONArray("points"))).strokeColor(stroke).strokeWidth(width).fillColor(fill)
                    val create: () -> (() -> Unit) = { map.addPolygon(options).let { polygon -> { polygon.remove() } } }
                    create
                }
            }
        }
        overlays.remove(kind)?.forEach { it() }
        overlays[kind] = creates.map { it() }
    }
    private fun fit(data: JSONArray, padding: JSONArray) {
        val points = points(data)
        require(points.isNotEmpty()) { "Points cannot be empty" }
        require(padding.length() == 0 || padding.length() == 4) { "Padding requires four values" }
        val inset = (0 until padding.length()).map { padding.getDouble(it).also { n -> require(n.isFinite() && n >= 0) } }.maxOrNull() ?: 0.0
        val density = activity.resources.displayMetrics.density
        val bounds = LatLngBounds.builder().also { builder -> points.forEach { builder.include(it) } }.build()
        // Android camera API uses a symmetric inset; retain the largest requested edge.
        map.moveCamera(CameraUpdateFactory.newLatLngBounds(bounds, (inset * density).toInt()))
    }
    override fun resume() {
        if (destroyed) return
        resumed = true
        mapView.onResume()
        if ((wantsLocation || pendingLocations.isNotEmpty()) && hasLocationPermission()) map.isMyLocationEnabled = true
    }
    override fun pause() {
        if (destroyed) return
        resumed = false
        animations.values.toList().forEach { it.cancel() }
        map.isMyLocationEnabled = false
        mapView.onPause()
    }
    override fun destroy() { if (!destroyed) { destroyed = true; animations.values.toList().forEach { it.cancel() }; animations.clear(); arcs.clear(); pendingLocations.clear(); map.isMyLocationEnabled = false; mapView.onPause(); mapView.onDestroy(); markers.clear(); anonymousMarkers.clear() } }
}
private fun coordinate(point: LatLng) = JSONObject().put("longitude", point.longitude).put("latitude", point.latitude)
private fun point(value: JSONObject): LatLng {
    val longitude = value.getDouble("longitude"); val latitude = value.getDouble("latitude")
    require(longitude.isFinite() && latitude.isFinite() && longitude in -180.0..180.0 && latitude in -90.0..90.0) { "Invalid coordinate" }
    return LatLng(latitude, longitude)
}
private fun points(values: JSONArray) = (0 until values.length()).map { point(values.getJSONObject(it)) }
private fun color(value: String): Int {
    // Mini-program uses #RRGGBBAA; Android uses #AARRGGBB.
    val normalized = if (value.length == 9 && value.startsWith("#")) "#" + value.takeLast(2) + value.substring(1, 7) else value
    return Color.parseColor(normalized)
}
