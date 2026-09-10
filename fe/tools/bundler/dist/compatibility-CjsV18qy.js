import { O as miniProgramBuiltinTags, g as getViewScriptTags, j as tagWhiteList, p as getTemplateDirectivePrefixes } from "./env-CPAAD5ub.js";
import { isMainThread } from "node:worker_threads";
import { Parser } from "htmlparser2";
import { isHTMLTag } from "@vue/shared";
//#region src/common/compatibility-reference.js
var supportedBuiltinComponents = [
	"block",
	"button",
	"canvas",
	"checkbox",
	"checkbox-group",
	"cover-image",
	"cover-view",
	"form",
	"icon",
	"image",
	"input",
	"label",
	"map",
	"movable-area",
	"movable-view",
	"navigation-bar",
	"navigator",
	"picker",
	"picker-view",
	"picker-view-column",
	"progress",
	"radio",
	"radio-group",
	"rich-text",
	"scroll-view",
	"slider",
	"slot",
	"swiper",
	"swiper-item",
	"switch",
	"template",
	"text",
	"textarea",
	"video",
	"view",
	"web-view",
	"wxs",
	"include",
	"import"
];
var supportedWxApis = [
	"createMapContext",
	"env",
	"getFileSystemManager",
	"FileSystemManager.saveFile",
	"openDocument",
	"onError",
	"offError",
	"onAppShow",
	"offAppShow",
	"onAppHide",
	"offAppHide",
	"onShow",
	"offShow",
	"onHide",
	"offHide",
	"canIUse",
	"getUpdateManager",
	"openSystemBluetoothSetting",
	"getWindowInfo",
	"getSystemSetting",
	"getSystemInfoSync",
	"getSystemInfoAsync",
	"getSystemInfo",
	"getAppBaseInfo",
	"getDeviceInfo",
	"onThemeChange",
	"offThemeChange",
	"openBluetoothAdapter",
	"closeBluetoothAdapter",
	"getBluetoothAdapterState",
	"startBluetoothDevicesDiscovery",
	"stopBluetoothDevicesDiscovery",
	"getBluetoothDevices",
	"getConnectedBluetoothDevices",
	"onBluetoothAdapterStateChange",
	"offBluetoothAdapterStateChange",
	"onBluetoothDeviceFound",
	"offBluetoothDeviceFound",
	"createBLEConnection",
	"closeBLEConnection",
	"getBLEDeviceServices",
	"getBLEDeviceCharacteristics",
	"readBLECharacteristicValue",
	"writeBLECharacteristicValue",
	"notifyBLECharacteristicValueChange",
	"getBLEDeviceRSSI",
	"setBLEMTU",
	"getBLEMTU",
	"onBLEConnectionStateChange",
	"offBLEConnectionStateChange",
	"onBLECharacteristicValueChange",
	"offBLECharacteristicValueChange",
	"onBLEMTUChange",
	"offBLEMTUChange",
	"isBluetoothDevicePaired",
	"makeBluetoothPair",
	"reLaunch",
	"redirectTo",
	"navigateTo",
	"navigateBack",
	"navigateToMiniProgram",
	"navigateBackMiniProgram",
	"exitMiniProgram",
	"restartMiniProgram",
	"showToast",
	"showModal",
	"showLoading",
	"showActionSheet",
	"hideToast",
	"hideLoading",
	"setNavigationBarTitle",
	"setNavigationBarColor",
	"pageScrollTo",
	"getMenuButtonBoundingClientRect",
	"onMenuButtonBoundingClientRectWeightChange",
	"offMenuButtonBoundingClientRectWeightChange",
	"nextTick",
	"createAnimation",
	"createCanvasContext",
	"createOffscreenCanvas",
	"createCanvas",
	"createImage",
	"canvasGetImageData",
	"canvasPutImageData",
	"canvasToTempFilePath",
	"onTouchStart",
	"offTouchStart",
	"onTouchMove",
	"offTouchMove",
	"onTouchEnd",
	"offTouchEnd",
	"onTouchCancel",
	"offTouchCancel",
	"createSelectorQuery",
	"createIntersectionObserver",
	"request",
	"downloadFile",
	"uploadFile",
	"UploadTask.abort",
	"UploadTask.onProgressUpdate",
	"UploadTask.offProgressUpdate",
	"UploadTask.onHeadersReceived",
	"UploadTask.offHeadersReceived",
	"startLocalServiceDiscovery",
	"stopLocalServiceDiscovery",
	"onLocalServiceDiscoveryStop",
	"offLocalServiceDiscoveryStop",
	"onLocalServiceFound",
	"offLocalServiceFound",
	"onLocalServiceLost",
	"offLocalServiceLost",
	"onLocalServiceResolveFail",
	"offLocalServiceResolveFail",
	"createUDPSocket",
	"UDPSocket.bind",
	"UDPSocket.close",
	"UDPSocket.connect",
	"UDPSocket.send",
	"UDPSocket.write",
	"UDPSocket.setTTL",
	"UDPSocket.onClose",
	"UDPSocket.offClose",
	"UDPSocket.onError",
	"UDPSocket.offError",
	"UDPSocket.onListening",
	"UDPSocket.offListening",
	"UDPSocket.onMessage",
	"UDPSocket.offMessage",
	"createTCPSocket",
	"TCPSocket.bindWifi",
	"TCPSocket.close",
	"TCPSocket.connect",
	"TCPSocket.write",
	"TCPSocket.onBindWifi",
	"TCPSocket.offBindWifi",
	"TCPSocket.onClose",
	"TCPSocket.offClose",
	"TCPSocket.onConnect",
	"TCPSocket.offConnect",
	"TCPSocket.onError",
	"TCPSocket.offError",
	"TCPSocket.onMessage",
	"TCPSocket.offMessage",
	"connectSocket",
	"sendSocketMessage",
	"closeSocket",
	"onSocketOpen",
	"onSocketMessage",
	"onSocketError",
	"onSocketClose",
	"SocketTask.send",
	"SocketTask.close",
	"SocketTask.onOpen",
	"SocketTask.onMessage",
	"SocketTask.onError",
	"SocketTask.onClose",
	"setStorageSync",
	"getStorageSync",
	"removeStorageSync",
	"clearStorageSync",
	"setStorage",
	"getStorage",
	"removeStorage",
	"clearStorage",
	"getStorageInfoSync",
	"getStorageInfo",
	"saveImageToPhotosAlbum",
	"previewImage",
	"getImageInfo",
	"previewMedia",
	"compressImage",
	"chooseImage",
	"chooseMessageFile",
	"chooseMedia",
	"chooseVideo",
	"getVideoInfo",
	"saveVideoToPhotosAlbum",
	"compressVideo",
	"getSetting",
	"openSetting",
	"authorize",
	"chooseContact",
	"addPhoneContact",
	"setClipboardData",
	"getClipboardData",
	"vibrateShort",
	"vibrateLong",
	"hideKeyboard",
	"getNetworkType",
	"onNetworkStatusChange",
	"offNetworkStatusChange",
	"makePhoneCall",
	"scanCode",
	"onUserCaptureScreen",
	"offUserCaptureScreen",
	"setKeepScreenOn",
	"extBridge",
	"extOnBridge",
	"extOffBridge"
];
//#endregion
//#region src/common/compatibility.js
var cachedReference = null;
var warnedItems = /* @__PURE__ */ new Set();
var pendingWarnings = [];
var TEMPLATE_DIRECTIVE_NAMES = /* @__PURE__ */ new Set([
	"if",
	"elif",
	"else",
	"for",
	"for-items",
	"for-item",
	"for-index",
	"key"
]);
var KNOWN_NON_TEMPLATE_PREFIXES = /* @__PURE__ */ new Set([
	"model",
	"change",
	"worklet",
	"data",
	"class",
	"style",
	"bind",
	"mut-bind",
	"catch",
	"capture-bind",
	"capture-mut-bind",
	"capture-catch",
	"mark",
	"generic",
	"extra-attr",
	"slot",
	"let"
]);
function splitAttributePrefix(attributeName) {
	const segments = attributeName.split(":");
	if (segments.length !== 2 || !segments[0] || !segments[1]) return null;
	return {
		prefix: segments[0],
		name: segments[1]
	};
}
function getTemplateDirectiveName(attributeName) {
	const attribute = splitAttributePrefix(attributeName);
	if (!attribute || !getTemplateDirectivePrefixes().includes(attribute.prefix)) return null;
	return TEMPLATE_DIRECTIVE_NAMES.has(attribute.name) ? attribute.name : null;
}
function getInvalidAttributePrefix(attributeName) {
	const attribute = splitAttributePrefix(attributeName);
	if (!attribute) return null;
	if (getTemplateDirectivePrefixes().includes(attribute.prefix)) return TEMPLATE_DIRECTIVE_NAMES.has(attribute.name) ? null : attribute.prefix;
	if (KNOWN_NON_TEMPLATE_PREFIXES.has(attribute.prefix)) return null;
	return attribute.prefix;
}
function loadReference() {
	if (cachedReference) return cachedReference;
	cachedReference = {
		supportedBuiltinComponents: new Set(supportedBuiltinComponents),
		supportedWxApis: new Set(supportedWxApis)
	};
	return cachedReference;
}
function getWxMemberName(node) {
	if (node?.type !== "MemberExpression") return null;
	if (node.object?.type !== "Identifier" || node.object.name !== "wx") return null;
	if (!node.computed && node.property?.type === "Identifier") return node.property.name;
	if (node.computed && (node.property?.type === "StringLiteral" || node.property?.type === "Literal") && typeof node.property.value === "string") return node.property.value;
	return null;
}
function warnUnsupportedWxApi(apiName, filePath, line) {
	const { supportedWxApis } = loadReference();
	if (!apiName || supportedWxApis.has(apiName)) return;
	const location = formatLocation(filePath, line);
	warnOnce("api", apiName, location, `[compat] Unsupported wx API: wx.${apiName}${location}`);
}
function warnUnsupportedComponent(tagName, filePath, line) {
	const { supportedBuiltinComponents } = loadReference();
	if (!tagName || supportedBuiltinComponents.has(tagName) || tagWhiteList.includes(tagName) || getViewScriptTags().includes(tagName)) return;
	if (!miniProgramBuiltinTags.has(tagName) && isHTMLTag(tagName)) return;
	const location = formatLocation(filePath, line);
	warnOnce("component", tagName, location, `[compat] Unsupported or undeclared component: <${tagName}>${location}`);
}
function checkTemplateCompatibility(content, filePath, components = {}) {
	const newlineOffsets = collectNewlineOffsets(content);
	let parser;
	parser = new Parser({
		onopentag(tagName, attrs) {
			const line = getLineByIndex(newlineOffsets, parser.startIndex);
			for (const attributeName of Object.keys(attrs)) {
				const invalidPrefix = getInvalidAttributePrefix(attributeName);
				if (invalidPrefix) {
					const location = formatLocation(filePath, line);
					warnOnce("template-prefix", attributeName, location, `[compat] Invalid template attribute prefix: ${invalidPrefix}: (${attributeName})${location}`);
				}
			}
			if (components?.[tagName]) return;
			warnUnsupportedComponent(tagName, filePath, line);
		},
		onerror(error) {
			warnOnce("parse", filePath, error.message, `[compat] Failed to parse template for compatibility diagnostics: ${filePath} ${error.message}`);
		}
	}, {
		xmlMode: true,
		lowerCaseTags: false,
		lowerCaseAttributeNames: false,
		withStartIndices: true
	});
	parser.write(content);
	parser.end();
}
function collectNewlineOffsets(content) {
	const offsets = [];
	for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) offsets.push(i);
	return offsets;
}
function getLineByIndex(newlineOffsets, index) {
	if (typeof index !== "number" || index < 0) return null;
	let lo = 0;
	let hi = newlineOffsets.length;
	while (lo < hi) {
		const mid = lo + hi >>> 1;
		if (newlineOffsets[mid] < index) lo = mid + 1;
		else hi = mid;
	}
	return lo + 1;
}
function formatLocation(filePath, line) {
	if (!filePath) return "";
	return line ? ` (${filePath}:${line})` : ` (${filePath})`;
}
function warnOnce(type, name, location, message) {
	const key = `${type}:${name}:${location}`;
	if (warnedItems.has(key)) return;
	warnedItems.add(key);
	if (isMainThread) console.warn(message);
	else pendingWarnings.push(message);
}
function takeCompatibilityWarnings() {
	return pendingWarnings.splice(0);
}
//#endregion
export { warnUnsupportedWxApi as a, takeCompatibilityWarnings as i, getTemplateDirectiveName as n, getWxMemberName as r, checkTemplateCompatibility as t };
