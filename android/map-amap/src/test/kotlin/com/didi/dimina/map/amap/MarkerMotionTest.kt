package com.didi.dimina.map.amap

import org.junit.Assert.*
import org.junit.Test

class MarkerMotionTest {
    @Test fun followsDistanceInsteadOfPointCount() {
        val motion = MarkerMotion(listOf(MotionPoint(0.0, 0.0), MotionPoint(1.0, 0.0), MotionPoint(4.0, 0.0)), 0.0, 0.0, true, false)
        val sample = motion.sample(0.5)
        assertEquals(2.0, sample.point.longitude, 1e-9)
        assertEquals(90.0, sample.rotate, 1e-9)
        assertEquals(4.0, motion.sample(1.0).point.longitude, 0.0)
    }
    @Test fun crossesDatelineByShortestPath() {
        val motion = MarkerMotion(listOf(MotionPoint(179.0, 0.0), MotionPoint(-179.0, 0.0)), 0.0, 0.0, true, false)
        assertEquals(180.0, kotlin.math.abs(motion.sample(0.5).point.longitude), 1e-9)
        assertEquals(-179.0, motion.sample(1.0).point.longitude, 0.0)
    }
    @Test fun rotatesBeforeMovingWhenRequested() {
        val motion = MarkerMotion(listOf(MotionPoint(0.0, 0.0), MotionPoint(2.0, 0.0)), 0.0, 90.0, false, true)
        assertEquals(0.0, motion.sample(0.25).point.longitude, 0.0)
        assertEquals(45.0, motion.sample(0.25).rotate, 1e-9)
        assertEquals(1.0, motion.sample(0.75).point.longitude, 1e-9)
    }
    @Test fun stationaryRouteStillRotates() {
        val motion = MarkerMotion(listOf(MotionPoint(0.0, 0.0), MotionPoint(0.0, 0.0)), 0.0, 90.0, true, false)
        assertEquals(0.0, motion.sample(0.5).distance, 0.0)
        assertEquals(90.0, motion.sample(1.0).rotate, 0.0)
    }
}
