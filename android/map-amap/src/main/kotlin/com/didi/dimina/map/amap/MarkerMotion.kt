package com.didi.dimina.map.amap

import kotlin.math.*

internal data class MotionPoint(val longitude: Double, val latitude: Double)
internal data class MotionSample(val point: MotionPoint, val rotate: Double, val distance: Double)

/** Distance table is immutable; sampling costs O(log n), with no SDK or bridge calls. */
internal class MarkerMotion(private val path: List<MotionPoint>, private val angle: Double,
    private val rotate: Double, private val autoRotate: Boolean, private val separateRotation: Boolean) {
    private val lengths = DoubleArray(path.size)
    init {
        require(path.size >= 2) { "Path requires at least two points" }
        for (i in 1 until path.size) {
            val a = path[i - 1]; val b = path[i]
            val h = sin(Math.toRadians(b.latitude - a.latitude) / 2).pow(2) +
                cos(Math.toRadians(a.latitude)) * cos(Math.toRadians(b.latitude)) * sin(Math.toRadians(delta(b.longitude - a.longitude)) / 2).pow(2)
            lengths[i] = lengths[i - 1] + 6371008.8 * 2 * asin(sqrt(h.coerceIn(0.0, 1.0)))
        }
    }
    fun sample(progress: Double): MotionSample {
        val p = progress.coerceIn(0.0, 1.0)
        val rotation = if (separateRotation) min(1.0, p * 2) else p
        val movement = if (separateRotation) max(0.0, p * 2 - 1) else p
        val traveled = lengths.last() * movement
        var low = 1; var high = path.lastIndex
        while (low < high) { val mid = (low + high) / 2; if (lengths[mid] < traveled) low = mid + 1 else high = mid }
        val a = path[low - 1]; val b = path[low]
        val fraction = if (lengths[low] == lengths[low - 1]) movement else (traveled - lengths[low - 1]) / (lengths[low] - lengths[low - 1])
        val dx = Math.toRadians(delta(b.longitude - a.longitude))
        val bearing = Math.toDegrees(atan2(sin(dx) * cos(Math.toRadians(b.latitude)),
            cos(Math.toRadians(a.latitude)) * sin(Math.toRadians(b.latitude)) - sin(Math.toRadians(a.latitude)) * cos(Math.toRadians(b.latitude)) * cos(dx)))
        return MotionSample(MotionPoint(if (movement == 1.0) b.longitude else delta(a.longitude + delta(b.longitude - a.longitude) * fraction),
            a.latitude + (b.latitude - a.latitude) * fraction),
            if (autoRotate && movement > 0 && lengths.last() > 0) (bearing + 360) % 360 else angle + delta(rotate - angle) * rotation, traveled)
    }
    private fun delta(value: Double) = ((value + 540) % 360 + 360) % 360 - 180
}
