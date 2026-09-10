package com.didi.dimina.ui.view.nativecomponent

import android.app.Activity
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.annotation.MainThread
import org.json.JSONObject

/** Composition policy, independent of a component's SDK/provider. */
data class NativeComponentCapabilities(
    val name: String,
    val requiresTransparentDomAncestors: Boolean,
    val requiresDomTouchForwarding: Boolean,
    val embedsIntoDom: Boolean,
    val supportsPageBackground: Boolean = false,
)

/** A backend owns presentation only. The component still owns and destroys its SDK View. */
@MainThread
interface NativeComponentBackend {
    val capabilities: NativeComponentCapabilities
    fun attach(id: String, type: String, view: View, onVisibilityChanged: (Boolean) -> Unit)
    fun updateLayout(id: String, layout: NativeComponentLayout)
    fun dispatchTouch(message: JSONObject): Boolean
    /** Update the page color without obscuring presented native components. */
    fun updatePageBackgroundColor(color: Int)
    /** Detach and cancel pending gestures before the component destroys its SDK. */
    fun detach(id: String)
    /** Terminal, idempotent teardown of this page's attachments and listeners. */
    fun destroy()
}

data class NativeComponentBackendContext(val activity: Activity, val webView: WebView, val nativeLayer: FrameLayout)

fun interface NativeComponentBackendFactory {
    /** Return a new backend for each page. Never share a backend between WebViews. */
    fun create(context: NativeComponentBackendContext): NativeComponentBackend
}

/** Changes affect subsequently created hosts only. Register on the UI thread before opening pages. */
@MainThread
object NativeComponentBackends {
    private val defaultFactory = NativeComponentBackendFactory { WebViewUnderlayBackend(it.webView, it.nativeLayer) }
    private var factory: NativeComponentBackendFactory = defaultFactory

    fun setFactory(factory: NativeComponentBackendFactory) { this.factory = factory }
    fun resetFactory() { factory = defaultFactory }
    fun create(context: NativeComponentBackendContext): NativeComponentBackend = factory.create(context)
}
