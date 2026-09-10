package com.didi.dimina.ui.view.nativecomponent

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeComponentLayoutTest {
    @Test fun documentCoordinatesTrackScrollWithoutChangingTheCameraSize() {
        val layout = NativeComponentLayout(10.0, 20.0, 200.0, 100.0, 360.0, 640.0,
            pageLeft = 30.0, pageTop = 400.0, clip = NativeComponentClip(5.0, 10.0, 180.0, 90.0))
        val before = NativeViewport(720, 1280, 0, 0).resolve(layout)
        val after = NativeViewport(720, 1280, 10, 200).resolve(layout)
        assertEquals(60, before.left)
        assertEquals(800, before.top)
        assertEquals(50, after.left)
        assertEquals(600, after.top)
        assertEquals(400, after.width)
        assertEquals(200, after.height)
        assertEquals(NativePixelClip(10, 20, 360, 180), after.clip)
    }
    @Test fun viewportCoordinatesDoNotSubtractScrollTwice() {
        val pixels = NativeViewport(1080, 1920, 20, 100).resolve(
            NativeComponentLayout(10.0, 25.0, 100.0, 50.0, 360.0, 640.0))
        assertEquals(30, pixels.left)
        assertEquals(75, pixels.top)
    }
    @Test fun bridgeSnapshotIsIndependentOfLaterJsonMutation() {
        val message = JSONObject("""{"rect":{"left":2,"top":3,"width":100,"height":50,"viewportWidth":200,"viewportHeight":400},"opacity":0.5,"style":{"zIndex":"7"},"clip":{"left":0,"top":10,"right":100,"bottom":50}}""")
        val layout = NativeComponentLayout.from(message)!!
        message.getJSONObject("rect").put("width", 0)
        assertEquals(100.0, layout.width, 0.0)
        assertEquals(0.5f, layout.opacity)
        assertEquals(7f, layout.zIndex)
        assertEquals(10.0, layout.clip!!.top, 0.0)
        assertNull(layout.pageLeft)
    }
    @Test fun hiddenZeroSizeAndEmptyClipAreNotPresented() {
        val viewport = NativeViewport(720, 1280, 0, 0)
        val layout = NativeComponentLayout(0.0, 0.0, 100.0, 50.0, 360.0, 640.0)
        assertTrue(viewport.resolve(layout).visible)
        assertFalse(viewport.resolve(layout.copy(hidden = true)).visible)
        assertFalse(viewport.resolve(layout.copy(width = 0.0)).visible)
        assertFalse(viewport.resolve(layout.copy(opacity = 0f)).visible)
        assertFalse(viewport.resolve(layout.copy(clip = NativeComponentClip(10.0, 0.0, 10.0, 30.0))).visible)
        assertNull(NativeComponentLayout.from(JSONObject()))
    }
}
