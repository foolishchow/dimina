package com.didi.dimina.core

import org.junit.Assert.*
import org.junit.Test

class BackgroundRetentionTest {
    @Test fun capacityUsesHideRecencyAndDoesNotRefreshDuplicateHide() {
        val state = BackgroundRetention()
        state.policy = RetentionPolicy(2, 0)
        state.hide("a", 0); state.hide("b", 1); state.hide("a", 2); state.hide("c", 3)
        assertEquals(listOf("a"), state.collect(3, false) { true })
        state.forget("b"); state.hide("b", 4); state.hide("d", 5)
        assertEquals(listOf("c"), state.collect(5, false) { true })
    }

    @Test fun expiresAtDeadlineAndCancelsLastLease() {
        val state = BackgroundRetention()
        state.policy = RetentionPolicy(3, 100)
        state.hide("a", 0); state.hide("b", 50)
        assertEquals(1L, state.nextDelay(99) { true })
        assertEquals(emptyList<String>(), state.collect(99, false) { true })
        assertEquals(listOf("a"), state.collect(100, false) { true })
        state.forget("b")
        assertNull(state.nextDelay(100) { true })
    }

    @Test fun pressureProtectsPinnedAppsAndZeroCapacityDisablesRetention() {
        val state = BackgroundRetention()
        state.hide("pinned", 0); state.hide("a", 1); state.hide("b", 2)
        assertEquals(listOf("a", "b"), state.collect(2, true) { it != "pinned" })
        state.policy = RetentionPolicy(0, 0)
        assertEquals(listOf("pinned"), state.collect(2, false) { true })
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsNegativeCapacity() { RetentionPolicy(-1) }
    @Test fun reentryStartsANewLeaseAndAnOldDeadlineCannotEvictIt() {
        val state = BackgroundRetention()
        state.policy = RetentionPolicy(3, 100)
        state.hide("a", 0)
        state.forget("a") // show before expiry
        assertNull(state.nextDelay(90) { true })
        state.hide("a", 200)
        assertEquals(emptyList<String>(), state.collect(299, false) { true })
        assertEquals(listOf("a"), state.collect(300, false) { true })
    }

    @Test fun repeatedPressureAndCapacityChangesDoNotRetainDestroyedGenerations() {
        val state = BackgroundRetention()
        state.hide("a", 0); state.hide("b", 1)
        assertEquals(listOf("a", "b"), state.collect(2, true) { true })
        assertEquals(emptyList<String>(), state.collect(3, true) { true })
        state.hide("a", 200) // a new runtime with the same appId
        state.policy = RetentionPolicy(0, 0)
        assertEquals(listOf("a"), state.collect(200, false) { true })
        assertNull(state.nextDelay(200) { true })
    }

}
