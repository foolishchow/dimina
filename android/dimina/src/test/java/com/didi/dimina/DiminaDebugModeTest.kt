package com.didi.dimina

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import sun.misc.Unsafe

/** Run in both testDebugUnitTest and testReleaseUnitTest to cover the shipped AAR policy. */
class DiminaDebugModeTest {
    private fun sdk(config: Dimina.DiminaConfig): Dimina {
        // Exercise the real accessor without starting Android services or native MMKV.
        val unsafeField = Unsafe::class.java.getDeclaredField("theUnsafe").apply { isAccessible = true }
        val instance = (unsafeField.get(null) as Unsafe).allocateInstance(Dimina::class.java) as Dimina
        Dimina::class.java.getDeclaredField("config").apply { isAccessible = true }.set(instance, config)
        return instance
    }

    @Test
    fun hostCanEnableDebuggingInEitherBuildVariant() {
        assertTrue(sdk(Dimina.DiminaConfig.Builder().setDebugMode(true).build()).isDebugMode())
    }

    @Test
    fun debuggingIsDisabledByDefault() {
        assertFalse(sdk(Dimina.DiminaConfig.Builder().build()).isDebugMode())
    }

    @Test
    fun hostCanExplicitlyDisableDebugging() {
        assertFalse(sdk(Dimina.DiminaConfig.Builder().setDebugMode(true).setDebugMode(false).build()).isDebugMode())
    }
}
