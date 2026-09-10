<script setup>
import { isAndroid, isIOS, isHarmonyOS } from '@dimina/common'
import { triggerEvent, useInfo } from '@/common/events'
import { createMapSession } from './map-session'

const props = defineProps({
	id: { type: String, default: () => `map-${useId()}` },
	latitude: { type: Number, default: 39.92 },
	longitude: { type: Number, default: 116.46 },
	scale: { type: Number, default: 16 },
	markers: { type: Array, default: () => [] },
	covers: { type: Array, default: () => [] },
	includePoints: { type: Array, default: () => [] },
	polyline: { type: Array, default: () => [] },
	circles: { type: Array, default: () => [] },
	controls: { type: Array, default: () => [] },
	polygons: { type: Array, default: () => [] },
	showLocation: { type: Boolean, default: false },
	showScale: { type: Boolean, default: false },
	showCompass: { type: Boolean, default: false },
	theme: { type: String, default: 'normal' },
	subkey: { type: String, default: '' },
	layerStyle: { type: Number, default: 1 },
	usePluginId: { type: Boolean, default: false },
	enableZoom: { type: Boolean, default: true },
	enableScroll: { type: Boolean, default: true },
	enableRotate: { type: Boolean, default: false },
	enable3D: { type: Boolean, default: false },
	enableOverlooking: { type: Boolean, default: false },
	enableAutoMaxOverlooking: { type: Boolean, default: false },
	enableSatellite: { type: Boolean, default: false },
	enableTraffic: { type: Boolean, default: false },
	enablePoi: { type: Boolean, default: true },
	// 兼容 Dimina 旧属性拼写；未显式传入时以 exparser 的 enable-poi 为准。
	enablePOI: { type: Boolean, default: undefined },
	enableBuilding: { type: Boolean, default: true },
	enableIndoor: { type: Boolean, default: false },
	enableIndoorBuildingPick: { type: Boolean, default: false },
	enableIndoorLevelPick: { type: Boolean, default: false },
	rotate: { type: Number, default: 0 },
	skew: { type: Number, default: 0 },
	minScale: { type: Number, default: 3 },
	maxScale: { type: Number, default: 22 },
	setting: { type: Object, default: () => ({}) },
})

const rootRef = ref()
const surfaceRef = ref()
const info = useInfo()
const errorMessage = ref('')
const errorHint = computed(() => {
	if (/AMap (?:Web|Android|iOS|HarmonyOS) key is required/i.test(errorMessage.value)) return '未配置地图 Key'
	if (/map provider is not configured/i.test(errorMessage.value)) return '地图未配置，请配置地图 Key 和服务提供方'
	return '地图暂不可用'
})
let session

function snapshot() {
	return JSON.parse(JSON.stringify({ ...props, ...props.setting }))
}

function emit(type, detail) {
	triggerEvent(type, { info, detail, currentTarget: rootRef.value })
}

onMounted(() => {
	const config = window.__DIMINA_MAP_CONFIG__ || ((isAndroid || isIOS || isHarmonyOS) && window.DiminaRenderBridge?.mapRenderer !== 'web'
		? { provider: 'native', authorize: () => true } : undefined)
	session = createMapSession({ element: surfaceRef.value, props: snapshot(), emit, bridgeId: info.bridgeId, config })
	session.ready.catch(error => { errorMessage.value = error.message })
	Object.defineProperty(rootRef.value, '__diminaMap', {
		configurable: true,
		value: { bridgeId: info.bridgeId, moduleId: info.moduleId, invoke: session.invoke },
	})
})

watch(snapshot, next => {
	session?.update(next).catch(error => emit('error', { errMsg: `map:fail ${error.message}` }))
}, { deep: true })

onBeforeUnmount(() => {
	delete rootRef.value.__diminaMap
	session?.destroy()
})
</script>

<template>
	<div :id="id" ref="rootRef" v-bind="$attrs" class="dd-map">
		<div ref="surfaceRef" class="dd-map-surface" />
		<div v-if="errorMessage" class="dd-map-error" role="status">{{ errorHint }}</div>
		<div class="dd-map-slot"><slot /></div>
	</div>
</template>

<style lang="scss">
.dd-map {
	display: block;
	position: relative;
	overflow: hidden;
	width: 300px;
	height: 150px;
	&[hidden] { display: none; }
}
.dd-map-surface, .dd-map-slot, .dd-map-error {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
.dd-map-error {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f5f5f5;
	color: #666;
}
.dd-map-slot { pointer-events: none; }
.dd-map-slot * { pointer-events: auto; }
</style>
