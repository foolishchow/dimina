package com.didi.dimina.api.file

import android.content.Context
import android.content.ContextWrapper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.didi.dimina.api.AsyncResult
import com.didi.dimina.common.PathUtils
import com.didi.dimina.ui.container.DiminaActivity
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class FileSystemCacheTest {
    @Test
    fun persistsTwoMegabyteCacheAndRejectsInvalidCleanup() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        lateinit var activity: DiminaActivity
        // File APIs only need an app Context, not a launched mini-program or WebView.
        instrumentation.runOnMainSync {
            activity = DiminaActivity()
            ContextWrapper::class.java.getDeclaredMethod("attachBaseContext", Context::class.java)
                .apply { isAccessible = true }.invoke(activity, instrumentation.targetContext)
        }
        val appId = "file-cache-test-${UUID.randomUUID()}"
        val api = FileApi()
        fun call(name: String, params: JSONObject, ok: Boolean = true): JSONObject {
            val result = api.handleAction(activity, appId, "FileSystemManager.$name", params) {} as AsyncResult
            assertEquals(result.value.toString(), ok, result.value.getString("errMsg").endsWith(":ok"))
            return result.value
        }
        fun args(vararg pairs: Pair<String, Any>) = JSONObject().apply { pairs.forEach { put(it.first, it.second) } }
        val base = "${PathUtils.VIRTUAL_DOMAIN_URL}usr/form-cache"
        val file = "$base/form.json"
        try {
            call("access", args("path" to base), false)
            call("mkdir", args("dirPath" to base, "recursive" to true))
            val json = "{\"form\":\"" + "x".repeat(2 * 1024 * 1024) + "中文\"}"
            call("writeFile", args("filePath" to file, "data" to json, "encoding" to "utf8"))
            assertEquals(json, call("readFile", args("filePath" to file, "encoding" to "utf8")).getString("data"))
            call("writeFile", args("filePath" to file, "data" to "{}", "encoding" to "utf8"))
            assertEquals("{}", call("readFile", args("filePath" to file, "encoding" to "utf8")).getString("data"))
            call("mkdir", args("dirPath" to file, "recursive" to true), false)
            call("mkdir", args("dirPath" to base, "recursive" to true), false)
            call("copyFile", args("srcPath" to file, "destPath" to file))
            call("copyFile", args("srcPath" to "$base/missing", "destPath" to file), false)
            assertEquals("{}", call("readFile", args("filePath" to file, "encoding" to "utf8")).getString("data"))
            call("copyFile", args("srcPath" to file, "destPath" to base), false)
            for (root in listOf("${PathUtils.VIRTUAL_DOMAIN_URL}usr", "${PathUtils.VIRTUAL_DOMAIN_URL}tmp")) {
                call("rmdir", args("dirPath" to root, "recursive" to true), false)
                call("rename", args("oldPath" to root, "newPath" to "$base/moved"), false)
                call("rename", args("oldPath" to base, "newPath" to root), false)
            }
            assertEquals(2, call("stat", args("path" to file, "recursive" to true)).getJSONObject("stats").getInt("size"))
            val stats = call("stat", args("path" to base, "recursive" to true)).getJSONObject("stats")
            assertTrue(stats.getJSONObject("").getBoolean("isDirectory"))
            assertEquals(32768, stats.getJSONObject("/form.json").getInt("mode") and 61440)
            call("writeFile", args("filePath" to "$base/replacement", "data" to "{}", "encoding" to "utf8"))
            call("rename", args("oldPath" to "$base/replacement", "newPath" to file))
            call("copyFile", args("srcPath" to file, "destPath" to "$base/copy.json"))
            call("rename", args("oldPath" to "$base/copy.json", "newPath" to "$base/renamed.json"))
            assertEquals(2, call("readdir", args("dirPath" to base)).getJSONArray("files").length())
            assertTrue(call("stat", args("path" to base, "recursive" to true)).getJSONObject("stats").has("/form.json"))
            call("rmdir", args("dirPath" to base), false)
            call("rmdir", args("dirPath" to file, "recursive" to true), false)
            call("unlink", args("filePath" to base), false)
            call("access", args("path" to file))
            call("unlink", args("filePath" to "$base/renamed.json"))
            call("rmdir", args("dirPath" to base, "recursive" to true))
            call("access", args("path" to file), false)
        } finally {
            PathUtils.appUserRoot(activity, appId).deleteRecursively()
            PathUtils.appTempRoot(activity, appId).deleteRecursively()
        }
    }
}
