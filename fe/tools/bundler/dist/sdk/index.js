import e from "mitt";
//#region src/utils/queryRouter.ts
var t = class {
	static ROUTE_QUERY_KEYS = [
		"appId",
		"entry",
		"page"
	];
	static _namespacedKey(e, t) {
		return t ? `${e}__${t}` : e;
	}
	static _encodePage(e, t) {
		return t && Object.keys(t).length > 0 ? `${e}?${Object.entries(t).map(([e, t]) => `${encodeURIComponent(e)}=${encodeURIComponent(t)}`).join("&")}` : e;
	}
	static _decodePage(e) {
		let t = e.indexOf("?");
		if (t === -1) return {
			pagePath: e,
			query: {}
		};
		let n = e.slice(0, t), r = {};
		return new URLSearchParams(e.slice(t + 1)).forEach((e, t) => {
			r[t] = e;
		}), {
			pagePath: n,
			query: r
		};
	}
	static _encodeSearchValue(e) {
		return encodeURIComponent(e).replace(/%2F/g, "/");
	}
	static _normalizeSearch(e) {
		return e ? e.startsWith("?") ? e.slice(1) : e : "";
	}
	static _stringifySearchParams(e) {
		return Array.from(e.entries()).map(([e, t]) => `${encodeURIComponent(e)}=${this._encodeSearchValue(t)}`).join("&");
	}
	static buildRouteSearch(e, t, n = typeof window < "u" ? window.location.search : "", r) {
		let i = new URLSearchParams(this._normalizeSearch(n));
		if (this.ROUTE_QUERY_KEYS.forEach((e) => i.delete(this._namespacedKey(e, r))), !e || !t?.length) return this._stringifySearchParams(i);
		let a = t[0], o = t[t.length - 1];
		return i.set(this._namespacedKey("appId", r), e), i.set(this._namespacedKey("entry", r), this._encodePage(a.pagePath, a.query || {})), i.set(this._namespacedKey("page", r), this._encodePage(o.pagePath, o.query || {})), this._stringifySearchParams(i);
	}
	static buildRouteURL(e, t, n = typeof window < "u" ? `${window.location.origin}${window.location.pathname}` : "", r) {
		let i = this.buildRouteSearch(e, t, void 0, r);
		return `${n}${i ? `?${i}` : ""}`;
	}
	static syncStack(e, t, n) {
		let r = this.buildRouteSearch(e, t, void 0, n);
		history.replaceState(null, "", `${window.location.pathname}${r ? `?${r}` : ""}`);
	}
	static clear(e) {
		let t = new URLSearchParams(this._normalizeSearch(window.location.search));
		this.ROUTE_QUERY_KEYS.forEach((n) => t.delete(this._namespacedKey(n, e)));
		let n = this._stringifySearchParams(t);
		history.replaceState(null, "", `${window.location.pathname}${n ? `?${n}` : ""}`);
	}
	static parseSearch(e, t) {
		let n = new URLSearchParams(this._normalizeSearch(e)), r = n.get(this._namespacedKey("appId", t)), i = n.get(this._namespacedKey("entry", t)), a = n.get(this._namespacedKey("page", t)) || i;
		if (!r || !i) return null;
		let o = this._decodePage(i);
		if (!o.pagePath) return null;
		let s = [o];
		if (a && a !== i) {
			let e = this._decodePage(a);
			e.pagePath && s.push(e);
		}
		return {
			appId: r,
			stack: s
		};
	}
	static parseHash(e) {
		if (!e || e.length <= 1) return null;
		let t = e.slice(1).split("|");
		if (t.length < 2) return null;
		let n = t[0], r = t.slice(1).map((e) => this._decodePage(e));
		return !n || r.length === 0 ? null : {
			appId: n,
			stack: r
		};
	}
	static parse(e, t = typeof window < "u" ? window.location.search : "", n) {
		return this.parseSearch(t, n) || this.parseHash(e);
	}
}, n = "/", r = "difile://", i = /* @__PURE__ */ new Set([
	"about",
	"blob",
	"content",
	"data",
	"dimina",
	"file",
	"ftp",
	"http",
	"https",
	"internal",
	"javascript",
	"resource",
	"ws",
	"wss"
]);
function a(e) {
	return e.endsWith("/") ? e : `${e}/`;
}
function o() {
	return {
		top: 0,
		left: 0,
		width: 0,
		height: 0,
		right: 0,
		bottom: 0
	};
}
function s() {}
function c(e) {
	let t = globalThis.__VIRTUAL_FILE_PREFIX__, n = e ?? t ?? "difile://";
	if (typeof n != "string") throw TypeError("[container] createContainer: virtualFilePrefix must be a string");
	let r = n.trim().toLowerCase(), a = r.slice(0, -3);
	if (!/^[a-z][a-z0-9+.-]*:\/\/$/.test(r) || i.has(a)) throw Error("[container] createContainer: virtualFilePrefix must be a custom URI scheme ending in \"://\"");
	return r;
}
function l(e = {}) {
	return {
		getStatusBarRect: e.getStatusBarRect ? e.getStatusBarRect.bind(e) : o,
		updateStatusBarColor: e.updateStatusBarColor ? e.updateStatusBarColor.bind(e) : s
	};
}
function u(e, t, n) {
	if (t && !t.includes(e.origin)) throw Error(`[container] createContainer: ${n} resolves to origin "${e.origin}", which is not in allowedOrigins`);
}
function d(e, t) {
	let r = new URL(e || n, window.location.origin);
	return u(r, t, "resourceBaseUrl"), a(r.toString());
}
function f(e, t, n) {
	let r = e ? new URL(e, window.location.origin) : new URL("pageFrame.html", t);
	return u(r, n, "pageFrameUrl"), r.toString();
}
function p(e = []) {
	return Array.from(new Set(e));
}
function m(e) {
	return e ?? (async () => ({}));
}
var h = {
	syncStack: s,
	clear: s
};
function g(e = !0, n) {
	return e === !1 ? h : e === !0 ? {
		syncStack: (e, r) => t.syncStack(e, r, n),
		clear: () => t.clear(n),
		buildShareUrl: (e, r) => t.buildRouteURL(e, r, void 0, n)
	} : e;
}
var _ = "storageSync is disabled: the container will not read/write localStorage", v = {
	getItem() {
		throw Error(_);
	},
	setItem() {
		throw Error(_);
	},
	removeItem() {
		throw Error(_);
	},
	key() {
		throw Error(_);
	},
	get length() {
		throw Error(_);
	}
};
function y() {
	return {
		getItem: (e) => window.localStorage.getItem(e),
		setItem: (e, t) => window.localStorage.setItem(e, t),
		removeItem: (e) => window.localStorage.removeItem(e),
		key: (e) => window.localStorage.key(e),
		get length() {
			return window.localStorage.length;
		}
	};
}
function b(e = !0) {
	return e === !1 ? v : e === !0 ? y() : e;
}
//#endregion
//#region src/core/retention.ts
function x(e = {}) {
	let t = e.maxBackgroundApps ?? 3, n = e.backgroundTimeoutMs ?? 3e5;
	if (!Number.isSafeInteger(t) || t < 0 || !Number.isSafeInteger(n) || n < 0) throw RangeError("Retention limits must be non-negative safe integers");
	return {
		maxBackgroundApps: t,
		backgroundTimeoutMs: n
	};
}
var ee = class {
	reconcile;
	now;
	policy = x();
	hidden = /* @__PURE__ */ new Map();
	timer;
	pressure = !1;
	constructor(e, t = () => performance.now()) {
		this.reconcile = e, this.now = t;
	}
	configure(e) {
		this.policy = x(e), this.reconcile();
	}
	hide(e) {
		this.hidden.has(e) || this.hidden.set(e, this.now()), this.reconcile();
	}
	forget(e) {
		this.hidden.delete(e), this.hidden.size || clearTimeout(this.timer);
	}
	memoryPressure() {
		this.pressure = !0, this.reconcile();
	}
	collect(e) {
		clearTimeout(this.timer);
		let t = [...this.hidden].filter(([t]) => e(t)).sort((e, t) => e[1] - t[1]), n = this.now(), { maxBackgroundApps: r, backgroundTimeoutMs: i } = this.policy, a = [];
		for (let [e, o] of t) (this.pressure || t.length - a.length > r || i > 0 && n - o >= i) && (a.push(e), this.hidden.delete(e));
		this.pressure = !1;
		let o = t.find(([e]) => this.hidden.has(e));
		return o && i > 0 && (this.timer = setTimeout(this.reconcile, Math.min(2147483647, Math.max(1, o[1] + i - n)))), a;
	}
};
//#endregion
//#region src/utils/util.ts
function S() {
	return Math.random().toString(36).slice(2, 7);
}
function te(e) {
	return new Promise((t) => {
		setTimeout(() => {
			t();
		}, e);
	});
}
function C(e) {
	let t = e.indexOf("?"), n = (t === -1 ? e : e.slice(0, t)).replace(/^\/+/, ""), r = t === -1 ? "" : e.slice(t + 1), i = {
		query: {},
		pagePath: n
	};
	return r && new URLSearchParams(r).forEach((e, t) => {
		i.query[t] = e;
	}), i;
}
function w(e) {
	return new Promise((t) => {
		fetch(`${e}`).then((e) => e.text()).then((e) => {
			t(e);
		}).catch(() => {
			t(null);
		});
	});
}
function T(e, t) {
	let n = {}, r = e.window || {}, i = t || {};
	return n.navigationBarTitleText = i.navigationBarTitleText || r.navigationBarTitleText || "", n.navigationBarBackgroundColor = i.navigationBarBackgroundColor || r.navigationBarBackgroundColor || "#000", n.navigationBarTextStyle = i.navigationBarTextStyle || r.navigationBarTextStyle || "white", n.backgroundColor = i.backgroundColor || r.backgroundColor || "#fff", n.navigationStyle = i.navigationStyle || r.navigationStyle || "default", n.homeButton = i.homeButton ?? r.homeButton ?? !1, n.usingComponents = i.usingComponents || {}, n;
}
//#endregion
//#region src/pages/webview/webview.html?raw
var ne = "<div class=\"dimina-native-webview\">\n	<!-- 导航区域 -->\n	<div class=\"dimina-native-webview__navigation\">\n		<div class=\"dimina-native-webview__navigation-content\">\n			<div class=\"dimina-native-webview__navigation-left-btn\"></div>\n			<div class=\"dimina-native-webview__navigation-home-btn\"></div>\n			<h2 class=\"dimina-native-webview__navigation-title\"></h2>\n		</div>\n	</div>\n\n	<!-- iframe -->\n	<div class=\"dimina-native-webview__body\">\n		<div class=\"dimina-native-webview__root\">\n			<iframe class=\"dimina-native-webview__window\" title=\"pageFrame\"></iframe>\n		</div>\n	</div>\n</div>", re = class {
	opts;
	id;
	el;
	iframe;
	event;
	parent;
	constructor(t) {
		this.opts = t, this.id = `webview_${S()}`, this.el = document.createElement("div"), this.el.classList.add("dimina-native-view"), this.el.innerHTML = ne, this.iframe = this.el.querySelector(".dimina-native-webview__window");
		let n = new URL(this.opts.pageFrameUrl ?? "/pageFrame.html", window.location.href);
		this.iframe.src = n.toString(), this.iframe.name = this.id, this.event = e(), this.bindBackEvent(), this.bindHomeEvent(), this.applyPageStyle(this.opts.configInfo, {
			isRoot: this.opts.isRoot,
			showHomeButton: this.opts.showHomeButton === !0
		});
	}
	async init(e, t) {
		await this.frameLoaded(t);
		let n = window.frames[this.iframe.name];
		this.applyResourceBaseUrl(n.document), n.DiminaRenderBridge.mapRenderer = "web", n.DiminaRenderBridge.invoke = (e) => {
			this.event.emit("invoke", e);
		}, n.DiminaRenderBridge.publish = (e) => {
			this.event.emit("publish", e);
		}, e?.();
	}
	applyResourceBaseUrl(e) {
		if (!this.opts.resourceBaseUrl || !e.head) return;
		let t = e.createElement("base");
		t.href = this.opts.resourceBaseUrl, e.head.prepend(t);
	}
	invoke(e) {
		this.event.on("invoke", e);
	}
	publish(e) {
		this.event.on("publish", e);
	}
	postMessage(e) {
		window.frames[this.iframe.name].DiminaRenderBridge.onMessage(e);
	}
	bindBackEvent() {
		let e = this.el.querySelector(".dimina-native-webview__navigation-left-btn");
		e.onclick = () => {
			this.parent.parent.navigateBack();
		};
	}
	bindHomeEvent() {
		let e = this.el.querySelector(".dimina-native-webview__navigation-home-btn");
		e.onclick = () => {
			this.parent.parent.navigateHome();
		};
	}
	setHomeButtonVisible(e) {
		let t = this.el.querySelector(".dimina-native-webview__navigation-home-btn");
		t.style.display = e ? "block" : "none";
	}
	frameLoaded(e) {
		return e?.aborted ? Promise.reject(e.reason ?? new DOMException("Aborted", "AbortError")) : new Promise((t, n) => {
			let r = () => {
				this.iframe.onload = null, n(e.reason ?? new DOMException("Aborted", "AbortError"));
			};
			this.iframe.onload = () => {
				e?.removeEventListener("abort", r), t();
			}, e?.addEventListener("abort", r, { once: !0 });
		});
	}
	applyPageStyle(e, { isRoot: t, showHomeButton: n }) {
		let r = this.el.querySelector(".dimina-native-webview"), i = this.el.querySelector(".dimina-native-webview__navigation-title"), a = this.el.querySelector(".dimina-native-webview__navigation"), o = this.el.querySelector(".dimina-native-webview__navigation-left-btn"), s = this.el.querySelector(".dimina-native-webview__root");
		o.style.display = t ? "none" : "block", this.setHomeButtonVisible(n === !0), this.el.querySelector(".dimina-native-webview__navigation-home-btn").classList.toggle("dimina-native-webview__navigation-home-btn--after-back", !t && n === !0), a.classList.remove("dimina-native-webview__navigation--white", "dimina-native-webview__navigation--black"), a.classList.add(e.navigationBarTextStyle === "white" ? "dimina-native-webview__navigation--white" : "dimina-native-webview__navigation--black"), r.classList.toggle("dimina-native-webview--custom-nav", e.navigationStyle === "custom"), s.style.backgroundColor = e.backgroundColor, a.style.backgroundColor = e.navigationBarBackgroundColor, i.textContent = e.navigationBarTitleText;
	}
}, E = 15e3, D = class {
	id;
	opts;
	webview;
	jscore;
	devCommandResultHandler;
	parent;
	destroyed;
	serviceResource;
	renderResource;
	resourceLoadedForwarded;
	resourceLoadId;
	desiredPageVisible;
	sentPageVisible;
	domReadyResourceLoadId;
	startupReadyWaiter;
	unsubscribeServiceInvoke;
	unsubscribeServicePublish;
	constructor(e) {
		this.id = `bridge_${S()}`, this.opts = e, this.webview = null, this.jscore = e.jscore, this.parent = null, this.startupReadyWaiter = null, this.unsubscribeServiceInvoke = null, this.unsubscribeServicePublish = null, this.resetStatus();
	}
	async init(e) {
		this.webview = await this.createWebview(e), this.webview && (this.unsubscribeServiceInvoke?.(), this.unsubscribeServicePublish?.(), this.unsubscribeServiceInvoke = this.jscore.invoke((e) => this.messageInvoke("service", e)), this.unsubscribeServicePublish = this.jscore.publish((e) => this.messagePublish(e)), this.webview.invoke((e) => this.messageInvoke("render", e)), this.webview.publish((e) => this.messagePublish(e)));
	}
	sendDevCommand(e, t = {}, n) {
		return n && (this.devCommandResultHandler = n), this.destroyed || !this.webview ? !1 : (this.webview.postMessage({
			type: e,
			body: t,
			target: "render"
		}), !0);
	}
	messagePublish(e) {
		if (this.destroyed) return;
		typeof e == "string" && (e = JSON.parse(e));
		let { body: t, target: n } = e;
		t.bridgeId && t.bridgeId !== this.id || (n === "service" ? this.jscore.postMessage(e) : n === "render" && this.webview.postMessage(e));
	}
	messageInvoke(e, t) {
		if (this.destroyed) return;
		typeof t == "string" && (t = JSON.parse(t));
		let { type: n, body: r, target: i } = t;
		if (r.bridgeId && r.bridgeId !== this.id) return;
		let a = n === "serviceResourceLoaded" || n === "renderResourceLoaded" || n === "renderResourceLoadFailed";
		if ((a || i === "container" && n === "domReady") && (typeof r.resourceLoadId != "string" || r.resourceLoadId !== this.resourceLoadId) || !a && r.resourceLoadId && r.resourceLoadId !== this.resourceLoadId) return;
		console.log(`[container] receive msg from ${e}: `, t);
		let o = {
			type: n,
			body: {
				bridgeId: this.id,
				pagePath: this.opts.pagePath,
				scene: this.opts.scene,
				query: this.opts.query,
				...r
			}
		};
		if (i === "service") {
			if (n === "serviceResourceLoaded") {
				if (this.serviceResource = !0, this.jscore.notifyServiceReady(), this.isResourceLoaded() && !this.resourceLoadedForwarded) this.resourceLoadedForwarded = !0, o.type = "resourceLoaded";
				else return;
			} else if (n === "renderResourceLoaded") {
				if (this.renderResource = !0, this.isResourceLoaded() && !this.resourceLoadedForwarded) this.resourceLoadedForwarded = !0, o.type = "resourceLoaded";
				else return;
			} else n === "renderResourceLoadFailed" && (this.renderResource = !1, this.resourceLoadedForwarded = !1, o.type = "resourceLoadFailed");
			if (this.jscore.postMessage(o), o.type === "resourceLoaded") this.#n(), this.#e();
			else if (o.type === "resourceLoadFailed") {
				let e = Array.isArray(r.errors) ? r.errors.map(String).join("; ") : "";
				this.#t(Error(e || `render resource load failed: ${this.opts.pagePath}`));
			}
		} else if (i === "container") {
			if (n === "hmr:result") this.devCommandResultHandler?.(r);
			else if (n === "invokeAPI") {
				let { name: e, params: t } = r;
				this.parent.invokeApi(e, t, this);
			} else n === "domReady" && (this.domReadyResourceLoadId = r.resourceLoadId, this.#e());
		}
	}
	start(e = {}) {
		this.#t(/* @__PURE__ */ Error("startup was superseded")), this.serviceResource = !1, this.renderResource = !1, this.resourceLoadedForwarded = !1, this.resourceLoadId = S(), this.domReadyResourceLoadId = null, this.sentPageVisible = null, Object.prototype.hasOwnProperty.call(e, "visible") ? this.desiredPageVisible = e.visible ?? null : this.desiredPageVisible === null && (this.desiredPageVisible = !0), this.webview.postMessage({
			type: "loadResource",
			body: {
				bridgeId: this.id,
				resourceLoadId: this.resourceLoadId,
				appId: this.opts.appId,
				runtimeType: this.opts.runtimeType,
				pagePath: this.opts.pagePath,
				root: this.opts.root,
				baseUrl: this.parent?.getResourceBaseUrl?.() ?? "/"
			}
		}), this.jscore.postMessage({
			type: "loadResource",
			body: {
				bridgeId: this.id,
				resourceLoadId: this.resourceLoadId,
				appId: this.opts.appId,
				runtimeType: this.opts.runtimeType,
				pagePath: this.opts.pagePath,
				scene: this.opts.scene,
				query: this.opts.query,
				referrerInfo: this.opts.referrerInfo,
				root: this.opts.root,
				baseUrl: this.parent?.getResourceBaseUrl?.() ?? "/",
				hostEnv: this.parent.getHostEnvSnapshot()
			}
		}), this.opts.isRoot && this.jscore.postMessage({
			type: "onUpdateStatusChange",
			body: {
				bridgeId: this.id,
				event: "noupdate"
			}
		});
	}
	startAndWait(e = {}) {
		if (this.start(e), this.isStartupReady()) return Promise.resolve();
		let t = this.resourceLoadId;
		return t ? new Promise((e, n) => {
			let r = this.jscore.onWorkerFailure((e) => {
				let t = e instanceof Error ? e.message : "worker failed while loading resources";
				this.#t(Error(t));
			}), i = setTimeout(() => {
				this.#t(/* @__PURE__ */ Error(`startup ready timed out: ${this.opts.pagePath}`));
			}, E);
			this.startupReadyWaiter = {
				resourceLoadId: t,
				resolve: e,
				reject: n,
				timer: i,
				unsubscribeWorkerFailure: r
			}, this.#e();
		}) : Promise.reject(/* @__PURE__ */ Error("resource load did not start"));
	}
	#e() {
		let e = this.startupReadyWaiter;
		e && e.resourceLoadId === this.resourceLoadId && this.isStartupReady() && (this.startupReadyWaiter = null, clearTimeout(e.timer), e.unsubscribeWorkerFailure(), e.resolve());
	}
	#t(e) {
		let t = this.startupReadyWaiter;
		t && (this.startupReadyWaiter = null, clearTimeout(t.timer), t.unsubscribeWorkerFailure(), t.reject(e));
	}
	resetStatus() {
		this.#t(/* @__PURE__ */ Error("startup state was reset")), this.destroyed = !1, this.serviceResource = !1, this.renderResource = !1, this.resourceLoadedForwarded = !1, this.resourceLoadId = null, this.domReadyResourceLoadId = null, this.desiredPageVisible = null, this.sentPageVisible = null;
	}
	createWebview(e) {
		return e?.aborted ? Promise.resolve(null) : new Promise((t, n) => {
			let r = new re({
				configInfo: this.opts.configInfo,
				isRoot: this.opts.isRoot,
				pageFrameUrl: this.parent?.getPageFrameUrl?.(),
				resourceBaseUrl: this.parent?.getResourceBaseUrl?.(),
				showHomeButton: this.parent?.shouldShowHomeButton?.({
					pagePath: this.opts.pagePath,
					configInfo: this.opts.configInfo,
					isRoot: this.opts.isRoot
				}) ?? !1
			});
			r.parent = this, this.opts.isRoot || r.el.classList.add("dimina-native-view--before-enter"), this.parent.webviewsContainer.appendChild(r.el), r.init(() => {
				t(r);
			}, e).catch((e) => {
				if (r.el.remove(), e?.name === "AbortError") {
					t(null);
					return;
				}
				n(e);
			});
		});
	}
	isResourceLoaded() {
		return this.serviceResource && this.renderResource;
	}
	isStartupReady() {
		return this.isResourceLoaded() && this.resourceLoadId !== null && this.domReadyResourceLoadId === this.resourceLoadId;
	}
	pageShow() {
		this.desiredPageVisible = !0, this.#n();
	}
	pageHide() {
		this.desiredPageVisible = !1, this.#n();
	}
	#n() {
		if (this.isResourceLoaded() && this.desiredPageVisible !== null && this.sentPageVisible !== this.desiredPageVisible) {
			if (!this.desiredPageVisible && this.sentPageVisible === null) {
				this.sentPageVisible = !1;
				return;
			}
			this.jscore.postMessage({
				type: this.desiredPageVisible ? "pageShow" : "pageHide",
				body: { bridgeId: this.id }
			}), this.sentPageVisible = this.desiredPageVisible;
		}
	}
	destroy(e = "routing") {
		let t = this.isResourceLoaded();
		this.#t(/* @__PURE__ */ Error("bridge was destroyed before startup became ready")), this.destroyed = !0, this.serviceResource = !1, this.renderResource = !1, this.resourceLoadedForwarded = !1, this.resourceLoadId = null, this.domReadyResourceLoadId = null, this.desiredPageVisible = null, this.sentPageVisible = null, this.unsubscribeServiceInvoke?.(), this.unsubscribeServicePublish?.(), this.unsubscribeServiceInvoke = null, this.unsubscribeServicePublish = null, t && e === "routing" && this.jscore.postMessage({
			type: "pageUnload",
			body: { bridgeId: this.id }
		});
	}
}, O = new URL("./service.js", import.meta.url).href, ie = 5e3, ae = class {
	parent;
	worker;
	event;
	desiredAppVisible;
	sentAppVisible;
	pendingAppShowOptions;
	serviceReady;
	callbackFlushWaiters;
	workerFailureHandlers;
	constructor(t) {
		this.parent = t, this.worker = null, this.event = e(), this.desiredAppVisible = null, this.sentAppVisible = null, this.pendingAppShowOptions = null, this.serviceReady = !1, this.callbackFlushWaiters = /* @__PURE__ */ new Map(), this.workerFailureHandlers = /* @__PURE__ */ new Set();
	}
	async init() {
		let e = this.parent.getApiNamespaces?.() || [], t = Object.keys(this.parent.apiRegistry ?? {}), n = JSON.stringify({
			apiNamespaces: e,
			registeredApis: t,
			virtualFilePrefix: this.parent.appInfo.virtualFilePrefix
		});
		this.worker = new Worker(O, {
			type: "classic",
			name: n
		}), this.worker.onmessage = (e) => {
			let t = e.data;
			if (t.type === "callbacksFlushed") {
				let e = t.body?.requestId;
				typeof e == "string" && this.#t(e);
				return;
			}
			this.event.emit(t.method, t);
		}, this.worker.onerror = (e) => this.#r(e), this.worker.onmessageerror = (e) => this.#r(e);
	}
	onWorkerFailure(e) {
		return this.workerFailureHandlers.add(e), () => this.workerFailureHandlers.delete(e);
	}
	invoke(e) {
		return this.event.on("invoke", e), () => this.event.off("invoke", e);
	}
	publish(e) {
		return this.event.on("publish", e), () => this.event.off("publish", e);
	}
	queueAppShowOptions(e) {
		this.pendingAppShowOptions = { ...e };
	}
	appShow(e) {
		e && this.queueAppShowOptions(e), this.desiredAppVisible = !0, this.#e();
	}
	appHide() {
		this.desiredAppVisible = !1, this.#e();
	}
	#e() {
		this.serviceReady && this.desiredAppVisible !== null && (this.sentAppVisible !== this.desiredAppVisible || this.desiredAppVisible && this.pendingAppShowOptions) && (this.postMessage({
			type: this.desiredAppVisible ? "appShow" : "appHide",
			body: this.desiredAppVisible ? this.pendingAppShowOptions ?? {} : {}
		}), this.desiredAppVisible && (this.pendingAppShowOptions = null), this.sentAppVisible = this.desiredAppVisible);
	}
	flushCallbacks() {
		if (!this.worker) return Promise.resolve();
		let e = S();
		return new Promise((t) => {
			let n = setTimeout(() => {
				console.warn("[container] flushCallbacks timed out; continuing destructive mini program operation"), this.#t(e);
			}, ie);
			this.callbackFlushWaiters.set(e, {
				resolve: t,
				timer: n
			});
			try {
				this.postMessage({
					type: "flushCallbacks",
					body: { requestId: e }
				});
			} catch {
				this.#t(e);
			}
		});
	}
	#t(e) {
		let t = this.callbackFlushWaiters.get(e);
		t && (clearTimeout(t.timer), this.callbackFlushWaiters.delete(e), t.resolve());
	}
	#n() {
		for (let e of [...this.callbackFlushWaiters.keys()]) this.#t(e);
	}
	#r(e) {
		this.#n();
		for (let t of [...this.workerFailureHandlers]) t(e);
	}
	notifyServiceReady() {
		this.serviceReady || (this.serviceReady = !0, this.sentAppVisible = !0, this.#e());
	}
	postMessage(e) {
		if (!this.worker) {
			this.parent._destroyed || console.warn(`[container] postMessage(${e.type}) dropped: worker not ready`);
			return;
		}
		this.worker.postMessage(e);
	}
	destroy() {
		this.#r(/* @__PURE__ */ Error("mini program worker was destroyed")), this.worker?.terminate(), this.worker = null, this.desiredAppVisible = null, this.sentAppVisible = null, this.pendingAppShowOptions = null, this.serviceReady = !1, this.workerFailureHandlers.clear(), this.event.all.clear();
	}
}, k = 6e4, A = 2147483647, j = 123, oe = /* @__PURE__ */ new Set([
	"connection",
	"content-length",
	"host",
	"referer",
	"sec-websocket-accept",
	"sec-websocket-extensions",
	"sec-websocket-key",
	"sec-websocket-protocol",
	"sec-websocket-version",
	"upgrade"
]), se = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, ce = /^[\t\x20-\x7E]*$/, le = /* @__PURE__ */ new Set([
	"\"",
	"<",
	">",
	"{",
	"}",
	"|",
	"\\",
	"^",
	"`"
]), ue = /%(?![0-9A-Fa-f]{2})/;
function de(e) {
	for (let t of e) {
		let e = t.charCodeAt(0);
		if (e <= 32 || e === 127 || le.has(t)) return !0;
	}
	return !1;
}
function M(e) {
	return {
		ok: !0,
		value: e
	};
}
function N(e) {
	return {
		ok: !1,
		error: e
	};
}
function fe(e) {
	return typeof e != "number" || !Number.isFinite(e) || e < 1 || e > A ? k : Math.floor(e);
}
var P = {
	DEFAULT_TIMEOUT_MS: k,
	MAX_TIMEOUT_MS: A,
	MAX_REASON_UTF8_BYTES: j,
	validateUrl(e) {
		if (typeof e != "string" || e.length === 0 || !/^wss:\/\/[^/?#]/i.test(e) || de(e) || ue.test(e) || e.includes("#")) return N("invalid url");
		try {
			let t = new URL(e);
			if (t.protocol.toLowerCase() !== "wss:" || t.hostname.length === 0) return N("invalid url");
		} catch {
			return N("invalid url");
		}
		return M(e);
	},
	validateTimeout(e, t) {
		let n = fe(t);
		return e == null ? M(n) : typeof e != "number" || !Number.isFinite(e) || e > A ? N("invalid timeout") : M(e < 1 ? n : Math.floor(e));
	},
	validateProtocols(e) {
		if (e == null) return M([]);
		if (!Array.isArray(e)) return N("protocols must be an array");
		let t = [];
		for (let n of e) {
			if (typeof n != "string" || n.length === 0) return N("invalid protocol");
			t.push(n);
		}
		return M(t);
	},
	validateHeader(e) {
		let t = {};
		if (e == null) return M(t);
		if (typeof e != "object" || Array.isArray(e)) return N("header must be an object");
		for (let n of Object.keys(e)) {
			if (n.includes("\r") || n.includes("\n")) return N("invalid header");
			let r = n.trim();
			if (!r || oe.has(r.toLowerCase())) continue;
			if (!se.test(r)) return N("invalid header");
			let i = e[n];
			if (i == null) continue;
			let a = String(i);
			if (!ce.test(a)) return N("invalid header");
			t[r] = a;
		}
		return M(t);
	},
	validateCloseCode(e) {
		return e == null ? M(1e3) : typeof e != "number" || !Number.isFinite(e) || !Number.isInteger(e) || e !== 1e3 && (e < 3e3 || e > 4999) ? N("invalid code") : M(e);
	},
	validateReason(e) {
		return e == null ? M("") : typeof e == "string" ? new TextEncoder().encode(e).byteLength > j ? N("reason must not exceed 123 UTF-8 bytes") : M(e) : N("reason must be a string");
	}
}, F = 5, I = 5e3, L = 32, R = "connectSocket:fail WebSocket connection failed", z = "connectSocket:fail timeout";
function B(e) {
	return e != null && e !== "";
}
function V(e) {
	let t = new Uint8Array(e), n = "", r = 32768;
	for (let e = 0; e < t.length; e += r) n += String.fromCharCode(...t.subarray(e, Math.min(e + r, t.length)));
	return btoa(n);
}
function pe(e) {
	if (typeof e != "string" || e.length % 4 != 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(e)) return null;
	try {
		let t = atob(e), n = new Uint8Array(t.length);
		for (let e = 0; e < t.length; e++) n[e] = t.charCodeAt(e);
		return n.buffer;
	} catch {
		return null;
	}
}
var me = class {
	emitCallback;
	getAppConnectTimeout;
	webSocketFactory;
	sockets = /* @__PURE__ */ new Map();
	terminalReplay = /* @__PURE__ */ new Map();
	legacyListeners = {
		open: /* @__PURE__ */ new Set(),
		message: /* @__PURE__ */ new Set(),
		error: /* @__PURE__ */ new Set(),
		close: /* @__PURE__ */ new Set()
	};
	legacyBoundSocketId = null;
	backgrounded = !1;
	backgroundTimer = null;
	destroyed = !1;
	constructor(e) {
		this.emitCallback = e.emitCallback, this.getAppConnectTimeout = e.getAppConnectTimeout ?? (() => void 0), this.webSocketFactory = e.webSocketFactory ?? ((e, t) => new WebSocket(e, t));
	}
	connectSocket(e = {}) {
		if (this.destroyed || this.backgrounded) {
			this.fail("connectSocket", e, "interrupted");
			return;
		}
		let t = typeof e.socketId == "string" ? e.socketId : "";
		if (!t || this.sockets.has(t)) {
			this.fail("connectSocket", e, "invalid socketId");
			return;
		}
		if (this.sockets.size >= F) {
			this.fail("connectSocket", e, `fail reach max websocket connect count ${F}`);
			return;
		}
		let n = P.validateUrl(e.url);
		if (!n.ok) {
			this.fail("connectSocket", e, n.error);
			return;
		}
		let r = P.validateTimeout(e.timeout, this.getAppConnectTimeout());
		if (!r.ok) {
			this.fail("connectSocket", e, r.error);
			return;
		}
		let i = P.validateProtocols(e.protocols);
		if (!i.ok) {
			this.fail("connectSocket", e, i.error);
			return;
		}
		let a = P.validateHeader(e.header);
		if (!a.ok) {
			this.fail("connectSocket", e, a.error);
			return;
		}
		this.clearTerminalReplay(t);
		let o = {
			socketId: t,
			state: "CREATED",
			opened: !1,
			closedByGlobalApi: !1,
			errorEmitted: !1,
			transport: null,
			connectTimer: null,
			dialTimer: null,
			listeners: {
				open: /* @__PURE__ */ new Set(),
				message: /* @__PURE__ */ new Set(),
				error: /* @__PURE__ */ new Set(),
				close: /* @__PURE__ */ new Set()
			},
			openPayload: null,
			openDeliveredCallbackIds: /* @__PURE__ */ new Set(),
			requestedCloseCode: null,
			requestedCloseReason: null
		};
		this.sockets.set(t, o);
		let s = this.legacyBoundSocketId ? this.sockets.get(this.legacyBoundSocketId) : void 0;
		(!s || s.closedByGlobalApi) && (this.legacyBoundSocketId = t), this.succeed("connectSocket", e), this.isCurrent(o) && (o.connectTimer = setTimeout(() => this.handleConnectTimeout(o), r.value), o.dialTimer = setTimeout(() => this.startDialing(o, n.value, i.value), 0));
	}
	sendSocketMessage(e = {}) {
		if (this.destroyed || this.backgrounded) {
			this.fail("sendSocketMessage", e, "interrupted");
			return;
		}
		let t = this.resolveEntry(e);
		if (!t || t.state !== "OPEN" || !t.transport) {
			this.fail("sendSocketMessage", e, "WebSocket is not connected");
			return;
		}
		let n;
		if (e.isBuffer === !0) {
			let t = pe(e.data);
			if (!t) {
				this.fail("sendSocketMessage", e, "data must be string or ArrayBuffer");
				return;
			}
			n = t;
		} else if (typeof e.data == "string") n = e.data;
		else {
			this.fail("sendSocketMessage", e, "data must be string or ArrayBuffer");
			return;
		}
		try {
			t.transport.send(n);
		} catch {
			this.fail("sendSocketMessage", e, "WebSocket is not connected");
			return;
		}
		this.succeed("sendSocketMessage", e);
	}
	closeSocket(e = {}) {
		if (this.destroyed || this.backgrounded) {
			this.fail("closeSocket", e, "interrupted");
			return;
		}
		let t = typeof e.socketId == "string" && e.socketId.length > 0, n = this.resolveEntry(e);
		if (!n || n.state === "CLOSING" || !t && n.state !== "OPEN") {
			this.fail("closeSocket", e, "WebSocket is not connected");
			return;
		}
		let r = P.validateCloseCode(e.code);
		if (!r.ok) {
			this.fail("closeSocket", e, r.error);
			return;
		}
		let i = P.validateReason(e.reason);
		if (!i.ok) {
			this.fail("closeSocket", e, i.error);
			return;
		}
		t || (n.closedByGlobalApi = !0);
		let a = r.value, o = i.value;
		if (n.state === "CREATED" || n.state === "CONNECTING") {
			this.detachEntry(n), this.closeTransport(n.transport, a, o), this.dispatchEvent(n, "close", {
				code: a,
				reason: o
			}), this.succeed("closeSocket", e);
			return;
		}
		n.state = "CLOSING", n.requestedCloseCode = a, n.requestedCloseReason = o;
		try {
			n.transport?.close(a, o);
		} catch {
			n.state = "OPEN", n.requestedCloseCode = null, n.requestedCloseReason = null, this.fail("closeSocket", e, "WebSocket is not connected");
			return;
		}
		this.succeed("closeSocket", e);
	}
	onSocketEvent(e, t = {}) {
		let n = t.callback;
		if (B(n)) {
			let r = typeof t.socketId == "string" ? t.socketId : "";
			r ? (this.sockets.get(r)?.listeners[e].add(n), this.replayMissedEvent(r, e, n)) : (this.legacyListeners[e].add(n), this.legacyBoundSocketId && this.replayMissedEvent(this.legacyBoundSocketId, e, n));
		}
	}
	offSocketEvent(e, t = {}) {
		let n = t.callback, r = typeof t.socketId == "string" ? t.socketId : "", i = r ? this.sockets.get(r)?.listeners[e] : this.legacyListeners[e];
		i && (B(n) ? i.delete(n) : i.clear()), r ? this.forgetDeliveredCallback(r, e, n) : this.legacyBoundSocketId && this.forgetDeliveredCallback(this.legacyBoundSocketId, e, n);
	}
	onAppHide() {
		this.destroyed || this.backgrounded || (this.backgrounded = !0, this.backgroundTimer = setTimeout(() => {
			if (this.backgroundTimer = null, this.backgrounded && !this.destroyed) for (let e of [...this.sockets.values()]) e.opened ? this.terminateOpenedEntry(e, 1006, "interrupted") : this.terminateHandshakeWithError(e, "connectSocket:fail interrupted");
		}, I));
	}
	onAppShow() {
		this.destroyed || (this.backgrounded = !1, this.backgroundTimer !== null && (clearTimeout(this.backgroundTimer), this.backgroundTimer = null));
	}
	destroy() {
		if (!this.destroyed) {
			this.destroyed = !0, this.backgroundTimer !== null && clearTimeout(this.backgroundTimer), this.backgroundTimer = null;
			for (let e of [...this.sockets.values()]) this.detachEntry(e), this.closeTransport(e.transport, 1e3, "");
			this.sockets.clear(), this.terminalReplay.clear();
			for (let e of Object.values(this.legacyListeners)) e.clear();
			this.legacyBoundSocketId = null;
		}
	}
	startDialing(e, t, n) {
		if (e.dialTimer = null, !this.isCurrent(e) || e.state !== "CREATED") return;
		e.state = "CONNECTING";
		let r;
		try {
			r = this.webSocketFactory(t, n), e.transport = r, r.binaryType = "arraybuffer", r.onopen = () => this.handleOpen(e), r.onmessage = (t) => this.handleMessage(e, t.data), r.onerror = () => this.handleError(e), r.onclose = (t) => this.handleClose(e, t.code, t.reason);
		} catch {
			this.terminateHandshakeWithError(e, R);
		}
	}
	handleOpen(e) {
		this.isCurrent(e) && e.state === "CONNECTING" && (e.state = "OPEN", e.opened = !0, this.clearConnectTimer(e), e.openPayload = { header: {} }, this.dispatchEvent(e, "open", e.openPayload));
	}
	handleMessage(e, t) {
		if (this.isCurrent(e) && e.state === "OPEN") {
			if (typeof t == "string") {
				this.dispatchEvent(e, "message", { data: t });
				return;
			}
			Object.prototype.toString.call(t) === "[object ArrayBuffer]" && this.dispatchEvent(e, "message", {
				data: V(t),
				isBuffer: !0
			});
		}
	}
	handleError(e) {
		if (this.isCurrent(e)) {
			if (!e.opened) {
				this.terminateHandshakeWithError(e, R);
				return;
			}
			e.requestedCloseCode !== null || e.errorEmitted || (e.errorEmitted = !0, this.dispatchEvent(e, "error", { errMsg: R }));
		}
	}
	handleClose(e, t, n) {
		if (!this.isCurrent(e)) return;
		if (!e.opened) {
			this.terminateHandshakeWithError(e, R);
			return;
		}
		let r = e.requestedCloseCode ?? t, i = e.requestedCloseReason ?? n;
		this.detachEntry(e), this.dispatchEvent(e, "close", {
			code: r,
			reason: i
		});
	}
	handleConnectTimeout(e) {
		this.isCurrent(e) && e.state !== "OPEN" && this.terminateHandshakeWithError(e, z);
	}
	terminateHandshakeWithError(e, t) {
		this.isCurrent(e) && (this.detachEntry(e), this.closeTransport(e.transport), e.errorEmitted || (e.errorEmitted = !0, this.dispatchEvent(e, "error", { errMsg: t })));
	}
	terminateOpenedEntry(e, t, n) {
		this.isCurrent(e) && (this.detachEntry(e), this.closeTransport(e.transport), this.dispatchEvent(e, "close", {
			code: t,
			reason: n
		}));
	}
	resolveEntry(e) {
		return typeof e.socketId == "string" && e.socketId.length > 0 ? this.sockets.get(e.socketId) : this.legacyBoundSocketId ? this.sockets.get(this.legacyBoundSocketId) : void 0;
	}
	dispatchEvent(e, t, n) {
		let r;
		t === "open" ? r = e.openDeliveredCallbackIds : (t === "error" || t === "close") && (r = this.recordTerminalEvent(e.socketId, t, n).deliveredCallbackIds);
		for (let i of e.listeners[t]) this.emitEventOnce(i, n, r);
		if (e.socketId === this.legacyBoundSocketId) for (let e of this.legacyListeners[t]) this.emitEventOnce(e, n, r);
	}
	replayMissedEvent(e, t, n) {
		if (t === "open") {
			let t = this.sockets.get(e);
			t?.state === "OPEN" && t.openPayload && this.emitEventOnce(n, t.openPayload, t.openDeliveredCallbackIds);
			return;
		}
		if (t === "error" || t === "close") {
			let r = this.terminalReplay.get(this.replayKey(e, t));
			r && this.emitEventOnce(n, r.payload, r.deliveredCallbackIds);
		}
	}
	emitEventOnce(e, t, n) {
		n && n.has(e) || (n?.add(e), this.emit(e, t));
	}
	recordTerminalEvent(e, t, n) {
		let r = this.replayKey(e, t), i = {
			payload: n,
			deliveredCallbackIds: /* @__PURE__ */ new Set()
		};
		for (this.terminalReplay.delete(r), this.terminalReplay.set(r, i); this.terminalReplay.size > L;) {
			let e = this.terminalReplay.keys().next().value;
			if (e === void 0) break;
			this.terminalReplay.delete(e);
		}
		return i;
	}
	forgetDeliveredCallback(e, t, n) {
		let r = t === "open" ? this.sockets.get(e)?.openDeliveredCallbackIds : t === "error" || t === "close" ? this.terminalReplay.get(this.replayKey(e, t))?.deliveredCallbackIds : void 0;
		r && (B(n) ? r.delete(n) : r.clear());
	}
	clearTerminalReplay(e) {
		this.terminalReplay.delete(this.replayKey(e, "error")), this.terminalReplay.delete(this.replayKey(e, "close"));
	}
	replayKey(e, t) {
		return `${e}|${t}`;
	}
	isCurrent(e) {
		return this.sockets.get(e.socketId) === e;
	}
	detachEntry(e) {
		this.clearConnectTimer(e), e.dialTimer !== null && clearTimeout(e.dialTimer), e.dialTimer = null, this.isCurrent(e) && this.sockets.delete(e.socketId), e.transport && (e.transport.onopen = null, e.transport.onmessage = null, e.transport.onerror = null, e.transport.onclose = null);
	}
	clearConnectTimer(e) {
		e.connectTimer !== null && clearTimeout(e.connectTimer), e.connectTimer = null;
	}
	closeTransport(e, t, n) {
		if (e) try {
			t === void 0 ? e.close() : e.close(t, n);
		} catch {}
	}
	succeed(e, t) {
		let n = { errMsg: `${e}:ok` };
		this.emit(t.success, n), this.emit(t.complete, n);
	}
	fail(e, t, n) {
		let r = { errMsg: `${e}:fail ${n}` };
		this.emit(t.fail, r), this.emit(t.complete, r);
	}
	emit(e, t) {
		B(e) && this.emitCallback(e, t);
	}
};
`${r}`;
var he = "dimina-file-system";
function ge(e) {
	let t;
	try {
		t = decodeURIComponent(e);
	} catch {
		throw Error(`invalid file path segment: ${e}`);
	}
	if (!t || t === "." || t === ".." || /[\\/\0]/.test(t)) throw Error(`invalid file path segment: ${e}`);
	return t;
}
function H(e, t) {
	let n = `${t}usr/`;
	if (!e.startsWith(n)) throw Error("filePath must be under wx.env.USER_DATA_PATH");
	let r = e.slice(n.length).split("/").map(ge);
	if (r.length === 0) throw Error("filePath must point to a file");
	return r;
}
function _e(e, t) {
	if (e.startsWith("data:")) return "file";
	try {
		let n = new URL(t, window.location.origin), r = new URL(e, n);
		return decodeURIComponent(r.pathname.split("/").pop() || "").replace(/[\\/\0]/g, "_") || "file";
	} catch {
		return "file";
	}
}
function ve(e, t, n) {
	let r = _e(e, t);
	return `${n}usr/saved/${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}_${r}`;
}
async function U(e) {
	let t = navigator.storage;
	if (typeof t?.getDirectory != "function") throw TypeError("origin private file system is not supported");
	let n = await t.getDirectory();
	return n = await n.getDirectoryHandle(he, { create: !0 }), n = await n.getDirectoryHandle(encodeURIComponent(e), { create: !0 }), n.getDirectoryHandle("usr", { create: !0 });
}
async function ye(e, t, n) {
	if (!e) throw Error("tempFilePath is required");
	if (e.startsWith(n)) throw Error(`temporary virtual file is not available on Web: ${e}`);
	let r = new URL(t, window.location.origin), i = new URL(e, r).toString(), a = await fetch(i);
	if (!a.ok) throw Error(`failed to read tempFilePath: HTTP ${a.status}`);
	return a.blob();
}
async function be(e) {
	let { appId: t, tempFilePath: n, resourceBaseUrl: r } = e, i = e.virtualFilePrefix ?? "difile://";
	if (!t) throw Error("appId is required");
	if (!n) throw Error("tempFilePath is required");
	let a = e.filePath || ve(n, r, i), o = H(a, i), s = await U(t), c = await ye(n, r, i);
	for (let e of o.slice(0, -1)) s = await s.getDirectoryHandle(e, { create: !0 });
	let l = await (await s.getFileHandle(o[o.length - 1], { create: !0 })).createWritable();
	try {
		await l.write(c), await l.close();
	} catch (e) {
		throw await l.abort().catch(() => {}), e;
	}
	return a;
}
async function xe(e, t, n = r) {
	if (!e) throw Error("appId is required");
	let i = H(t, n), a = await U(e);
	for (let e of i.slice(0, -1)) a = await a.getDirectoryHandle(e);
	return (await a.getFileHandle(i[i.length - 1])).getFile();
}
//#endregion
//#region src/pages/miniApp/navigator.ts
var Se = class {
	stack = [];
	tabPool = /* @__PURE__ */ new Map();
	_activeTabPath = null;
	get top() {
		return this.stack[this.stack.length - 1];
	}
	get size() {
		return this.stack.length;
	}
	getStack() {
		return this.stack.slice();
	}
	pushPage(e) {
		this.stack.push(e);
	}
	popPage() {
		return this.stack.pop();
	}
	removeFromStack(e) {
		let t = this.stack.indexOf(e);
		return t !== -1 && (this.stack.splice(t, 1), !0);
	}
	resetTo(e) {
		this.stack = [e], this.tabPool.clear(), this._activeTabPath = null;
	}
	clear() {
		this.stack = [], this.tabPool.clear(), this._activeTabPath = null;
	}
	getTabBridge(e) {
		return this.tabPool.get(e);
	}
	setTabBridge(e, t) {
		this.tabPool.set(e, t);
	}
	deleteTabBridge(e) {
		this.tabPool.delete(e);
	}
	getTabBridges() {
		return [...this.tabPool.values()];
	}
	get activeTabPath() {
		return this._activeTabPath;
	}
	setActiveTabPath(e) {
		this._activeTabPath = e;
	}
	getPageStack() {
		return this.stack.map((e) => ({
			pagePath: e.opts.pagePath.startsWith("/") ? e.opts.pagePath.slice(1) : e.opts.pagePath,
			query: e.opts.query || {}
		}));
	}
}, Ce = "<div class=\"dimina-mini-app\">\n	<!-- 右上方药丸按钮 -->\n	<ul class=\"dimina-mini-app-navigation__actions\">\n		<li class=\"dimina-mini-app-navigation__actions-variable\"></li>\n		<li class=\"dimina-mini-app-navigation__actions-close\"></li>\n	</ul>\n\n	<!-- webview挂载节点 -->\n	<div class=\"dimina-mini-app__webviews\"></div>\n\n	<!-- TabBar 底部导航栏 -->\n	<div class=\"dimina-mini-app__tabbar\" style=\"display: none;\"></div>\n\n	<!-- 启动loading页面 -->\n	<div class=\"dimina-mini-app__launch-screen\">\n		<div class=\"dimina-mini-app__launch-screen-content\">\n			<div class=\"dimina-mini-app__logo\">\n				<div class=\"dimina-mini-app__logo-img\">\n					<img class=\"dimina-mini-app__logo-img-url\" alt=\"logo\" />\n				</div>\n				<div class=\"dimina-mini-app__logo-circle\"></div>\n				<span class=\"dimina-mini-app__green-point\"></span>\n			</div>\n			<h1 class=\"dimina-mini-app__name\"></h1>\n		</div>\n	</div>\n\n	<div class=\"dimina-mini-app-menu__mask\"></div>\n	<div class=\"dimina-mini-app-menu\">\n		<div class=\"dimina-mini-app-menu__handle\"></div>\n		<div class=\"dimina-mini-app-menu__app\">\n			<div class=\"dimina-mini-app-menu__app-logo\">\n				<img class=\"dimina-mini-app-menu__app-logo-img\" alt=\"logo\" />\n			</div>\n			<div class=\"dimina-mini-app-menu__app-meta\">\n				<h2 class=\"dimina-mini-app-menu__app-name\"></h2>\n				<p class=\"dimina-mini-app-menu__app-id\"></p>\n				<p class=\"dimina-mini-app-menu__app-desc\"></p>\n			</div>\n		</div>\n		<div class=\"dimina-mini-app-menu__quick-actions\"></div>\n		<div class=\"dimina-mini-app-menu__footer\">\n			<button type=\"button\" class=\"dimina-mini-app-menu__footer-btn dimina-mini-app-menu__footer-btn--cancel\">取消</button>\n		</div>\n	</div>\n</div>\n", W = (e, t, n = 560) => new Promise((r) => {
	let i = setTimeout(r, n), a = (n) => {
		(!t || n.propertyName === t) && (clearTimeout(i), e.removeEventListener("transitionend", a), r());
	};
	e.addEventListener("transitionend", a);
});
function G(e) {
	e.cancelable && e.preventDefault();
}
function K(e) {
	G(e), e.stopImmediatePropagation?.();
}
var we = "__dimina_storage_v2_data__", Te = "__dimina_storage_v2_meta__";
function q(e) {
	return e instanceof Error ? e.message : String(e);
}
var J = class {
	appInfo;
	id;
	parent;
	appId;
	opener;
	appConfig;
	runtimeType;
	navigator;
	jscore;
	webviewsContainer;
	webviewAnimaEnd;
	el;
	toastInfo;
	color;
	apiRegistry;
	webSocketManager;
	_extSubscriptions;
	_windowResizeHandlers;
	_networkStatusHandlers;
	_wakeLockSentinel;
	_wakeLockRequest;
	_keepScreenOnRequested;
	_wakeLockVisibilityHandler;
	_mediaPreviewEl;
	_tempObjectUrls;
	tabBarConfig;
	tabBarPaths;
	tabBarEl;
	tabBarHeight;
	tabBarBadges;
	tabBarRedDots;
	tabBarApiVisible;
	_modalStack;
	_modalPendingTimers;
	_modalPageTouchTarget;
	_destroyed;
	_destructionLifecycleQueued;
	_destroyAbortController;
	customTabBar = !1;
	_themeMediaQuery = null;
	_themeChangeHandler = null;
	_tabBarResizeObserver = null;
	constructor(e) {
		this.appInfo = {
			...e,
			virtualFilePrefix: e.virtualFilePrefix ?? "difile://"
		}, this.id = `mini_app_${S()}`, this.parent = null, this.appId = e.appId, this.opener = e.opener ?? null, this.appConfig = null, this.runtimeType = "miniProgram", this.navigator = new Se(), this.jscore = new ae(this), this.webviewsContainer = null, this.webviewAnimaEnd = !0, this.el = document.createElement("div"), this.el.classList.add("dimina-native-view"), this.toastInfo = {
			dom: null,
			timer: null
		}, this.color = null, this.apiRegistry = {}, this.webSocketManager = new me({
			emitCallback: (e, t) => this.createCallbackFunction(e)?.(t),
			getAppConnectTimeout: () => this.appConfig?.app.networkTimeout?.connectSocket
		}), this._extSubscriptions = /* @__PURE__ */ new Map(), this._windowResizeHandlers = /* @__PURE__ */ new Set(), this._networkStatusHandlers = /* @__PURE__ */ new Map(), this._wakeLockSentinel = null, this._wakeLockRequest = null, this._keepScreenOnRequested = !1, this._wakeLockVisibilityHandler = null, this._mediaPreviewEl = null, this._tempObjectUrls = /* @__PURE__ */ new Set(), this.tabBarConfig = null, this.tabBarPaths = [], this.tabBarEl = null, this.tabBarHeight = 0, this.tabBarBadges = [], this.tabBarRedDots = [], this.tabBarApiVisible = !0, this._modalStack = [], this._modalPendingTimers = /* @__PURE__ */ new Set(), this._modalPageTouchTarget = null, this._modalPageTouchTarget = null, this._destroyed = !1, this._destructionLifecycleQueued = !1, this._destroyAbortController = new AbortController();
	}
	get pagePath() {
		return this.appInfo.pagePath;
	}
	get query() {
		return this.appInfo.query ?? {};
	}
	_normalizePagePath(e) {
		return !e || typeof e != "string" ? "" : e.startsWith("/") ? e.slice(1) : e;
	}
	_isTabBarPage(e) {
		return this.tabBarPaths.includes(this._normalizePagePath(e));
	}
	getCurrentPagePath() {
		return this.navigator.top?.opts?.pagePath || this.appInfo.pagePath || this.appConfig?.app?.entryPagePath || "";
	}
	getCurrentPageQuery() {
		return this.navigator.top?.opts?.query || this.appInfo.query || {};
	}
	getEntryPagePath() {
		return this.appInfo.pagePath || this.appConfig?.app?.entryPagePath || this.appConfig?.app?.pages?.[0] || "";
	}
	getHomePagePath() {
		return this._normalizePagePath(this.appConfig?.app?.entryPagePath || this.appConfig?.app?.pages?.[0] || "");
	}
	shouldShowHomeButton({ pagePath: e, configInfo: t, isRoot: n }) {
		if (t?.navigationStyle === "custom") return !1;
		let r = this.getHomePagePath();
		if (!r) return !1;
		let i = this._normalizePagePath(e);
		return this._isTabBarPage(i) || i === r ? !1 : n === !0 || t?.homeButton === !0;
	}
	navigateHome() {
		let e = this.getHomePagePath();
		e && (this._isTabBarPage(e) ? this.switchTab({ url: `/${e}` }) : this.navigator.size <= 1 ? this.redirectTo({ url: `/${e}` }) : this.reLaunch({ url: `/${e}` }));
	}
	hideHomeButton(e = {}, t) {
		let { onSuccess: n, onComplete: r } = this._createApiCallbacks(e);
		(t || this.navigator.top)?.webview?.setHomeButtonVisible(!1), n?.({ errMsg: "hideHomeButton:ok" }), r?.();
	}
	async copyText(e, t) {
		try {
			if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(e);
			else {
				let t = document.createElement("textarea");
				t.value = e, t.setAttribute("readonly", "readonly"), t.style.position = "fixed", t.style.opacity = "0", document.body.appendChild(t), t.select(), document.execCommand("copy"), document.body.removeChild(t);
			}
			this.showToast({
				title: t,
				icon: "success"
			});
		} catch {
			this.showToast({
				title: "复制失败",
				icon: "none"
			});
		}
	}
	closeMiniProgram() {
		this.closeMiniAppMenu(), this.parent.appManager.closeApp(this);
	}
	renderMiniAppMenu() {
		let e = this.el.querySelector(".dimina-mini-app-menu__app-name"), t = this.el.querySelector(".dimina-mini-app-menu__app-id"), n = this.el.querySelector(".dimina-mini-app-menu__app-desc"), r = this.el.querySelector(".dimina-mini-app-menu__app-logo-img"), i = this.el.querySelector(".dimina-mini-app-menu__quick-actions"), a = this.getCurrentPagePath(), o = this.getEntryPagePath(), s = a || o || "", c = this.parent?.urlSync?.buildShareUrl?.(this.appId, this.getPageStack());
		e.textContent = this.appInfo.name || "未命名小程序", t.textContent = `AppID：${this.appId || "--"}`, n.textContent = `当前页面：${s || "--"}`, r.src = this.appInfo.logo || "";
		let l = [
			...c ? [{
				label: "复制链接",
				icon: "↗",
				handler: () => this.copyText(c, "链接已复制")
			}] : [],
			{
				label: "重新进入",
				icon: "↻",
				handler: () => {
					this.closeMiniAppMenu(), this.reLaunch({ url: o || a });
				}
			},
			{
				label: "关闭小程序",
				icon: "×",
				danger: !0,
				handler: () => this.closeMiniProgram()
			}
		];
		i.style.gridTemplateColumns = `repeat(${l.length}, minmax(0, 1fr))`, i.innerHTML = l.map((e, t) => `
				<button type="button" class="dimina-mini-app-menu__quick-action${e.danger ? " is-danger" : ""}" data-quick-index="${t}">
					<span class="dimina-mini-app-menu__quick-action-icon">${e.icon}</span>
					<span class="dimina-mini-app-menu__quick-action-label">${e.label}</span>
				</button>
			`).join(""), i.querySelectorAll("[data-quick-index]").forEach((e, t) => {
			e.onclick = () => l[t].handler();
		});
	}
	openMiniAppMenu() {
		let e = this.el.querySelector(".dimina-mini-app-menu__mask"), t = this.el.querySelector(".dimina-mini-app-menu");
		this.renderMiniAppMenu(), e.style.display = "block", requestAnimationFrame(() => {
			e.classList.add("show"), t.classList.add("show");
		});
	}
	closeMiniAppMenu() {
		let e = this.el.querySelector(".dimina-mini-app-menu__mask"), t = this.el.querySelector(".dimina-mini-app-menu");
		e.classList.remove("show"), t.classList.remove("show");
	}
	registerApi(e, t) {
		this.apiRegistry[e] = t;
	}
	getApiNamespaces() {
		return this.parent?.apiNamespaces ?? [];
	}
	getResourceBaseUrl() {
		return this.appInfo.resourceBaseUrl ?? this.parent?.resourceBaseUrl ?? "/";
	}
	getPageFrameUrl() {
		return this.parent?.pageFrameUrl ?? `${this.getResourceBaseUrl()}pageFrame.html`;
	}
	_getStatusBarRect() {
		return this.parent?.shell?.getStatusBarRect?.() ?? {
			top: 0,
			left: 0,
			width: 0,
			height: 0,
			right: 0,
			bottom: 0
		};
	}
	_getStorageAdapter() {
		return this.parent?.storageAdapter ?? b(!0);
	}
	_storageKey(e) {
		return `${this._storageKeyPrefix()}${e}`;
	}
	_storageKeyPrefix() {
		return `${we}${this.appId.length}:${this.appId}:`;
	}
	_legacyStorageKey(e) {
		return `${this.appId}_${e}`;
	}
	_legacyStorageDisabledKey() {
		return `${Te}${this.appId.length}:${this.appId}:legacy-disabled`;
	}
	_serializeStorageValue(e) {
		return JSON.stringify(e === void 0 ? {
			version: 2,
			kind: "value",
			dataType: "undefined"
		} : {
			version: 2,
			kind: "value",
			dataType: "json",
			data: e
		});
	}
	_serializeStorageTombstone() {
		return JSON.stringify({
			version: 2,
			kind: "deleted"
		});
	}
	_decodeStorageRecord(e) {
		let t = JSON.parse(e);
		if (!t || t.version !== 2 || t.kind !== "value" && t.kind !== "deleted") throw Error("invalid storage record");
		if (t.kind === "value" && t.dataType !== "json" && t.dataType !== "undefined") throw Error("invalid storage value type");
		return t;
	}
	_decodeLegacyStorageValue(e) {
		try {
			return JSON.parse(e);
		} catch {
			return e;
		}
	}
	_readStorageValue(e, t) {
		let n = this._storageKey(t), r = e.getItem(n);
		if (r !== null) {
			let e = this._decodeStorageRecord(r);
			return e.kind === "deleted" ? { found: !1 } : {
				found: !0,
				data: e.dataType === "undefined" ? void 0 : e.data
			};
		}
		if (e.getItem(this._legacyStorageDisabledKey()) === "1" || this.appId.includes("_") || t.includes("_")) return { found: !1 };
		let i = e.getItem(this._legacyStorageKey(t));
		if (i === null) return { found: !1 };
		let a = this._decodeLegacyStorageValue(i);
		return e.setItem(n, this._serializeStorageValue(a)), {
			found: !0,
			data: a
		};
	}
	isPresentedTop() {
		return !this.parent || this.parent.getActiveView() === this && !this.parent.isSleeping;
	}
	safeSyncUrl() {
		try {
			this.parent?.syncUrl();
		} catch {}
	}
	invokeApi(e, t, n) {
		let r = this.apiRegistry[e];
		r ? r.call(this, t, n) : typeof this[e] == "function" ? this[e](t, n) : t?.module !== void 0 || t?.evtId !== void 0 ? this._handleExtCall(e, t) : this._handleUnsupportedApi(e, t);
	}
	_handleUnsupportedApi(e, t = {}) {
		let { onFail: n, onComplete: r } = this._createApiCallbacks(t), i = { errMsg: `${e}:fail api is not supported` };
		t.fail ? n?.(i) : console.warn(`[container] ${i.errMsg}`), r?.();
	}
	_prepareViewForLoad() {
		this.initPageFrame(), this.webviewsContainer = this.el.querySelector(".dimina-mini-app__webviews"), this.showLaunchScreen(), this.bindMoreEvent(), this.bindCloseEvent();
	}
	viewDidLoad() {
		this._prepareViewForLoad(), this.initApp().catch((e) => {
			this._destroyed || e instanceof Error && e.name === "AbortError" || (console.error(`[container] initApp failed for ${this.appId}:`, e), this.parent?.onAppLaunchError?.(e, { appId: this.appId }));
		});
	}
	async viewDidLoadForReplacement() {
		this._prepareViewForLoad(), await this.initApp(!1, !0);
	}
	async initApp(e = !0, t = !1) {
		this.webviewAnimaEnd = !1;
		try {
			await this.jscore.init(), this._bindThemeChange();
			let e = "main", n = `${this.appInfo.appId}/${e}/app-config.json`, [r] = await Promise.all([w(`${this.getResourceBaseUrl()}${n}`), te(560)]);
			if (this._destroyed) return;
			if (!r) throw Error(`[container] failed to load app config: ${n}`);
			this.appConfig = JSON.parse(r), this.runtimeType = this.appConfig?.app?.runtimeType === "game" ? "game" : "miniProgram", this.el.classList.toggle("dimina-native-view--game", this.runtimeType === "game"), this._initTabBar();
			let i = this.runtimeType === "game" ? this.appConfig.app.entryPagePath || "game" : this.appInfo.pagePath || this.appConfig.app.entryPagePath || this.appConfig.app.pages?.[0];
			if (this.appInfo.pagePath || (this.appInfo.pagePath = i), t && !this.appConfig.app.pages.some((e) => this._normalizePagePath(e) === this._normalizePagePath(i))) throw Error(`[container] page is not declared in app config: ${i}`);
			let a = this.appConfig.modules[i], o = T(this.appConfig.app, a);
			this.updateTargetPageColorStyle(o);
			let s = await this.createBridge({
				pagePath: i,
				query: this.appInfo.query,
				scene: this.appInfo.scene,
				jscore: this.jscore,
				isRoot: !0,
				root: e,
				appId: this.appInfo.appId,
				pages: this.appConfig.app.pages,
				configInfo: o
			});
			if (this._destroyed) return;
			if (this.navigator.pushPage(s), this._isTabBarPage(i)) {
				let e = this._normalizePagePath(i);
				this.navigator.setTabBridge(e, s), this.navigator.setActiveTabPath(e), this._setTabBarVisible(!0), this._updateTabBarSelection(e);
			}
			let c = (this.appInfo.restoreStack?.length ?? 0) > 1, l = { visible: !c && this.isPresentedTop() };
			if (c) {
				if (t ? await s.startAndWait(l) : s.start(l), await this.restorePageStack(this.appInfo.restoreStack.slice(1)), this._destroyed) return;
			} else await s.startAndWait(l);
			this.safeSyncUrl(), this.hideLaunchScreen();
		} catch (t) {
			let n = /* @__PURE__ */ new Set([...this.navigator.getStack(), ...this.navigator.getTabBridges()]);
			for (let e of n) e.destroy(), e.webview?.el?.remove();
			this.navigator.clear(), this.safeSyncUrl(), console.error(`[container] initApp failed for ${this.appId}:`, t);
			try {
				this.parent?.onAppLaunchError?.(t, { appId: this.appId });
			} catch (e) {
				console.error(`[container] onAppLaunchError threw for ${this.appId}:`, e);
			}
			try {
				this.destroy();
			} catch (e) {
				console.error(`[container] destroy() threw during initApp failure cleanup for ${this.appId}:`, e);
			}
			throw e && await this.parent?.removeFailedView(this), t;
		} finally {
			this.webviewAnimaEnd = !0;
		}
	}
	async restorePageStack(e) {
		for (let t = 0; t < e.length; t++) {
			let { pagePath: n, query: r } = e[t], i = t === e.length - 1, a = n.startsWith("/") ? n.slice(1) : n, o = this.appConfig.modules[a], s = T(this.appConfig.app, o), c = await this.createBridge({
				pagePath: a,
				query: r,
				scene: this.appInfo.scene,
				jscore: this.jscore,
				isRoot: !1,
				root: o?.root || "main",
				appId: this.appInfo.appId,
				pages: this.appConfig.app.pages,
				configInfo: s
			});
			if (this._destroyed) return;
			let l = this.navigator.top;
			l.webview.el.classList.remove("dimina-native-view--instage"), l.webview.el.classList.add("dimina-native-view--slide-out"), this.navigator.pushPage(c), c.webview.el.style.zIndex = String(this.navigator.size + 1), c.webview.el.classList.remove("dimina-native-view--before-enter"), i || c.webview.el.classList.add("dimina-native-view--slide-out");
			let u = { visible: i && this.isPresentedTop() };
			i ? await c.startAndWait(u) : c.start(u);
		}
		if (e.length > 0) {
			let e = this.navigator.top, t = this.appConfig.modules[e.opts.pagePath], n = T(this.appConfig.app, t);
			this.updateTargetPageColorStyle(n), this._isTabBarPage(e.opts.pagePath) || this._setTabBarVisible(!1);
		}
	}
	getPageStack() {
		return this.navigator.getPageStack();
	}
	async createBridge(e) {
		let { jscore: t, configInfo: n, isRoot: r, appId: i, pagePath: a, query: o, scene: s, pages: c, root: l } = e, u = new D({
			jscore: t,
			configInfo: n,
			isRoot: r,
			appId: i,
			runtimeType: this.runtimeType,
			pagePath: a,
			query: o,
			scene: s,
			referrerInfo: e.referrerInfo ?? this.appInfo.referrerInfo,
			pages: c,
			root: l
		});
		return u.parent = this, await u.init(this._destroyAbortController.signal), u;
	}
	queueAppShowOptions(e) {
		this.jscore.queueAppShowOptions(e);
	}
	onPresentIn() {
		this.parent?.appManager.retention.forget(this);
		let e = this.navigator.top;
		this.webSocketManager.onAppShow(), this.jscore.appShow(), e?.pageShow();
	}
	onPresentOut() {
		this.navigator.top?.pageHide(), this.webSocketManager.onAppHide(), this.jscore.appHide(), this.parent?.appManager.retention.hide(this);
	}
	queueDestructionLifecycle() {
		if (this._destructionLifecycleQueued) return;
		this._destructionLifecycleQueued = !0;
		let e = /* @__PURE__ */ new Set([...this.navigator.getStack(), ...this.navigator.getTabBridges()]);
		for (let t of e) t.destroy("exit");
	}
	initPageFrame() {
		this.el.innerHTML = Ce;
	}
	updateTargetPageColorStyle(e) {
		let { navigationBarTextStyle: t } = e;
		this.updateActionColorStyle(t);
	}
	showLaunchScreen() {
		let e = this.el.querySelector(".dimina-mini-app__launch-screen"), t = this.el.querySelector(".dimina-mini-app__name"), n = this.el.querySelector(".dimina-mini-app__logo-img-url");
		this.updateActionColorStyle("black"), t.textContent = this.appInfo.name ?? null, n.src = this.appInfo.logo || "", e.style.display = "block";
	}
	hideLaunchScreen() {
		let e = this.el.querySelector(".dimina-mini-app__launch-screen");
		e.style.display = "none";
	}
	updateActionColorStyle(e) {
		this.color = e;
		let t = this.el.querySelector(".dimina-mini-app-navigation__actions");
		if (e === "white" ? (t.classList.remove("dimina-mini-app-navigation__actions--black"), t.classList.add("dimina-mini-app-navigation__actions--white")) : e === "black" && (t.classList.remove("dimina-mini-app-navigation__actions--white"), t.classList.add("dimina-mini-app-navigation__actions--black")), this.isPresentedTop()) try {
			this.parent.updateStatusBarColor(e);
		} catch (e) {
			console.error(`[container] updateStatusBarColor threw for ${this.appId}:`, e);
		}
	}
	restoreColorStyle() {
		this.updateActionColorStyle(this.color);
	}
	createCallbackFunction(e) {
		if (e) return (t) => {
			this.jscore.postMessage({
				type: "triggerCallback",
				body: {
					id: e,
					args: t
				}
			});
		};
	}
	_createApiCallbacks({ success: e, fail: t, complete: n } = {}) {
		let r = this.createCallbackFunction(e), i = this.createCallbackFunction(t), a = this.createCallbackFunction(n), o;
		return {
			onSuccess: r || a ? (e) => {
				o = e, r?.(e);
			} : void 0,
			onFail: i || a ? (e) => {
				o = e, i?.(e);
			} : void 0,
			onComplete: a ? (...e) => a(e.length > 0 ? e[0] : o) : void 0
		};
	}
	async navigateTo(e) {
		let { url: t, success: n, fail: r, complete: i } = e, { query: a, pagePath: o } = C(t), { onSuccess: s, onFail: c, onComplete: l } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		if (this._isTabBarPage(o)) {
			c?.({ errMsg: "navigateTo:fail can not navigateTo a tabbar page" }), l?.();
			return;
		}
		if (!this.webviewAnimaEnd) {
			c?.({ errMsg: "navigateTo:fail busy" }), l?.();
			return;
		}
		this.webviewAnimaEnd = !1;
		let u = this.color;
		try {
			let e = this.appConfig.modules[o], t = T(this.appConfig.app, e), n = await this.createBridge({
				pagePath: o,
				query: a,
				scene: this.appInfo.scene,
				jscore: this.jscore,
				isRoot: !1,
				root: e?.root || "main",
				appId: this.appInfo.appId,
				pages: this.appConfig.app.pages,
				configInfo: t
			});
			if (this._destroyed) return;
			this.updateTargetPageColorStyle(t);
			let r = this.navigator.top, i = r.webview;
			this.navigator.pushPage(n), n.start({ visible: this.isPresentedTop() }), this.safeSyncUrl(), i.el.classList.remove("dimina-native-view--instage"), i.el.classList.add("dimina-native-view--slide-out"), i.el.classList.add("dimina-native-view--linear-anima"), r?.pageHide(), this._setTabBarVisible(!1), n.webview.el.style.zIndex = String(this.navigator.size + 1), n.webview.el.classList.add("dimina-native-view--enter-anima"), n.webview.el.classList.add("dimina-native-view--instage"), await W(n.webview.el, "transform"), i.el.classList.remove("dimina-native-view--linear-anima"), n.webview.el.classList.remove("dimina-native-view--before-enter"), n.webview.el.classList.remove("dimina-native-view--enter-anima"), n.webview.el.classList.remove("dimina-native-view--instage"), s?.({ errMsg: "navigateTo:ok" });
		} catch (e) {
			if (this.parent) try {
				this.updateActionColorStyle(u);
			} catch {}
			c?.({ errMsg: `navigateTo:fail ${q(e)}` });
		} finally {
			this.webviewAnimaEnd = !0, l?.();
		}
	}
	reLaunch(e) {
		let { url: t, success: n, fail: r, complete: i } = e, { onSuccess: a, onFail: o, onComplete: s } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		if (!this.webviewAnimaEnd) {
			o?.({ errMsg: "reLaunch:fail busy" }), s?.();
			return;
		}
		this.webviewAnimaEnd = !1;
		let { query: c, pagePath: l } = C(t);
		try {
			let e = this.appConfig.modules[l], t = T(this.appConfig.app, e);
			this.updateTargetPageColorStyle(t);
			let n = /* @__PURE__ */ new Set([...this.navigator.getStack(), ...this.navigator.getTabBridges()]);
			for (let e of n) e.destroy(), e.webview?.el?.remove();
			this.navigator.clear(), this.safeSyncUrl(), this.webviewsContainer && (this.webviewsContainer.innerHTML = ""), this.createBridge({
				pagePath: l,
				query: c,
				scene: this.appInfo.scene,
				jscore: this.jscore,
				isRoot: !0,
				root: e?.root || "main",
				appId: this.appInfo.appId,
				pages: this.appConfig.app.pages,
				configInfo: t
			}).then((e) => {
				if (!this._destroyed) {
					if (this.navigator.pushPage(e), this._isTabBarPage(l)) {
						let t = this._normalizePagePath(l);
						this.navigator.setTabBridge(t, e), this.navigator.setActiveTabPath(t), this._setTabBarVisible(!0), this._updateTabBarSelection(t);
					} else this._setTabBarVisible(!1);
					e.start({ visible: this.isPresentedTop() }), this.safeSyncUrl(), e.webview.el.style.zIndex = "1", this.webviewAnimaEnd = !0, a?.({ errMsg: "reLaunch:ok" }), s?.();
				}
			}).catch((e) => {
				this.webviewAnimaEnd = !0, o?.({ errMsg: `reLaunch:fail ${q(e)}` }), s?.();
			});
		} catch (e) {
			o?.({ errMsg: `reLaunch:fail ${q(e)}` }), s?.(), this.webviewAnimaEnd = !0;
		}
	}
	applyUpdate() {
		this.reLaunch({ url: this.getEntryPagePath() });
	}
	redirectTo(e) {
		let { url: t, success: n, fail: r, complete: i } = e, { query: a, pagePath: o } = C(t), { onSuccess: s, onFail: c, onComplete: l } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		if (this._isTabBarPage(o)) {
			c?.({ errMsg: "redirectTo:fail can not redirectTo a tabbar page" }), l?.();
			return;
		}
		if (!this.webviewAnimaEnd) {
			c?.({ errMsg: "redirectTo:fail busy" }), l?.();
			return;
		}
		this.webviewAnimaEnd = !1;
		try {
			let e = this.navigator.top, t = this._normalizePagePath(e.opts.pagePath), n = this.appConfig.modules[o], r = T(this.appConfig.app, n);
			this.updateTargetPageColorStyle(r), e.destroy(), e.opts = {
				...e.opts,
				pagePath: o,
				query: a,
				configInfo: r
			}, e.webview.applyPageStyle(r, {
				isRoot: e.opts.isRoot,
				showHomeButton: this.shouldShowHomeButton({
					pagePath: o,
					configInfo: r,
					isRoot: e.opts.isRoot
				})
			}), e.resetStatus(), e.start({ visible: this.isPresentedTop() }), this.safeSyncUrl(), this.navigator.getTabBridge(t) === e && (this.navigator.deleteTabBridge(t), this.navigator.activeTabPath === t && this.navigator.setActiveTabPath(null)), this._setBridgeTabBarInset(e, !1), this._setTabBarVisible(!1), s?.({ errMsg: "redirectTo:ok" });
		} catch (e) {
			c?.({ errMsg: `redirectTo:fail ${q(e)}` });
		} finally {
			this.webviewAnimaEnd = !0, l?.();
		}
	}
	async navigateBack(e = {}) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e);
		if (this.navigator.size < 2) {
			n?.({ errMsg: "navigateBack:fail cannot navigate back at first page" }), r?.();
			return;
		}
		if (!this.webviewAnimaEnd) {
			n?.({ errMsg: "navigateBack:fail busy" }), r?.();
			return;
		}
		this.webviewAnimaEnd = !1;
		try {
			let e = this.navigator.popPage(), n = this.navigator.top, r = this.appConfig.modules[n.opts.pagePath], i = T(this.appConfig.app, r);
			if (this.updateTargetPageColorStyle(i), e.webview.el.classList.add("dimina-native-view--before-enter"), e.webview.el.classList.add("dimina-native-view--enter-anima"), e.destroy(), n.webview.el.classList.remove("dimina-native-view--slide-out"), n.webview.el.classList.add("dimina-native-view--instage"), n.webview.el.classList.add("dimina-native-view--enter-anima"), this.isPresentedTop() && n.pageShow(), this.safeSyncUrl(), this._isTabBarPage(n.opts.pagePath)) {
				let e = this._normalizePagePath(n.opts.pagePath);
				this.navigator.setActiveTabPath(e), this._setTabBarVisible(!0), this._updateTabBarSelection(e);
			}
			await W(n.webview.el, "transform"), n.webview.el.classList.remove("dimina-native-view--enter-anima"), n.webview.el.classList.remove("dimina-native-view--instage"), e.webview.el.parentNode.removeChild(e.webview.el), t?.({ errMsg: "navigateBack:ok" });
		} catch (e) {
			n?.({ errMsg: `navigateBack:fail ${q(e)}` });
		} finally {
			this.webviewAnimaEnd = !0, r?.();
		}
	}
	async switchTab(e) {
		let { url: t, success: n, fail: r, complete: i } = e, { query: a, pagePath: o } = C(t), s = this._normalizePagePath(o), { onSuccess: c, onFail: l, onComplete: u } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		if (!this._isTabBarPage(s)) {
			l?.({ errMsg: `switchTab:fail not a tabBar page: ${s}` }), u?.();
			return;
		}
		if (!this.webviewAnimaEnd) {
			l?.({ errMsg: "switchTab:fail busy" }), u?.();
			return;
		}
		if (this.navigator.activeTabPath === s && this.navigator.size === 1) {
			this._setTabBarVisible(!0), this._updateTabBarSelection(s), c?.({ errMsg: "switchTab:ok" }), u?.();
			return;
		}
		this.webviewAnimaEnd = !1;
		try {
			let e = this.navigator.activeTabPath, t = e ? this.navigator.getTabBridge(e) : null, n = !!t && this.navigator.size === 1 && this.navigator.top === t, r = this.navigator.getTabBridge(s), i = this.appConfig.modules[s], o = T(this.appConfig.app, i);
			if (!r) {
				if (r = await this.createBridge({
					pagePath: s,
					query: a,
					scene: this.appInfo.scene,
					jscore: this.jscore,
					isRoot: !0,
					root: i?.root || "main",
					appId: this.appInfo.appId,
					pages: this.appConfig.app.pages,
					configInfo: o
				}), this._destroyed) return;
				this.navigator.setTabBridge(s, r), r.start({ visible: !1 });
			}
			for (this.updateTargetPageColorStyle(o); this.navigator.size > 0;) {
				let e = this.navigator.top;
				if (this._isTabBarPage(e.opts.pagePath)) break;
				e.pageHide(), e.destroy(), e.webview?.el?.remove(), this.navigator.popPage();
			}
			t && t !== r && (n && t.pageHide(), t.webview?.el && (t.webview.el.style.display = "none"), this.navigator.removeFromStack(t));
			let l = r.webview.el;
			this._setBridgeTabBarInset(r, !0), l.classList.remove("dimina-native-view--before-enter", "dimina-native-view--slide-out", "dimina-native-view--enter-anima", "dimina-native-view--linear-anima", "dimina-native-view--instage"), l.style.display = "", l.style.zIndex = "1", this.navigator.getStack().includes(r) || this.navigator.pushPage(r), this.navigator.setActiveTabPath(s), this.isPresentedTop() && r.pageShow(), this._setTabBarVisible(!0), this._updateTabBarSelection(s), this.safeSyncUrl(), c?.({ errMsg: "switchTab:ok" });
		} catch (e) {
			l?.({ errMsg: `switchTab:fail ${q(e)}` });
		} finally {
			this.webviewAnimaEnd = !0, u?.();
		}
	}
	_initTabBar() {
		let e = this.appConfig?.app?.tabBar;
		if (!e || !Array.isArray(e.list) || e.list.length === 0) return;
		let t = e.list.filter((e) => this._normalizePagePath(e?.pagePath) !== "");
		if (t.length !== 0) {
			if (this.tabBarConfig = {
				...e,
				list: t
			}, this.tabBarPaths = t.map((e) => this._normalizePagePath(e.pagePath)), this.tabBarBadges = t.map(() => ""), this.tabBarRedDots = t.map(() => !1), this.tabBarApiVisible = !0, this.customTabBar = e.custom === !0, this.customTabBar) {
				this.tabBarEl = this.el.querySelector(".dimina-mini-app__tabbar"), this.tabBarEl && (this.tabBarEl.textContent = "", this.tabBarEl.style.display = "none"), this.tabBarHeight = 0, this.el.style.setProperty("--dimina-tabbar-height", "0px");
				return;
			}
			this._renderTabBar();
		}
	}
	_renderTabBar() {
		if (this.tabBarEl = this.el.querySelector(".dimina-mini-app__tabbar"), !this.tabBarEl) return;
		let { color: e, backgroundColor: t, borderStyle: n, list: r } = this.tabBarConfig, i = this._sanitizeCssColor(e) || "#999999", a = this._sanitizeCssColor(t) || "#ffffff";
		this.tabBarEl.textContent = "";
		let o = document.createElement("div");
		o.className = "dimina-tabbar", o.style.backgroundColor = a, o.style.borderTopColor = this._getTabBarBorderColor(n), r.forEach((e, t) => {
			let n = this._normalizePagePath(e.pagePath), r = document.createElement("div");
			r.className = "dimina-tabbar-item", r.dataset.path = n, r.dataset.index = String(t);
			let a = this._resolveTabBarIcon(e.iconPath);
			a && r.appendChild(this._createTabBarIcon(a, "dimina-tabbar-icon-default"));
			let s = this._resolveTabBarIcon(e.selectedIconPath);
			s && r.appendChild(this._createTabBarIcon(s, "dimina-tabbar-icon-selected"));
			let c = document.createElement("span");
			c.className = "dimina-tabbar-text", c.style.color = i, c.textContent = e.text || "", r.appendChild(c);
			let l = document.createElement("span");
			l.className = "dimina-tabbar-badge", l.hidden = !0, r.appendChild(l);
			let u = document.createElement("span");
			u.className = "dimina-tabbar-red-dot", u.hidden = !0, r.appendChild(u), o.appendChild(r);
		}), this.tabBarEl.appendChild(o), this.tabBarEl.addEventListener("click", (e) => {
			let t = e.target.closest(".dimina-tabbar-item");
			if (!t) return;
			let n = t.dataset.path;
			n && n !== this.navigator.activeTabPath && this.switchTab({ url: `/${n}` });
		}), typeof ResizeObserver < "u" && (this._tabBarResizeObserver?.disconnect(), this._tabBarResizeObserver = new ResizeObserver(() => this._syncTabBarHeightVar()), this._tabBarResizeObserver.observe(this.tabBarEl));
	}
	_createTabBarIcon(e, t) {
		let n = document.createElement("img");
		return n.className = `dimina-tabbar-icon ${t}`, n.src = e, n.alt = "", n.addEventListener("error", () => {
			n.style.display = "none";
		}), n;
	}
	_sanitizeCssColor(e) {
		if (!e || typeof e != "string") return "";
		let t = e.trim();
		return t.length === 0 || t.length > 64 ? "" : /[<>"';{}()\\]/.test(t) ? /^(?:rgb|rgba|hsl|hsla)\(\s*[\d.,%\s/-]+\)$/i.test(t) ? t : "" : t;
	}
	_getTabBarBorderColor(e) {
		return e === "white" ? "#ffffff" : "#e0e0e0";
	}
	_getTabBarHeight() {
		if (this.customTabBar) return 0;
		if (!this.tabBarEl) return this.tabBarHeight;
		let e = this.tabBarEl.getBoundingClientRect().height;
		if (!e && this.tabBarEl.style.display === "none") {
			let t = this.tabBarEl.style.display, n = this.tabBarEl.style.visibility;
			this.tabBarEl.style.visibility = "hidden", this.tabBarEl.style.display = "block", e = this.tabBarEl.getBoundingClientRect().height, this.tabBarEl.style.display = t, this.tabBarEl.style.visibility = n;
		}
		return e > 0 && (this.tabBarHeight = e), this.tabBarHeight;
	}
	_syncTabBarHeightVar() {
		let e = this._getTabBarHeight();
		this.el.style.setProperty("--dimina-tabbar-height", `${e}px`), this._syncTabBarBridgeInsets();
	}
	_setBridgeTabBarInset(e, t) {
		let n = e?.webview?.el;
		if (n) {
			if (!t || this.customTabBar) {
				n.style.removeProperty("bottom");
				return;
			}
			n.style.bottom = `${this._getTabBarHeight()}px`;
		}
	}
	_syncTabBarBridgeInsets() {
		for (let e of this.navigator.getTabBridges()) this._setBridgeTabBarInset(e, !0);
	}
	_joinBaseUrl(...e) {
		return `${this.getResourceBaseUrl()}${e.map((e) => String(e).trim().replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/")}`;
	}
	_resolveTabBarIcon(e) {
		if (!e || typeof e != "string") return null;
		let t = e.trim();
		if (!t) return null;
		if (/^(?:data:|blob:|https?:|\/\/)/i.test(t)) return t;
		let n = t.replace(/^\/+/, "").replace(/^\.\//, ""), r = `${this.appId}/`;
		return n.startsWith(r) ? this._joinBaseUrl(n) : this._joinBaseUrl(this.appId, "main", n);
	}
	_setTabBarVisible(e) {
		if (!this.tabBarEl) return;
		if (this.customTabBar) {
			this.tabBarEl.style.display = "none", this._syncTabBarHeightVar();
			return;
		}
		let t = this.navigator.top, n = this._normalizePagePath(t?.opts?.pagePath), r = !!n && n === this.navigator.activeTabPath && this._isTabBarPage(n), i = e && this.tabBarApiVisible && r;
		this.tabBarEl.style.display = i ? "block" : "none", this._syncTabBarHeightVar();
	}
	_updateTabBarSelection(e) {
		if (!this.tabBarEl || !this.tabBarConfig) return;
		let t = this.tabBarConfig.color || "#999999", n = this.tabBarConfig.selectedColor || "#1890ff";
		this.tabBarEl.querySelectorAll(".dimina-tabbar-item").forEach((r) => {
			let i = r.getAttribute("data-path") === e, a = r.querySelector(".dimina-tabbar-text"), o = r.querySelector(".dimina-tabbar-icon-default"), s = r.querySelector(".dimina-tabbar-icon-selected");
			a && (a.style.color = i ? n : t), o && (o.style.display = i ? "none" : "block"), s && (s.style.display = i ? "block" : "none"), r.classList.toggle("dimina-tabbar-item--selected", i);
		});
	}
	_getTabBarItemEl(e) {
		return this.tabBarEl?.querySelector(`.dimina-tabbar-item[data-index="${e}"]`) || null;
	}
	_validateTabBarIndex(e, t, n, r) {
		let i = this.tabBarConfig?.list?.length || 0;
		if (!i || !this.tabBarEl) return n?.({ errMsg: `${e}:fail tabBar not configured` }), r?.(), !1;
		let a = Number(t);
		return t == null || !Number.isInteger(a) || a < 0 || a >= i ? (n?.({ errMsg: `${e}:fail invalid index ${t}` }), r?.(), !1) : !0;
	}
	_replaceTabBarItemIcons(e, t) {
		let n = e.querySelector(".dimina-tabbar-text");
		e.querySelectorAll(".dimina-tabbar-icon-default, .dimina-tabbar-icon-selected").forEach((e) => e.remove());
		let r = this._resolveTabBarIcon(t.iconPath);
		r && e.insertBefore(this._createTabBarIcon(r, "dimina-tabbar-icon-default"), n);
		let i = this._resolveTabBarIcon(t.selectedIconPath);
		i && e.insertBefore(this._createTabBarIcon(i, "dimina-tabbar-icon-selected"), n);
	}
	setTabBarStyle(e = {}) {
		let { color: t, selectedColor: n, backgroundColor: r, borderStyle: i, success: a, fail: o, complete: s } = e, { onSuccess: c, onFail: l, onComplete: u } = this._createApiCallbacks({
			success: a,
			fail: o,
			complete: s
		});
		if (!this.tabBarConfig || !this.tabBarEl) {
			l?.({ errMsg: "setTabBarStyle:fail tabBar not configured" }), u?.();
			return;
		}
		let d = i === "black" || i === "white" ? i : null, f = t === void 0 ? null : this._sanitizeCssColor(t), p = n === void 0 ? null : this._sanitizeCssColor(n), m = r === void 0 ? null : this._sanitizeCssColor(r);
		f && (this.tabBarConfig.color = f), p && (this.tabBarConfig.selectedColor = p), m && (this.tabBarConfig.backgroundColor = m), d && (this.tabBarConfig.borderStyle = d);
		let h = this.tabBarEl.querySelector(".dimina-tabbar");
		h && (m && (h.style.backgroundColor = m), d && (h.style.borderTopColor = this._getTabBarBorderColor(d))), this._updateTabBarSelection(this.navigator.activeTabPath), c?.({ errMsg: "setTabBarStyle:ok" }), u?.();
	}
	setTabBarItem(e = {}) {
		let { index: t, text: n, iconPath: r, selectedIconPath: i } = e, { onSuccess: a, onFail: o, onComplete: s } = this._createApiCallbacks(e);
		if (!this._validateTabBarIndex("setTabBarItem", t, o, s)) return;
		let c = Number(t), l = this.tabBarConfig.list[c], u = {
			...l,
			text: n === void 0 ? l.text : n,
			iconPath: r === void 0 ? l.iconPath : r,
			selectedIconPath: i === void 0 ? l.selectedIconPath : i
		};
		this.tabBarConfig.list[c] = u;
		let d = this._getTabBarItemEl(c);
		if (d) {
			let e = d.querySelector(".dimina-tabbar-text");
			e && (e.textContent = u.text || ""), (r !== void 0 || i !== void 0) && this._replaceTabBarItemIcons(d, u), this._updateTabBarSelection(this.navigator.activeTabPath);
		}
		a?.({ errMsg: "setTabBarItem:ok" }), s?.();
	}
	showTabBar(e = {}) {
		let { onSuccess: t, onComplete: n } = this._createApiCallbacks(e);
		this.tabBarApiVisible = !0, this._setTabBarVisible(!0), t?.({ errMsg: "showTabBar:ok" }), n?.();
	}
	hideTabBar(e = {}) {
		let { onSuccess: t, onComplete: n } = this._createApiCallbacks(e);
		this.tabBarApiVisible = !1, this._setTabBarVisible(!1), t?.({ errMsg: "hideTabBar:ok" }), n?.();
	}
	setTabBarBadge(e = {}) {
		let { index: t, text: n = "" } = e, { onSuccess: r, onFail: i, onComplete: a } = this._createApiCallbacks(e);
		if (!this._validateTabBarIndex("setTabBarBadge", t, i, a)) return;
		let o = Number(t);
		this.tabBarBadges[o] = String(n), this.tabBarRedDots[o] = !1;
		let s = this._getTabBarItemEl(o), c = s?.querySelector(".dimina-tabbar-badge"), l = s?.querySelector(".dimina-tabbar-red-dot");
		c && (c.textContent = this.tabBarBadges[o], c.hidden = this.tabBarBadges[o].length === 0), l && (l.hidden = !0), r?.({ errMsg: "setTabBarBadge:ok" }), a?.();
	}
	removeTabBarBadge(e = {}) {
		let { index: t } = e, { onSuccess: n, onFail: r, onComplete: i } = this._createApiCallbacks(e);
		if (!this._validateTabBarIndex("removeTabBarBadge", t, r, i)) return;
		let a = Number(t);
		this.tabBarBadges[a] = "";
		let o = this._getTabBarItemEl(a)?.querySelector(".dimina-tabbar-badge");
		o && (o.textContent = "", o.hidden = !0), n?.({ errMsg: "removeTabBarBadge:ok" }), i?.();
	}
	showTabBarRedDot(e = {}) {
		let { index: t } = e, { onSuccess: n, onFail: r, onComplete: i } = this._createApiCallbacks(e);
		if (!this._validateTabBarIndex("showTabBarRedDot", t, r, i)) return;
		let a = Number(t);
		this.tabBarRedDots[a] = !0, this.tabBarBadges[a] = "";
		let o = this._getTabBarItemEl(a), s = o?.querySelector(".dimina-tabbar-badge"), c = o?.querySelector(".dimina-tabbar-red-dot");
		s && (s.textContent = "", s.hidden = !0), c && (c.hidden = !1), n?.({ errMsg: "showTabBarRedDot:ok" }), i?.();
	}
	hideTabBarRedDot(e = {}) {
		let { index: t } = e, { onSuccess: n, onFail: r, onComplete: i } = this._createApiCallbacks(e);
		if (!this._validateTabBarIndex("hideTabBarRedDot", t, r, i)) return;
		let a = Number(t);
		this.tabBarRedDots[a] = !1;
		let o = this._getTabBarItemEl(a)?.querySelector(".dimina-tabbar-red-dot");
		o && (o.hidden = !0), n?.({ errMsg: "hideTabBarRedDot:ok" }), i?.();
	}
	async navigateToMiniProgram(e = {}) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e);
		try {
			await this.parent.appManager.navigateToMiniProgram(e, this);
			let n = { errMsg: "navigateToMiniProgram:ok" };
			t?.(n), r?.(n);
		} catch (e) {
			let t = { errMsg: `navigateToMiniProgram:fail ${q(e)}` };
			n?.(t), r?.(t);
		}
	}
	async navigateBackMiniProgram(e = {}) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e), i = !1;
		try {
			await this.parent.appManager.navigateBackMiniProgram(this, e.extraData, async () => {
				i = !0;
				let e = { errMsg: "navigateBackMiniProgram:ok" };
				t?.(e), r?.(e);
			});
		} catch (e) {
			if (!i) {
				let t = { errMsg: `navigateBackMiniProgram:fail ${q(e)}` };
				n?.(t), r?.(t);
			}
		}
	}
	async exitMiniProgram(e = {}) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e), i = !1;
		try {
			await this.parent.appManager.exitMiniProgram(this, async () => {
				i = !0;
				let e = { errMsg: "exitMiniProgram:ok" };
				t?.(e), r?.(e);
			});
		} catch (e) {
			if (!i) {
				let t = { errMsg: `exitMiniProgram:fail ${q(e)}` };
				n?.(t), r?.(t);
			}
		}
	}
	async restartMiniProgram(e = {}) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e), i = !1;
		try {
			await this.parent.appManager.restartMiniProgram(this, e.path ?? "", async () => {
				i = !0;
				let e = { errMsg: "restartMiniProgram:ok" };
				t?.(e), r?.(e);
			});
		} catch (e) {
			if (!i) {
				let t = { errMsg: `restartMiniProgram:fail ${q(e)}` };
				n?.(t), r?.(t);
			}
		}
	}
	bindMoreEvent() {
		let e = this.el.querySelector(".dimina-mini-app-navigation__actions-variable"), t = this.el.querySelector(".dimina-mini-app-menu__mask"), n = this.el.querySelector(".dimina-mini-app-menu"), r = this.el.querySelector(".dimina-mini-app-menu__footer-btn--cancel");
		t.addEventListener("transitionend", () => {
			t.classList.contains("show") || (t.style.display = "none");
		}), e.onclick = () => this.openMiniAppMenu(), t.onclick = () => this.closeMiniAppMenu(), r.onclick = () => this.closeMiniAppMenu(), n.onclick = (e) => e.stopPropagation();
	}
	bindCloseEvent() {
		let e = this.el.querySelector(".dimina-mini-app-navigation__actions-close");
		e.onclick = () => {
			this.closeMiniProgram();
		};
	}
	destroy() {
		this._destroyed = !0, this.queueDestructionLifecycle(), this._destroyAbortController.abort(), this.webSocketManager.destroy();
		let e;
		for (let t of this._extSubscriptions.values()) try {
			t?.();
		} catch (t) {
			console.error(`[container] extension unsubscribe threw during destroy() for ${this.appId}:`, t), e ||= t;
		}
		this._extSubscriptions.clear();
		for (let e of this._windowResizeHandlers) globalThis.removeEventListener?.("resize", e);
		this._windowResizeHandlers.clear();
		for (let e of this._networkStatusHandlers.values()) globalThis.removeEventListener?.("online", e), globalThis.removeEventListener?.("offline", e), this._networkConnection()?.removeEventListener?.("change", e);
		this._networkStatusHandlers.clear(), this._keepScreenOnRequested = !1, this._wakeLockVisibilityHandler &&= (document.removeEventListener("visibilitychange", this._wakeLockVisibilityHandler), null), this._releaseWakeLock().catch(() => {}), this._mediaPreviewEl?.remove(), this._mediaPreviewEl = null;
		for (let e of this._tempObjectUrls) URL.revokeObjectURL(e);
		this._tempObjectUrls.clear(), this._themeMediaQuery?.removeEventListener ? this._themeMediaQuery.removeEventListener("change", this._themeChangeHandler) : this._themeMediaQuery?.removeListener?.(this._themeChangeHandler), this._themeMediaQuery = null, this._themeChangeHandler = null, this._tabBarResizeObserver?.disconnect(), this._tabBarResizeObserver = null;
		for (let e of this._modalPendingTimers) clearTimeout(e);
		this._modalPendingTimers.clear();
		for (let e of this._modalStack) e.mask?.remove(), e.dialog?.remove();
		if (this._modalStack.length = 0, this._unlockModalPageTouch(), this.hideToast({}), this.parent?.appManager?.removeApp(this), this.jscore.destroy(), e) throw e;
	}
	connectSocket(e = {}) {
		this.webSocketManager.connectSocket(e);
	}
	sendSocketMessage(e = {}) {
		this.webSocketManager.sendSocketMessage(e);
	}
	closeSocket(e = {}) {
		this.webSocketManager.closeSocket(e);
	}
	onSocketOpen(e = {}) {
		this.onSocketEvent("open", e);
	}
	onSocketMessage(e = {}) {
		this.onSocketEvent("message", e);
	}
	onSocketError(e = {}) {
		this.onSocketEvent("error", e);
	}
	onSocketClose(e = {}) {
		this.onSocketEvent("close", e);
	}
	offSocketOpen(e = {}) {
		this.offSocketEvent("open", e);
	}
	offSocketMessage(e = {}) {
		this.offSocketEvent("message", e);
	}
	offSocketError(e = {}) {
		this.offSocketEvent("error", e);
	}
	offSocketClose(e = {}) {
		this.offSocketEvent("close", e);
	}
	onSocketEvent(e, t) {
		this.webSocketManager.onSocketEvent(e, t);
	}
	offSocketEvent(e, t) {
		this.webSocketManager.offSocketEvent(e, t);
	}
	getNetworkType(e) {
		let { onSuccess: t, onComplete: n } = this._createApiCallbacks(e), r = {
			networkType: this._currentNetworkType(),
			errMsg: "getNetworkType:ok"
		};
		t?.(r), n?.(r);
	}
	onNetworkStatusChange(e) {
		let t = e.callbackId ?? e.success;
		if (!t || this._networkStatusHandlers.has(t)) return;
		let n = () => {
			this.createCallbackFunction(t)?.({
				isConnected: navigator.onLine,
				networkType: this._currentNetworkType()
			});
		};
		this._networkStatusHandlers.set(t, n), globalThis.addEventListener?.("online", n), globalThis.addEventListener?.("offline", n), this._networkConnection()?.addEventListener?.("change", n);
	}
	offNetworkStatusChange(e = {}) {
		let t = e.callbackId ? [[e.callbackId, this._networkStatusHandlers.get(e.callbackId)]] : [...this._networkStatusHandlers.entries()];
		for (let [e, n] of t) n && (globalThis.removeEventListener?.("online", n), globalThis.removeEventListener?.("offline", n), this._networkConnection()?.removeEventListener?.("change", n), this._networkStatusHandlers.delete(e));
	}
	_networkConnection() {
		let e = navigator;
		return e.connection ?? e.mozConnection ?? e.webkitConnection;
	}
	_currentNetworkType() {
		if (!navigator.onLine) return "none";
		let e = this._networkConnection(), t = e?.type?.toLowerCase();
		if (t === "wifi" || t === "ethernet") return "wifi";
		if (t === "cellular") {
			let t = e?.effectiveType?.toLowerCase();
			if (t && [
				"2g",
				"3g",
				"4g",
				"5g"
			].includes(t)) return t;
		}
		return "unknown";
	}
	getSystemInfoAsync(e) {
		let t = this._getStatusBarRect(), n = this.parent.el.querySelector(".dimina-native-webview__root").getBoundingClientRect(), { success: r, complete: i } = e, { onSuccess: a, onComplete: o } = this._createApiCallbacks({
			success: r,
			complete: i
		});
		a?.({
			statusBarHeight: t.height,
			brand: "devtools",
			mode: "default",
			model: "web",
			platform: "devtools",
			system: "web",
			deviceOrientation: "portrait",
			SDKVersion: "3.0.0",
			language: "zh_CN",
			wifiEnabled: !0,
			safeArea: {
				width: n.width,
				height: n.height,
				top: n.top,
				bottom: n.bottom,
				left: n.left,
				right: n.right
			}
		}), o?.();
	}
	getSystemInfo(e = {}) {
		let { onSuccess: t, onComplete: n } = this._createApiCallbacks(e);
		t?.({
			...this.getSystemInfoSync(),
			errMsg: "getSystemInfo:ok"
		}), n?.();
	}
	onWindowResize(e = {}) {
		let t = this.createCallbackFunction(e.success);
		if (!t || !globalThis.addEventListener) return;
		let n = () => {
			let { windowWidth: e, windowHeight: n, deviceOrientation: r = "portrait" } = this.getSystemInfoSync();
			t({
				size: {
					windowWidth: e,
					windowHeight: n
				},
				deviceOrientation: r
			});
		};
		this._windowResizeHandlers ??= /* @__PURE__ */ new Set(), this._windowResizeHandlers.add(n), globalThis.addEventListener("resize", n);
	}
	getMenuButtonBoundingClientRect() {
		let e = this.el.querySelector(".dimina-mini-app-navigation__actions").getBoundingClientRect(), t = this.el.getBoundingClientRect(), n = (this._getStatusBarRect().height || 0) + 4, r = n + e.height, i = e.left - t.left;
		return {
			top: n,
			right: e.right - t.left,
			bottom: r,
			left: i,
			width: e.width,
			height: e.height,
			x: i,
			y: n
		};
	}
	getHostEnvSnapshot() {
		return {
			menuRect: this.getMenuButtonBoundingClientRect(),
			systemInfo: this.getSystemInfoSync()
		};
	}
	_bindThemeChange() {
		let e = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
		e && (this._themeMediaQuery = e, this._themeChangeHandler = (e) => {
			this.jscore.postMessage({
				type: "hostEnvUpdate",
				body: { systemInfo: {
					...this.getSystemInfoSync(),
					theme: e.matches ? "dark" : "light"
				} }
			});
		}, e.addEventListener ? e.addEventListener("change", this._themeChangeHandler) : e.addListener?.(this._themeChangeHandler));
	}
	getSystemInfoSync() {
		let e = this.parent.el.querySelector(".dimina-native-webview__root"), t = e?.getBoundingClientRect(), n = e?.clientWidth || t?.width || this.el.clientWidth || 375, r = e?.clientHeight || t?.height || this.el.clientHeight || 667, i = this._getStatusBarRect().height || 0;
		return {
			brand: "devtools",
			model: "web",
			platform: "devtools",
			system: "web",
			SDKVersion: "3.0.0",
			pixelRatio: globalThis.devicePixelRatio || 1,
			screenWidth: n,
			screenHeight: r,
			windowWidth: n,
			windowHeight: r,
			statusBarHeight: i,
			safeArea: {
				left: 0,
				right: n,
				top: i,
				bottom: r,
				width: n,
				height: Math.max(r - i, 0)
			},
			enableDebug: !1,
			host: { appId: "" },
			language: navigator.language || "zh_CN",
			version: "",
			theme: globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light",
			fontSizeScaleFactor: 1,
			fontSizeSetting: 16,
			deviceOrientation: "portrait"
		};
	}
	showToast(e = {}) {
		let { title: t = "", duration: n = 1500, icon: r = "success", mask: i = !1, success: a, complete: o } = e;
		if (!t) return;
		this.hideToast({});
		let { onSuccess: s, onComplete: c } = this._createApiCallbacks({
			success: a,
			complete: o
		}), l = null;
		i && (l = document.createElement("div"), l.className = "dimina-toast-mask", this.el.appendChild(l));
		let u = document.createElement("div");
		u.className = `dimina-toast dimina-toast--${r}`, r === "none" && u.classList.add("dimina-toast--text-only");
		let d = document.createElement("p");
		d.textContent = String(t), u.appendChild(d), this.el.appendChild(u), this.toastInfo.dom = u, this.toastInfo.maskEl = l, this.toastInfo.timer = setTimeout(() => {
			u.remove(), l?.remove(), this.toastInfo.dom === u && (this.toastInfo.dom = null, this.toastInfo.maskEl = null, this.toastInfo.timer = null);
		}, n), s?.(), c?.();
	}
	hideToast(e = {}) {
		let { success: t, complete: n } = e, { onSuccess: r, onComplete: i } = this._createApiCallbacks({
			success: t,
			complete: n
		});
		this.toastInfo.dom && (this.toastInfo.dom.remove(), this.toastInfo.dom = null), this.toastInfo.maskEl && (this.toastInfo.maskEl.remove(), this.toastInfo.maskEl = null), this.toastInfo.timer && (clearTimeout(this.toastInfo.timer), this.toastInfo.timer = null), r?.(), i?.();
	}
	showLoading(e = {}) {
		this.showToast({
			...e,
			icon: "loading"
		});
	}
	hideLoading(e = {}) {
		this.hideToast(e);
	}
	_lockModalPageTouch() {
		if (this._modalPageTouchTarget) return;
		let e = this.navigator.top?.webview?.iframe?.contentWindow;
		e?.addEventListener && (e.addEventListener("touchmove", K, {
			capture: !0,
			passive: !1
		}), this._modalPageTouchTarget = e);
	}
	_unlockModalPageTouch() {
		this._modalPageTouchTarget &&= (this._modalPageTouchTarget.removeEventListener("touchmove", K, !0), null);
	}
	showModal(e) {
		if (this._destroyed) return;
		this._modalStack.length === 0 && this._lockModalPageTouch();
		let t = this._mountModal(e || {});
		this._modalStack.push(t), this._updateModalView(), t.mask.classList.add("show");
		let n = setTimeout(() => {
			this._modalPendingTimers.delete(n), !this._destroyed && this._modalStack.includes(t) && t.dialog.classList.add("show");
		}, 100);
		this._modalPendingTimers.add(n);
	}
	_updateModalView() {
		let e = this._modalStack.length - 1;
		for (let t = 0; t < this._modalStack.length; t++) {
			let n = this._modalStack[t];
			t === e ? (n.mask.classList.remove("dimina-modal--occluded"), n.dialog.classList.remove("dimina-modal--occluded")) : (n.mask.classList.add("dimina-modal--occluded"), n.dialog.classList.add("dimina-modal--occluded"));
		}
	}
	_mountModal(e) {
		let { title: t = "", content: n = "", showCancel: r = !0, cancelText: i = "取消", cancelColor: a = "#000", confirmText: o = "确定", confirmColor: s = "#576b95", success: c, complete: l } = e, { onSuccess: u, onComplete: d } = this._createApiCallbacks({
			success: c,
			complete: l
		}), f = document.createElement("div");
		f.className = "dimina-dialog-mask", f.addEventListener("touchmove", G, { passive: !1 });
		let p = document.createElement("div");
		p.className = "dimina-dialog";
		let m = this._modalStack.length;
		if (f.style.zIndex = String(1100 + m * 20), p.style.zIndex = String(1110 + m * 20), t) {
			let e = document.createElement("h2");
			e.className = "dimina-dialog__title", e.textContent = String(t), p.appendChild(e);
		}
		if (n) {
			let e = document.createElement("p");
			e.className = "dimina-dialog__content", e.textContent = String(n), p.appendChild(e);
		}
		let h = document.createElement("div");
		h.className = "dimina-dialog__buttons";
		let g = !1, _ = {
			mask: f,
			dialog: p,
			close: null
		}, v = (e) => {
			if (g) return;
			g = !0;
			let t = this._modalStack.indexOf(_);
			t >= 0 && this._modalStack.splice(t, 1), this._modalStack.length === 0 ? (f.classList.remove("show"), p.classList.remove("show"), setTimeout(() => {
				f.remove(), p.remove();
			}, 200)) : (f.remove(), p.remove()), this._updateModalView(), this._modalStack.length === 0 && this._unlockModalPageTouch(), u?.(e), d?.();
		};
		if (_.close = v, r) {
			let e = document.createElement("button");
			e.type = "button", e.className = "dimina-dialog__button", e.style.color = a, e.textContent = String(i), e.addEventListener("click", () => {
				v({
					cancel: !0,
					confirm: !1,
					errMsg: "showModal:ok"
				});
			}), h.appendChild(e);
		}
		let y = document.createElement("button");
		return y.type = "button", y.className = "dimina-dialog__button", y.style.color = s, y.textContent = String(o), y.addEventListener("click", () => {
			v({
				cancel: !1,
				confirm: !0,
				errMsg: "showModal:ok"
			});
		}), h.appendChild(y), p.appendChild(h), this.el.appendChild(f), this.el.appendChild(p), _;
	}
	showActionSheet(e) {
		let { itemList: t = [], itemColor: n = "#000", success: r, fail: i, complete: a } = e || {}, { onSuccess: o, onFail: s, onComplete: c } = this._createApiCallbacks({
			success: r,
			fail: i,
			complete: a
		});
		if (!Array.isArray(t) || t.length === 0) {
			s?.({ errMsg: "showActionSheet:fail" }), c?.();
			return;
		}
		let l = document.createElement("div");
		l.className = "dimina-action-sheet-mask";
		let u = document.createElement("div");
		u.className = "dimina-action-sheet";
		let d = () => {
			l.remove(), u.remove();
		};
		t.forEach((e, t) => {
			let r = document.createElement("div");
			r.className = "dimina-action-sheet-item", r.style.color = n, r.textContent = e, r.onclick = () => {
				d(), o?.({
					tapIndex: t,
					errMsg: "showActionSheet:ok"
				}), c?.();
			}, u.appendChild(r);
		});
		let f = document.createElement("div");
		f.className = "dimina-action-sheet-cancel", f.textContent = "取消", f.onclick = () => {
			d(), s?.({ errMsg: "showActionSheet:fail cancel" }), c?.();
		}, u.appendChild(f), l.onclick = d, this.el.appendChild(l), this.el.appendChild(u), requestAnimationFrame(() => requestAnimationFrame(() => {
			u.classList.add("show"), l.classList.add("show");
		}));
	}
	setNavigationBarTitle(e) {
		let { title: t, success: n, fail: r, complete: i } = e, { onSuccess: a, onFail: o, onComplete: s } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		try {
			let e = this.navigator.top.webview.el.querySelector(".dimina-native-webview__navigation-title");
			e ? (e.textContent = t || "", a?.({ errMsg: "setNavigationBarTitle:ok" })) : o?.({ errMsg: "setNavigationBarTitle:fail Navigation title element not found" });
		} catch (e) {
			o?.({ errMsg: `setNavigationBarTitle:fail ${q(e)}` });
		} finally {
			s?.();
		}
	}
	setNavigationBarColor(e) {
		let { frontColor: t, backgroundColor: n, success: r, fail: i, complete: a } = e, { onSuccess: o, onFail: s, onComplete: c } = this._createApiCallbacks({
			success: r,
			fail: i,
			complete: a
		});
		try {
			let e = this.navigator.top.webview.el.querySelector(".dimina-native-webview__navigation");
			e ? (t && (e.querySelector(".dimina-native-webview__navigation-title").style.color = t), n && (e.style.backgroundColor = n), o?.({ errMsg: "setNavigationBarColor:ok" })) : s?.({ errMsg: "setNavigationBarColor:fail Navigation element not found" });
		} catch (e) {
			s?.({ errMsg: `setNavigationBarColor:fail ${q(e)}` });
		} finally {
			c?.();
		}
	}
	pageScrollTo(e) {
		let { scrollTop: t, duration: n = 300, success: r, fail: i, complete: a } = e, { onSuccess: o, onFail: s, onComplete: c } = this._createApiCallbacks({
			success: r,
			fail: i,
			complete: a
		});
		try {
			let e = this.navigator.top.webview.iframe.contentWindow?.document.documentElement;
			e ? (e.scrollTo({
				top: t,
				behavior: n > 0 ? "smooth" : "auto"
			}), setTimeout(() => {
				o?.({ errMsg: "pageScrollTo:ok" }), c?.();
			}, n)) : (s?.({ errMsg: "pageScrollTo:fail Webview root element not found" }), c?.());
		} catch (e) {
			s?.({ errMsg: `pageScrollTo:fail ${q(e)}` }), c?.();
		}
	}
	setClipboardData(e) {
		let { data: t, success: n, fail: r, complete: i } = e, { onSuccess: a, onFail: o, onComplete: s } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		try {
			navigator.clipboard.writeText(t).then(() => {
				a?.({ errMsg: "setClipboardData:ok" }), s?.();
			}).catch((e) => {
				o?.({ errMsg: `setClipboardData:fail ${e.message}` }), s?.();
			});
		} catch (e) {
			o?.({ errMsg: `setClipboardData:fail ${q(e)}` }), s?.();
		}
	}
	getClipboardData(e) {
		let { success: t, fail: n, complete: r } = e, { onSuccess: i, onFail: a, onComplete: o } = this._createApiCallbacks({
			success: t,
			fail: n,
			complete: r
		});
		try {
			navigator.clipboard.readText().then((e) => {
				i?.({
					data: e,
					errMsg: "getClipboardData:ok"
				}), o?.();
			}).catch((e) => {
				a?.({ errMsg: `getClipboardData:fail ${e.message}` }), o?.();
			});
		} catch (e) {
			a?.({ errMsg: `getClipboardData:fail ${q(e)}` }), o?.();
		}
	}
	chooseVideo(e = {}) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e), i = document.createElement("input");
		i.type = "file", i.accept = "video/*", e.sourceType?.length === 1 && e.sourceType[0] === "camera" && (i.capture = e.camera === "front" ? "user" : "environment"), i.style.display = "none", this.el.appendChild(i);
		let a = !1, o = !1, s = null, c = () => {
			globalThis.removeEventListener?.("focus", u), s && clearTimeout(s), i.remove();
		}, l = () => {
			if (a) return;
			a = !0, c();
			let e = { errMsg: "chooseVideo:fail cancel" };
			n?.(e), r?.(e);
		}, u = () => {
			s = setTimeout(() => {
				!a && !i.files?.length && l();
			}, 300);
		}, d = (e, i) => {
			o || (o = !0, i ? t?.(e) : n?.(e), r?.(e));
		};
		i.addEventListener("cancel", l, { once: !0 }), globalThis.addEventListener?.("focus", u), i.onchange = () => {
			let e = i.files?.[0];
			if (!e) {
				l();
				return;
			}
			a = !0, c();
			let t = URL.createObjectURL(e);
			this._tempObjectUrls.add(t);
			let n = document.createElement("video");
			n.preload = "metadata", n.onloadedmetadata = () => {
				let r = {
					tempFilePath: t,
					duration: Number.isFinite(n.duration) ? n.duration : 0,
					width: n.videoWidth,
					height: n.videoHeight,
					size: e.size,
					errMsg: "chooseVideo:ok"
				};
				d(r, !0);
			}, n.onerror = () => {
				d({ errMsg: "chooseVideo:fail unsupported video" }, !1);
			}, n.src = t;
		}, i.click();
	}
	getImageInfo(e) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e);
		if (!e.src) {
			let e = { errMsg: "getImageInfo:fail src is required" };
			n?.(e), r?.(e);
			return;
		}
		this._resolveMediaObjectUrl(e.src).then((i) => {
			let a = new Image();
			a.onload = () => {
				let n = e.src.split("?")[0], i = n.includes(".") ? n.split(".").pop().toLowerCase() : "unknown", o = {
					width: a.naturalWidth,
					height: a.naturalHeight,
					path: e.src,
					orientation: "up",
					type: i,
					errMsg: "getImageInfo:ok"
				};
				t?.(o), r?.(o);
			}, a.onerror = () => {
				let e = { errMsg: "getImageInfo:fail unsupported image" };
				n?.(e), r?.(e);
			}, a.src = i;
		}).catch((e) => {
			let t = { errMsg: `getImageInfo:fail ${q(e)}` };
			n?.(t), r?.(t);
		});
	}
	getVideoInfo(e) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e);
		if (!e.src) {
			let e = { errMsg: "getVideoInfo:fail src is required" };
			n?.(e), r?.(e);
			return;
		}
		this._resolveMediaObjectUrl(e.src).then((i) => {
			let a = document.createElement("video");
			a.preload = "metadata", a.onloadedmetadata = async () => {
				let n = 0;
				try {
					let e = await fetch(i);
					n = Math.ceil((await e.blob()).size / 1024);
				} catch {}
				let o = e.src.split("?")[0].split(".").pop()?.toLowerCase() ?? "unknown", s = {
					duration: Number.isFinite(a.duration) ? a.duration : 0,
					width: a.videoWidth,
					height: a.videoHeight,
					orientation: "up",
					type: o,
					size: n,
					bitrate: 0,
					fps: 0,
					errMsg: "getVideoInfo:ok"
				};
				t?.(s), r?.(s);
			}, a.onerror = () => {
				let e = { errMsg: "getVideoInfo:fail unsupported video" };
				n?.(e), r?.(e);
			}, a.src = i;
		}).catch((e) => {
			let t = { errMsg: `getVideoInfo:fail ${q(e)}` };
			n?.(t), r?.(t);
		});
	}
	previewMedia(e) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e), i = (e.sources ?? []).filter((e) => e.url);
		if (i.length === 0) {
			let e = { errMsg: "previewMedia:fail sources is required" };
			n?.(e), r?.(e);
			return;
		}
		this._mediaPreviewEl?.remove();
		let a = Math.max(0, Math.min(e.current ?? 0, i.length - 1)), o = document.createElement("div");
		o.style.cssText = "position:absolute;inset:0;z-index:10000;background:#000;display:flex;align-items:center;justify-content:center;";
		let s = document.createElement("div");
		s.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;";
		let c = document.createElement("div");
		c.style.cssText = "position:absolute;top:calc(env(safe-area-inset-top) + 16px);left:50%;transform:translateX(-50%);color:white;font:14px sans-serif;z-index:2;";
		let l = document.createElement("button");
		l.type = "button", l.textContent = "×", l.style.cssText = "position:absolute;right:16px;top:calc(env(safe-area-inset-top) + 8px);z-index:3;border:0;background:transparent;color:white;font-size:36px;";
		let u = async () => {
			let e = a;
			s.replaceChildren();
			let t = i[a];
			try {
				let n = await this._resolveMediaObjectUrl(t.url);
				if (e !== a) return;
				let r = t.type === "video" ? document.createElement("video") : document.createElement("img");
				if (r.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;", r instanceof HTMLVideoElement && (r.controls = !0, r.autoplay = !0, r.poster = t.poster ? await this._resolveMediaObjectUrl(t.poster) : ""), e !== a) return;
				r.src = n, s.appendChild(r), c.textContent = `${a + 1}/${i.length}`;
			} catch (t) {
				if (e !== a) return;
				s.textContent = `previewMedia:fail ${q(t)}`, s.style.color = "white";
			}
		}, d = 0;
		s.addEventListener("pointerdown", (e) => {
			d = e.clientX;
		}), s.addEventListener("pointerup", (e) => {
			let t = e.clientX - d;
			Math.abs(t) < 40 || (a = Math.max(0, Math.min(a + (t < 0 ? 1 : -1), i.length - 1)), u());
		}), l.onclick = () => {
			o.remove(), this._mediaPreviewEl === o && (this._mediaPreviewEl = null);
		}, o.append(s, c, l), this.el.appendChild(o), this._mediaPreviewEl = o, u();
		let f = { errMsg: "previewMedia:ok" };
		t?.(f), r?.(f);
	}
	setKeepScreenOn(e) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e);
		if (typeof e.keepScreenOn != "boolean") {
			let e = { errMsg: "setKeepScreenOn:fail invalid keepScreenOn" };
			n?.(e), r?.(e);
			return;
		}
		let i = (e, i) => {
			i ? t?.(e) : n?.(e), r?.(e);
		};
		if (!e.keepScreenOn) {
			this._keepScreenOnRequested = !1, this._wakeLockVisibilityHandler &&= (document.removeEventListener("visibilitychange", this._wakeLockVisibilityHandler), null), (this._wakeLockRequest ?? Promise.resolve()).catch(() => {}).then(() => this._releaseWakeLock()).then(() => {
				i({ errMsg: "setKeepScreenOn:ok" }, !0);
			}).catch((e) => i({ errMsg: `setKeepScreenOn:fail ${q(e)}` }, !1));
			return;
		}
		this._keepScreenOnRequested = !0, this._installWakeLockVisibilityHandler(), this._requestWakeLock().then(() => {
			i({ errMsg: "setKeepScreenOn:ok" }, !0);
		}).catch((e) => {
			this._keepScreenOnRequested = !1, this._wakeLockVisibilityHandler &&= (document.removeEventListener("visibilitychange", this._wakeLockVisibilityHandler), null), i({ errMsg: `setKeepScreenOn:fail ${q(e)}` }, !1);
		});
	}
	_installWakeLockVisibilityHandler() {
		this._wakeLockVisibilityHandler || (this._wakeLockVisibilityHandler = () => {
			document.visibilityState === "visible" && this._keepScreenOnRequested && !this._destroyed && this._requestWakeLock().catch(() => {});
		}, document.addEventListener("visibilitychange", this._wakeLockVisibilityHandler));
	}
	_requestWakeLock() {
		if (this._wakeLockSentinel && !this._wakeLockSentinel.released) return Promise.resolve();
		if (this._wakeLockRequest) return this._wakeLockRequest;
		let e = navigator.wakeLock;
		if (!e) return Promise.reject(/* @__PURE__ */ Error("screen wake lock is not supported"));
		let t;
		return t = e.request("screen").then(async (e) => {
			if (!this._keepScreenOnRequested || this._destroyed) {
				await e.release();
				return;
			}
			this._wakeLockSentinel = e, e.addEventListener?.("release", () => {
				this._wakeLockSentinel === e && (this._wakeLockSentinel = null);
			});
		}).finally(() => {
			this._wakeLockRequest === t && (this._wakeLockRequest = null);
		}), this._wakeLockRequest = t, t;
	}
	_releaseWakeLock() {
		let e = this._wakeLockSentinel;
		return this._wakeLockSentinel = null, e ? e.release() : Promise.resolve();
	}
	async getSetting(e = {}) {
		let { onSuccess: t, onComplete: n } = this._createApiCallbacks(e), r = {}, i = navigator.permissions;
		for (let [e, t] of [
			["scope.camera", "camera"],
			["scope.record", "microphone"],
			["scope.userLocation", "geolocation"]
		]) try {
			r[e] = (await i?.query({ name: t }))?.state === "granted";
		} catch {
			r[e] = !1;
		}
		let a = {
			authSetting: r,
			errMsg: "getSetting:ok"
		};
		t?.(a), n?.(a);
	}
	authorize(e) {
		let { onSuccess: t, onFail: n, onComplete: r } = this._createApiCallbacks(e), i = (e, i = "auth deny") => {
			let a = { errMsg: e ? "authorize:ok" : `authorize:fail ${i}` };
			e ? t?.(a) : n?.(a), r?.(a);
		};
		if (e.scope === "scope.camera" || e.scope === "scope.record") {
			if (!navigator.mediaDevices?.getUserMedia) {
				i(!1, "media permission is not supported");
				return;
			}
			navigator.mediaDevices.getUserMedia({
				video: e.scope === "scope.camera",
				audio: e.scope === "scope.record"
			}).then((e) => {
				e.getTracks().forEach((e) => e.stop()), i(!0);
			}).catch((e) => i(!1, q(e)));
			return;
		}
		if (e.scope === "scope.userLocation" && navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(() => i(!0), (e) => i(!1, e.message));
			return;
		}
		i(!1, "scope is not supported on Web");
	}
	_resolveMediaUrl(e) {
		return new URL(e, new URL(this.getResourceBaseUrl(), window.location.origin)).toString();
	}
	async _resolveMediaObjectUrl(e) {
		let t = this.appInfo.virtualFilePrefix, n = `${t}usr/`;
		if (e.startsWith(n)) {
			let n = await xe(this.appId, e, t), r = URL.createObjectURL(n);
			return this._tempObjectUrls.add(r), r;
		}
		if (e.startsWith(t)) throw Error(`temporary virtual file is not available on Web: ${e}`);
		return this._resolveMediaUrl(e);
	}
	"FileSystemManager.saveFile"(e = {}) {
		let { tempFilePath: t = "", filePath: n, success: r, fail: i, complete: a } = e, { onSuccess: o, onFail: s, onComplete: c } = this._createApiCallbacks({
			success: r,
			fail: i,
			complete: a
		});
		be({
			appId: this.appId,
			tempFilePath: t,
			filePath: n,
			resourceBaseUrl: this.getResourceBaseUrl(),
			virtualFilePrefix: this.appInfo.virtualFilePrefix
		}).then((e) => {
			let t = {
				savedFilePath: e,
				errMsg: "FileSystemManager.saveFile:ok"
			};
			o?.(t), c?.(t);
		}).catch((e) => {
			let t = { errMsg: `FileSystemManager.saveFile:fail ${q(e)}` };
			s?.(t), c?.(t);
		});
	}
	setStorage(e) {
		let { key: t, data: n, success: r, fail: i, complete: a } = e, { onSuccess: o, onFail: s, onComplete: c } = this._createApiCallbacks({
			success: r,
			fail: i,
			complete: a
		});
		try {
			let e = this._storageKey(t);
			this._getStorageAdapter().setItem(e, this._serializeStorageValue(n)), o?.({ errMsg: "setStorage:ok" });
		} catch (e) {
			s?.({ errMsg: `setStorage:fail ${q(e)}` });
		} finally {
			c?.();
		}
	}
	getStorage(e) {
		let { key: t, success: n, fail: r, complete: i } = e, { onSuccess: a, onFail: o, onComplete: s } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		try {
			let e = this._readStorageValue(this._getStorageAdapter(), t);
			e.found ? a?.({
				data: e.data,
				errMsg: "getStorage:ok"
			}) : o?.({ errMsg: "getStorage:fail data not found" });
		} catch (e) {
			o?.({ errMsg: `getStorage:fail ${q(e)}` });
		} finally {
			s?.();
		}
	}
	removeStorage(e) {
		let { key: t, success: n, fail: r, complete: i } = e, { onSuccess: a, onFail: o, onComplete: s } = this._createApiCallbacks({
			success: n,
			fail: r,
			complete: i
		});
		try {
			this._getStorageAdapter().setItem(this._storageKey(t), this._serializeStorageTombstone()), a?.({ errMsg: "removeStorage:ok" });
		} catch (e) {
			o?.({ errMsg: `removeStorage:fail ${q(e)}` });
		} finally {
			s?.();
		}
	}
	clearStorage(e = {}) {
		let { success: t, fail: n, complete: r } = e || {}, { onSuccess: i, onFail: a, onComplete: o } = this._createApiCallbacks({
			success: t,
			fail: n,
			complete: r
		});
		try {
			let e = this._storageKeyPrefix(), t = [], n = this._getStorageAdapter();
			for (let r = 0; r < n.length; r++) {
				let i = n.key(r);
				i?.startsWith(e) && t.push(i);
			}
			t.forEach((e) => n.removeItem(e)), n.setItem(this._legacyStorageDisabledKey(), "1"), i?.({ errMsg: "clearStorage:ok" });
		} catch (e) {
			a?.({ errMsg: `clearStorage:fail ${q(e)}` });
		} finally {
			o?.();
		}
	}
	getStorageInfo(e = {}) {
		let { success: t, fail: n, complete: r } = e || {}, { onSuccess: i, onFail: a, onComplete: o } = this._createApiCallbacks({
			success: t,
			fail: n,
			complete: r
		});
		try {
			let e = [], t = 0, n = this._storageKeyPrefix(), r = this._getStorageAdapter();
			for (let i = 0; i < r.length; i++) {
				let a = r.key(i);
				if (a?.startsWith(n)) {
					let i = r.getItem(a);
					if (i === null || this._decodeStorageRecord(i).kind === "deleted") continue;
					e.push(a.substring(n.length)), t += i.length * 2;
				}
			}
			i?.({
				keys: e,
				currentSize: t,
				limitSize: 10485760,
				errMsg: "getStorageInfo:ok"
			});
		} catch (e) {
			a?.({ errMsg: `getStorageInfo:fail ${q(e)}` });
		} finally {
			o?.();
		}
	}
	_parseExtEventKey(e) {
		let t = this.parent?.appManager?.getExtModules() ?? {};
		for (let n of Object.keys(t)) {
			let t = `${n}_`;
			if (e.startsWith(t)) return {
				module: n,
				event: e.slice(t.length)
			};
		}
		return {
			module: null,
			event: null
		};
	}
	_handleExtCall(e, t = {}) {
		t.module === void 0 ? t.success ? this._extOnBridgeCall(e, t) : this._extOffBridgeCall(e) : this._extBridgeCall(e, t);
	}
	_extBridgeCall(e, t) {
		let { module: n, data: r = {}, success: i, fail: a, complete: o } = t, { onSuccess: s, onFail: c, onComplete: l } = this._createApiCallbacks({
			success: i,
			fail: a,
			complete: o
		}), u = this.parent?.appManager?.getExtModule(n);
		if (!u) {
			let e = `extBridge:fail module "${n}" not registered`;
			console.error(`[container] ${e}`), c?.({ errMsg: e }), l?.();
			return;
		}
		try {
			u({
				event: e,
				data: r,
				success: (e) => {
					s?.(e), l?.();
				},
				fail: (e) => {
					c?.(e), l?.();
				}
			});
		} catch (e) {
			c?.({ errMsg: `extBridge:fail ${q(e)}` }), l?.();
		}
	}
	_extOnBridgeCall(e, t) {
		let { success: n } = t, r = this.createCallbackFunction(n), { module: i, event: a } = this._parseExtEventKey(e);
		if (!i) {
			console.warn(`[container] extOnBridge:fail no registered module matched for key "${e}"`);
			return;
		}
		let o = this.parent?.appManager?.getExtModule(i);
		this._extSubscriptions.get(e)?.();
		try {
			let t = o?.({
				event: a,
				data: { isSustain: !0 },
				success: (e) => r?.(e),
				fail: (t) => console.error(`[container] extOnBridge error (${e}):`, t)
			});
			this._extSubscriptions.set(e, t ?? null);
		} catch (e) {
			console.error(`[container] extOnBridge:fail ${q(e)}`);
		}
	}
	_extOffBridgeCall(e) {
		let t = this._extSubscriptions.get(e);
		t && (t(), this._extSubscriptions.delete(e));
	}
}, Y = class {
	apps;
	_extModules;
	_containerApis;
	_openQueue;
	application;
	retentionQueued = !1;
	retention = new ee(() => this.scheduleRetention());
	configureRetention(e, t) {
		this.application = t, this.retention.configure(e);
	}
	scheduleRetention() {
		!this.retentionQueued && this.application && (this.retentionQueued = !0, this._enqueue(async () => {
			let e = this.application;
			await e._enqueue(async () => {
				this.retentionQueued = !1;
				for (let t of this.retention.collect((t) => !e.views.includes(t))) this.apps.get(t.appId) === t && await e.destroyRootView(t);
			});
		}).catch((e) => {
			this.retentionQueued = !1, console.error("[container] retention:", e);
		}));
	}
	constructor() {
		this.apps = /* @__PURE__ */ new Map(), this._extModules = {}, this._containerApis = {}, this._openQueue = Promise.resolve();
	}
	registerExtModule(e, t) {
		this._extModules[e] = t;
	}
	registerApi(e, t) {
		this._containerApis[e] = t;
		for (let n of this.apps.values()) n.registerApi(e, t);
	}
	getExtModule(e) {
		return this._extModules[e];
	}
	getExtModules() {
		return this._extModules;
	}
	openApp(e, t) {
		return this._enqueue(() => this._openApp(e, t));
	}
	_enqueue(e) {
		let t = this._openQueue.then(e);
		return this._openQueue = t.catch(() => {}), t;
	}
	async _openApp(e, t) {
		await t._enqueue(async () => {
			for (let e of this.retention.collect((e) => !t.views.includes(e))) this.apps.get(e.appId) === e && await t.destroyRootView(e);
		});
		let { appId: n, path: r, scene: i, destroy: a, restoreStack: o } = e;
		if (!n || typeof n != "string") throw Error("[container] openApp: options.appId is required");
		let s = e.resourceBaseUrl === void 0 ? void 0 : d(e.resourceBaseUrl, t.allowedOrigins), c, l;
		if (r) ({pagePath: c, query: l} = C(r));
		else if (!e.allowDefaultPath && o?.length) {
			let e = o?.[0], t = typeof e?.pagePath == "string" ? e.pagePath.replace(/^\/+/, "") : "";
			if (!t) throw Error("[container] openApp: restoreStack[0].pagePath must be a non-empty string");
			c = t, l = e.query ?? {};
		} else c = "", l = {};
		let { name: u, logo: f } = await t.getAppInfo(n) ?? {};
		if (a) {
			let e = [...this.apps.values()].filter((e) => e.appId !== n);
			for (let n of e) n.navigator.popPage()?.destroy("exit"), await t.destroyRootView(n);
		}
		let p = this.getAppById(n);
		if (p) return p.opener = e.opener ?? null, t.views.at(-1) !== p && p.queueAppShowOptions({
			scene: i ?? 1001,
			path: p.getCurrentPagePath(),
			query: p.getCurrentPageQuery(),
			referrerInfo: e.referrerInfo ?? {}
		}), await t.presentView(p, !0), p;
		let m = new J({
			appId: n,
			scene: i,
			referrerInfo: e.referrerInfo,
			opener: e.opener,
			name: u,
			logo: f,
			pagePath: c,
			query: l,
			restoreStack: o,
			resourceBaseUrl: s,
			virtualFilePrefix: t.virtualFilePrefix
		});
		for (let [e, t] of Object.entries(this._containerApis)) m.registerApi(e, t);
		return this.apps.set(m.appId, m), await t.presentView(m, !1), m;
	}
	_navigateContext(e) {
		let t = e.parent;
		if (!t || t.views[t.views.length - 1] !== e) throw Error("[container] mini program navigation requires the active mini program");
		return t;
	}
	_referrerInfo(e, t) {
		return t === void 0 ? { appId: e.appId } : {
			appId: e.appId,
			extraData: t
		};
	}
	_sameQuery(e, t) {
		let n = Object.keys(e);
		return n.length === Object.keys(t).length && n.every((n) => e[n] === t[n]);
	}
	_validateExtraData(e, t) {
		if (t !== void 0 && Object.prototype.toString.call(t) !== "[object Object]") throw Error(`[container] ${e}: options.extraData must be an object`);
	}
	navigateToMiniProgram(e, t) {
		return this._enqueue(async () => {
			let n = this._navigateContext(t);
			if (e.shortLink !== void 0 && typeof e.shortLink != "string") throw Error("[container] navigateToMiniProgram: options.shortLink must be a string");
			if (e.shortLink?.trim()) throw Error("[container] navigateToMiniProgram: shortLink is not supported by this host");
			let r = typeof e.appId == "string" ? e.appId.trim() : "";
			if (!r) throw Error("[container] navigateToMiniProgram: options.appId is required");
			if (r === t.appId) throw Error("[container] navigateToMiniProgram: cannot navigate to the current mini program");
			if (e.path !== void 0 && typeof e.path != "string") throw Error("[container] navigateToMiniProgram: options.path must be a string");
			if (e.envVersion !== void 0 && e.envVersion !== "release") throw Error(`[container] navigateToMiniProgram: envVersion ${String(e.envVersion)} is not available in this host`);
			if (e.noRelaunchIfPathUnchanged !== void 0 && typeof e.noRelaunchIfPathUnchanged != "boolean") throw Error("[container] navigateToMiniProgram: options.noRelaunchIfPathUnchanged must be a boolean");
			this._validateExtraData("navigateToMiniProgram", e.extraData);
			let i = this._referrerInfo(t, e.extraData), a = this.getAppById(r);
			if (a && e.noRelaunchIfPathUnchanged) {
				let r = e.path ? C(e.path) : {
					pagePath: a.getHomePagePath() || a.pagePath,
					query: {}
				};
				if (r.pagePath && r.pagePath === a.getCurrentPagePath() && this._sameQuery(r.query, a.getCurrentPageQuery())) return a.opener = t, a.queueAppShowOptions({
					scene: 1037,
					path: a.getCurrentPagePath(),
					query: a.getCurrentPageQuery(),
					referrerInfo: i
				}), await n.presentView(a, !0), a;
			}
			return a && (n.views.includes(a) ? await n.dismissView(a, { destroy: !0 }) : await n.destroyRootView(a)), this._openApp({
				appId: r,
				path: e.path,
				scene: 1037,
				allowDefaultPath: !0,
				referrerInfo: i,
				opener: t
			}, n);
		});
	}
	navigateBackMiniProgram(e, t, n) {
		return this._enqueue(async () => {
			let r = this._navigateContext(e);
			this._validateExtraData("navigateBackMiniProgram", t);
			let i = e.opener, a = r.views.indexOf(e), o = i ? r.views.indexOf(i) : -1;
			if (!i || o < 0 || o >= a) throw Error("[container] navigateBackMiniProgram: current mini program was not opened by another mini program");
			e.onPresentOut(), await n(), e.queueDestructionLifecycle(), await e.jscore.flushCallbacks(), i.queueAppShowOptions({
				scene: 1038,
				path: i.getCurrentPagePath(),
				query: i.getCurrentPageQuery(),
				referrerInfo: this._referrerInfo(e, t)
			}), await r.dismissView(e, { destroy: !0 });
		});
	}
	exitMiniProgram(e, t) {
		return this._enqueue(async () => {
			let n = this._navigateContext(e), r = e.opener, i = n.views.indexOf(e), a = r ? n.views.indexOf(r) : -1;
			e.onPresentOut(), await t(), e.queueDestructionLifecycle(), await e.jscore.flushCallbacks(), r && a >= 0 && a < i && r.queueAppShowOptions({
				scene: 1038,
				path: r.getCurrentPagePath(),
				query: r.getCurrentPageQuery(),
				referrerInfo: this._referrerInfo(e, void 0)
			}), await n.dismissView(e, { destroy: !0 });
		});
	}
	restartMiniProgram(e, t, n) {
		return this._enqueue(async () => {
			let r = this._navigateContext(e);
			if (typeof t != "string" || !t.trim()) throw Error("[container] restartMiniProgram: options.path is required");
			let { pagePath: i, query: a } = C(t);
			if (!i) throw Error("[container] restartMiniProgram: options.path is required");
			let o = new J({
				...e.appInfo,
				pagePath: i,
				query: a,
				restoreStack: void 0,
				opener: e.opener
			});
			for (let [t, n] of Object.entries(e.apiRegistry)) o.registerApi(t, n);
			this.apps.set(e.appId, o);
			try {
				await r.replaceView(e, o, n);
			} catch (t) {
				let n = this.apps.get(e.appId);
				(!n || n === o) && this.apps.set(e.appId, e);
				try {
					o.destroy();
				} catch {}
				throw t;
			}
			return o;
		});
	}
	getAppById(e) {
		return this.apps.get(e) ?? null;
	}
	removeApp(e) {
		this.retention.forget(e), this.apps.get(e.appId) === e && this.apps.delete(e.appId);
	}
	closeApp(e) {
		e.parent.dismissView(e, { destroy: !1 });
	}
}, X = () => new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), Z = (e, t, n = 560) => new Promise((r) => {
	let i = setTimeout(r, n), a = (n) => {
		(!t || n.propertyName === t) && (clearTimeout(i), e.removeEventListener("transitionend", a), r());
	};
	e.addEventListener("transitionend", a);
}), Ee = class {
	el;
	window;
	root;
	views;
	rootView;
	parent;
	done;
	isSleeping;
	_queue;
	shell;
	resourceBaseUrl;
	pageFrameUrl;
	virtualFilePrefix;
	allowedOrigins;
	apiNamespaces;
	urlSync;
	storageAdapter;
	getAppInfo;
	onAppLaunchError;
	appManager;
	constructor(e = {}) {
		this.root = null, this.views = [], this.rootView = null, this.parent = null, this.done = !0, this.isSleeping = !1, this._queue = Promise.resolve(), this.shell = l(e.shell), this.resourceBaseUrl = d(e.resourceBaseUrl, e.allowedOrigins), this.pageFrameUrl = f(e.pageFrameUrl, this.resourceBaseUrl, e.allowedOrigins), this.virtualFilePrefix = c(e.virtualFilePrefix), this.allowedOrigins = e.allowedOrigins, this.apiNamespaces = p(e.apiNamespaces), this.urlSync = g(e.urlSync, e.instanceKey), this.storageAdapter = b(e.storageSync), this.getAppInfo = m(e.getAppInfo), this.onAppLaunchError = e.onAppLaunchError, this.appManager = e.appManager ?? new Y(), this.init();
	}
	_enqueue(e) {
		let t = this._queue.then(() => e());
		return this._queue = t.catch(() => {}), t;
	}
	syncUrl() {
		let e = this.views[this.views.length - 1];
		if (!e) {
			this.urlSync.clear();
			return;
		}
		this.urlSync.syncStack(e.appId, e.getPageStack());
	}
	safeSyncUrl() {
		try {
			this.syncUrl();
		} catch {}
	}
	safeRestoreColorStyle(e) {
		try {
			e.restoreColorStyle();
		} catch {}
	}
	init() {
		this.el = document.createElement("div"), this.el.classList.add("dimina-application"), this.window = document.createElement("div"), this.window.classList.add("dimina-native-window"), this.el.appendChild(this.window);
	}
	initRootView(e) {
		this.rootView = e, e.parent = this, e.el.classList.add("dimina-native-view--instage"), e.el.style.zIndex = "1", this.root = e, this.window.appendChild(e.el), e.viewDidLoad?.();
	}
	presentView(e, t) {
		return this._enqueue(() => this._presentView(e, t));
	}
	async _presentView(e, t) {
		if (this.done) {
			if (this.views[this.views.length - 1] === e) {
				t && this.safeRestoreColorStyle(e), this.safeSyncUrl();
				return;
			}
			this.done = !1;
			try {
				let n = this.views[this.views.length - 1];
				e.parent = this, e.el.style.zIndex = String(this.views.length + 1), e.el.classList.add("dimina-native-view--before-present"), e.el.classList.add("dimina-native-view--enter-anima"), n?.el.classList.add("dimina-native-view--before-presenting"), n?.el.classList.remove("dimina-native-view--instage"), n?.el.classList.add("dimina-native-view--enter-anima"), n?.onPresentOut(), this.isSleeping ? e.onPresentOut() : e.onPresentIn(), !t && this.el.appendChild(e.el);
				let r = this.views.indexOf(e);
				r !== -1 && this.views.splice(r, 1), this.views.push(e), !t && e.viewDidLoad && e.viewDidLoad(), t && this.safeRestoreColorStyle(e), await X(), n?.el.classList.add("dimina-native-view--presenting"), e.el.classList.add("dimina-native-view--instage"), await Z(e.el, "transform"), e.el.classList.remove("dimina-native-view--before-present"), e.el.classList.remove("dimina-native-view--enter-anima"), n?.el.classList.remove("dimina-native-view--enter-anima"), n?.el.classList.remove("dimina-native-view--before-presenting"), this.safeSyncUrl();
			} finally {
				this.done = !0;
			}
		}
	}
	dismissView(e, t = {}) {
		return this._enqueue(() => this._dismissView(e, t));
	}
	replaceView(e, t, n = () => {}) {
		return this._enqueue(async () => {
			let r = this.views.indexOf(e);
			if (r === -1 || r !== this.views.length - 1) throw Error("[container] replaceView: current view must be active");
			t.parent = this, t.el.style.zIndex = e.el.style.zIndex, t.el.classList.add("dimina-native-view--instage"), e.onPresentOut(), e.el.parentNode?.replaceChild(t.el, e.el), this.views[r] = t;
			try {
				this.isSleeping ? t.onPresentOut() : t.onPresentIn(), await t.viewDidLoadForReplacement(), await n(), e.queueDestructionLifecycle(), await e.jscore.flushCallbacks();
			} catch (n) {
				throw this.views[r] = e, t.el.parentNode?.replaceChild(e.el, t.el), this.isSleeping || e.onPresentIn(), this.safeRestoreColorStyle(e), this.safeSyncUrl(), n;
			}
			try {
				e.destroy();
			} catch (t) {
				console.error(`[container] view.destroy() threw during replaceView cleanup for ${e.appId}:`, t);
			}
		});
	}
	async _dismissView(e, t = {}) {
		if (!this.done) return;
		let n = this.views.indexOf(e);
		if (n === -1) return;
		let { destroy: r = !0 } = t;
		if (n !== this.views.length - 1) {
			if (this.views.splice(n, 1), e.el.classList.remove("dimina-native-view--presenting", "dimina-native-view--before-presenting", "dimina-native-view--enter-anima"), r) {
				try {
					e.destroy();
				} catch (t) {
					console.error(`[container] view.destroy() threw during dismissView cleanup for ${e.appId}:`, t);
				}
				e.el.parentNode?.removeChild(e.el);
			}
			return;
		}
		this.done = !1;
		try {
			let t = this.views[this.views.length - 2], n = e;
			if (n.el.classList.add("dimina-native-view--enter-anima"), t?.el.classList.add("dimina-native-view--enter-anima"), t?.el.classList.add("dimina-native-view--before-presenting"), await X(), n.el.classList.add("dimina-native-view--before-present"), n.el.classList.remove("dimina-native-view--instage"), t?.el.classList.remove("dimina-native-view--presenting"), this.isSleeping || t?.onPresentIn(), n?.onPresentOut(), await Z(n.el, "transform"), r) {
				try {
					n.destroy();
				} catch (e) {
					console.error(`[container] view.destroy() threw during dismissView cleanup for ${n.appId}:`, e);
				}
				this.el.removeChild(n.el);
			}
			this.views.pop(), t?.el.classList.remove("dimina-native-view--enter-anima"), t?.el.classList.remove("dimina-native-view--before-presenting"), this.safeSyncUrl();
		} finally {
			this.done = !0;
		}
	}
	async destroyRootView(e) {
		try {
			e.destroy();
		} catch (t) {
			console.error(`[container] view.destroy() threw during destroyRootView for ${e.appId}:`, t);
		}
		let t = this.views.indexOf(e);
		t !== -1 && this.views.splice(t, 1), e.el.parentNode?.removeChild(e.el);
	}
	removeFailedView(e) {
		return this._enqueue(async () => {
			let t = this.views.indexOf(e), n = t !== -1 && t === this.views.length - 1;
			if (t !== -1 && this.views.splice(t, 1), e.el.parentNode?.removeChild(e.el), n) {
				let e = this.views[this.views.length - 1];
				e && (e.el.classList.remove("dimina-native-view--presenting", "dimina-native-view--before-presenting", "dimina-native-view--enter-anima"), e.el.classList.add("dimina-native-view--instage"), this.safeRestoreColorStyle(e), this.isSleeping || e.onPresentIn()), this.safeSyncUrl();
			}
		});
	}
	getActiveView() {
		return this.views[this.views.length - 1] || this.rootView;
	}
	sleepActiveView() {
		this.isSleeping || (this.isSleeping = !0, this.getActiveView()?.onPresentOut?.());
	}
	wakeActiveView() {
		if (!this.isSleeping) return;
		this.isSleeping = !1;
		let e = this.getActiveView();
		e?.restoreColorStyle?.(), e?.onPresentIn?.();
	}
	updateStatusBarColor(e) {
		this.shell.updateStatusBarColor(e);
	}
}, Q = "dimina-default-shell__status-bar";
function $(e) {
	return `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
}
function De(e = {}) {
	let { mount: t, height: n = 44, showTime: r = !0 } = e, i = document.createElement("div");
	i.className = Q, i.style.height = `${n}px`;
	let a = null;
	if (r) {
		let e = document.createElement("span");
		e.className = "dimina-default-shell__time", e.textContent = $(/* @__PURE__ */ new Date()), i.appendChild(e), a = setInterval(() => {
			e.textContent = $(/* @__PURE__ */ new Date());
		}, 1e3);
	}
	return t?.prepend(i), {
		el: i,
		getStatusBarRect: () => i.isConnected ? i.getBoundingClientRect() : {
			top: 0,
			left: 0,
			right: 0,
			width: 0,
			height: n,
			bottom: n
		},
		updateStatusBarColor: (e) => {
			e === "black" ? (i.classList.add(`${Q}--black`), i.classList.remove(`${Q}--white`)) : e === "white" && (i.classList.add(`${Q}--white`), i.classList.remove(`${Q}--black`));
		},
		destroy: () => {
			a !== null && (clearInterval(a), a = null), i.remove();
		}
	};
}
//#endregion
//#region src/index.ts
function Oe(e = {}) {
	let { mount: t, shell: n, resourceBaseUrl: r, pageFrameUrl: i, virtualFilePrefix: a, apiNamespaces: o, urlSync: s, instanceKey: c, storageSync: l, getAppInfo: u, onAppLaunchError: d, apis: f, extModules: p, allowedOrigins: m } = e;
	if (!t) throw Error("[container] createContainer: options.mount is required");
	let h = x(e.retention), g = new Y();
	for (let [e, t] of Object.entries(f ?? {})) g.registerApi(e, t);
	for (let [e, t] of Object.entries(p ?? {})) g.registerExtModule(e, t);
	let _ = new Ee({
		shell: n,
		resourceBaseUrl: r,
		pageFrameUrl: i,
		virtualFilePrefix: a,
		apiNamespaces: o,
		urlSync: s,
		instanceKey: c,
		storageSync: l,
		getAppInfo: u,
		onAppLaunchError: d,
		appManager: g,
		allowedOrigins: m
	});
	return g.configureRetention(h, _), t.appendChild(_.el), {
		application: _,
		configureRetention: (e) => g.configureRetention(e, _),
		notifyMemoryPressure: () => g.retention.memoryPressure(),
		openApp(e) {
			return g.openApp(e, _);
		},
		closeApp(e) {
			let t = e ?? _.views[_.views.length - 1];
			t && g.closeApp(t);
		},
		sendDevCommand(e, t, n) {
			let r = _.views[_.views.length - 1]?.navigator.top;
			return r ? r.sendDevCommand(e, t ?? {}, n) : !1;
		},
		registerExtModule(e, t) {
			g.registerExtModule(e, t);
		},
		registerApi(e, t) {
			g.registerApi(e, t);
		},
		setRootView(e) {
			_.initRootView(e);
		}
	};
}
//#endregion
export { t as QueryRouter, Oe as createContainer, De as createDefaultShell };
