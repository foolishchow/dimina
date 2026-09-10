package com.didi.dimina.map

import android.app.Activity
import android.view.View
import androidx.annotation.MainThread
import org.json.JSONObject

/** Vendor-independent native map contract. All methods and callbacks run on the UI thread. */
interface MapProvider {
    fun create(activity: Activity, events: MapEvents): MapInstance
}
interface MapEvents {
    fun ready()
    fun event(name: String, detail: JSONObject = JSONObject())
    fun error(message: String)
}
interface MapInstance {
    val view: View
    fun update(props: JSONObject)
    fun invoke(command: String, args: JSONObject, result: (Result<JSONObject>) -> Unit)
    fun resume()
    fun pause()
    fun destroy()
}

/** Host-selected providers; registry never imports a vendor SDK or receives a key from JS. */
object MapProviders {
    private val providers = mutableMapOf<String, MapProvider>()
    private var selected: String? = null

    @MainThread
    fun register(name: String, provider: MapProvider, select: Boolean = true) {
        require(name.isNotBlank())
        providers[name] = provider
        if (select) selected = name
    }

    @MainThread
    fun select(name: String) {
        require(providers.containsKey(name)) { "Map provider is not registered: $name" }
        selected = name
    }

    @MainThread
    fun create(activity: Activity, events: MapEvents): MapInstance =
        (providers[selected] ?: error("Native map provider is not configured")).create(activity, events)
}
