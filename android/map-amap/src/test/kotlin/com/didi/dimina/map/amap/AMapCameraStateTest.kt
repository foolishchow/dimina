package com.didi.dimina.map.amap

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AMapCameraStateTest {
    private val beijing = AMapCameraState(39.92, 116.46, 10f, 0f, 0f)
    private fun props() = JSONObject("""{"latitude":23.099994,"longitude":113.324520,"scale":16,"rotate":0,"skew":0}""")

    @Test fun initialCenterAndZoomAreNotOverwrittenByDefaultRotation() {
        assertEquals(AMapCameraState(23.099994, 113.324520, 16f, 0f, 0f),
            resolveCameraState(JSONObject(), props(), beijing))
    }

    @Test fun aRotationUpdatePreservesTheUsersCurrentCenterAndZoom() {
        val current = AMapCameraState(30.0, 120.0, 12f, 20f, 0f)
        assertEquals(current.copy(rotate = 90f), resolveCameraState(props(), props().put("rotate", 90), current))
        assertNull(resolveCameraState(props(), props().put("markers", org.json.JSONArray()), current))
    }
}
