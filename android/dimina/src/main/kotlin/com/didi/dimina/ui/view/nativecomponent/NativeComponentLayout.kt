package com.didi.dimina.ui.view.nativecomponent

import org.json.JSONObject
import kotlin.math.roundToInt

/** CSS viewport coordinates from Render. The backend decides how to present them. */
data class NativeComponentLayout(
    val left: Double,
    val top: Double,
    val width: Double,
    val height: Double,
    val viewportWidth: Double,
    val viewportHeight: Double,
    val pageLeft: Double? = null,
    val pageTop: Double? = null,
    val hidden: Boolean = false,
    val zIndex: Float = 0f,
    val opacity: Float = 1f,
    val clip: NativeComponentClip? = null,
    val pageBackgroundColors: List<Int>? = null,
) {
    companion object {
        fun from(params: JSONObject): NativeComponentLayout? {
            val rect = params.optJSONObject("rect") ?: return null
            val style = params.optJSONObject("style")
            return NativeComponentLayout(
                left = rect.optDouble("left", 0.0), top = rect.optDouble("top", 0.0),
                width = rect.optDouble("width", 0.0), height = rect.optDouble("height", 0.0),
                viewportWidth = rect.optDouble("viewportWidth", 0.0), viewportHeight = rect.optDouble("viewportHeight", 0.0),
                pageLeft = if (rect.has("pageLeft")) rect.optDouble("pageLeft") else null,
                pageTop = if (rect.has("pageTop")) rect.optDouble("pageTop") else null,
                hidden = params.optBoolean("hidden"),
                zIndex = style?.optString("zIndex")?.toFloatOrNull() ?: 0f,
                opacity = if (params.has("opacity")) params.optDouble("opacity", 1.0).toFloat()
                    else style?.optString("opacity")?.toFloatOrNull() ?: 1f,
                clip = params.optJSONObject("clip")?.let {
                    NativeComponentClip(it.optDouble("left"), it.optDouble("top"), it.optDouble("right"), it.optDouble("bottom"))
                },
                pageBackgroundColors = params.optJSONArray("pageBackgroundColors")?.let { colors ->
                    (0 until colors.length()).map { colors.getInt(it) }
                },
            )
        }
    }
}

data class NativeComponentClip(val left: Double, val top: Double, val right: Double, val bottom: Double)

/** Pure coordinate conversion shared by layout and forwarded touch handling. */
internal data class NativeViewport(val width: Int, val height: Int, val scrollX: Int, val scrollY: Int) {
    fun scaleX(cssWidth: Double) = if (cssWidth > 0 && width > 0) width / cssWidth else 1.0
    fun scaleY(cssWidth: Double, cssHeight: Double) = if (cssHeight > 0 && height > 0) height / cssHeight else scaleX(cssWidth)

    fun resolve(layout: NativeComponentLayout): NativePixelLayout {
        val sx = scaleX(layout.viewportWidth)
        val sy = scaleY(layout.viewportWidth, layout.viewportHeight)
        val width = (layout.width * sx).roundToInt()
        val height = (layout.height * sy).roundToInt()
        val clip = layout.clip?.let {
            NativePixelClip((it.left * sx).roundToInt(), (it.top * sy).roundToInt(),
                (it.right * sx).roundToInt(), (it.bottom * sy).roundToInt())
        }
        return NativePixelLayout(
            left = (layout.pageLeft?.let { it * sx - scrollX } ?: (layout.left * sx)).roundToInt(),
            top = (layout.pageTop?.let { it * sy - scrollY } ?: (layout.top * sy)).roundToInt(),
            width = width.coerceAtLeast(1), height = height.coerceAtLeast(1),
            visible = !layout.hidden && width > 0 && height > 0 && layout.opacity > 0 &&
                (clip == null || (clip.right > clip.left && clip.bottom > clip.top)),
            clip = clip,
        )
    }
}

internal data class NativePixelClip(val left: Int, val top: Int, val right: Int, val bottom: Int)
internal data class NativePixelLayout(val left: Int, val top: Int, val width: Int, val height: Int,
    val visible: Boolean, val clip: NativePixelClip?)
