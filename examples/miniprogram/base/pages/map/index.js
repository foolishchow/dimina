const start = { longitude: 116.397428, latitude: 39.90923 }
const end = { longitude: 116.407428, latitude: 39.91923 }
const path = [start, { longitude: end.longitude, latitude: start.latitude }, end, start]
const markers = [
  { id: 0, ...start, title: '地点 A', callout: { content: '地点 A', display: 'BYCLICK' } },
  { id: 1, ...end, title: '地点 B' },
]
const commands = {
  getCenterLocation: {}, getScale: {}, getRegion: {}, getRotate: {}, getSkew: {},
  includePoints: { points: [start, end], padding: [32, 32, 32, 32] },
  moveToLocation: {},
  addMarkers: { markers, clear: true },
  removeMarkers: { markerIds: [0] },
  translateMarker: { markerId: 0, destination: end, duration: 2000, autoRotate: true },
  moveAlong: { markerId: 0, path, duration: 4000, autoRotate: true, precision: 100 },
  addArc: { id: 0, start, end, angle: 45, width: 6, color: '#1677ff' },
  removeArc: { id: 0 },
  offset: { offset: [0.5, 0.7] },
  resetOffset: { offset: [0.5, 0.5] },
  setBoundary: {
    southwest: { longitude: 116.37, latitude: 39.89 },
    northeast: { longitude: 116.44, latitude: 39.94 },
  },
}

Page({
  data: {
    ...start, scale: 14, rotate: 0, skew: 0,
    showLocation: false, showCompass: false, ready: false,
    status: '地图加载中', results: [], markers,
    polyline: [], circles: [], polygons: [], overlaysVisible: false,
    queryMethods: ['getCenterLocation', 'getScale', 'getRegion', 'getRotate', 'getSkew'],
  },
  onReady() { this.map = wx.createMapContext('places') },
  onUnload() { this.unloaded = true },
  onMapReady() { this.setData({ ready: true, status: '地图已就绪' }) },
  onMapError(event) { this.setData({ status: event.detail.errMsg }) },
  onMarkerTap(event) { this.setData({ status: `点击标记 ${event.detail.markerId}` }) },
  onRegionChange(event) {
    if (event.detail.type === 'end') this.setData({ status: `当前缩放 ${event.detail.scale}` })
  },
  onInterpolatePoint(event) {
    // 只记录完成事件，避免动画过程持续刷新结果列表。
    if (event.detail.animationStatus === 'complete') this.record('interpolatepoint', '完成', event.detail)
  },
  record(method, state, value) {
    if (this.unloaded) return
    const detail = value ? JSON.stringify(value) : ''
    this.setData({ results: [`${method} · ${state} ${detail}`, ...this.data.results].slice(0, 8) })
  },
  clearResults() { this.setData({ results: [] }) },
  invoke(method, options = {}, onSuccess) {
    if (!this.data.ready || !this.map) {
      this.record(method, '失败', { errMsg: '请等待地图就绪' })
      return
    }
    this.record(method, '调用中')
    try {
      this.map[method]({
        ...options,
        success: result => {
          if (this.unloaded) return
          this.record(method, '成功', result)
          if (onSuccess) onSuccess(result)
        },
        fail: error => this.record(method, '失败', error),
      })
    } catch (error) {
      this.record(method, '失败', { errMsg: error.message })
    }
  },
  runTest(event) {
    const key = event.currentTarget.dataset.command
    const method = key === 'offset' || key === 'resetOffset' ? 'setCenterOffset' : key
    if (!Object.prototype.hasOwnProperty.call(commands, key)) return
    // 每次复制参数，避免 SDK 改写路径或标记影响后续测试。
    const options = JSON.parse(JSON.stringify(commands[key]))
    if (method === 'translateMarker') options.animationEnd = () => this.record(method, 'animationEnd')
    this.invoke(method, options, () => {
      if (method === 'moveToLocation') this.setData({ showLocation: true })
    })
  },
  roundTrip() {
    this.invoke('getCenterLocation', {}, center => {
      this.invoke('toScreenLocation', center, screen => {
        this.invoke('fromScreenLocation', { x: screen.x, y: screen.y }, point => {
          this.record('坐标往返', '误差（度）', {
            longitude: Math.abs(point.longitude - center.longitude),
            latitude: Math.abs(point.latitude - center.latitude),
          })
        })
      })
    })
  },
  toggleCamera() {
    const tilted = this.data.skew === 0
    this.setData({ rotate: tilted ? 45 : 0, skew: tilted ? 30 : 0, showCompass: tilted })
    this.record('视角属性', '已设置', { rotate: tilted ? 45 : 0, skew: tilted ? 30 : 0 })
  },
  toggleOverlays() {
    const visible = !this.data.overlaysVisible
    this.setData({
      overlaysVisible: visible,
      polyline: visible ? [{ points: path, color: '#1677ff', width: 4 }] : [],
      circles: visible ? [{ ...start, radius: 200, color: '#ff6600', fillColor: '#ff660033', strokeWidth: 2 }] : [],
      polygons: visible ? [{ points: path.slice(0, 3), strokeColor: '#009966', fillColor: '#00996633', strokeWidth: 2 }] : [],
    })
    this.record('折线 / 圆 / 多边形', visible ? '已显示' : '已隐藏')
  },
})
