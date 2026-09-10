package com.didi.dimina.ui.view.nativecomponent

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.PixelCopy
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class BackendTestActivity : Activity() {
    lateinit var layer: FrameLayout
    lateinit var web: WebView
    val loaded = CountDownLatch(1)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this).apply { setBackgroundColor(Color.WHITE) }
        layer = FrameLayout(this)
        web = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) { loaded.countDown() }
            }
        }
        root.addView(layer, FrameLayout.LayoutParams(-1, -1))
        root.addView(web, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        web.loadDataWithBaseURL(null, """<meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:2000px;background:transparent"><button style="position:absolute;left:20px;top:100px;width:100px;height:40px;background:#ff0000;border:0;color:white">Overlay</button></body>""", "text/html", "UTF-8", null)
    }
    override fun onDestroy() { web.destroy(); super.onDestroy() }
}

private class TouchView(activity: Activity) : View(activity) {
    val actions = mutableListOf<Int>()
    val points = mutableListOf<Pair<Float, Float>>()
    override fun onTouchEvent(event: MotionEvent): Boolean {
        actions.add(event.actionMasked); points.add(event.x to event.y); return true
    }
}

@RunWith(AndroidJUnit4::class)
class NativeComponentBackendTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun launch(): ActivityScenario<BackendTestActivity> {
        val scenario = ActivityScenario.launch<BackendTestActivity>(Intent(instrumentation.targetContext, BackendTestActivity::class.java))
        lateinit var latch: CountDownLatch
        scenario.onActivity { latch = it.loaded }
        assertTrue("WebView load", latch.await(10, TimeUnit.SECONDS))
        instrumentation.waitForIdleSync()
        return scenario
    }
    private fun layout(activity: BackendTestActivity): NativeComponentLayout {
        val density = activity.resources.displayMetrics.density.toDouble()
        return NativeComponentLayout(20.0, 100.0, 200.0, 150.0,
            activity.web.width / density, activity.web.height / density)
    }
    private fun touch(action: String) = JSONObject("""{"targetId":"shared","targetType":"native/map","action":"$action","actionPointerId":0,"viewportWidth":360,"viewportHeight":640,"pointers":[{"id":0,"clientX":50,"clientY":120}]}""")

    private fun awaitFrame(scenario: ActivityScenario<BackendTestActivity>) {
        val drawn = CountDownLatch(1)
        scenario.onActivity { activity ->
            activity.web.postVisualStateCallback(1, object : WebView.VisualStateCallback() {
                override fun onComplete(requestId: Long) {
                    activity.web.viewTreeObserver.addOnDrawListener(object : android.view.ViewTreeObserver.OnDrawListener {
                        override fun onDraw() {
                            activity.web.post {
                                activity.web.viewTreeObserver.removeOnDrawListener(this)
                                drawn.countDown()
                            }
                        }
                    })
                    activity.web.invalidate()
                }
            })
        }
        assertTrue("WebView composite frame", drawn.await(10, TimeUnit.SECONDS))
    }

    private fun captureWindow(scenario: ActivityScenario<BackendTestActivity>): Bitmap {
        val copied = CountDownLatch(1)
        lateinit var bitmap: Bitmap
        var result = -1
        scenario.onActivity { activity ->
            val decor = activity.window.decorView
            bitmap = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
            PixelCopy.request(activity.window, bitmap, { result = it; copied.countDown() }, Handler(Looper.getMainLooper()))
        }
        assertTrue("Window pixels", copied.await(10, TimeUnit.SECONDS))
        assertEquals(PixelCopy.SUCCESS, result)
        return bitmap
    }

    @Test fun detachCancelsGestureAndRestoresBackgroundWithoutRemovingForeignViews() {
        launch().use { scenario ->
            scenario.onActivity { activity ->
                val foreign = View(activity); activity.layer.addView(foreign)
                val backend = WebViewUnderlayBackend(activity.web, activity.layer)
                val view = TouchView(activity)
                val visibility = mutableListOf<Boolean>()
                backend.attach("shared", "native/map", view, visibility::add)
                val layout = layout(activity)
                backend.updateLayout("shared", layout)
                activity.layer.measure(View.MeasureSpec.makeMeasureSpec(activity.web.width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(activity.web.height, View.MeasureSpec.EXACTLY))
                activity.layer.layout(0, 0, activity.web.width, activity.web.height)
                assertTrue(backend.dispatchTouch(touch("down")))
                backend.updateLayout("shared", layout.copy(hidden = true))
                assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_CANCEL), view.actions)
                assertFalse(backend.dispatchTouch(touch("move")))
                backend.updateLayout("shared", layout)
                assertTrue(backend.dispatchTouch(touch("down")))
                backend.detach("shared")
                assertEquals(MotionEvent.ACTION_CANCEL, view.actions.last())
                assertEquals(listOf(true, false, true, false), visibility)
                assertNull(activity.web.background)
                backend.destroy(); backend.destroy()
                assertSame(activity.layer, foreign.parent)
                assertNull(view.parent)
            }
        }
    }

    @Test fun backendsAreIsolatedAndFactoryChangesOnlyAffectNewHosts() {
        launch().use { scenario ->
            scenario.onActivity { activity ->
                var creates = 0
                NativeComponentBackends.setFactory { context ->
                    creates++; WebViewUnderlayBackend(context.webView, context.nativeLayer)
                }
                try {
                    val first = NativeComponentBackends.create(NativeComponentBackendContext(activity, activity.web, activity.layer))
                    val secondWeb = WebView(activity)
                    val secondLayer = FrameLayout(activity)
                    val second = NativeComponentBackends.create(NativeComponentBackendContext(activity, secondWeb, secondLayer))
                    NativeComponentBackends.resetFactory()
                    val thirdWeb = WebView(activity)
                    val third = NativeComponentBackends.create(NativeComponentBackendContext(activity, thirdWeb, FrameLayout(activity)))
                    third.destroy(); thirdWeb.destroy()
                    val one = View(activity); val two = View(activity)
                    first.attach("same", "native/map", one) {}
                    second.attach("same", "native/video", two) {}
                    first.updateLayout("same", layout(activity))
                    second.updateLayout("same", layout(activity))
                    first.destroy()
                    assertNull(one.parent)
                    assertSame(secondLayer, two.parent)
                    assertEquals(2, creates)
                    assertFalse(second.capabilities.embedsIntoDom)
                    second.destroy(); secondWeb.destroy()
                } finally { NativeComponentBackends.resetFactory() }
            }
        }
    }

    @Test fun cssPageBackgroundIsBehindNativeViewsAndSurvivesHiddenMaps() {
        launch().use { scenario ->
            lateinit var backend: WebViewUnderlayBackend
            lateinit var view: View
            var x = 0; var y = 0; var outsideX = 0
            val original = android.graphics.drawable.ColorDrawable(Color.MAGENTA)
            scenario.onActivity { activity ->
                activity.layer.background = original
                backend = WebViewUnderlayBackend(activity.web, activity.layer)
                view = View(activity).apply { setBackgroundColor(Color.GREEN) }
                backend.attach("map", "native/map", view) {}
                backend.updateLayout("map", layout(activity).copy(pageBackgroundColors = listOf(Color.TRANSPARENT, Color.YELLOW)))
            }
            awaitFrame(scenario)
            scenario.onActivity { activity ->
                val origin = IntArray(2); view.getLocationInWindow(origin)
                val density = activity.resources.displayMetrics.density
                x = origin[0] + (150 * density).toInt(); y = origin[1] + (100 * density).toInt()
                outsideX = origin[0] + (210 * density).toInt()
            }
            val shown = captureWindow(scenario)
            try {
                assertEquals("Map stays above page CSS color", Color.GREEN, shown.getPixel(x, y))
                assertEquals("Page CSS color outside the map", Color.YELLOW, shown.getPixel(outsideX, y))
            } finally { shown.recycle() }
            scenario.onActivity { activity ->
                backend.updateLayout("map", layout(activity).copy(hidden = true, pageBackgroundColors = listOf(Color.TRANSPARENT, Color.CYAN)))
            }
            awaitFrame(scenario)
            val hidden = captureWindow(scenario)
            try { assertEquals("Hidden map retains updated CSS background", Color.CYAN, hidden.getPixel(x, y)) }
            finally { hidden.recycle() }
            scenario.onActivity { activity ->
                backend.destroy()
                assertSame(original, activity.layer.background)
                assertEquals(Color.MAGENTA, original.color)
            }
        }
    }

    @Test fun unchangedPageColorDoesNotReplaceBackgroundDuringLayoutUpdates() {
        launch().use { scenario ->
            scenario.onActivity { activity ->
                val backend = WebViewUnderlayBackend(activity.web, activity.layer)
                val view = View(activity)
                backend.attach("map", "native/map", view) {}
                val layout = layout(activity).copy(pageBackgroundColors = listOf(Color.TRANSPARENT, Color.YELLOW))
                backend.updateLayout("map", layout)
                val initial = activity.layer.background
                repeat(300) { index ->
                    backend.updateLayout("map", layout.copy(top = index.toDouble(), pageBackgroundColors = listOf(Color.TRANSPARENT, Color.YELLOW)))
                    assertSame("Layout must not allocate/replace the background", initial, activity.layer.background)
                }
                // Opaque CSS hides base-color changes; compare the composed result too.
                backend.updatePageBackgroundColor(Color.BLUE)
                assertSame("Same composed color", initial, activity.layer.background)
                backend.updateLayout("map", layout.copy(pageBackgroundColors = listOf(Color.TRANSPARENT)))
                val blue = activity.layer.background as android.graphics.drawable.ColorDrawable
                assertEquals(Color.BLUE, blue.color)
                backend.updatePageBackgroundColor(Color.RED)
                assertEquals(Color.RED, (activity.layer.background as android.graphics.drawable.ColorDrawable).color)
                backend.detach("map")
                assertNull(activity.layer.background)
                backend.attach("map", "native/map", view) {}
                backend.updateLayout("map", layout)
                assertEquals(Color.YELLOW, (activity.layer.background as android.graphics.drawable.ColorDrawable).color)
                backend.destroy()
            }
        }
    }

    @Test fun nativePixelsAndHtmlOverlayComposeAndClippingKeepsFullViewSize() {
        launch().use { scenario ->
            lateinit var backend: WebViewUnderlayBackend
            lateinit var view: View
            var greenX = 0; var greenY = 0; var redX = 0; var redY = 0
            scenario.onActivity { activity ->
                backend = WebViewUnderlayBackend(activity.web, activity.layer)
                view = View(activity).apply { setBackgroundColor(Color.GREEN) }
                backend.attach("map", "native/map", view) {}
                backend.updateLayout("map", layout(activity))
                backend.updatePageBackgroundColor(Color.MAGENTA)
            }
            instrumentation.waitForIdleSync()
            awaitFrame(scenario)
            scenario.onActivity { activity ->
                val origin = IntArray(2); view.getLocationInWindow(origin)
                val density = activity.resources.displayMetrics.density
                greenX = origin[0] + (150 * density).toInt(); greenY = origin[1] + (100 * density).toInt()
                redX = origin[0] + (10 * density).toInt(); redY = origin[1] + (10 * density).toInt()
            }
            // Copy the composed window so system transition animations cannot move the sampled pixels.
            val bitmap = captureWindow(scenario)
            try {
                instrumentation.targetContext.openFileOutput("backend-composition.png", 0).use {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
                assertEquals("Native map region", Color.GREEN, bitmap.getPixel(greenX, greenY))
                assertEquals("HTML overlay", Color.RED, bitmap.getPixel(redX, redY))
            } finally { bitmap.recycle() }
            scenario.onActivity { activity ->
                val width = view.width
                backend.updateLayout("map", layout(activity).copy(clip = NativeComponentClip(30.0, 20.0, 180.0, 120.0)))
                val density = activity.resources.displayMetrics.density
                assertEquals(width, view.layoutParams.width)
                assertEquals((30 * density).toInt(), view.clipBounds!!.left)
                backend.destroy()
                // A contrasting native layer exposes a WebView that was accidentally left transparent.
                activity.layer.setBackgroundColor(Color.BLUE)
            }
            awaitFrame(scenario)
            val restored = captureWindow(scenario)
            try { assertEquals("WebView page color restored", Color.MAGENTA, restored.getPixel(greenX, greenY)) }
            finally { restored.recycle() }
        }
    }
}
