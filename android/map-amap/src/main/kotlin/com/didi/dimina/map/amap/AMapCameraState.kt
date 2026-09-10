package com.didi.dimina.map.amap

import org.json.JSONObject

internal data class AMapCameraState(
    val latitude: Double, val longitude: Double, val scale: Float, val skew: Float, val rotate: Float,
)

// Camera commands are asynchronous. Merge changed props against one SDK snapshot
// and submit once, so later commands cannot restore a stale center or zoom.
internal fun resolveCameraState(previous: JSONObject, props: JSONObject, current: AMapCameraState): AMapCameraState? {
    fun changed(key: String) = props.opt(key)?.toString() != previous.opt(key)?.toString()
    val centerChanged = changed("latitude") || changed("longitude")
    if (!centerChanged && !changed("scale") && !changed("skew") && !changed("rotate")) return null
    return AMapCameraState(
        if (centerChanged) props.getDouble("latitude") else current.latitude,
        if (centerChanged) props.getDouble("longitude") else current.longitude,
        if (changed("scale")) props.optDouble("scale", 16.0).toFloat() else current.scale,
        if (changed("skew")) props.optDouble("skew", 0.0).toFloat() else current.skew,
        if (changed("rotate")) props.optDouble("rotate", 0.0).toFloat() else current.rotate,
    )
}
