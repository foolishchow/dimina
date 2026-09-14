package com.didi.dimina.api.file

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.didi.dimina.Dimina
import com.didi.dimina.common.PathUtils
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@RunWith(AndroidJUnit4::class)
class LocalPackageTest {
    @Test fun localInstallPreservesDataAndRollsBackInvalidPackages() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val sdk = Dimina.init(context, Dimina.DiminaConfig.Builder().setShowCapsule(false).build())
        assertFalse(sdk.shouldShowCapsule())
        val appId = "local-${UUID.randomUUID()}"
        val source = File(context.cacheDir, appId).apply { mkdirs() }
        val target = File(context.filesDir, "jsapp/$appId")
        val userFile = File(PathUtils.appUserRoot(context, appId), "keep").apply { parentFile!!.mkdirs(); writeText("user") }
        fun archive(version: Number, valid: Boolean = true, id: String = appId): File {
            val zip = File(source, "${UUID.randomUUID()}.zip")
            ZipOutputStream(zip.outputStream()).use { out ->
                val files = mutableMapOf("config.json" to JSONObject().put("appId", id).put("versionCode", version).put("versionName", "v$version").put("name", "test").put("path", "pages/index").toString(), "main/app-config.json" to "{}")
                if (valid) files["main/logic.js"] = "v$version"
                files.forEach { (name, data) -> out.putNextEntry(ZipEntry(name)); out.write(data.toByteArray()); out.closeEntry() }
            }
            return zip
        }
        fun install(zip: File): Result<JSONObject> {
            val latch = CountDownLatch(1)
            var result: Result<JSONObject>? = null
            sdk.installMiniProgram(appId, zip.path) { result = it; latch.countDown() }
            assertTrue("install callback timed out", latch.await(15, TimeUnit.SECONDS))
            return result!!
        }
        try {
            assertFalse(sdk.isExistsApp(appId))
            val zip = archive(2)
            assertEquals(2, install(zip).getOrThrow().getInt("versionCode"))
            assertTrue(zip.isFile)
            assertTrue(sdk.isExistsApp(appId))
            assertTrue(install(archive(3, false)).isFailure)
            assertTrue(install(archive(-1)).isFailure)
            assertTrue(install(archive(1.5)).isFailure)
            assertTrue(install(archive(3, id = "other-app")).isFailure)
            assertEquals("v2", File(target, "main/logic.js").readText())
            assertEquals(2, sdk.getAppVersionInfo(appId)!!.getInt("versionCode"))
            install(archive(2)).getOrThrow()
            install(archive(1)).getOrThrow()
            assertEquals(1, sdk.getAppVersionInfo(appId)!!.getInt("versionCode"))
            assertTrue(sdk.getAppVersionInfo(appId)!!.getBoolean("hostManaged"))
            assertEquals("user", userFile.readText())
        } finally {
            source.deleteRecursively(); target.deleteRecursively(); userFile.parentFile!!.deleteRecursively()
        }
    }
}
