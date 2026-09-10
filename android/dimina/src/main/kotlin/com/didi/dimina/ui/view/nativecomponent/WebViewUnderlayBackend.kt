package com.didi.dimina.ui.view.nativecomponent

import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.ColorDrawable
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.ViewTreeObserver
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.annotation.MainThread
import androidx.core.graphics.ColorUtils
import org.json.JSONArray
import org.json.JSONObject

/** System WebView compatibility backend; this does not embed native content into the DOM compositor. */
@MainThread
class WebViewUnderlayBackend(
    private val webView: WebView,
    private val layer: FrameLayout,
    private var pageBackgroundColor: Int = Color.WHITE,
) : NativeComponentBackend {
    override val capabilities = NativeComponentCapabilities("webview-underlay", true, true, false, true)
    private class Entry(val type: String, val view: View, val visibilityChanged: (Boolean) -> Unit) {
        var layout: NativeComponentLayout? = null
        var visible = false
        var downTime: Long? = null
        var lastTouch: MotionEvent? = null
    }
    private val entries = mutableMapOf<String, Entry>()
    private val originalBackground = webView.background
    private val originalLayerBackground = layer.background
    private var appliedBackgroundColors: List<Int>? = null
    private var appliedBaseColor: Int? = null
    private var appliedLayerColor: Int? = null
    private val originalBackgroundCopy = originalBackground?.constantState?.newDrawable()?.mutate()
    private var transparent = false
    private var destroyed = false
    private val scrollObserver = webView.viewTreeObserver
    private val scrollListener = ViewTreeObserver.OnScrollChangedListener { refreshLayouts() }
    private val resizeListener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> refreshLayouts() }

    init {
        scrollObserver.addOnScrollChangedListener(scrollListener)
        webView.addOnLayoutChangeListener(resizeListener)
    }

    override fun attach(id: String, type: String, view: View, onVisibilityChanged: (Boolean) -> Unit) {
        check(!destroyed) { "Native component backend destroyed" }
        require(id !in entries) { "Native component already attached: $id" }
        require(view.parent == null) { "Native component View already has a parent" }
        view.visibility = View.GONE
        layer.addView(view)
        entries[id] = Entry(type, view, onVisibilityChanged)
    }

    override fun updateLayout(id: String, layout: NativeComponentLayout) {
        check(!destroyed) { "Native component backend destroyed" }
        val entry = entries[id] ?: error("Native component is not attached: $id")
        entry.layout = layout
        applyLayout(entry)
        updateBackground()
    }

    private fun viewport() = NativeViewport(webView.width, webView.height, webView.scrollX, webView.scrollY)
    private fun refreshLayouts() {
        if (destroyed) return
        entries.values.forEach { applyLayout(it) }
        updateBackground()
    }
    private fun applyLayout(entry: Entry) {
        val layout = entry.layout ?: return
        val pixels = viewport().resolve(layout)
        val view = entry.view
        if (!pixels.visible) cancelGesture(entry)
        view.visibility = if (pixels.visible) View.VISIBLE else View.GONE
        // Preserve cover-view / cover-image above maps regardless of mount order.
        view.translationZ = if (entry.type == "native/map") -1f else layout.zIndex
        view.alpha = layout.opacity.coerceIn(0f, 1f)
        view.clipBounds = pixels.clip?.let { Rect(it.left, it.top, it.right, it.bottom) }
        val current = view.layoutParams as? FrameLayout.LayoutParams
        if (current?.width != pixels.width || current.height != pixels.height ||
            current.leftMargin != pixels.left || current.topMargin != pixels.top) {
            view.layoutParams = FrameLayout.LayoutParams(pixels.width, pixels.height).apply {
                leftMargin = pixels.left; topMargin = pixels.top
            }
        }
        if (entry.visible != pixels.visible) {
            entry.visible = pixels.visible
            entry.visibilityChanged(entry.visible)
        }
    }

    private fun updateBackground() {
        val colors = entries.values.lastOrNull { it.layout?.pageBackgroundColors != null }
            ?.layout?.pageBackgroundColors
        val visible = colors != null || entries.values.any { it.visible }
        if (colors != null) {
            if (colors != appliedBackgroundColors || pageBackgroundColor != appliedBaseColor) {
                val color = colors.fold(pageBackgroundColor) { background, foreground ->
                    ColorUtils.compositeColors(foreground, background)
                }
                if (color != appliedLayerColor) {
                    layer.background = ColorDrawable(color)
                    appliedLayerColor = color
                }
                appliedBackgroundColors = colors
                appliedBaseColor = pageBackgroundColor
            }
        } else if (appliedLayerColor != null) {
            layer.background = originalLayerBackground
            appliedBackgroundColors = null
            appliedBaseColor = null
            appliedLayerColor = null
        }
        if (visible && !transparent) {
            webView.setBackgroundColor(Color.TRANSPARENT)
            transparent = true
        } else if (!visible) restoreBackground()
    }
    private fun restoreBackground() {
        if (!transparent) return
        // WebView keeps its page color separately from View.background (which can be null).
        webView.setBackgroundColor(pageBackgroundColor)
        webView.background = originalBackgroundCopy ?: originalBackground
        transparent = false
    }

    override fun updatePageBackgroundColor(color: Int) {
        if (destroyed) return
        pageBackgroundColor = color
        if (!transparent) webView.setBackgroundColor(color)
        updateBackground()
    }

    override fun dispatchTouch(message: JSONObject): Boolean {
        if (destroyed) return false
        val entry = entries[message.optString("targetId")] ?: return false
        if (!entry.visible) return false
        if (message.has("targetType") && message.optString("targetType") != entry.type) return false
        val action = message.optString("action")
        val now = SystemClock.uptimeMillis()
        if (action == TOUCH_ACTION_DOWN) cancelGesture(entry)
        val downTime = if (action == TOUCH_ACTION_DOWN) now else entry.downTime ?: return false
        val event = createMotionEvent(message, entry.view, downTime, now) ?: return false
        entry.downTime = downTime
        try {
            entry.view.dispatchTouchEvent(event)
            entry.lastTouch?.recycle()
            entry.lastTouch = if (action == TOUCH_ACTION_UP || action == TOUCH_ACTION_CANCEL) null else MotionEvent.obtain(event)
            if (entry.lastTouch == null) entry.downTime = null
        } finally { event.recycle() }
        return true
    }

    private fun cancelGesture(entry: Entry) {
        val event = entry.lastTouch ?: return
        entry.lastTouch = null
        entry.downTime = null
        try { event.action = MotionEvent.ACTION_CANCEL; entry.view.dispatchTouchEvent(event) }
        finally { event.recycle() }
    }

    override fun detach(id: String) {
        val entry = entries.remove(id) ?: return
        cancelGesture(entry)
        layer.removeView(entry.view)
        if (entry.visible) entry.visibilityChanged(false)
        updateBackground()
    }
    override fun destroy() {
        if (destroyed) return
        destroyed = true
        if (scrollObserver.isAlive) scrollObserver.removeOnScrollChangedListener(scrollListener)
        webView.removeOnLayoutChangeListener(resizeListener)
        entries.keys.toList().forEach(::detach)
        restoreBackground()
    }
    private fun createMotionEvent(
        params: JSONObject,
        targetView: View,
        downTime: Long,
        eventTime: Long,
    ): MotionEvent? {
        val pointers = params.optJSONArray("pointers") ?: return null
        if (pointers.length() == 0) {
            return null
        }

        val actionPointerId = params.optInt("actionPointerId", -1)
        val actionPointerIndex = findPointerIndex(pointers, actionPointerId)
        val action = when (params.optString("action")) {
            TOUCH_ACTION_DOWN -> MotionEvent.ACTION_DOWN
            TOUCH_ACTION_POINTER_DOWN -> MotionEvent.ACTION_POINTER_DOWN or
                (actionPointerIndex.coerceAtLeast(0) shl MotionEvent.ACTION_POINTER_INDEX_SHIFT)
            TOUCH_ACTION_MOVE -> MotionEvent.ACTION_MOVE
            TOUCH_ACTION_POINTER_UP -> MotionEvent.ACTION_POINTER_UP or
                (actionPointerIndex.coerceAtLeast(0) shl MotionEvent.ACTION_POINTER_INDEX_SHIFT)
            TOUCH_ACTION_UP -> MotionEvent.ACTION_UP
            TOUCH_ACTION_CANCEL -> MotionEvent.ACTION_CANCEL
            else -> return null
        }

        val viewportWidth = params.optDouble("viewportWidth", 0.0)
        val viewportHeight = params.optDouble("viewportHeight", 0.0)
        val viewport = viewport()
        val scaleX = viewport.scaleX(viewportWidth)
        val scaleY = viewport.scaleY(viewportWidth, viewportHeight)

        val pointerProperties = Array(pointers.length()) { index ->
            val pointer = pointers.getJSONObject(index)
            MotionEvent.PointerProperties().apply {
                id = pointer.optInt("id", index)
                toolType = MotionEvent.TOOL_TYPE_FINGER
            }
        }
        val pointerCoords = Array(pointers.length()) { index ->
            val pointer = pointers.getJSONObject(index)
            MotionEvent.PointerCoords().apply {
                x = (pointer.optDouble("clientX") * scaleX - targetView.left).toFloat()
                y = (pointer.optDouble("clientY") * scaleY - targetView.top).toFloat()
                pressure = 1f
                size = 1f
            }
        }

        return MotionEvent.obtain(
            downTime,
            eventTime,
            action,
            pointers.length(),
            pointerProperties,
            pointerCoords,
            0,
            0,
            1f,
            1f,
            0,
            0,
            InputDevice.SOURCE_TOUCHSCREEN,
            0,
        )
    }

    private fun findPointerIndex(pointers: JSONArray, pointerId: Int): Int {
        for (index in 0 until pointers.length()) {
            if (pointers.getJSONObject(index).optInt("id", -1) == pointerId) {
                return index
            }
        }
        return 0
    }

    private companion object {
        const val TOUCH_ACTION_DOWN = "down"
        const val TOUCH_ACTION_POINTER_DOWN = "pointerDown"
        const val TOUCH_ACTION_MOVE = "move"
        const val TOUCH_ACTION_POINTER_UP = "pointerUp"
        const val TOUCH_ACTION_UP = "up"
        const val TOUCH_ACTION_CANCEL = "cancel"
    }
}
