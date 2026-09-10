/** One-shot Web demo location, converted by AMap to its GCJ-02 coordinate system. */
export function getMapLocation(frameWindow, { type, signal } = {}) {
	return new Promise((resolve, reject) => {
		if (type !== 'gcj02') return reject(new Error('地图定位仅支持 GCJ-02 坐标'))
		const AMap = frameWindow.AMap
		if (!AMap?.plugin) return reject(new Error('地图 SDK 尚未就绪'))
		let settled = false
		const finish = (error, location) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			signal?.removeEventListener('abort', cancel)
			if (error) reject(error)
			else resolve(location)
		}
		const cancel = () => finish(new Error('地图定位已取消'))
		const timer = setTimeout(() => finish(new Error('地图定位超时，请检查浏览器定位权限')), 10000)
		if (signal?.aborted) return cancel()
		signal?.addEventListener('abort', cancel, { once: true })
		try {
			AMap.plugin('AMap.Geolocation', () => {
				if (settled) return
				try {
					const geolocation = new AMap.Geolocation({
						enableHighAccuracy: true, timeout: 10000, convert: true, noIpLocate: 3,
						showButton: false, showMarker: false, showCircle: false,
						panToLocation: false, zoomToAccuracy: false,
					})
					geolocation.getCurrentPosition((status, result) => {
						if (settled) return
						if (status !== 'complete') return finish(new Error(`地图定位失败：${result?.message || result?.info || '请检查浏览器定位权限'}`))
						try {
							const longitude = result?.position?.getLng()
							const latitude = result?.position?.getLat()
							if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
								throw new Error('地图定位返回了无效坐标')
							}
							finish(null, { longitude, latitude })
						} catch (error) { finish(error) }
					})
				} catch (error) { finish(error) }
			})
		} catch (error) { finish(error) }
	})
}
