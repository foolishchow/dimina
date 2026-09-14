package com.didi.dimina.common

import com.didi.dimina.Dimina
import org.junit.Assert.*
import org.junit.Test

class DiminaLaunchConfigTest {
    @Test fun `launch options preserve defaults and remain independent`() {
        val defaults = Dimina.DiminaConfig.Builder().build()
        assertTrue(defaults.enableMultiTask)
        assertTrue(defaults.showLaunchLoading)
        val singleTask = Dimina.DiminaConfig.Builder().setEnableMultiTask(false).build()
        assertFalse(singleTask.enableMultiTask)
        assertTrue(singleTask.showLaunchLoading)
        val noLoading = Dimina.DiminaConfig.Builder().setShowLaunchLoading(false).build()
        assertTrue(noLoading.enableMultiTask)
        assertFalse(noLoading.showLaunchLoading)
        assertTrue(noLoading.showCapsule)
    }
}
