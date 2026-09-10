//#region ../../packages/common/dist/common.js
function e(e) {
	return typeof e == "function";
}
function t() {
	return Math.random().toString(36).slice(2, 7);
}
var n = typeof window < "u" && typeof navigator < "u";
n && /Android/i.test(navigator.userAgent), n && /iPad|iPhone|iPod/.test(navigator.userAgent), n && /OpenHarmony|harmony/.test(navigator.userAgent), n && /Android|iPad|iPhone|iPod|OpenHarmony|harmony|Mobile/.test(navigator.userAgent), typeof WorkerGlobalScope < "u" && globalThis instanceof WorkerGlobalScope;
var r = {}, i = 1, a = 2;
function o(e, t) {
	r[e] || (r[e] = {
		factory: t,
		status: i,
		exports: void 0
	});
}
function s(t, n, o) {
	if (typeof t != "string") throw TypeError("require args must be a string");
	let c = r[t];
	if (!c) throw Error(`module ${t} not found`);
	if (c.status === i) {
		c.status = a;
		let n = { exports: {} }, r;
		try {
			c.factory && (r = c.factory.call(null, s, n, n.exports));
		} catch (n) {
			c.status = i;
			let r = `
				name: ${n.name}
				msg: ${n.message}
				stack:
				${n.stack}
			`;
			console.error(`require ${t} error: ${r}`), e(globalThis.__diminaReportError) && globalThis.__diminaReportError(n), e(o) && o({
				mod: t,
				errMsg: n.message
			});
		}
		c.exports = n.exports === void 0 ? r : n.exports;
	}
	return e(n) && n(c.exports), c.exports;
}
s.async = async (e) => new Promise((t, n) => {
	try {
		t(s(e));
	} catch (t) {
		n(/* @__PURE__ */ Error(`${t.message}: Failed to initialize asynchronous loading for module '${e}'`));
	}
}), new class {
	constructor() {
		this.callbacks = {};
	}
	store(e, n, r = t()) {
		if (n) {
			for (let [t, n] of Object.entries(this.callbacks)) if (n.callback === e) return t;
		}
		return this.callbacks[r] = {
			callback: e,
			keep: n
		}, r;
	}
	invoke(t, n) {
		if (t === void 0) return;
		let r = this.callbacks[t];
		r && e(r.callback) && (r.keep || delete this.callbacks[t], r.callback(n));
	}
	remove(e) {
		e ? Object.keys(this.callbacks).forEach((t) => {
			e === t && delete this.callbacks[t];
		}) : Object.entries(this.callbacks).forEach(([e, t]) => {
			t.keep && delete this.callbacks[e];
		});
	}
}();
var c = 33554432;
c / 4, Math.floor(c / 4 / 4);
//#endregion
//#region ../../packages/render/dist/render.js
function l(e, t) {
	typeof Array.prototype[e] != "function" && Object.defineProperty(Array.prototype, e, {
		value: t,
		configurable: !0,
		writable: !0
	});
}
l("toReversed", function() {
	return Array.prototype.slice.call(this).reverse();
}), l("toSorted", function(e) {
	return Array.prototype.slice.call(this).sort(e);
}), l("toSpliced", function(...e) {
	let t = Array.prototype.slice.call(this);
	return t.splice(...e), t;
});
function u(e) {
	return typeof e == "function";
}
function d(e, t) {
	if (e === t) return !0;
	if (typeof e != "object" || typeof t != "object" || e == null || t == null) return !1;
	let n = Object.keys(e), r = Object.keys(t);
	return n.length === r.length && n.every((n) => d(e[n], t[n]));
}
function f(e, t) {
	return Object.prototype.hasOwnProperty.call(e, t);
}
function p(e) {
	return e === "__proto__";
}
function m(e) {
	switch (typeof e) {
		case "number":
		case "symbol": return !1;
		case "string": return e.includes(".") || e.includes("[") || e.includes("]");
	}
}
function h(e, t = 2 ** 53 - 1) {
	switch (typeof e) {
		case "number": return Number.isInteger(e) && e >= 0 && e < t;
		case "symbol": return !1;
		case "string": return /^(?:0|[1-9]\d*)$/.test(e);
	}
}
function g(e) {
	return e !== null && (typeof e == "object" || typeof e == "function");
}
function _(e) {
	return typeof e == "symbol" || Object.prototype.toString.call(e) === "[object Symbol]";
}
function v(e, t) {
	return e === t || Number.isNaN(e) && Number.isNaN(t);
}
function y(e) {
	return typeof e == "string" || typeof e == "symbol" ? e : Object.is(e?.valueOf?.(), -0) ? "-0" : String(e);
}
function b(e) {
	if (Array.isArray(e)) return e.map(y);
	if (typeof e == "symbol") return [e];
	e = x(e);
	let t = [], n = e.length;
	if (n === 0) return t;
	let r = 0, i = "", a = "", o = !1;
	for (e.charCodeAt(0) === 46 && (t.push(""), r++); r < n;) {
		let s = e[r];
		a ? s === "\\" && r + 1 < n ? (r++, i += e[r]) : s === a ? a = "" : i += s : o ? s === "\"" || s === "'" ? a = s : s === "]" ? (o = !1, t.push(i), i = "") : i += s : s === "[" ? (o = !0, i &&= (t.push(i), "")) : s === "." ? i &&= (t.push(i), "") : i += s, r++;
	}
	return i && t.push(i), t;
}
function x(e) {
	if (e == null) return "";
	if (typeof e == "string") return e;
	if (Array.isArray(e)) return e.map(x).join(",");
	let t = String(e);
	return t === "0" && Object.is(Number(e), -0) ? "-0" : t;
}
function S(e, t) {
	return Array.isArray(e) ? !1 : typeof e == "number" || typeof e == "boolean" || e == null || _(e) ? !0 : typeof e == "string" && (/^\w*$/.test(e) || !/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/.test(e)) || t != null && f(t, e);
}
function C(e, t, n) {
	if (t.length === 0) return n;
	let r = e;
	for (let e = 0; e < t.length; e++) {
		if (r == null || p(t[e])) return n;
		r = r[t[e]];
	}
	return r === void 0 ? n : r;
}
function w(e, t) {
	if (e != null) switch (typeof t) {
		case "string": {
			if (p(t)) return;
			let n = e[t];
			return n === void 0 ? m(t) ? w(e, b(t)) : void 0 : n;
		}
		case "number":
		case "symbol": {
			typeof t == "number" && (t = y(t));
			let n = e[t];
			return n === void 0 ? void 0 : n;
		}
		default: {
			if (Array.isArray(t)) return C(e, t);
			if (t = Object.is(t?.valueOf(), -0) ? "-0" : String(t), p(t)) return;
			let n = e[t];
			return n === void 0 ? void 0 : n;
		}
	}
}
function T(e, t, n) {
	E(e, t, () => n, () => void 0);
}
function E(e, t, n, r) {
	if (e == null && !g(e)) return e;
	let i;
	i = S(t, e) ? [t] : Array.isArray(t) ? t : b(t);
	let a = n(w(e, i)), o = e;
	for (let t = 0; t < i.length && o != null; t++) {
		let n = y(i[t]);
		if (p(n)) continue;
		let s;
		if (t === i.length - 1) s = a;
		else {
			let a = o[n], c = r?.(a, n, e);
			s = c === void 0 ? g(a) ? a : h(i[t + 1]) ? [] : {} : c;
		}
		ee(o, n, s), o = o[n];
	}
	return e;
}
function ee(e, t, n) {
	let r = e[t];
	(!(f(e, t) && v(r, n)) || n === void 0 && !(t in e)) && (e[t] = n);
}
function D() {
	return Math.random().toString(36).slice(2, 7);
}
function te(e) {
	return e.toLowerCase().replace(/-(.)/g, (e, t) => t.toUpperCase());
}
function ne(e, t) {
	if (!e) return;
	let n = {};
	for (let r in e) {
		if (!r.startsWith("data-")) continue;
		let i = te(r.replace(/^data-/, ""));
		n[i] = t(e[r]);
	}
	return n;
}
var O = typeof window < "u" && typeof navigator < "u", re = O && /Android/i.test(navigator.userAgent), k = O && /iPad|iPhone|iPod/.test(navigator.userAgent);
O && /OpenHarmony|harmony/.test(navigator.userAgent), O && /Android|iPad|iPhone|iPod|OpenHarmony|harmony|Mobile/.test(navigator.userAgent), typeof WorkerGlobalScope < "u" && globalThis instanceof WorkerGlobalScope;
function A(e) {
	if (typeof e != "object" || !e) return e;
	let t = /* @__PURE__ */ new WeakMap();
	function n(e) {
		if (typeof e != "object" || !e) return e;
		if (e instanceof Date) return new Date(e);
		if (e instanceof RegExp) return new RegExp(e.source, e.flags);
		if (Array.isArray(e)) {
			if (t.has(e)) return t.get(e);
			let r = [];
			return t.set(e, r), r.push(...e.map(n)), r;
		}
		if (t.has(e)) return t.get(e);
		let r = Object.create(Object.getPrototypeOf(e));
		return t.set(e, r), Object.assign(r, ...Object.keys(e).map((t) => ({ [t]: n(e[t]) })));
	}
	return n(e);
}
var ie = {}, ae = 1, oe = 2;
function se(e, t, n) {
	if (typeof e != "string") throw TypeError("require args must be a string");
	let r = ie[e];
	if (!r) throw Error(`module ${e} not found`);
	if (r.status === ae) {
		r.status = oe;
		let t = { exports: {} }, i;
		try {
			r.factory && (i = r.factory.call(null, se, t, t.exports));
		} catch (t) {
			r.status = ae;
			let i = `
				name: ${t.name}
				msg: ${t.message}
				stack:
				${t.stack}
			`;
			console.error(`require ${e} error: ${i}`), u(globalThis.__diminaReportError) && globalThis.__diminaReportError(t), u(n) && n({
				mod: e,
				errMsg: t.message
			});
		}
		r.exports = t.exports === void 0 ? i : t.exports;
	}
	return u(t) && t(r.exports), r.exports;
}
se.async = async (e) => new Promise((t, n) => {
	try {
		t(se(e));
	} catch (t) {
		n(/* @__PURE__ */ Error(`${t.message}: Failed to initialize asynchronous loading for module '${e}'`));
	}
});
var ce = new class {
	constructor() {
		this.callbacks = {};
	}
	store(e, t, n = D()) {
		if (t) {
			for (let [t, n] of Object.entries(this.callbacks)) if (n.callback === e) return t;
		}
		return this.callbacks[n] = {
			callback: e,
			keep: t
		}, n;
	}
	invoke(e, t) {
		if (e === void 0) return;
		let n = this.callbacks[e];
		n && u(n.callback) && (n.keep || delete this.callbacks[e], n.callback(t));
	}
	remove(e) {
		e ? Object.keys(this.callbacks).forEach((t) => {
			e === t && delete this.callbacks[t];
		}) : Object.entries(this.callbacks).forEach(([e, t]) => {
			t.keep && delete this.callbacks[e];
		});
	}
}(), j = "dd-canvas-contract-change", le = "__ddCanvasNode", ue = 33554432, de = 4096, fe = ue / 4, pe = Math.floor(ue / 4 / 4);
function me(e) {
	let t = Number(e);
	if (!Number.isFinite(t)) return null;
	let n = Math.abs(Math.trunc(t));
	return Number.isSafeInteger(n) ? n : null;
}
function he(e, t, { allowZero: n = !1, transferable: r = !1 } = {}) {
	let i = me(e), a = me(t);
	return i === null || a === null ? "pixel dimensions must be finite non-zero safe integers" : i > 4096 || a > 4096 ? r ? "pixel dimensions exceed the maximum transferable pixel data" : "pixel dimensions exceed the maximum canvas bitmap" : i === 0 || a === 0 ? n ? null : "pixel dimensions must be finite non-zero safe integers" : i > Math.floor((r ? pe : 8388608) / a) ? r ? "pixel dimensions exceed the maximum transferable pixel data" : "pixel dimensions exceed the maximum canvas bitmap" : null;
}
var ge = "__dimina_data_function_reference__", _e = 1;
function M(e) {
	return {
		[ge]: e,
		version: _e
	};
}
function ve(e) {
	return typeof e == "object" && !!e && e.version === _e && typeof e[ge] == "string" && Object.keys(e).length === 2;
}
function ye(e) {
	return ve(e) ? e[ge] : void 0;
}
function be(e, { mapFunction: t, mapReference: n } = {}, r = /* @__PURE__ */ new WeakMap()) {
	if (typeof e == "function") return t ? t(e) : e;
	if (typeof e != "object" || !e) return e;
	if (ve(e)) return n ? n(e) : e;
	if (e instanceof Date || e instanceof RegExp || e instanceof ArrayBuffer || ArrayBuffer.isView(e)) return e;
	if (!Array.isArray(e)) {
		let t = Object.getPrototypeOf(e);
		if (t !== Object.prototype && t !== null) return e;
	}
	if (r.has(e)) return r.get(e);
	let i = Array.isArray(e) ? [] : {};
	r.set(e, i);
	for (let a of Object.keys(e)) i[a] = be(e[a], {
		mapFunction: t,
		mapReference: n
	}, r);
	return i;
}
var xe = /* @__PURE__ */ new Set([
	String,
	Number,
	Boolean,
	Object,
	Array,
	null
]);
function Se(e) {
	return xe.has(e);
}
function Ce(e) {
	return e === String ? "" : e === Number ? 0 : e === Boolean ? !1 : e === Array ? [] : null;
}
function we(e) {
	return Array.isArray(e) ? e.filter(Se) : [];
}
function Te(e) {
	let t, n = [], r;
	return Se(e) ? t = e : e && typeof e == "object" && (t = e.type, n = we(e.optionalTypes), r = e.value), Se(t) || (t = n[0] ?? null), r === void 0 && (r = Ce(t)), {
		type: t,
		optionalTypes: n,
		value: A(r)
	};
}
function Ee(e) {
	return Array.isArray(e);
}
function De(e) {
	return Ee(e) && e?.constructor?.name === Array.name;
}
function Oe(e, t) {
	return e === String ? typeof t == "string" : e === Number ? Number.isFinite(t) : e === Boolean ? typeof t == "boolean" : e === Object ? t !== null && t?.constructor === Object : e === Array ? De(t) : t !== void 0;
}
function ke(e, t) {
	typeof e == "function" && e(t);
}
function Ae(e, t, { absent: n = !1, warn: r } = {}) {
	if (n) return A(e.value);
	for (let n of e.optionalTypes || []) if (Oe(n, t)) return t;
	let i = e.type;
	if (i === String) return t == null ? (ke(r, "property received type-uncompatible value: expected <String> but get null value. Used empty string instead."), "") : (typeof t == "object" && ke(r, "property received type-uncompatible value: expected <String> but got object-typed value. Forcely converted."), String(t));
	if (i === Number) {
		try {
			if (Number.isFinite(Number(t))) return Number(t);
		} catch {}
		return ke(r, `property received type-uncompatible value: expected <Number> but ${typeof t == "number" ? "got NaN or Infinity" : "got non-number value"}. Used 0 instead.`), 0;
	}
	return i === Boolean ? !!t : i === Array ? Ee(t) ? t : (ke(r, "property received type-uncompatible value: expected <Array> but got non-array value. Used empty array instead."), []) : i === Object ? typeof t == "object" ? t : (ke(r, "property received type-uncompatible value: expected <Object> but got non-object value. Used null instead."), null) : t === void 0 ? null : t;
}
function je(e, t = {}, { isAbsent: n, warn: r } = {}) {
	let i = {};
	for (let [a, o] of Object.entries(e || {})) {
		let e = typeof n == "function" ? n(a) : !Object.prototype.hasOwnProperty.call(t, a);
		i[a] = Ae(o, t[a], {
			absent: e,
			warn: r
		});
	}
	return i;
}
function Me(e) {
	return {
		all: e ||= /* @__PURE__ */ new Map(),
		on: function(t, n) {
			var r = e.get(t);
			r ? r.push(n) : e.set(t, [n]);
		},
		off: function(t, n) {
			var r = e.get(t);
			r && (n ? r.splice(r.indexOf(n) >>> 0, 1) : e.set(t, []));
		},
		emit: function(t, n) {
			var r = e.get(t);
			r && r.slice().map(function(e) {
				e(n);
			}), (r = e.get("*")) && r.slice().map(function(e) {
				e(t, n);
			});
		}
	};
}
var Ne = /* @__PURE__ */ new Map();
function Pe(e) {
	if (Ne.has(e)) return Ne.get(e);
	let t = function() {};
	return Object.defineProperty(t, "toJSON", { value: () => M(e) }), Ne.set(e, t), t;
}
function Fe(e) {
	return be(e, { mapReference(e) {
		return Pe(ye(e));
	} });
}
var N = new class e {
	constructor() {
		this.event = Me(), this.pendingWaitData = /* @__PURE__ */ new Map(), this.pendingWaiters = /* @__PURE__ */ new Map(), this.init();
	}
	init() {
		window.DiminaRenderBridge || (window.DiminaRenderBridge = {}), window.DiminaRenderBridge.onMessage = (e) => {
			let t = Fe(e);
			console.log("[system]", "[render]", "receive msg: ", t);
			let { type: n, body: r } = t, i = this.pendingWaiters.get(n);
			if (i?.length) {
				this.pendingWaiters.delete(n);
				for (let e of i) e(r?.data);
			} else this.event.emit(n, r);
		};
	}
	on(e, t) {
		this.event.on(e, t);
	}
	send(e) {
		window.DiminaRenderBridge.publish(JSON.stringify(e));
	}
	invoke(t) {
		return re || k ? e.prototype.invoke = function(e) {
			window.DiminaRenderBridge.invoke(JSON.stringify(e));
		} : e.prototype.invoke = function(e) {
			window.DiminaRenderBridge.invoke(e);
		}, this.invoke(t);
	}
	off(e, t) {
		this.event.off(e, t);
	}
	wait(e) {
		if (this.pendingWaitData.has(e)) {
			let t = this.pendingWaitData.get(e);
			return this.pendingWaitData.delete(e), Promise.resolve(t);
		}
		return new Promise((t) => {
			let n = this.pendingWaiters.get(e) || [];
			n.push(t), this.pendingWaiters.set(e, n);
		});
	}
	resolveWait(e, t) {
		let n = this.pendingWaiters.get(e);
		if (n?.length) {
			this.pendingWaiters.delete(e);
			for (let e of n) e(t);
			return;
		}
		this.pendingWaitData.set(e, t);
	}
	waitAndSend(e, t) {
		let n = this.wait(e);
		return this.send(t), n;
	}
}(), Ie = "__dmcc_hmr", Le = 1e4;
function Re() {
	return /* @__PURE__ */ new Map();
}
var ze = Re();
function Be({ scope: e, pagePath: t }) {
	return e === "app" ? "style:app" : `style:page:${t}`;
}
function Ve(e, { scope: t, pagePath: n, appId: r, url: i, el: a }) {
	e.set(Be({
		scope: t,
		pagePath: n
	}), {
		scope: t,
		pagePath: n,
		appId: r,
		url: i,
		el: a
	});
}
function He(e, t) {
	return `${e}${e.includes("?") ? "&" : "?"}${Ie}=${t}`;
}
function Ue(e, t) {
	return new Promise((n, r) => {
		let i = document.createElement("link");
		i.rel = "stylesheet", i.href = e;
		let a = (t) => {
			clearTimeout(o), i.onload = null, i.onerror = null, t ? n(i) : (i.remove(), r(/* @__PURE__ */ Error(`stylesheet load failed: ${e}`)));
		};
		i.onload = () => a(!0), i.onerror = () => a(!1);
		let o = setTimeout(() => a(!1), t);
		document.head.append(i);
	});
}
async function We(e, { scope: t, pagePath: n, buildId: r }) {
	let i = Be({
		scope: t,
		pagePath: n
	}), a = e.get(i);
	if (!a) return {
		applied: !1,
		reason: "unknown-style-resource"
	};
	let o;
	try {
		o = await Ue(He(a.url, r), Le);
	} catch {
		return {
			applied: !1,
			reason: "style-load-failed"
		};
	}
	return a.el?.remove(), Ve(e, {
		scope: t,
		pagePath: n,
		appId: a.appId,
		url: a.url,
		el: o
	}), { applied: !0 };
}
async function Ge(e, { buildId: t, affectedPages: n }) {
	let r = [{ scope: "app" }, ...n.map((e) => ({
		scope: "page",
		pagePath: e
	}))], i = [];
	for (let n of r) {
		let r = await We(e, {
			...n,
			buildId: t
		});
		i.push({
			...n,
			...r
		});
	}
	return i;
}
var Ke = {
	s: String,
	n: Number,
	b: Boolean,
	o: Object,
	a: Array
}, qe = class {
	constructor(e) {
		this.moduleInfo = e;
	}
	setInitialData(e) {
		this.builtinBehaviors = new Set(e?.__diminaMeta?.builtinBehaviors || []);
		let t = e && { ...e };
		t && delete t.__diminaMeta;
		let { propertySchemas: n, vueProps: r } = this.unSerializeProps(t);
		this.propertySchemas = n, this.props = r;
	}
	unSerializeProps(e) {
		if (!e) return {
			propertySchemas: {},
			vueProps: {}
		};
		let t = {}, n = {};
		for (let r in e) {
			let i = e[r], a = (Array.isArray(i.type) ? i.type : [i.type]).map((e) => this.convertStringToType(e));
			t[r] = Te({
				type: a[0],
				optionalTypes: a.slice(1),
				value: i.default
			}), n[r] = { type: null }, i.cls && (n[r].cls = !0);
		}
		return {
			propertySchemas: t,
			vueProps: n
		};
	}
	convertStringToType(e) {
		if (e === null) return null;
		let t = Ke[e];
		return t || console.warn("[system]", "[render]", `unknown props type ${e}`), t;
	}
}, Je = new class {
	constructor() {
		this.staticModules = {}, this.lastHmrBuildId = 0, this.hmrCapture = null, this.resourceContext = null;
	}
	async loadResource(e) {
		let { bridgeId: t, appId: n, pagePath: r, root: i, baseUrl: a, resourceLoadId: o, runtimeType: s } = e;
		if (s === "game") return this.reportResourceLoaded({
			bridgeId: t,
			resourceLoadId: o
		}), !0;
		this.resourceContext = {
			appId: n,
			root: i,
			baseUrl: a
		};
		let c = r.replace(/\//g, "_"), l = `${a}${n}/main/app.css`, u = `${a}${n}/${i}/${c}.css`, d = `${a}${n}/${i}/${c}.js`, f = (await Promise.allSettled([
			this.loadStyleFile(l, {
				scope: "app",
				appId: n
			}),
			this.loadStyleFile(u, {
				scope: "page",
				appId: n,
				pagePath: r
			}),
			this.loadScriptFile(d)
		])).filter((e) => e.status === "rejected").map((e) => e.reason instanceof Error ? e.reason.message : String(e.reason));
		if (f.length) return this.reportResourceLoadFailed({
			bridgeId: t,
			pagePath: r,
			errors: f,
			resourceLoadId: o
		}), !1;
		try {
			window.modRequire(r);
		} catch (e) {
			return this.reportResourceLoadFailed({
				bridgeId: t,
				pagePath: r,
				resourceLoadId: o,
				errors: [e instanceof Error ? e.message : String(e)]
			}), !1;
		}
		return this.reportResourceLoaded({
			bridgeId: t,
			resourceLoadId: o
		}), !0;
	}
	reportResourceLoaded({ bridgeId: e, resourceLoadId: t }) {
		N.invoke({
			type: "renderResourceLoaded",
			target: "service",
			body: {
				bridgeId: e,
				resourceLoadId: t
			}
		});
	}
	reportResourceLoadFailed({ bridgeId: e, pagePath: t, errors: n, resourceLoadId: r }) {
		console.error("[system]", "[render]", `资源加载失败: ${n.join("; ")}`), N.invoke({
			type: "renderResourceLoadFailed",
			target: "service",
			body: {
				bridgeId: e,
				resourceLoadId: r,
				pagePath: t,
				errors: n
			}
		});
	}
	loadStyleFile(e, t) {
		return new Promise((n, r) => {
			let i = document.createElement("link");
			i.rel = "stylesheet", i.href = e, t && Ve(ze, {
				...t,
				url: e,
				el: i
			}), i.onload = () => {
				n();
			}, i.onerror = () => {
				r(/* @__PURE__ */ Error(`样式文件加载失败: ${e}`));
			}, document.head.append(i);
		});
	}
	loadScriptFile(e) {
		return new Promise((t, n) => {
			let r = document.createElement("script");
			r.src = e, r.onload = () => {
				t();
			}, r.onerror = () => {
				n(/* @__PURE__ */ Error(`脚本文件加载失败: ${e}`));
			}, document.head.append(r);
		});
	}
	async reloadViewModule(e, t) {
		let n = this.resourceContext;
		if (!n) throw Error("render resource context is unavailable");
		if (!Number.isInteger(t) || t <= this.lastHmrBuildId) throw Error("stale-build-id");
		let r = e.replace(/\//g, "_"), i = `${n.baseUrl}${n.appId}/${n.root}/${r}.js`, a = i.includes("?") ? "&" : "?";
		this.hmrCapture = {
			path: e,
			moduleInfo: null
		};
		try {
			await this.loadScriptFile(`${i}${a}__dmcc_hmr=${t}`), window.modRequire(e);
			let n = this.hmrCapture.moduleInfo;
			if (!n) throw Error("view module did not register during HMR load");
			return n;
		} finally {
			this.hmrCapture = null;
		}
	}
	replaceModule(e, t, n) {
		if (typeof e != "string" || e.length === 0 || !t || t.path !== e) return {
			committed: !1,
			reason: "invalid-module",
			rollback: () => !1,
			previous: null
		};
		if (!Number.isInteger(n) || n <= this.lastHmrBuildId) return {
			committed: !1,
			reason: "stale-build-id",
			rollback: () => !1,
			previous: this.staticModules[e] || null
		};
		let r = this.staticModules[e] || null;
		try {
			this.resolveComponents(t);
		} catch (e) {
			return {
				committed: !1,
				reason: "dependency-resolution-failed",
				error: e,
				rollback: () => !1,
				previous: r
			};
		}
		let i = new qe(t);
		this.staticModules[e] = i, this.lastHmrBuildId = n;
		let a = !0;
		return {
			committed: !0,
			previous: r,
			rollback: () => !a || this.staticModules[e] !== i ? !1 : (r ? this.staticModules[e] = r : delete this.staticModules[e], a = !1, !0)
		};
	}
	resolveComponents(e) {
		let { usingComponents: t = {}, componentPlaceholder: n = {} } = e;
		for (let [e, r] of Object.entries(t)) try {
			window.modRequire(r);
		} catch (r) {
			let i = n[e], a = i && t[i];
			if (!a) throw r;
			window.modRequire(a);
		}
	}
	createModule(e) {
		let { path: t, usingComponents: n, componentPlaceholder: r = {} } = e;
		if (this.staticModules[t]) {
			this.hmrCapture?.path === t && (this.hmrCapture.moduleInfo = e);
			return;
		}
		this.hmrCapture?.path === t && (this.hmrCapture.moduleInfo = e), this.staticModules[t] = new qe(e);
		for (let [e, t] of Object.entries(n)) try {
			window.modRequire(t);
		} catch (t) {
			let i = r[e], a = i && n[i];
			if (!a) throw t;
			window.modRequire(a);
		}
	}
	setInitialData(e) {
		for (let [t, n] of Object.entries(e)) {
			if (!n) continue;
			let e = this.staticModules[t];
			e && e.setInitialData(n);
		}
	}
	getModuleByPath(e) {
		return this.staticModules[e];
	}
}(), Ye = new class {
	constructor() {
		this.init();
	}
	init() {
		window.Module = (e) => Je.createModule(e);
	}
}(), Xe = /* @__PURE__ */ new Set(["L2", "L3"]);
function Ze() {
	return {
		enabled: !1,
		lastAcceptedBuildId: 0
	};
}
function Qe(e, t = {}) {
	e.enabled = !0, Number.isFinite(t.buildId) && t.buildId > e.lastAcceptedBuildId && (e.lastAcceptedBuildId = t.buildId);
}
function $e(e, t) {
	if (!e.enabled) return {
		accepted: !1,
		reason: "hmr-disabled"
	};
	if (!t || typeof t != "object") return {
		accepted: !1,
		reason: "invalid-envelope"
	};
	let { level: n, buildId: r, affectedPages: i } = t;
	return Xe.has(n) ? !Number.isInteger(r) || r <= 0 ? {
		accepted: !1,
		reason: "invalid-build-id"
	} : r <= e.lastAcceptedBuildId ? {
		accepted: !1,
		reason: "stale-build-id"
	} : Array.isArray(i) ? (e.lastAcceptedBuildId = r, {
		accepted: !0,
		payload: t
	}) : {
		accepted: !1,
		reason: "invalid-envelope"
	} : {
		accepted: !1,
		reason: "invalid-level"
	};
}
// @__NO_SIDE_EFFECTS__
function et(e) {
	let t = /* @__PURE__ */ Object.create(null);
	for (let n of e.split(",")) t[n] = 1;
	return (e) => e in t;
}
var P = {}, tt = [], nt = () => {}, rt = () => !1, it = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), at = (e) => e.startsWith("onUpdate:"), ot = Object.assign, st = (e, t) => {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}, ct = Object.prototype.hasOwnProperty, F = (e, t) => ct.call(e, t), I = Array.isArray, lt = (e) => _t(e) === "[object Map]", ut = (e) => _t(e) === "[object Set]", dt = (e) => _t(e) === "[object Date]", L = (e) => typeof e == "function", ft = (e) => typeof e == "string", pt = (e) => typeof e == "symbol", mt = (e) => typeof e == "object" && !!e, ht = (e) => (mt(e) || L(e)) && L(e.then) && L(e.catch), gt = Object.prototype.toString, _t = (e) => gt.call(e), vt = (e) => _t(e).slice(8, -1), yt = (e) => _t(e) === "[object Object]", bt = (e) => ft(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, xt = /* @__PURE__ */ et(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), St = (e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
}, Ct = /-\w/g, wt = St((e) => e.replace(Ct, (e) => e.slice(1).toUpperCase())), Tt = /\B([A-Z])/g, Et = St((e) => e.replace(Tt, "-$1").toLowerCase()), Dt = St((e) => e.charAt(0).toUpperCase() + e.slice(1)), Ot = St((e) => e ? `on${Dt(e)}` : ""), kt = (e, t) => !Object.is(e, t), At = (e, ...t) => {
	for (let n = 0; n < e.length; n++) e[n](...t);
}, jt = (e, t, n, r = !1) => {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		writable: r,
		value: n
	});
}, Mt = (e) => {
	let t = parseFloat(e);
	return isNaN(t) ? e : t;
}, Nt = (e) => {
	let t = ft(e) ? Number(e) : NaN;
	return isNaN(t) ? e : t;
}, Pt, Ft = () => Pt ||= typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
function It(e) {
	if (I(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) {
			let r = e[n], i = ft(r) ? Bt(r) : It(r);
			if (i) for (let e in i) t[e] = i[e];
		}
		return t;
	}
	if (ft(e) || mt(e)) return e;
}
var Lt = /;(?![^(]*\))/g, Rt = /:([^]+)/, zt = /\/\*[^]*?\*\//g;
function Bt(e) {
	let t = {};
	return e.replace(zt, "").split(Lt).forEach((e) => {
		if (e) {
			let n = e.split(Rt);
			n.length > 1 && (t[n[0].trim()] = n[1].trim());
		}
	}), t;
}
function Vt(e) {
	let t = "";
	if (ft(e)) t = e;
	else if (I(e)) for (let n = 0; n < e.length; n++) {
		let r = Vt(e[n]);
		r && (t += r + " ");
	}
	else if (mt(e)) for (let n in e) e[n] && (t += n + " ");
	return t.trim();
}
function Ht(e) {
	if (!e) return null;
	let { class: t, style: n } = e;
	return t && !ft(t) && (e.class = Vt(t)), n && (e.style = It(n)), e;
}
var Ut = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", Wt = /* @__PURE__ */ et(Ut);
Ut + "";
function Gt(e) {
	return !!e || e === "";
}
function Kt(e, t) {
	if (e.length !== t.length) return !1;
	let n = !0;
	for (let r = 0; n && r < e.length; r++) n = Jt(e[r], t[r]);
	return n;
}
function qt(e, t) {
	if (e.size !== t.size) return !1;
	let n = Array.from(t), r = new Uint8Array(n.length);
	for (let t of e) {
		let e = -1;
		for (let i = 0; i < n.length; i++) if (!r[i] && Jt(t, n[i])) {
			e = i;
			break;
		}
		if (e < 0) return !1;
		r[e] = 1;
	}
	return !0;
}
function Jt(e, t) {
	if (e === t) return !0;
	let n = dt(e), r = dt(t);
	if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
	if (n = pt(e), r = pt(t), n || r) return e === t;
	if (n = I(e), r = I(t), n || r) return n && r ? Kt(e, t) : !1;
	if (n = mt(e), r = mt(t), n || r) {
		if (!n || !r) return !1;
		if (n = lt(e), r = lt(t), n || r || (n = ut(e), r = ut(t), n || r)) return n && r ? qt(e, t) : !1;
		if (Object.keys(e).length !== Object.keys(t).length) return !1;
		for (let n in e) {
			let r = e.hasOwnProperty(n), i = t.hasOwnProperty(n);
			if (r && !i || !r && i || !Jt(e[n], t[n])) return !1;
		}
	}
	return String(e) === String(t);
}
var Yt = (e) => !!(e && e.__v_isRef === !0), Xt = (e) => ft(e) ? e : e == null ? "" : I(e) || mt(e) && (e.toString === gt || !L(e.toString)) ? Yt(e) ? Xt(e.value) : JSON.stringify(e, Zt, 2) : String(e), Zt = (e, t) => Yt(t) ? Zt(e, t.value) : lt(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((e, [t, n], r) => (e[Qt(t, r) + " =>"] = n, e), {}) } : ut(t) ? { [`Set(${t.size})`]: [...t.values()].map((e) => Qt(e)) } : pt(t) ? Qt(t) : mt(t) && !I(t) && !yt(t) ? String(t) : t, Qt = (e, t = "") => pt(e) ? `Symbol(${e.description ?? t})` : e;
function $t(e) {
	return e == null ? "initial" : typeof e == "string" ? e === "" ? " " : e : String(e);
}
var en, tn = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !e && en && (en.active ? (this.parent = en, this.index = (en.scopes || (en.scopes = [])).push(this) - 1) : (this._active = !1, this._warnOnRun = !1));
	}
	get active() {
		return this._active;
	}
	pause() {
		if (this._active) {
			this._isPaused = !0;
			let e, t;
			if (this.scopes) {
				let n = this.scopes.slice();
				for (e = 0, t = n.length; e < t; e++) n[e].pause();
			}
			for (e = 0, t = this.effects.length; e < t; e++) this.effects[e].pause();
		}
	}
	resume() {
		if (this._active && this._isPaused) {
			this._isPaused = !1;
			let e, t;
			if (this.scopes) {
				let n = this.scopes.slice();
				for (e = 0, t = n.length; e < t; e++) n[e].resume();
			}
			let n = this.effects.slice();
			for (e = 0, t = n.length; e < t; e++) n[e].resume();
		}
	}
	run(e) {
		if (this._active) {
			let t = en;
			try {
				return en = this, e();
			} finally {
				en = t;
			}
		}
	}
	on() {
		++this._on === 1 && (this.prevScope = en, en = this);
	}
	off() {
		if (this._on > 0 && --this._on === 0) {
			if (en === this) en = this.prevScope;
			else {
				let e = en;
				for (; e;) {
					if (e.prevScope === this) {
						e.prevScope = this.prevScope;
						break;
					}
					e = e.prevScope;
				}
			}
			this.prevScope = void 0;
		}
	}
	stop(e) {
		if (this._active) {
			this._active = !1;
			let t, n;
			for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].stop();
			for (this.effects.length = 0, t = 0, n = this.cleanups.length; t < n; t++) this.cleanups[t]();
			if (this.cleanups.length = 0, this.scopes) {
				let e = this.scopes.slice();
				for (t = 0, n = e.length; t < n; t++) e[t].stop(!0);
				this.scopes.length = 0;
			}
			if (!this.detached && this.parent && !e) {
				let e = this.parent.scopes.pop();
				e && e !== this && (this.parent.scopes[this.index] = e, e.index = this.index);
			}
			this.parent = void 0;
		}
	}
};
function nn() {
	return en;
}
var rn, an = /* @__PURE__ */ new WeakSet(), on = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, en && (en.active ? en.effects.push(this) : this.flags &= -2);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, an.has(this) && (an.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || un(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, Cn(this), pn(this);
		let e = rn, t = yn;
		rn = this, yn = !0;
		try {
			return this.fn();
		} finally {
			mn(this), rn = e, yn = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) _n(e);
			this.deps = this.depsTail = void 0, Cn(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? an.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		hn(this) && this.run();
	}
	get dirty() {
		return hn(this);
	}
}, sn = 0, cn, ln;
function un(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = ln, ln = e;
		return;
	}
	e.next = cn, cn = e;
}
function dn() {
	sn++;
}
function fn() {
	if (--sn > 0) return;
	if (ln) {
		let e = ln;
		for (ln = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; cn;) {
		let t = cn;
		for (cn = void 0; t;) {
			let n = t.next;
			if (t.next = void 0, t.flags &= -9, t.flags & 1) try {
				t.trigger();
			} catch (t) {
				e ||= t;
			}
			t = n;
		}
	}
	if (e) throw e;
}
function pn(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function mn(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), _n(r), vn(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function hn(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (gn(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function gn(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === wn) || (e.globalVersion = wn, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !hn(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = rn, r = yn;
	rn = e, yn = !0;
	try {
		pn(e);
		let n = e.fn(e._value);
		(t.version === 0 || kt(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		rn = n, yn = r, mn(e), e.flags &= -3;
	}
}
function _n(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) _n(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function vn(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
var yn = !0, bn = [];
function xn() {
	bn.push(yn), yn = !1;
}
function Sn() {
	let e = bn.pop();
	yn = e === void 0 || e;
}
function Cn(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = rn;
		rn = void 0;
		try {
			t();
		} finally {
			rn = e;
		}
	}
}
var wn = 0, Tn = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, En = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
	}
	track(e) {
		if (!rn || !yn || rn === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== rn) t = this.activeLink = new Tn(rn, this), rn.deps ? (t.prevDep = rn.depsTail, rn.depsTail.nextDep = t, rn.depsTail = t) : rn.deps = rn.depsTail = t, Dn(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = rn.depsTail, t.nextDep = void 0, rn.depsTail.nextDep = t, rn.depsTail = t, rn.deps === t && (rn.deps = e);
		}
		return t;
	}
	trigger(e) {
		this.version++, wn++, this.notify(e);
	}
	notify(e) {
		dn();
		try {
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			fn();
		}
	}
};
function Dn(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) Dn(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
	}
}
var On = /* @__PURE__ */ new WeakMap(), kn = /* @__PURE__ */ Symbol(""), An = /* @__PURE__ */ Symbol(""), jn = /* @__PURE__ */ Symbol("");
function Mn(e, t, n) {
	if (yn && rn) {
		let t = On.get(e);
		t || On.set(e, t = /* @__PURE__ */ new Map());
		let r = t.get(n);
		r || (t.set(n, r = new En()), r.map = t, r.key = n), r.track();
	}
}
function Nn(e, t, n, r, i, a) {
	let o = On.get(e);
	if (!o) {
		wn++;
		return;
	}
	let s = (e) => {
		e && e.trigger();
	};
	if (dn(), t === "clear") o.forEach(s);
	else {
		let i = I(e), a = i && bt(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === jn || !pt(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(jn)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(kn)), lt(e) && s(o.get(An)));
				break;
			case "delete":
				i || (s(o.get(kn)), lt(e) && s(o.get(An)));
				break;
			case "set": lt(e) && s(o.get(kn));
		}
	}
	fn();
}
function Pn(e) {
	let t = /* @__PURE__ */ R(e);
	return t === e ? t : (Mn(t, "iterate", jn), /* @__PURE__ */ yr(e) ? t : t.map(Sr));
}
function Fn(e) {
	return Mn(e = /* @__PURE__ */ R(e), "iterate", jn), e;
}
function In(e, t) {
	return /* @__PURE__ */ vr(e) ? Cr(/* @__PURE__ */ _r(e) ? Sr(t) : t) : Sr(t);
}
var Ln = {
	__proto__: null,
	[Symbol.iterator]() {
		return Rn(this, Symbol.iterator, (e) => In(this, e));
	},
	concat(...e) {
		return Pn(this).concat(...e.map((e) => I(e) ? Pn(e) : e));
	},
	entries() {
		return Rn(this, "entries", (e) => (e[1] = In(this, e[1]), e));
	},
	every(e, t) {
		return Bn(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return Bn(this, "filter", e, t, (e) => e.map((e) => In(this, e)), arguments);
	},
	find(e, t) {
		return Bn(this, "find", e, t, (e) => In(this, e), arguments);
	},
	findIndex(e, t) {
		return Bn(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return Bn(this, "findLast", e, t, (e) => In(this, e), arguments);
	},
	findLastIndex(e, t) {
		return Bn(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return Bn(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return Hn(this, "includes", e);
	},
	indexOf(...e) {
		return Hn(this, "indexOf", e);
	},
	join(e) {
		return Pn(this).join(e);
	},
	lastIndexOf(...e) {
		return Hn(this, "lastIndexOf", e);
	},
	map(e, t) {
		return Bn(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return Un(this, "pop");
	},
	push(...e) {
		return Un(this, "push", e);
	},
	reduce(e, ...t) {
		return Vn(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return Vn(this, "reduceRight", e, t);
	},
	shift() {
		return Un(this, "shift");
	},
	some(e, t) {
		return Bn(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return Un(this, "splice", e);
	},
	toReversed() {
		return Pn(this).toReversed();
	},
	toSorted(e) {
		return Pn(this).toSorted(e);
	},
	toSpliced(...e) {
		return Pn(this).toSpliced(...e);
	},
	unshift(...e) {
		return Un(this, "unshift", e);
	},
	values() {
		return Rn(this, "values", (e) => In(this, e));
	}
};
function Rn(e, t, n) {
	let r = Fn(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ yr(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var zn = Array.prototype;
function Bn(e, t, n, r, i, a) {
	let o = Fn(e), s = o !== e && !/* @__PURE__ */ yr(e), c = o[t];
	if (c !== zn[t]) {
		let t = c.apply(e, a);
		return s ? Sr(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, In(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function Vn(e, t, n, r) {
	let i = Fn(e), a = i !== e && !/* @__PURE__ */ yr(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = In(e, t)), n.call(this, t, In(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? In(e, c) : c;
}
function Hn(e, t, n) {
	let r = /* @__PURE__ */ R(e);
	Mn(r, "iterate", jn);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ br(n[0]) ? (n[0] = /* @__PURE__ */ R(n[0]), r[t](...n)) : i;
}
function Un(e, t, n = []) {
	xn(), dn();
	let r = (/* @__PURE__ */ R(e))[t].apply(e, n);
	return fn(), Sn(), r;
}
var Wn = /* @__PURE__ */ et("__proto__,__v_isRef,__isVue"), Gn = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(pt));
function Kn(e) {
	pt(e) || (e = String(e));
	let t = /* @__PURE__ */ R(this);
	return Mn(t, "has", e), t.hasOwnProperty(e);
}
var qn = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? dr : ur : i ? lr : cr).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = I(e);
		if (!r) {
			let e;
			if (a && (e = Ln[t])) return e;
			if (t === "hasOwnProperty") return Kn;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ wr(e) ? e : n);
		if ((pt(t) ? Gn.has(t) : Wn(t)) || (r || Mn(e, "get", t), i)) return o;
		if (/* @__PURE__ */ wr(o)) {
			let e = a && bt(t) ? o : o.value;
			return r && mt(e) ? /* @__PURE__ */ hr(e) : e;
		}
		return mt(o) ? r ? /* @__PURE__ */ hr(o) : /* @__PURE__ */ pr(o) : o;
	}
}, Jn = class extends qn {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = I(e) && bt(t);
		if (!this._isShallow) {
			let e = /* @__PURE__ */ vr(i);
			if (!/* @__PURE__ */ yr(n) && !/* @__PURE__ */ vr(n) && (i = /* @__PURE__ */ R(i), n = /* @__PURE__ */ R(n)), !a && /* @__PURE__ */ wr(i) && !/* @__PURE__ */ wr(n)) return e || (i.value = n), !0;
		}
		let o = a ? Number(t) < e.length : F(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ wr(e) ? e : r);
		return e === /* @__PURE__ */ R(r) && s && (o ? kt(n, i) && Nn(e, "set", t, n, i) : Nn(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = F(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && Nn(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!pt(t) || !Gn.has(t)) && Mn(e, "has", t), n;
	}
	ownKeys(e) {
		return Mn(e, "iterate", I(e) ? "length" : kn), Reflect.ownKeys(e);
	}
}, Yn = class extends qn {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return !0;
	}
	deleteProperty(e, t) {
		return !0;
	}
}, Xn = /* @__PURE__ */ new Jn(), Zn = /* @__PURE__ */ new Yn(), Qn = /* @__PURE__ */ new Jn(!0), $n = (e) => e, er = (e) => Reflect.getPrototypeOf(e);
function tr(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ R(i), o = lt(a), s = e === "entries" || e === Symbol.iterator && o, c = e === "keys" && o, l = i[e](...r), u = n ? $n : t ? Cr : Sr;
		return !t && Mn(a, "iterate", c ? An : kn), ot(Object.create(l), { next() {
			let { value: e, done: t } = l.next();
			return t ? {
				value: e,
				done: t
			} : {
				value: s ? [u(e[0]), u(e[1])] : u(e),
				done: t
			};
		} });
	};
}
function nr(e) {
	return function(...t) {
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function rr(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ R(r), a = /* @__PURE__ */ R(n);
			e || (kt(n, a) && Mn(i, "get", n), Mn(i, "get", a));
			let { has: o } = er(i), s = t ? $n : e ? Cr : Sr;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && Mn(/* @__PURE__ */ R(t), "iterate", kn), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ R(n), i = /* @__PURE__ */ R(t);
			return e || (kt(t, i) && Mn(r, "has", t), Mn(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ R(a), s = t ? $n : e ? Cr : Sr;
			return !e && Mn(o, "iterate", kn), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return ot(n, e ? {
		add: nr("add"),
		set: nr("set"),
		delete: nr("delete"),
		clear: nr("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ R(this), r = er(n), i = /* @__PURE__ */ R(e), a = !t && !/* @__PURE__ */ yr(e) && !/* @__PURE__ */ vr(e) ? i : e;
			return r.has.call(n, a) || kt(e, a) && r.has.call(n, e) || kt(i, a) && r.has.call(n, i) || (n.add(a), Nn(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ yr(n) && !/* @__PURE__ */ vr(n) && (n = /* @__PURE__ */ R(n));
			let r = /* @__PURE__ */ R(this), { has: i, get: a } = er(r), o = i.call(r, e);
			o ||= (e = /* @__PURE__ */ R(e), i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? kt(n, s) && Nn(r, "set", e, n, s) : Nn(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ R(this), { has: n, get: r } = er(t), i = n.call(t, e);
			i ||= (e = /* @__PURE__ */ R(e), n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && Nn(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ R(this), t = e.size !== 0, n = e.clear();
			return t && Nn(e, "clear", void 0, void 0, void 0), n;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = tr(r, e, t);
	}), n;
}
function ir(e, t) {
	let n = rr(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(F(n, r) && r in t ? n : t, r, i);
}
var ar = { get: /* @__PURE__ */ ir(!1, !1) }, or = { get: /* @__PURE__ */ ir(!1, !0) }, sr = { get: /* @__PURE__ */ ir(!0, !1) }, cr = /* @__PURE__ */ new WeakMap(), lr = /* @__PURE__ */ new WeakMap(), ur = /* @__PURE__ */ new WeakMap(), dr = /* @__PURE__ */ new WeakMap();
function fr(e) {
	switch (e) {
		case "Object":
		case "Array": return 1;
		case "Map":
		case "Set":
		case "WeakMap":
		case "WeakSet": return 2;
		default: return 0;
	}
}
// @__NO_SIDE_EFFECTS__
function pr(e) {
	return /* @__PURE__ */ vr(e) ? e : gr(e, !1, Xn, ar, cr);
}
// @__NO_SIDE_EFFECTS__
function mr(e) {
	return gr(e, !1, Qn, or, lr);
}
// @__NO_SIDE_EFFECTS__
function hr(e) {
	return gr(e, !0, Zn, sr, ur);
}
function gr(e, t, n, r, i) {
	if (!mt(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e)) return e;
	let a = i.get(e);
	if (a) return a;
	let o = fr(vt(e));
	if (o === 0) return e;
	let s = new Proxy(e, o === 2 ? r : n);
	return i.set(e, s), s;
}
// @__NO_SIDE_EFFECTS__
function _r(e) {
	return /* @__PURE__ */ vr(e) ? /* @__PURE__ */ _r(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function vr(e) {
	return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function yr(e) {
	return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function br(e) {
	return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function R(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ R(t) : e;
}
function xr(e) {
	return !F(e, "__v_skip") && Object.isExtensible(e) && jt(e, "__v_skip", !0), e;
}
var Sr = (e) => mt(e) ? /* @__PURE__ */ pr(e) : e, Cr = (e) => mt(e) ? /* @__PURE__ */ hr(e) : e;
// @__NO_SIDE_EFFECTS__
function wr(e) {
	return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function z(e) {
	return Tr(e, !1);
}
function Tr(e, t) {
	return /* @__PURE__ */ wr(e) ? e : new Er(e, t);
}
var Er = class {
	constructor(e, t) {
		this.dep = new En(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ R(e), this._value = t ? e : Sr(e), this.__v_isShallow = t;
	}
	get value() {
		return this.dep.track(), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ yr(e) || /* @__PURE__ */ vr(e);
		e = n ? e : /* @__PURE__ */ R(e), kt(e, t) && (this._rawValue = e, this._value = n ? e : Sr(e), this.dep.trigger());
	}
};
function B(e) {
	return /* @__PURE__ */ wr(e) ? e.value : e;
}
var Dr = {
	get: (e, t, n) => t === "__v_raw" ? e : B(Reflect.get(e, t, n)),
	set: (e, t, n, r) => {
		let i = e[t];
		return /* @__PURE__ */ wr(i) && !/* @__PURE__ */ wr(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
	}
};
function Or(e) {
	return /* @__PURE__ */ _r(e) ? e : new Proxy(e, Dr);
}
var kr = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new En(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = wn - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && rn !== this) return un(this, !0), !0;
	}
	get value() {
		let e = this.dep.track();
		return gn(this), e && (e.version = this.dep.version), this._value;
	}
	set value(e) {
		this.setter && this.setter(e);
	}
};
// @__NO_SIDE_EFFECTS__
function Ar(e, t, n = !1) {
	let r, i;
	return L(e) ? r = e : (r = e.get, i = e.set), new kr(r, i, n);
}
var jr = {}, Mr = /* @__PURE__ */ new WeakMap(), Nr = void 0;
function Pr(e, t = !1, n = Nr) {
	if (n) {
		let t = Mr.get(n);
		t || Mr.set(n, t = []), t.push(e);
	}
}
function Fr(e, t, n = P) {
	let { immediate: r, deep: i, once: a, scheduler: o, augmentJob: s, call: c } = n, l = (e) => i ? e : /* @__PURE__ */ yr(e) || i === !1 || i === 0 ? Ir(e, 1) : Ir(e), u, d, f, p, m = !1, h = !1;
	if (/* @__PURE__ */ wr(e) ? (d = () => e.value, m = /* @__PURE__ */ yr(e)) : /* @__PURE__ */ _r(e) ? (d = () => l(e), m = !0) : I(e) ? (h = !0, m = e.some((e) => /* @__PURE__ */ _r(e) || /* @__PURE__ */ yr(e)), d = () => e.map((e) => {
		if (/* @__PURE__ */ wr(e)) return e.value;
		if (/* @__PURE__ */ _r(e)) return l(e);
		if (L(e)) return c ? c(e, 2) : e();
	})) : d = L(e) ? t ? c ? () => c(e, 2) : e : () => {
		if (f) {
			xn();
			try {
				f();
			} finally {
				Sn();
			}
		}
		let t = Nr;
		Nr = u;
		try {
			return c ? c(e, 3, [p]) : e(p);
		} finally {
			Nr = t;
		}
	} : nt, t && i) {
		let e = d, t = i === !0 ? Infinity : i;
		d = () => Ir(e(), t);
	}
	let g = nn(), _ = () => {
		u.stop(), g && g.active && st(g.effects, u);
	};
	if (a && t) {
		let e = t;
		t = (...t) => {
			let n = e(...t);
			return _(), n;
		};
	}
	let v = h ? Array(e.length).fill(jr) : jr, y = (e) => {
		if (u.flags & 1 && (u.dirty || e)) {
			if (t) {
				let n = u.run();
				if (e || i || m || (h ? n.some((e, t) => kt(e, v[t])) : kt(n, v))) {
					f && f();
					let e = Nr;
					Nr = u;
					try {
						let e = [
							n,
							v === jr ? void 0 : h && v[0] === jr ? [] : v,
							p
						];
						v = n, c ? c(t, 3, e) : t(...e);
					} finally {
						Nr = e;
					}
				}
			} else u.run();
		}
	};
	return s && s(y), u = new on(d), u.scheduler = o ? () => o(y, !1) : y, p = (e) => Pr(e, !1, u), f = u.onStop = () => {
		let e = Mr.get(u);
		if (e) {
			if (c) c(e, 4);
			else for (let t of e) t();
			Mr.delete(u);
		}
	}, t ? r ? y(!0) : v = u.run() : o ? o(y.bind(null, !0), !0) : u.run(), _.pause = u.pause.bind(u), _.resume = u.resume.bind(u), _.stop = _, _;
}
function Ir(e, t = Infinity, n) {
	if (t <= 0 || !mt(e) || e.__v_skip || (n ||= /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t)) return e;
	if (n.set(e, t), t--, /* @__PURE__ */ wr(e)) Ir(e.value, t, n);
	else if (I(e)) for (let r = 0; r < e.length; r++) Ir(e[r], t, n);
	else if (ut(e) || lt(e)) e.forEach((e) => {
		Ir(e, t, n);
	});
	else if (yt(e)) {
		for (let r in e) Ir(e[r], t, n);
		for (let r of Object.getOwnPropertySymbols(e)) Object.prototype.propertyIsEnumerable.call(e, r) && Ir(e[r], t, n);
	}
	return e;
}
function Lr(e, t, n, r) {
	try {
		return r ? e(...r) : e();
	} catch (e) {
		zr(e, t, n);
	}
}
function Rr(e, t, n, r) {
	if (L(e)) {
		let i = Lr(e, t, n, r);
		return i && ht(i) && i.catch((e) => {
			zr(e, t, n);
		}), i;
	}
	if (I(e)) {
		let i = [];
		for (let a = 0; a < e.length; a++) i.push(Rr(e[a], t, n, r));
		return i;
	}
}
function zr(e, t, n, r = !0) {
	let i = t ? t.vnode : null, { errorHandler: a, throwUnhandledErrorInProduction: o } = t && t.appContext.config || P;
	if (t) {
		let r = t.parent, i = t.proxy, o = `https://vuejs.org/error-reference/#runtime-${n}`;
		for (; r;) {
			let t = r.ec;
			if (t) {
				for (let n = 0; n < t.length; n++) if (t[n](e, i, o) === !1) return;
			}
			r = r.parent;
		}
		if (a) {
			xn(), Lr(a, null, 10, [
				e,
				i,
				o
			]), Sn();
			return;
		}
	}
	Br(e, n, i, r, o);
}
function Br(e, t, n, r = !0, i = !1) {
	if (i) throw e;
	console.error(e);
}
var Vr = [], Hr = -1, Ur = [], Wr = null, Gr = 0, Kr = /* @__PURE__ */ Promise.resolve(), qr = null;
function Jr(e) {
	let t = qr || Kr;
	return e ? t.then(this ? e.bind(this) : e) : t;
}
function Yr(e) {
	let t = Hr + 1, n = Vr.length;
	for (; t < n;) {
		let r = t + n >>> 1, i = Vr[r], a = ti(i);
		a < e || a === e && i.flags & 2 ? t = r + 1 : n = r;
	}
	return t;
}
function Xr(e) {
	if (!(e.flags & 1)) {
		let t = ti(e), n = Vr[Vr.length - 1];
		!n || !(e.flags & 2) && t >= ti(n) ? Vr.push(e) : Vr.splice(Yr(t), 0, e), e.flags |= 1, Zr();
	}
}
function Zr() {
	qr ||= Kr.then(ni);
}
function Qr(e) {
	if (!I(e)) Wr && e.id === -1 ? Wr.splice(Gr + 1, 0, e) : e.flags & 1 || (Ur.push(e), e.flags |= 1);
	else for (let t = 0; t < e.length; t++) Ur.push(e[t]);
	Zr();
}
function $r(e, t, n = Hr + 1) {
	for (; n < Vr.length; n++) {
		let t = Vr[n];
		if (t && t.flags & 2) {
			if (e && t.id !== e.uid) continue;
			Vr.splice(n, 1), n--, t.flags & 4 && (t.flags &= -2), t(), t.flags & 4 || (t.flags &= -2);
		}
	}
}
function ei(e) {
	if (Ur.length) {
		let e = [...new Set(Ur)].sort((e, t) => ti(e) - ti(t));
		if (Ur.length = 0, Wr) {
			for (let t = 0; t < e.length; t++) Wr.push(e[t]);
			return;
		}
		for (Wr = e, Gr = 0; Gr < Wr.length; Gr++) {
			let e = Wr[Gr];
			e.flags & 4 && (e.flags &= -2), e.flags & 8 || e(), e.flags &= -2;
		}
		Wr = null, Gr = 0;
	}
}
var ti = (e) => e.id == null ? e.flags & 2 ? -1 : Infinity : e.id;
function ni(e) {
	try {
		for (Hr = 0; Hr < Vr.length; Hr++) {
			let e = Vr[Hr];
			e && !(e.flags & 8) && (e.flags & 4 && (e.flags &= -2), Lr(e, e.i, e.i ? 15 : 14), e.flags & 4 || (e.flags &= -2));
		}
	} finally {
		for (; Hr < Vr.length; Hr++) {
			let e = Vr[Hr];
			e && (e.flags &= -2);
		}
		Hr = -1, Vr.length = 0, ei(e), qr = null, (Vr.length || Ur.length) && ni(e);
	}
}
var ri = null, ii = null;
function ai(e) {
	let t = ri;
	return ri = e, ii = e && e.type.__scopeId || null, t;
}
function oi(e, t = ri, n) {
	if (!t || e._n) return e;
	let r = (...n) => {
		r._d && Zo(-1);
		let i = ai(t), a = qo.length, o;
		try {
			o = e(...n);
		} finally {
			for (let e = qo.length; e > a; e--) Yo();
			ai(i), r._d && Zo(1);
		}
		return o;
	};
	return r._n = !0, r._c = !0, r._d = !0, r;
}
function si(e, t) {
	if (ri === null) return e;
	let n = js(ri), r = e.dirs ||= [];
	for (let e = 0; e < t.length; e++) {
		let [i, a, o, s = P] = t[e];
		i && (L(i) && (i = {
			mounted: i,
			updated: i
		}), i.deep && Ir(a), r.push({
			dir: i,
			instance: n,
			value: a,
			oldValue: void 0,
			arg: o,
			modifiers: s
		}));
	}
	return e;
}
function ci(e, t, n, r) {
	let i = e.dirs, a = t && t.dirs;
	for (let o = 0; o < i.length; o++) {
		let s = i[o];
		a && (s.oldValue = a[o].value);
		let c = s.dir[r];
		c && (xn(), Rr(c, n, 8, [
			e.el,
			s,
			e,
			t
		]), Sn());
	}
}
function li(e, t) {
	if (_s) {
		let n = _s.provides, r = _s.parent && _s.parent.provides;
		r === n && (n = _s.provides = Object.create(r)), n[e] = t;
	}
}
function V(e, t, n = !1) {
	let r = vs();
	if (r || Ba) {
		let i = Ba ? Ba._context.provides : r ? r.parent == null || r.ce ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides : void 0;
		if (i && e in i) return i[e];
		if (arguments.length > 1) return n && L(t) ? t.call(r && r.proxy) : t;
	}
}
var ui = /* @__PURE__ */ Symbol.for("v-scx"), di = () => V(ui);
function fi(e, t) {
	return pi(e, null, t);
}
function H(e, t, n) {
	return pi(e, t, n);
}
function pi(e, t, n = P) {
	let { immediate: r, deep: i, flush: a, once: o } = n, s = ot({}, n), c = t && r || !t && a !== "post", l;
	if (ws) {
		if (a === "sync") {
			let e = di();
			l = e.__watcherHandles ||= [];
		} else if (!c) {
			let e = () => {};
			return e.stop = nt, e.resume = nt, e.pause = nt, e;
		}
	}
	let u = _s;
	s.call = (e, t, n) => Rr(e, u, t, n);
	let d = !1;
	a === "post" ? s.scheduler = (e) => {
		yo(e, u && u.suspense);
	} : a !== "sync" && (d = !0, s.scheduler = (e, t) => {
		t ? e() : Xr(e);
	}), s.augmentJob = (e) => {
		t && (e.flags |= 4), d && (e.flags |= 2, u && (e.id = u.uid, e.i = u));
	};
	let f = Fr(e, t, s);
	return ws && (l ? l.push(f) : c && f()), f;
}
function mi(e, t, n) {
	let r = this.proxy, i = ft(e) ? e.includes(".") ? hi(r, e) : () => r[e] : e.bind(r, r), a;
	L(t) ? a = t : (a = t.handler, n = t);
	let o = xs(this), s = pi(i, a.bind(r), n);
	return o(), s;
}
function hi(e, t) {
	let n = t.split(".");
	return () => {
		let t = e;
		for (let e = 0; e < n.length && t; e++) t = t[n[e]];
		return t;
	};
}
var gi = /* @__PURE__ */ new WeakMap(), _i = /* @__PURE__ */ Symbol("_vte"), vi = (e) => e.__isTeleport, yi = (e) => e && (e.disabled || e.disabled === ""), bi = (e) => e && (e.defer || e.defer === ""), xi = (e) => typeof SVGElement < "u" && e instanceof SVGElement, Si = (e) => typeof MathMLElement == "function" && e instanceof MathMLElement, Ci = (e, t) => {
	let n = e && e.to;
	return ft(n) ? t ? t(n) : null : n;
}, wi = {
	name: "Teleport",
	__isTeleport: !0,
	process(e, t, n, r, i, a, o, s, c, l) {
		let { mc: u, pc: d, pbc: f, o: { insert: p, querySelector: m, createText: h, createComment: g, parentNode: _ } } = l, v = yi(t.props), { dynamicChildren: y } = t, b = (e, t, n) => {
			e.shapeFlag & 16 && u(e.children, t, n, i, a, o, s, c);
		}, x = (e = t) => {
			let n = yi(e.props), r = e.target = Ci(e.props, m), a = ki(r, e, h, p);
			r && (o !== "svg" && xi(r) ? o = "svg" : o !== "mathml" && Si(r) && (o = "mathml"), i && i.isCE && (i.ce._teleportTargets || (i.ce._teleportTargets = /* @__PURE__ */ new Set())).add(r), n || (b(e, r, a), Oi(e, !1)));
		}, S = (e) => {
			let t = () => {
				if (gi.get(e) === t) {
					if (gi.delete(e), yi(e.props)) {
						let t = _(e.el) || n;
						b(e, t, e.anchor), Oi(e, !0);
					}
					x(e);
				}
			};
			gi.set(e, t), yo(t, a);
		};
		if (e == null) {
			let e = t.el = h(""), i = t.anchor = h("");
			if (p(e, n, r), p(i, n, r), bi(t.props) || a && a.pendingBranch) {
				S(t);
				return;
			}
			v && (b(t, n, i), Oi(t, !0)), x();
		} else {
			t.el = e.el;
			let r = t.anchor = e.anchor, u = gi.get(e);
			if (u) {
				u.flags |= 8, gi.delete(e), S(t);
				return;
			}
			t.targetStart = e.targetStart;
			let p = t.target = e.target, h = t.targetAnchor = e.targetAnchor, g = yi(e.props), _ = g ? n : p, b = g ? r : h;
			if (o === "svg" || xi(p) ? o = "svg" : (o === "mathml" || Si(p)) && (o = "mathml"), y ? (f(e.dynamicChildren, y, _, i, a, o, s), To(e, t, !0)) : c || d(e, t, _, b, i, a, o, s, !1), v) g ? t.props && e.props && t.props.to !== e.props.to && (t.props.to = e.props.to) : Ti(t, n, r, l, 1);
			else if ((t.props && t.props.to) !== (e.props && e.props.to)) {
				let e = Ci(t.props, m);
				e && (t.target = e, Ti(t, e, null, l, 0));
			} else g && Ti(t, p, h, l, 1);
			Oi(t, v);
		}
	},
	remove(e, t, n, { um: r, o: { remove: i } }, a) {
		let { shapeFlag: o, children: s, anchor: c, targetStart: l, targetAnchor: u, target: d, props: f } = e, p = yi(f), m = a || !p, h = gi.get(e);
		if (h && (h.flags |= 8, gi.delete(e)), d && (i(l), i(u)), a && i(c), !h && (p || d) && o & 16) for (let e = 0; e < s.length; e++) {
			let i = s[e];
			r(i, t, n, m, !!i.dynamicChildren);
		}
	},
	move: Ti,
	hydrate: Ei
};
function Ti(e, t, n, { o: { insert: r }, m: i }, a = 2) {
	a === 0 && r(e.targetAnchor, t, n);
	let { el: o, anchor: s, shapeFlag: c, children: l, props: u } = e, d = a === 2;
	if (d && r(o, t, n), !gi.has(e) && (!d || yi(u)) && c & 16) for (let e = 0; e < l.length; e++) i(l[e], t, n, 2);
	d && r(s, t, n);
}
function Ei(e, t, n, r, i, a, { o: { nextSibling: o, parentNode: s, querySelector: c, insert: l, createText: u } }, d) {
	function f(e, n) {
		let r = n;
		for (; r;) {
			if (r && r.nodeType === 8) {
				if (r.data === "teleport start anchor") t.targetStart = r;
				else if (r.data === "teleport anchor") {
					t.targetAnchor = r, e._lpa = t.targetAnchor && o(t.targetAnchor);
					break;
				}
			}
			r = o(r);
		}
	}
	function p(e, t) {
		t.anchor = d(o(e), t, s(e), n, r, i, a);
	}
	let m = t.target = Ci(t.props, c), h = yi(t.props);
	if (m) {
		let c = m._lpa || m.firstChild;
		t.shapeFlag & 16 && (h ? (p(e, t), f(m, c), t.targetAnchor || ki(m, t, u, l, s(e) === m ? e : null)) : (t.anchor = o(e), f(m, c), t.targetAnchor || ki(m, t, u, l), d(c && o(c), t, m, n, r, i, a))), Oi(t, h);
	} else h && t.shapeFlag & 16 && (p(e, t), t.targetStart = e, t.targetAnchor = o(e));
	return t.anchor && o(t.anchor);
}
var Di = wi;
function Oi(e, t) {
	let n = e.ctx;
	if (n && n.ut) {
		let r, i;
		for (t ? (r = e.el, i = e.anchor) : (r = e.targetStart, i = e.targetAnchor); r && r !== i;) r.nodeType === 1 && r.setAttribute("data-v-owner", n.uid), r = r.nextSibling;
		n.ut();
	}
}
function ki(e, t, n, r, i = null) {
	let a = t.targetStart = n(""), o = t.targetAnchor = n("");
	return a[_i] = o, e && (r(a, e, i), r(o, e, i)), o;
}
var Ai = /* @__PURE__ */ Symbol("_leaveCb");
function ji(e) {
	let t = e[0];
	if (e.length > 1) {
		for (let n of e) if (n.type !== Go && (t = n, 1)) break;
	}
	return t;
}
function Mi(e) {
	if (!Vi(e)) return vi(e.type) && e.children ? ji(e.children) : e;
	if (e.component) return e.component.subTree;
	let { shapeFlag: t, children: n } = e;
	if (n) {
		if (t & 16) return n[0];
		if (t & 32 && L(n.default)) return n.default();
	}
}
function Ni(e, t) {
	if (e.shapeFlag & 6 && e.component) {
		e.transition = t;
		let n = e.component.subTree;
		Ni(vi(n.type) && Mi(n) || n, t);
	} else e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function Pi() {
	let e = vs();
	return e ? (e.appContext.config.idPrefix || "v") + "-" + e.ids[0] + e.ids[1]++ : "";
}
function Fi(e) {
	e.ids = [
		e.ids[0] + e.ids[2]++ + "-",
		0,
		0
	];
}
function Ii(e, t) {
	let n;
	return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
var Li = /* @__PURE__ */ new WeakMap();
function Ri(e, t, n, r, i = !1) {
	if (I(e)) {
		e.forEach((e, a) => Ri(e, t && (I(t) ? t[a] : t), n, r, i));
		return;
	}
	if (Bi(r) && !i) {
		r.shapeFlag & 512 && r.type.__asyncResolved && r.component.subTree.component && Ri(e, t, n, r.component.subTree);
		return;
	}
	let a = r.shapeFlag & 4 ? js(r.component) : r.el, o = i ? null : a, { i: s, r: c } = e, l = t && t.r, u = s.refs === P ? s.refs = {} : s.refs, d = s.setupState, f = /* @__PURE__ */ R(d), p = d === P ? rt : (e) => !Ii(u, e) && F(f, e), m = (e, t) => !(t && Ii(u, t));
	if (l != null && l !== c) {
		if (zi(t), ft(l)) u[l] = null, p(l) && (d[l] = null);
		else if (/* @__PURE__ */ wr(l)) {
			let e = t;
			m(l, e.k) && (l.value = null), e.k && (u[e.k] = null);
		}
	}
	if (L(c)) Lr(c, s, 12, [o, u]);
	else {
		let t = ft(c), r = /* @__PURE__ */ wr(c);
		if (t || r) {
			let s = () => {
				if (e.f) {
					let n = t ? p(c) ? d[c] : u[c] : m(c) || !e.k ? c.value : u[e.k];
					if (i) I(n) && st(n, a);
					else if (I(n)) n.includes(a) || n.push(a);
					else if (t) u[c] = [a], p(c) && (d[c] = u[c]);
					else {
						let t = [a];
						m(c, e.k) && (c.value = t), e.k && (u[e.k] = t);
					}
				} else t ? (u[c] = o, p(c) && (d[c] = o)) : r && (m(c, e.k) && (c.value = o), e.k && (u[e.k] = o));
			};
			if (o) {
				let t = () => {
					s(), Li.delete(e);
				};
				t.id = -1, Li.set(e, t), yo(t, n);
			} else zi(e), s();
		}
	}
}
function zi(e) {
	let t = Li.get(e);
	t && (t.flags |= 8, Li.delete(e));
}
Ft().requestIdleCallback, Ft().cancelIdleCallback;
var Bi = (e) => !!e.type.__asyncLoader, Vi = (e) => e.type.__isKeepAlive;
function Hi(e, t) {
	Wi(e, "a", t);
}
function Ui(e, t) {
	Wi(e, "da", t);
}
function Wi(e, t, n = _s) {
	let r = e.__wdc ||= () => {
		let t = n;
		for (; t;) {
			if (t.isDeactivated) return;
			t = t.parent;
		}
		return e();
	};
	if (Ki(t, r, n), n) {
		let e = n.parent;
		for (; e && e.parent;) Vi(e.parent.vnode) && Gi(r, t, n, e), e = e.parent;
	}
}
function Gi(e, t, n, r) {
	let i = Ki(t, e, r, !0);
	$i(() => {
		st(r[t], i);
	}, n);
}
function Ki(e, t, n = _s, r = !1) {
	if (n) {
		let i = n[e] || (n[e] = []), a = t.__weh ||= (...r) => {
			xn();
			let i = xs(n), a = Rr(t, n, e, r);
			return i(), Sn(), a;
		};
		return r ? i.unshift(a) : i.push(a), a;
	}
}
var qi = (e) => (t, n = _s) => {
	(!ws || e === "sp") && Ki(e, (...e) => t(...e), n);
}, Ji = qi("bm"), Yi = qi("m"), Xi = qi("bu"), Zi = qi("u"), Qi = qi("bum"), $i = qi("um"), ea = qi("sp"), ta = qi("rtg"), na = qi("rtc");
function ra(e, t = _s) {
	Ki("ec", e, t);
}
var ia = "components", aa = "directives";
function oa(e, t) {
	return ua(ia, e, !0, t) || e;
}
var sa = /* @__PURE__ */ Symbol.for("v-ndc");
function ca(e) {
	return ft(e) ? ua(ia, e, !1) || e : e || sa;
}
function la(e) {
	return ua(aa, e);
}
function ua(e, t, n = !0, r = !1) {
	let i = ri || _s;
	if (i) {
		let n = i.type;
		if (e === ia) {
			let e = Ms(n, !1);
			if (e && (e === t || e === wt(t) || e === Dt(wt(t)))) return n;
		}
		let a = da(i[e] || n[e], t) || da(i.appContext[e], t);
		return !a && r ? n : a;
	}
}
function da(e, t) {
	return e && (e[t] || e[wt(t)] || e[Dt(wt(t))]);
}
function fa(e, t, n, r) {
	let i, a = n && n[r], o = I(e);
	if (o || ft(e)) {
		let n = o && /* @__PURE__ */ _r(e), r = !1, s = !1;
		n && (r = !/* @__PURE__ */ yr(e), s = /* @__PURE__ */ vr(e), e = Fn(e)), i = Array(e.length);
		for (let n = 0, o = e.length; n < o; n++) i[n] = t(r ? s ? Cr(Sr(e[n])) : Sr(e[n]) : e[n], n, void 0, a && a[n]);
	} else if (typeof e == "number") {
		i = Array(e);
		for (let n = 0; n < e; n++) i[n] = t(n + 1, n, void 0, a && a[n]);
	} else if (mt(e)) {
		if (e[Symbol.iterator]) i = Array.from(e, (e, n) => t(e, n, void 0, a && a[n]));
		else {
			let n = Object.keys(e);
			i = Array(n.length);
			for (let r = 0, o = n.length; r < o; r++) {
				let o = n[r];
				i[r] = t(e[o], o, r, a && a[r]);
			}
		}
	} else i = [];
	return n && (n[r] = i), i;
}
function U(e, t, n, r, i, a) {
	if (n ??= {}, ri.ce || ri.parent && Bi(ri.parent) && ri.parent.ce) {
		let e = a != null && n.key == null ? ot({}, n, { key: a }) : n, i = Object.keys(e).length > 0;
		return t !== "default" && (e.name = t), W(), $o(Uo, null, [is("slot", e, r && r())], i ? -2 : 64);
	}
	let o = e[t];
	o && o._c && (o._d = !1);
	let s = qo.length;
	W();
	let c;
	try {
		let i = o && pa(o(n)), s = n.key || a || i && i.key;
		c = $o(Uo, { key: (s && !pt(s) ? s : `_${t}`) + (!i && r ? "_fb" : "") }, i || (r ? r() : []), i && e._ === 1 ? 64 : -2);
	} catch (e) {
		for (let e = qo.length; e > s; e--) Yo();
		throw e;
	} finally {
		o && o._c && (o._d = !0);
	}
	return !i && c.scopeId && (c.slotScopeIds = [c.scopeId + "-s"]), c;
}
function pa(e) {
	return e.some((e) => !es(e) || !(e.type === Go || e.type === Uo && !pa(e.children))) ? e : null;
}
var ma = (e) => e ? Cs(e) ? js(e) : ma(e.parent) : null, ha = /* @__PURE__ */ ot(/* @__PURE__ */ Object.create(null), {
	$: (e) => e,
	$el: (e) => e.vnode.el,
	$data: (e) => e.data,
	$props: (e) => e.props,
	$attrs: (e) => e.attrs,
	$slots: (e) => e.slots,
	$refs: (e) => e.refs,
	$parent: (e) => ma(e.parent),
	$root: (e) => ma(e.root),
	$host: (e) => e.ce,
	$emit: (e) => e.emit,
	$options: (e) => Da(e),
	$forceUpdate: (e) => e.f ||= () => {
		Xr(e.update);
	},
	$nextTick: (e) => e.n ||= Jr.bind(e.proxy),
	$watch: (e) => mi.bind(e)
}), ga = (e, t) => e !== P && !e.__isScriptSetup && F(e, t), _a = {
	get({ _: e }, t) {
		if (t === "__v_skip") return !0;
		let { ctx: n, setupState: r, data: i, props: a, accessCache: o, type: s, appContext: c } = e;
		if (t[0] !== "$") {
			let e = o[t];
			if (e !== void 0) switch (e) {
				case 1: return r[t];
				case 2: return i[t];
				case 4: return n[t];
				case 3: return a[t];
			}
			else if (ga(r, t)) return o[t] = 1, r[t];
			else if (i !== P && F(i, t)) return o[t] = 2, i[t];
			else if (F(a, t)) return o[t] = 3, a[t];
			else if (n !== P && F(n, t)) return o[t] = 4, n[t];
			else Sa && (o[t] = 0);
		}
		let l = ha[t], u, d;
		if (l) return t === "$attrs" && Mn(e.attrs, "get", ""), l(e);
		if ((u = s.__cssModules) && (u = u[t])) return u;
		if (n !== P && F(n, t)) return o[t] = 4, n[t];
		if (d = c.config.globalProperties, F(d, t)) return d[t];
	},
	set({ _: e }, t, n) {
		let { data: r, setupState: i, ctx: a } = e;
		return ga(i, t) ? (i[t] = n, !0) : r !== P && F(r, t) ? (r[t] = n, !0) : F(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (a[t] = n, !0);
	},
	has({ _: { data: e, setupState: t, accessCache: n, ctx: r, appContext: i, props: a, type: o } }, s) {
		let c;
		return !!(n[s] || e !== P && s[0] !== "$" && F(e, s) || ga(t, s) || F(a, s) || F(r, s) || F(ha, s) || F(i.config.globalProperties, s) || (c = o.__cssModules) && c[s]);
	},
	defineProperty(e, t, n) {
		return n.get == null ? F(n, "value") && this.set(e, t, n.value, null) : e._.accessCache[t] = 0, Reflect.defineProperty(e, t, n);
	}
};
function va() {
	return ba("useSlots").slots;
}
function ya() {
	return ba("useAttrs").attrs;
}
function ba(e) {
	let t = vs();
	return t.setupContext ||= As(t);
}
function xa(e) {
	return I(e) ? e.reduce((e, t) => (e[t] = null, e), {}) : e;
}
var Sa = !0;
function Ca(e) {
	let t = Da(e), n = e.proxy, r = e.ctx;
	Sa = !1, t.beforeCreate && Ta(t.beforeCreate, e, "bc");
	let { data: i, computed: a, methods: o, watch: s, provide: c, inject: l, created: u, beforeMount: d, mounted: f, beforeUpdate: p, updated: m, activated: h, deactivated: g, beforeDestroy: _, beforeUnmount: v, destroyed: y, unmounted: b, render: x, renderTracked: S, renderTriggered: C, errorCaptured: w, serverPrefetch: T, expose: E, inheritAttrs: ee, components: D, directives: te, filters: ne } = t;
	if (l && wa(l, r, null), o) for (let e in o) {
		let t = o[e];
		L(t) && (r[e] = t.bind(n));
	}
	if (i) {
		let t = i.call(n, n);
		mt(t) && (e.data = /* @__PURE__ */ pr(t));
	}
	if (Sa = !0, a) for (let e in a) {
		let t = a[e], i = J({
			get: L(t) ? t.bind(n, n) : L(t.get) ? t.get.bind(n, n) : nt,
			set: !L(t) && L(t.set) ? t.set.bind(n) : nt
		});
		Object.defineProperty(r, e, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		});
	}
	if (s) for (let e in s) Ea(s[e], r, n, e);
	if (c) {
		let e = L(c) ? c.call(n) : c;
		Reflect.ownKeys(e).forEach((t) => {
			li(t, e[t]);
		});
	}
	u && Ta(u, e, "c");
	function O(e, t) {
		I(t) ? t.forEach((t) => e(t.bind(n))) : t && e(t.bind(n));
	}
	if (O(Ji, d), O(Yi, f), O(Xi, p), O(Zi, m), O(Hi, h), O(Ui, g), O(ra, w), O(na, S), O(ta, C), O(Qi, v), O($i, b), O(ea, T), I(E)) {
		if (E.length) {
			let t = e.exposed ||= {};
			E.forEach((e) => {
				Object.defineProperty(t, e, {
					get: () => n[e],
					set: (t) => n[e] = t,
					enumerable: !0
				});
			});
		} else e.exposed ||= {};
	}
	x && e.render === nt && (e.render = x), ee != null && (e.inheritAttrs = ee), D && (e.components = D), te && (e.directives = te), T && Fi(e);
}
function wa(e, t, n = nt) {
	I(e) && (e = Ma(e));
	for (let n in e) {
		let r = e[n], i;
		i = mt(r) ? "default" in r ? V(r.from || n, r.default, !0) : V(r.from || n) : V(r), /* @__PURE__ */ wr(i) ? Object.defineProperty(t, n, {
			enumerable: !0,
			configurable: !0,
			get: () => i.value,
			set: (e) => i.value = e
		}) : t[n] = i;
	}
}
function Ta(e, t, n) {
	Rr(I(e) ? e.map((e) => e.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function Ea(e, t, n, r) {
	let i = r.includes(".") ? hi(n, r) : () => n[r];
	if (ft(e)) {
		let n = t[e];
		L(n) && H(i, n);
	} else if (L(e)) H(i, e.bind(n));
	else if (mt(e)) {
		if (I(e)) e.forEach((e) => Ea(e, t, n, r));
		else {
			let r = L(e.handler) ? e.handler.bind(n) : t[e.handler];
			L(r) && H(i, r, e);
		}
	}
}
function Da(e) {
	let t = e.type, { mixins: n, extends: r } = t, { mixins: i, optionsCache: a, config: { optionMergeStrategies: o } } = e.appContext, s = a.get(t), c;
	return s ? c = s : !i.length && !n && !r ? c = t : (c = {}, i.length && i.forEach((e) => Oa(c, e, o, !0)), Oa(c, t, o)), mt(t) && a.set(t, c), c;
}
function Oa(e, t, n, r = !1) {
	let { mixins: i, extends: a } = t;
	a && Oa(e, a, n, !0), i && i.forEach((t) => Oa(e, t, n, !0));
	for (let i in t) if (!(r && i === "expose")) {
		let r = ka[i] || n && n[i];
		e[i] = r ? r(e[i], t[i]) : t[i];
	}
	return e;
}
var ka = {
	data: Aa,
	props: Fa,
	emits: Fa,
	methods: Pa,
	computed: Pa,
	beforeCreate: Na,
	created: Na,
	beforeMount: Na,
	mounted: Na,
	beforeUpdate: Na,
	updated: Na,
	beforeDestroy: Na,
	beforeUnmount: Na,
	destroyed: Na,
	unmounted: Na,
	activated: Na,
	deactivated: Na,
	errorCaptured: Na,
	serverPrefetch: Na,
	components: Pa,
	directives: Pa,
	watch: Ia,
	provide: Aa,
	inject: ja
};
function Aa(e, t) {
	return t ? e ? function() {
		return ot(L(e) ? e.call(this, this) : e, L(t) ? t.call(this, this) : t);
	} : t : e;
}
function ja(e, t) {
	return Pa(Ma(e), Ma(t));
}
function Ma(e) {
	if (I(e)) {
		let t = {};
		for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
		return t;
	}
	return e;
}
function Na(e, t) {
	return e ? [...new Set([].concat(e, t))] : t;
}
function Pa(e, t) {
	return e ? ot(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Fa(e, t) {
	return e ? I(e) && I(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : ot(/* @__PURE__ */ Object.create(null), xa(e), xa(t ?? {})) : t;
}
function Ia(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = ot(/* @__PURE__ */ Object.create(null), e);
	for (let r in t) n[r] = Na(e[r], t[r]);
	return n;
}
function La() {
	return {
		app: null,
		config: {
			isNativeTag: rt,
			performance: !1,
			globalProperties: {},
			optionMergeStrategies: {},
			errorHandler: void 0,
			warnHandler: void 0,
			compilerOptions: {}
		},
		mixins: [],
		components: {},
		directives: {},
		provides: /* @__PURE__ */ Object.create(null),
		optionsCache: /* @__PURE__ */ new WeakMap(),
		propsCache: /* @__PURE__ */ new WeakMap(),
		emitsCache: /* @__PURE__ */ new WeakMap()
	};
}
var Ra = 0;
function za(e, t) {
	return function(n, r = null) {
		L(n) || (n = ot({}, n)), r != null && !mt(r) && (r = null);
		let i = La(), a = /* @__PURE__ */ new WeakSet(), o = [], s = !1, c = i.app = {
			_uid: Ra++,
			_component: n,
			_props: r,
			_container: null,
			_context: i,
			_instance: null,
			version: Fs,
			get config() {
				return i.config;
			},
			set config(e) {},
			use(e, ...t) {
				return a.has(e) || (e && L(e.install) ? (a.add(e), e.install(c, ...t)) : L(e) && (a.add(e), e(c, ...t))), c;
			},
			mixin(e) {
				return i.mixins.includes(e) || i.mixins.push(e), c;
			},
			component(e, t) {
				return t ? (i.components[e] = t, c) : i.components[e];
			},
			directive(e, t) {
				return t ? (i.directives[e] = t, c) : i.directives[e];
			},
			mount(a, o, l) {
				if (!s) {
					let u = c._ceVNode || is(n, r);
					return u.appContext = i, l === !0 ? l = "svg" : l === !1 && (l = void 0), o && t ? t(u, a) : e(u, a, l), s = !0, c._container = a, a.__vue_app__ = c, js(u.component);
				}
			},
			onUnmount(e) {
				o.push(e);
			},
			unmount() {
				s && (Rr(o, c._instance, 16), e(null, c._container), delete c._container.__vue_app__);
			},
			provide(e, t) {
				return i.provides[e] = t, c;
			},
			runWithContext(e) {
				let t = Ba;
				Ba = c;
				try {
					return e();
				} finally {
					Ba = t;
				}
			}
		};
		return c;
	};
}
var Ba = null, Va = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${wt(t)}Modifiers`] || e[`${Et(t)}Modifiers`];
function Ha(e, t, ...n) {
	if (e.isUnmounted) return;
	let r = e.vnode.props || P, i = n, a = t.startsWith("update:"), o = a && Va(r, t.slice(7));
	o && (o.trim && (i = n.map((e) => ft(e) ? e.trim() : e)), o.number && (i = i.map(Mt)));
	let s, c = r[s = Ot(t)] || r[s = Ot(wt(t))];
	!c && a && (c = r[s = Ot(Et(t))]), c && Rr(c, e, 6, i);
	let l = r[s + "Once"];
	if (l) {
		if (!e.emitted) e.emitted = {};
		else if (e.emitted[s]) return;
		e.emitted[s] = !0, Rr(l, e, 6, i);
	}
}
var Ua = /* @__PURE__ */ new WeakMap();
function Wa(e, t, n = !1) {
	let r = n ? Ua : t.emitsCache, i = r.get(e);
	if (i !== void 0) return i;
	let a = e.emits, o = {}, s = !1;
	if (!L(e)) {
		let r = (e) => {
			let n = Wa(e, t, !0);
			n && (s = !0, ot(o, n));
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	return !a && !s ? (mt(e) && r.set(e, null), null) : (I(a) ? a.forEach((e) => o[e] = null) : ot(o, a), mt(e) && r.set(e, o), o);
}
function Ga(e, t) {
	return !e || !it(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), F(e, t[0].toLowerCase() + t.slice(1)) || F(e, Et(t)) || F(e, t));
}
function Ka(e) {
	let { type: t, vnode: n, proxy: r, withProxy: i, propsOptions: [a], slots: o, attrs: s, emit: c, render: l, renderCache: u, props: d, data: f, setupState: p, ctx: m, inheritAttrs: h } = e, g = ai(e), _, v;
	try {
		if (n.shapeFlag & 4) {
			let e = i || r, t = e;
			_ = us(l.call(t, e, u, d, p, f, m)), v = s;
		} else {
			let e = t;
			_ = us(e.length > 1 ? e(d, {
				attrs: s,
				slots: o,
				emit: c
			}) : e(d, null)), v = t.props ? s : Ja(s);
		}
	} catch (t) {
		qo.length = 0, zr(t, e, 1), _ = is(Go);
	}
	let y = _;
	if (v && h !== !1) {
		let e = Object.keys(v), { shapeFlag: t } = y;
		e.length && t & 7 && (a && e.some(at) && (v = Ya(v, a)), y = ss(y, v, !1, !0));
	}
	return n.dirs && (y = ss(y, null, !1, !0), y.dirs = y.dirs ? y.dirs.concat(n.dirs) : n.dirs), n.transition && Ni(vi(y.type) && Mi(y) || y, n.transition), _ = y, ai(g), _;
}
function qa(e, t = !0) {
	let n;
	for (let t = 0; t < e.length; t++) {
		let r = e[t];
		if (es(r)) {
			if (r.type !== Go || r.children === "v-if") {
				if (n) return;
				n = r;
			}
		} else return;
	}
	return n;
}
var Ja = (e) => {
	let t;
	for (let n in e) (n === "class" || n === "style" || it(n)) && ((t ||= {})[n] = e[n]);
	return t;
}, Ya = (e, t) => {
	let n = {};
	for (let r in e) (!at(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
	return n;
};
function Xa(e, t, n) {
	let { props: r, children: i, component: a } = e, { props: o, children: s, patchFlag: c } = t, l = a.emitsOptions;
	if (t.dirs || t.transition) return !0;
	if (n && c >= 0) {
		if (c & 1024) return !0;
		if (c & 16) return r ? Za(r, o, l) : !!o;
		if (c & 8) {
			let e = t.dynamicProps;
			for (let t = 0; t < e.length; t++) {
				let n = e[t];
				if (Qa(o, r, n) && !Ga(l, n)) return !0;
			}
		}
	} else return (i || s) && (!s || !s.$stable) ? !0 : r === o ? !1 : r ? !o || Za(r, o, l) : !!o;
	return !1;
}
function Za(e, t, n) {
	let r = Object.keys(t);
	if (r.length !== Object.keys(e).length) return !0;
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		if (Qa(t, e, a) && !Ga(n, a)) return !0;
	}
	return !1;
}
function Qa(e, t, n) {
	let r = e[n], i = t[n];
	return n === "style" && mt(r) && mt(i) ? !Jt(r, i) : r !== i;
}
function $a({ vnode: e, parent: t, suspense: n }, r) {
	for (; t;) {
		let n = t.subTree;
		if (n.suspense && n.suspense.activeBranch === e && (n.suspense.vnode.el = n.el = r, e = n), n === e) (e = t.vnode).el = r, t = t.parent;
		else break;
	}
	n && n.activeBranch === e && (n.vnode.el = r);
}
var eo = {}, to = () => Object.create(eo), no = (e) => Object.getPrototypeOf(e) === eo;
function ro(e, t, n, r = !1) {
	let i = {}, a = to();
	e.propsDefaults = /* @__PURE__ */ Object.create(null), ao(e, t, i, a);
	for (let t in e.propsOptions[0]) t in i || (i[t] = void 0);
	e.props = n ? r ? i : /* @__PURE__ */ mr(i) : e.type.props ? i : a, e.attrs = a;
}
function io(e, t, n, r) {
	let { props: i, attrs: a, vnode: { patchFlag: o } } = e, s = /* @__PURE__ */ R(i), [c] = e.propsOptions, l = !1;
	if ((r || o > 0) && !(o & 16)) {
		if (o & 8) {
			let n = e.vnode.dynamicProps;
			for (let r = 0; r < n.length; r++) {
				let o = n[r];
				if (Ga(e.emitsOptions, o)) continue;
				let u = t[o];
				if (c) {
					if (F(a, o)) u !== a[o] && (a[o] = u, l = !0);
					else {
						let t = wt(o);
						i[t] = oo(c, s, t, u, e, !1);
					}
				} else u !== a[o] && (a[o] = u, l = !0);
			}
		}
	} else {
		ao(e, t, i, a) && (l = !0);
		let r;
		for (let a in s) (!t || !F(t, a) && ((r = Et(a)) === a || !F(t, r))) && (c ? n && (n[a] !== void 0 || n[r] !== void 0) && (i[a] = oo(c, s, a, void 0, e, !0)) : delete i[a]);
		if (a !== s) for (let e in a) (!t || !F(t, e)) && (delete a[e], l = !0);
	}
	l && Nn(e.attrs, "set", "");
}
function ao(e, t, n, r) {
	let [i, a] = e.propsOptions, o = !1, s;
	if (t) for (let c in t) {
		if (xt(c)) continue;
		let l = t[c], u;
		i && F(i, u = wt(c)) ? !a || !a.includes(u) ? n[u] = l : (s ||= {})[u] = l : Ga(e.emitsOptions, c) || (!(c in r) || l !== r[c]) && (r[c] = l, o = !0);
	}
	if (a) {
		let t = /* @__PURE__ */ R(n), r = s || P;
		for (let o = 0; o < a.length; o++) {
			let s = a[o];
			n[s] = oo(i, t, s, r[s], e, !F(r, s));
		}
	}
	return o;
}
function oo(e, t, n, r, i, a) {
	let o = e[n];
	if (o != null) {
		let e = F(o, "default");
		if (e && r === void 0) {
			let e = o.default;
			if (o.type !== Function && !o.skipFactory && L(e)) {
				let { propsDefaults: a } = i;
				if (n in a) r = a[n];
				else {
					let o = xs(i);
					r = a[n] = e.call(null, t), o();
				}
			} else r = e;
			i.ce && i.ce._setProp(n, r);
		}
		o[0] && (a && !e ? r = !1 : o[1] && (r === "" || r === Et(n)) && (r = !0));
	}
	return r;
}
var so = /* @__PURE__ */ new WeakMap();
function co(e, t, n = !1) {
	let r = n ? so : t.propsCache, i = r.get(e);
	if (i) return i;
	let a = e.props, o = {}, s = [], c = !1;
	if (!L(e)) {
		let r = (e) => {
			c = !0;
			let [n, r] = co(e, t, !0);
			ot(o, n), r && s.push(...r);
		};
		!n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r);
	}
	if (!a && !c) return mt(e) && r.set(e, tt), tt;
	if (I(a)) for (let e = 0; e < a.length; e++) {
		let t = wt(a[e]);
		lo(t) && (o[t] = P);
	}
	else if (a) for (let e in a) {
		let t = wt(e);
		if (lo(t)) {
			let n = a[e], r = o[t] = I(n) || L(n) ? { type: n } : ot({}, n), i = r.type, c = !1, l = !0;
			if (I(i)) for (let e = 0; e < i.length; ++e) {
				let t = i[e], n = L(t) && t.name;
				if (n === "Boolean") {
					c = !0;
					break;
				}
				n === "String" && (l = !1);
			}
			else c = L(i) && i.name === "Boolean";
			r[0] = c, r[1] = l, (c || F(r, "default")) && s.push(t);
		}
	}
	let l = [o, s];
	return mt(e) && r.set(e, l), l;
}
function lo(e) {
	return e[0] !== "$" && !xt(e) || !1;
}
var uo = (e) => e === "_" || e === "_ctx" || e === "$stable", fo = (e) => I(e) ? e.map(us) : [us(e)], po = (e, t, n) => {
	if (t._n) return t;
	let r = oi((...e) => fo(t(...e)), n);
	return r._c = !1, r;
}, mo = (e, t, n) => {
	let r = e._ctx;
	for (let n in e) {
		if (uo(n)) continue;
		let i = e[n];
		if (L(i)) t[n] = po(n, i, r);
		else if (i != null) {
			let e = fo(i);
			t[n] = () => e;
		}
	}
}, ho = (e, t) => {
	let n = fo(t);
	e.slots.default = () => n;
}, go = (e, t, n) => {
	for (let r in t) (n || !uo(r)) && (e[r] = t[r]);
}, _o = (e, t, n) => {
	let r = e.slots = to();
	if (e.vnode.shapeFlag & 32) {
		let e = t._;
		e ? (go(r, t, n), n && jt(r, "_", e, !0)) : mo(t, r);
	} else t && ho(e, t);
}, vo = (e, t, n) => {
	let { vnode: r, slots: i } = e, a = !0, o = P;
	if (r.shapeFlag & 32) {
		let e = t._;
		e ? n && e === 1 ? a = !1 : go(i, t, n) : (a = !t.$stable, mo(t, i)), o = t;
	} else t && (ho(e, t), o = { default: 1 });
	if (a) for (let e in i) !uo(e) && o[e] == null && delete i[e];
}, yo = Bo;
function bo(e) {
	return xo(e);
}
function xo(e, t) {
	let n = Ft();
	n.__VUE__ = !0;
	let { insert: r, remove: i, patchProp: a, createElement: o, createText: s, createComment: c, setText: l, setElementText: u, parentNode: d, nextSibling: f, setScopeId: p = nt, insertStaticContent: m } = e, h = (e, t, n, r = null, i = null, a = null, o = void 0, s = null, c = !!t.dynamicChildren) => {
		if (e === t) return;
		e && !ts(e, t) && (r = de(e), se(e, i, a, !0), e = null), t.patchFlag === -2 && (c = !1, t.dynamicChildren = null);
		let { type: l, ref: u, shapeFlag: d } = t;
		switch (l) {
			case Wo:
				g(e, t, n, r);
				break;
			case Go:
				_(e, t, n, r);
				break;
			case Ko:
				e ?? v(t, n, r, o);
				break;
			case Uo:
				D(e, t, n, r, i, a, o, s, c);
				break;
			default: d & 1 ? x(e, t, n, r, i, a, o, s, c) : d & 6 ? te(e, t, n, r, i, a, o, s, c) : (d & 64 || d & 128) && l.process(e, t, n, r, i, a, o, s, c, me);
		}
		u != null && i ? Ri(u, e && e.ref, a, t || e, !t) : u == null && e && e.ref != null && Ri(e.ref, null, a, e, !0);
	}, g = (e, t, n, i) => {
		if (e == null) r(t.el = s(t.children), n, i);
		else {
			let n = t.el = e.el;
			t.children !== e.children && l(n, t.children);
		}
	}, _ = (e, t, n, i) => {
		e == null ? r(t.el = c(t.children || ""), n, i) : t.el = e.el;
	}, v = (e, t, n, r) => {
		[e.el, e.anchor] = m(e.children, t, n, r, e.el, e.anchor);
	}, y = ({ el: e, anchor: t }, n, i) => {
		let a;
		for (; e && e !== t;) a = f(e), r(e, n, i), e = a;
		r(t, n, i);
	}, b = ({ el: e, anchor: t }) => {
		let n;
		for (; e && e !== t;) n = f(e), i(e), e = n;
		i(t);
	}, x = (e, t, n, r, i, a, o, s, c) => {
		if (t.type === "svg" ? o = "svg" : t.type === "math" && (o = "mathml"), e == null) S(t, n, r, i, a, o, s, c);
		else {
			let n = e.el && e.el._isVueCE ? e.el : null;
			try {
				n && n._beginPatch(), T(e, t, i, a, o, s, c);
			} finally {
				n && n._endPatch();
			}
		}
	}, S = (e, t, n, i, s, c, l, d) => {
		let f, p, { props: m, shapeFlag: h, transition: g, dirs: _ } = e;
		if (f = e.el = o(e.type, c, m && m.is, m), h & 8 ? u(f, e.children) : h & 16 && w(e.children, f, null, i, s, So(e, c), l, d), _ && ci(e, null, i, "created"), C(f, e, e.scopeId, l, i), m) {
			for (let e in m) e !== "value" && !xt(e) && a(f, e, null, m[e], c, i);
			"value" in m && a(f, "value", null, m.value, c), (p = m.onVnodeBeforeMount) && ps(p, i, e);
		}
		_ && ci(e, null, i, "beforeMount");
		let v = wo(s, g);
		v && g.beforeEnter(f), r(f, t, n), ((p = m && m.onVnodeMounted) || v || _) && yo(() => {
			try {
				p && ps(p, i, e), v && g.enter(f), _ && ci(e, null, i, "mounted");
			} finally {}
		}, s);
	}, C = (e, t, n, r, i) => {
		if (n && p(e, n), r) for (let t = 0; t < r.length; t++) p(e, r[t]);
		if (i) {
			let n = i.subTree;
			if (t === n || Ao(n.type) && (n.ssContent === t || n.ssFallback === t)) {
				let t = i.vnode;
				C(e, t, t.scopeId, t.slotScopeIds, i.parent);
			}
		}
	}, w = (e, t, n, r, i, a, o, s, c = 0) => {
		for (let l = c; l < e.length; l++) {
			let c = e[l] = s ? ds(e[l]) : us(e[l]);
			h(null, c, t, n, r, i, a, o, s);
		}
	}, T = (e, t, n, r, i, o, s) => {
		let c = t.el = e.el, { patchFlag: l, dynamicChildren: d, dirs: f } = t;
		l |= e.patchFlag & 16;
		let p = e.props || P, m = t.props || P, h;
		if (n && Co(n, !1), (h = m.onVnodeBeforeUpdate) && ps(h, n, t, e), f && ci(t, e, n, "beforeUpdate"), n && Co(n, !0), d && (!e.dynamicChildren || e.dynamicChildren.length !== d.length) && (l = 0, s = !1, d = null), (p.innerHTML && m.innerHTML == null || p.textContent && m.textContent == null) && u(c, ""), d ? E(e.dynamicChildren, d, c, n, r, So(t, i), o) : s || A(e, t, c, null, n, r, So(t, i), o, !1), l > 0) {
			if (l & 16) ee(c, p, m, n, i);
			else if (l & 2 && p.class !== m.class && a(c, "class", null, m.class, i), l & 4 && a(c, "style", p.style, m.style, i), l & 8) {
				let e = t.dynamicProps;
				for (let t = 0; t < e.length; t++) {
					let r = e[t], o = p[r], s = m[r];
					(s !== o || r === "value") && a(c, r, o, s, i, n);
				}
			}
			l & 1 && e.children !== t.children && u(c, t.children);
		} else !s && d == null && ee(c, p, m, n, i);
		((h = m.onVnodeUpdated) || f) && yo(() => {
			h && ps(h, n, t, e), f && ci(t, e, n, "updated");
		}, r);
	}, E = (e, t, n, r, i, a, o) => {
		for (let s = 0; s < t.length; s++) {
			let c = e[s], l = t[s], u = c.el && (c.type === Uo || !ts(c, l) || c.shapeFlag & 198) ? d(c.el) : n;
			h(c, l, u, null, r, i, a, o, !0);
		}
	}, ee = (e, t, n, r, i) => {
		if (t !== n) {
			if (t !== P) for (let o in t) !xt(o) && !(o in n) && a(e, o, t[o], null, i, r);
			for (let o in n) {
				if (xt(o)) continue;
				let s = n[o], c = t[o];
				s !== c && o !== "value" && a(e, o, c, s, i, r);
			}
			"value" in n && a(e, "value", t.value, n.value, i);
		}
	}, D = (e, t, n, i, a, o, c, l, u) => {
		let d = t.el = e ? e.el : s(""), f = t.anchor = e ? e.anchor : s(""), { patchFlag: p, dynamicChildren: m, slotScopeIds: h } = t;
		h && (l = l ? l.concat(h) : h), e == null ? (r(d, n, i), r(f, n, i), w(t.children || [], n, f, a, o, c, l, u)) : p > 0 && p & 64 && m && e.dynamicChildren && e.dynamicChildren.length === m.length ? (E(e.dynamicChildren, m, n, a, o, c, l), (t.key != null || a && t === a.subTree) && To(e, t, !0)) : A(e, t, n, f, a, o, c, l, u);
	}, te = (e, t, n, r, i, a, o, s, c) => {
		t.slotScopeIds = s, e == null ? t.shapeFlag & 512 ? i.ctx.activate(t, n, r, o, c) : ne(t, n, r, i, a, o, c) : O(e, t, c);
	}, ne = (e, t, n, r, i, a, o) => {
		let s = e.component = gs(e, r, i);
		if (Vi(e) && (s.ctx.renderer = me), Ts(s, !1, o), s.asyncDep) {
			if (i && i.registerDep(s, re, o), !e.el) {
				let r = s.subTree = is(Go);
				_(null, r, t, n), e.placeholder = r.el;
			}
		} else re(s, e, t, n, i, a, o);
	}, O = (e, t, n) => {
		let r = t.component = e.component;
		if (Xa(e, t, n)) {
			if (r.asyncDep && !r.asyncResolved) {
				k(r, t, n);
				return;
			}
			r.next = t, r.update();
		} else t.el = e.el, r.vnode = t;
	}, re = (e, t, n, r, i, a, o) => {
		let s = () => {
			if (e.isMounted) {
				let { next: t, bu: n, u: r, parent: s, vnode: c } = e;
				{
					let n = Do(e);
					if (n) {
						t && (t.el = c.el, k(e, t, o)), n.asyncDep.then(() => {
							yo(() => {
								e.isUnmounted || l();
							}, i);
						});
						return;
					}
				}
				let u = t, f;
				Co(e, !1), t ? (t.el = c.el, k(e, t, o)) : t = c, n && At(n), (f = t.props && t.props.onVnodeBeforeUpdate) && ps(f, s, t, c), Co(e, !0);
				let p = Ka(e), m = e.subTree;
				e.subTree = p, h(m, p, d(m.el), de(m), e, i, a), t.el = p.el, u === null && $a(e, p.el), r && yo(r, i), (f = t.props && t.props.onVnodeUpdated) && yo(() => ps(f, s, t, c), i);
			} else {
				let o, { el: s, props: c } = t, { bm: l, m: u, parent: d, root: f, type: p } = e, m = Bi(t);
				if (Co(e, !1), l && At(l), !m && (o = c && c.onVnodeBeforeMount) && ps(o, d, t), Co(e, !0), s && ge) {
					let t = () => {
						e.subTree = Ka(e), ge(s, e.subTree, e, i, null);
					};
					m && p.__asyncHydrate ? p.__asyncHydrate(s, e, t) : t();
				} else {
					f.ce && f.ce._hasShadowRoot() && f.ce._injectChildStyle(p, e.parent ? e.parent.type : void 0);
					let o = e.subTree = Ka(e);
					h(null, o, n, r, e, i, a), t.el = o.el;
				}
				if (u && yo(u, i), !m && (o = c && c.onVnodeMounted)) {
					let e = t;
					yo(() => ps(o, d, e), i);
				}
				(t.shapeFlag & 256 || d && Bi(d.vnode) && d.vnode.shapeFlag & 256) && e.a && yo(e.a, i), e.isMounted = !0, t = n = r = null;
			}
		};
		e.scope.on();
		let c = e.effect = new on(s);
		e.scope.off();
		let l = e.update = c.run.bind(c), u = e.job = c.runIfDirty.bind(c);
		u.i = e, u.id = e.uid, c.scheduler = () => Xr(u), Co(e, !0), l();
	}, k = (e, t, n) => {
		t.component = e;
		let r = e.vnode.props;
		e.vnode = t, e.next = null, io(e, t.props, r, n), vo(e, t.children, n), xn(), $r(e), Sn();
	}, A = (e, t, n, r, i, a, o, s, c = !1) => {
		let l = e && e.children, d = e ? e.shapeFlag : 0, f = t.children, { patchFlag: p, shapeFlag: m } = t;
		if (p > 0) {
			if (p & 128) {
				ae(l, f, n, r, i, a, o, s, c);
				return;
			}
			if (p & 256) {
				ie(l, f, n, r, i, a, o, s, c);
				return;
			}
		}
		m & 8 ? (d & 16 && ue(l, i, a), f !== l && u(n, f)) : d & 16 ? m & 16 ? ae(l, f, n, r, i, a, o, s, c) : ue(l, i, a, !0) : (d & 8 && u(n, ""), m & 16 && w(f, n, r, i, a, o, s, c));
	}, ie = (e, t, n, r, i, a, o, s, c) => {
		e ||= tt, t ||= tt;
		let l = e.length, u = t.length, d = Math.min(l, u), f = 0;
		for (; f < d; f++) {
			let r = t[f] = c ? ds(t[f]) : us(t[f]);
			h(e[f], r, n, null, i, a, o, s, c);
		}
		l > u ? ue(e, i, a, !0, !1, d) : w(t, n, r, i, a, o, s, c, d);
	}, ae = (e, t, n, r, i, a, o, s, c) => {
		let l = 0, u = t.length, d = e.length - 1, f = u - 1;
		for (; l <= d && l <= f;) {
			let r = e[l], u = t[l] = c ? ds(t[l]) : us(t[l]);
			if (ts(r, u)) h(r, u, n, null, i, a, o, s, c);
			else break;
			l++;
		}
		for (; l <= d && l <= f;) {
			let r = e[d], l = t[f] = c ? ds(t[f]) : us(t[f]);
			if (ts(r, l)) h(r, l, n, null, i, a, o, s, c);
			else break;
			d--, f--;
		}
		if (l > d) {
			if (l <= f) {
				let e = f + 1, d = e < u ? t[e].el : r;
				for (; l <= f;) h(null, t[l] = c ? ds(t[l]) : us(t[l]), n, d, i, a, o, s, c), l++;
			}
		} else if (l > f) for (; l <= d;) se(e[l], i, a, !0), l++;
		else {
			let p = l, m = l, g = /* @__PURE__ */ new Map();
			for (l = m; l <= f; l++) {
				let e = t[l] = c ? ds(t[l]) : us(t[l]);
				e.key != null && g.set(e.key, l);
			}
			let _, v = 0, y = f - m + 1, b = !1, x = 0, S = Array(y);
			for (l = 0; l < y; l++) S[l] = 0;
			for (l = p; l <= d; l++) {
				let r = e[l];
				if (v >= y) {
					se(r, i, a, !0);
					continue;
				}
				let u;
				if (r.key != null) u = g.get(r.key);
				else for (_ = m; _ <= f; _++) if (S[_ - m] === 0 && ts(r, t[_])) {
					u = _;
					break;
				}
				u === void 0 ? se(r, i, a, !0) : (S[u - m] = l + 1, u >= x ? x = u : b = !0, h(r, t[u], n, null, i, a, o, s, c), v++);
			}
			let C = b ? Eo(S) : tt;
			for (_ = C.length - 1, l = y - 1; l >= 0; l--) {
				let e = m + l, d = t[e], f = t[e + 1], p = e + 1 < u ? f.el || ko(f) : r;
				S[l] === 0 ? h(null, d, n, p, i, a, o, s, c) : b && (_ < 0 || l !== C[_] ? oe(d, n, p, 2) : _--);
			}
		}
	}, oe = (e, t, n, a, o = null) => {
		let { el: s, type: c, transition: l, children: u, shapeFlag: d } = e;
		if (d & 6) {
			oe(e.component.subTree, t, n, a);
			return;
		}
		if (d & 128) {
			e.suspense.move(t, n, a);
			return;
		}
		if (d & 64) {
			c.move(e, t, n, me);
			return;
		}
		if (c === Uo) {
			r(s, t, n);
			for (let e = 0; e < u.length; e++) oe(u[e], t, n, a);
			r(e.anchor, t, n);
			return;
		}
		if (c === Ko) {
			y(e, t, n);
			return;
		}
		if (a !== 2 && d & 1 && l) {
			if (a === 0) l.persisted && !s[Ai] ? r(s, t, n) : (l.beforeEnter(s), r(s, t, n), yo(() => l.enter(s), o));
			else {
				let { leave: a, delayLeave: o, afterLeave: c } = l, u = () => {
					e.ctx.isUnmounted ? i(s) : r(s, t, n);
				}, d = () => {
					let e = s._isLeaving || !!s[Ai];
					s._isLeaving && s[Ai](!0), l.persisted && !e ? u() : a(s, () => {
						u(), c && c();
					});
				};
				o ? o(s, u, d) : d();
			}
		} else r(s, t, n);
	}, se = (e, t, n, r = !1, i = !1) => {
		let { type: a, props: o, ref: s, children: c, dynamicChildren: l, shapeFlag: u, patchFlag: d, dirs: f, cacheIndex: p, memo: m } = e;
		if (d === -2 && (i = !1), s != null && (xn(), Ri(s, null, n, e, !0), Sn()), p != null && (t.renderCache[p] = void 0), u & 256) {
			t.ctx.deactivate(e);
			return;
		}
		let h = u & 1 && f, g = !Bi(e), _;
		if (g && (_ = o && o.onVnodeBeforeUnmount) && ps(_, t, e), u & 6) le(e.component, n, r);
		else {
			if (u & 128) {
				e.suspense.unmount(n, r);
				return;
			}
			h && ci(e, null, t, "beforeUnmount"), u & 64 ? e.type.remove(e, t, n, me, r) : l && !l.hasOnce && (a !== Uo || d > 0 && d & 64) ? ue(l, t, n, !1, !0) : (a === Uo && d & 384 || !i && u & 16) && ue(c, t, n), r && ce(e);
		}
		let v = m != null && p == null;
		(g && (_ = o && o.onVnodeUnmounted) || h || v) && yo(() => {
			_ && ps(_, t, e), h && ci(e, null, t, "unmounted"), v && (e.el = null);
		}, n);
	}, ce = (e) => {
		let { type: t, el: n, anchor: r, transition: a } = e;
		if (t === Uo) {
			j(n, r);
			return;
		}
		if (t === Ko) {
			b(e);
			return;
		}
		let o = () => {
			i(n), a && !a.persisted && a.afterLeave && a.afterLeave();
		};
		if (e.shapeFlag & 1 && a && !a.persisted) {
			let { leave: t, delayLeave: r } = a, i = () => t(n, o);
			r ? r(e.el, o, i) : i();
		} else o();
	}, j = (e, t) => {
		let n;
		for (; e !== t;) n = f(e), i(e), e = n;
		i(t);
	}, le = (e, t, n) => {
		let { bum: r, scope: i, job: a, subTree: o, um: s, m: c, a: l } = e;
		Oo(c), Oo(l), r && At(r), i.stop(), a && (a.flags |= 8, se(o, e, t, n)), s && yo(s, t), yo(() => {
			e.isUnmounted = !0;
		}, t);
	}, ue = (e, t, n, r = !1, i = !1, a = 0) => {
		for (let o = a; o < e.length; o++) se(e[o], t, n, r, i);
	}, de = (e) => {
		if (e.shapeFlag & 6) return de(e.component.subTree);
		if (e.shapeFlag & 128) return e.suspense.next();
		let t = f(e.anchor || e.el), n = t && t[_i];
		return n ? f(n) : t;
	}, fe = !1, pe = (e, t, n) => {
		let r;
		e == null ? t._vnode && (se(t._vnode, null, null, !0), r = t._vnode.component) : h(t._vnode || null, e, t, null, null, null, n), t._vnode = e, fe ||= (fe = !0, $r(r), ei(), !1);
	}, me = {
		p: h,
		um: se,
		m: oe,
		r: ce,
		mt: ne,
		mc: w,
		pc: A,
		pbc: E,
		n: de,
		o: e
	}, he, ge;
	return t && ([he, ge] = t(me)), {
		render: pe,
		hydrate: he,
		createApp: za(pe, he)
	};
}
function So({ type: e, props: t }, n) {
	return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function Co({ effect: e, job: t }, n) {
	n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function wo(e, t) {
	return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function To(e, t, n = !1) {
	let r = e.children, i = t.children;
	if (I(r) && I(i)) for (let e = 0; e < r.length; e++) {
		let t = r[e], a = i[e];
		a.shapeFlag & 1 && !a.dynamicChildren && ((a.patchFlag <= 0 || a.patchFlag === 32) && (a = i[e] = ds(i[e]), a.el = t.el), !n && a.patchFlag !== -2 && To(t, a)), a.type === Wo && (a.patchFlag === -1 && (a = i[e] = ds(a)), a.el = t.el), a.type === Go && !a.el && (a.el = t.el);
	}
}
function Eo(e) {
	let t = e.slice(), n = [0], r, i, a, o, s, c = e.length;
	for (r = 0; r < c; r++) {
		let c = e[r];
		if (c !== 0) {
			if (i = n[n.length - 1], e[i] < c) {
				t[r] = i, n.push(r);
				continue;
			}
			for (a = 0, o = n.length - 1; a < o;) s = a + o >> 1, e[n[s]] < c ? a = s + 1 : o = s;
			c < e[n[a]] && (a > 0 && (t[r] = n[a - 1]), n[a] = r);
		}
	}
	for (a = n.length, o = n[a - 1]; a-- > 0;) n[a] = o, o = t[o];
	return n;
}
function Do(e) {
	let t = e.subTree.component;
	if (t) return t.asyncDep && !t.asyncResolved ? t : Do(t);
}
function Oo(e) {
	if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function ko(e) {
	if (e.placeholder) return e.placeholder;
	let t = e.component;
	return t ? ko(t.subTree) : null;
}
var Ao = (e) => e.__isSuspense, jo = 0, Mo = {
	name: "Suspense",
	__isSuspense: !0,
	process(e, t, n, r, i, a, o, s, c, l) {
		if (e == null) Po(t, n, r, i, a, o, s, c, l);
		else {
			if (a && a.deps > 0 && !e.suspense.isInFallback) {
				t.suspense = e.suspense, t.suspense.vnode = t, t.el = e.el;
				return;
			}
			Fo(e, t, n, r, i, o, s, c, l);
		}
	},
	hydrate: Lo,
	normalize: Ro
};
function No(e, t) {
	let n = e.props && e.props[t];
	L(n) && n();
}
function Po(e, t, n, r, i, a, o, s, c) {
	let { p: l, o: { createElement: u } } = c, d = u("div"), f = e.suspense = Io(e, i, r, t, d, n, a, o, s, c);
	l(null, f.pendingBranch = e.ssContent, d, null, r, f, a, o), f.deps > 0 ? (No(e, "onPending"), No(e, "onFallback"), l(null, e.ssFallback, t, n, r, null, a, o), Vo(f, e.ssFallback)) : f.resolve(!1, !0);
}
function Fo(e, t, n, r, i, a, o, s, { p: c, um: l, o: { createElement: u } }) {
	let d = t.suspense = e.suspense;
	d.vnode = t, t.el = e.el;
	let f = t.ssContent, p = t.ssFallback, { activeBranch: m, pendingBranch: h, isInFallback: g, isHydrating: _ } = d;
	if (h) d.pendingBranch = f, ts(h, f) ? (c(h, f, d.hiddenContainer, null, i, d, a, o, s), d.deps <= 0 ? d.resolve() : g && !_ && !d.isFallbackMountPending && (c(m, p, n, r, i, null, a, o, s), Vo(d, p))) : (d.pendingId = jo++, _ ? (d.isHydrating = !1, d.activeBranch = h) : l(h, i, d), d.deps = 0, d.effects.length = 0, d.hiddenContainer = u("div"), g ? (c(null, f, d.hiddenContainer, null, i, d, a, o, s), d.deps <= 0 ? d.resolve() : d.isFallbackMountPending || (c(m, p, n, r, i, null, a, o, s), Vo(d, p))) : m && ts(m, f) ? (c(m, f, n, r, i, d, a, o, s), d.resolve(!0)) : (c(null, f, d.hiddenContainer, null, i, d, a, o, s), d.deps <= 0 && d.resolve()));
	else if (m && ts(m, f)) c(m, f, n, r, i, d, a, o, s), Vo(d, f);
	else if (No(t, "onPending"), d.pendingBranch = f, d.pendingId = f.shapeFlag & 512 ? f.component.suspenseId : jo++, c(null, f, d.hiddenContainer, null, i, d, a, o, s), d.deps <= 0) d.resolve();
	else {
		let { timeout: e, pendingId: t } = d;
		e > 0 ? setTimeout(() => {
			d.pendingId === t && d.fallback(p);
		}, e) : e === 0 && d.fallback(p);
	}
}
function Io(e, t, n, r, i, a, o, s, c, l, u = !1) {
	let { p: d, m: f, um: p, n: m, o: { parentNode: h, remove: g } } = l, _, v = Ho(e);
	v && t && t.pendingBranch && (_ = t.pendingId, t.deps++);
	let y = e.props ? Nt(e.props.timeout) : void 0, b = a, x = {
		vnode: e,
		parent: t,
		parentComponent: n,
		namespace: o,
		container: r,
		hiddenContainer: i,
		deps: 0,
		pendingId: jo++,
		timeout: typeof y == "number" ? y : -1,
		activeBranch: null,
		isFallbackMountPending: !1,
		pendingBranch: null,
		isInFallback: !u,
		isHydrating: u,
		isUnmounted: !1,
		effects: [],
		resolve(e = !1, n = !1) {
			let { vnode: r, activeBranch: i, pendingBranch: o, pendingId: s, effects: c, parentComponent: l, container: u, isInFallback: d } = x, g = !1;
			if (x.isHydrating) x.isHydrating = !1;
			else if (!e) {
				g = i && o.transition && o.transition.mode === "out-in";
				let e = !1;
				g && (i.transition.afterLeave = () => {
					s === x.pendingId && (f(o, u, a === b && !e ? m(i) : a, 0), Qr(c), d && r.ssFallback && (r.ssFallback.el = null));
				}), i && !x.isFallbackMountPending && (h(i.el) === u && (a = m(i), e = !0), p(i, l, x, !0), !g && d && r.ssFallback && yo(() => r.ssFallback.el = null, x)), g || f(o, u, a, 0);
			}
			x.isFallbackMountPending = !1, Vo(x, o), x.pendingBranch = null, x.isInFallback = !1;
			let y = x.parent, S = !1;
			for (; y;) {
				if (y.pendingBranch) {
					for (let e = 0; e < c.length; e++) y.effects.push(c[e]);
					S = !0;
					break;
				}
				y = y.parent;
			}
			!S && !g && Qr(c), x.effects = [], v && t && t.pendingBranch && _ === t.pendingId && (t.deps--, t.deps === 0 && !n && t.resolve()), No(r, "onResolve");
		},
		fallback(e) {
			if (!x.pendingBranch) return;
			let { vnode: t, activeBranch: n, parentComponent: r, container: i, namespace: a } = x;
			No(t, "onFallback");
			let o = m(n), l = () => {
				if (x.isFallbackMountPending = !1, !x.isInFallback) return;
				let e = x.vnode.ssFallback;
				d(null, e, i, o, r, null, a, s, c), Vo(x, e);
			}, u = e.transition && e.transition.mode === "out-in";
			u && (x.isFallbackMountPending = !0, n.transition.afterLeave = l), x.isInFallback = !0, p(n, r, null, !0), u || l();
		},
		move(e, t, n) {
			x.activeBranch && f(x.activeBranch, e, t, n), x.container = e;
		},
		next() {
			return x.activeBranch && m(x.activeBranch);
		},
		registerDep(e, t, n) {
			let r = !!x.pendingBranch;
			r && x.deps++;
			let i = e.vnode.el;
			e.asyncDep.catch((t) => {
				zr(t, e, 0);
			}).then((a) => {
				if (e.isUnmounted || x.isUnmounted || x.pendingId !== e.suspenseId) return;
				Ss(), e.asyncResolved = !0;
				let { vnode: s } = e;
				Ds(e, a, !1), i && (s.el = i);
				let c = !i && e.subTree.el;
				t(e, s, h(i || e.subTree.el), i ? null : m(e.subTree), x, o, n), c && (s.placeholder = null, g(c)), $a(e, s.el), r && --x.deps === 0 && x.resolve();
			});
		},
		unmount(e, t) {
			x.isUnmounted = !0, x.activeBranch && p(x.activeBranch, n, e, t), x.pendingBranch && p(x.pendingBranch, n, e, t);
		}
	};
	return x;
}
function Lo(e, t, n, r, i, a, o, s, c) {
	let l = t.suspense = Io(t, r, n, e.parentNode, document.createElement("div"), null, i, a, o, s, !0), u = c(e, l.pendingBranch = t.ssContent, n, l, a, o);
	return l.deps === 0 && l.resolve(!1, !0), u;
}
function Ro(e) {
	let { shapeFlag: t, children: n } = e, r = t & 32;
	e.ssContent = zo(r ? n.default : n), e.ssFallback = r ? zo(n.fallback) : is(Go);
}
function zo(e) {
	let t;
	if (L(e)) {
		let n = Xo && e._c;
		n && (e._d = !1, W()), e = e(), n && (e._d = !0, t = Jo, Yo());
	}
	return I(e) && (e = qa(e)), e = us(e), t && !e.dynamicChildren && (e.dynamicChildren = t.filter((t) => t !== e)), e;
}
function Bo(e, t) {
	t && t.pendingBranch ? I(e) ? t.effects.push(...e) : t.effects.push(e) : Qr(e);
}
function Vo(e, t) {
	e.activeBranch = t;
	let { vnode: n, parentComponent: r } = e, i = t.el;
	for (; !i && t.component;) t = t.component.subTree, i = t.el;
	n.el = i, r && r.subTree === n && (r.vnode.el = i, $a(r, i));
}
function Ho(e) {
	let t = e.props && e.props.suspensible;
	return t != null && t !== !1;
}
var Uo = /* @__PURE__ */ Symbol.for("v-fgt"), Wo = /* @__PURE__ */ Symbol.for("v-txt"), Go = /* @__PURE__ */ Symbol.for("v-cmt"), Ko = /* @__PURE__ */ Symbol.for("v-stc"), qo = [], Jo = null;
function W(e = !1) {
	qo.push(Jo = e ? null : []);
}
function Yo() {
	qo.pop(), Jo = qo[qo.length - 1] || null;
}
var Xo = 1;
function Zo(e, t = !1) {
	Xo += e, e < 0 && Jo && t && (Jo.hasOnce = !0);
}
function Qo(e) {
	return e.dynamicChildren = Xo > 0 ? Jo || tt : null, Yo(), Xo > 0 && Jo && Jo.push(e), e;
}
function G(e, t, n, r, i, a) {
	return Qo(K(e, t, n, r, i, a, !0));
}
function $o(e, t, n, r, i) {
	return Qo(is(e, t, n, r, i, !0));
}
function es(e) {
	return e ? e.__v_isVNode === !0 : !1;
}
function ts(e, t) {
	return e.type === t.type && e.key === t.key;
}
var ns = ({ key: e }) => e ?? null, rs = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e == null ? null : ft(e) || /* @__PURE__ */ wr(e) || L(e) ? {
	i: ri,
	r: e,
	k: t,
	f: !!n
} : e);
function K(e, t = null, n = null, r = 0, i = null, a = e === Uo ? 0 : 1, o = !1, s = !1) {
	let c = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e,
		props: t,
		key: t && ns(t),
		ref: t && rs(t),
		scopeId: ii,
		slotScopeIds: null,
		children: n,
		component: null,
		suspense: null,
		ssContent: null,
		ssFallback: null,
		dirs: null,
		transition: null,
		el: null,
		anchor: null,
		target: null,
		targetStart: null,
		targetAnchor: null,
		staticCount: 0,
		shapeFlag: a,
		patchFlag: r,
		dynamicProps: i,
		dynamicChildren: null,
		appContext: null,
		ctx: ri
	};
	return s ? (fs(c, n), a & 128 && e.normalize(c)) : n && (c.shapeFlag |= ft(n) ? 8 : 16), Xo > 0 && !o && Jo && (c.patchFlag > 0 || a & 6) && c.patchFlag !== 32 && Jo.push(c), c;
}
var is = as;
function as(e, t = null, n = null, r = 0, i = null, a = !1) {
	if ((!e || e === sa) && (e = Go), es(e)) {
		let r = ss(e, t, !0);
		return n && fs(r, n), Xo > 0 && !a && Jo && (r.shapeFlag & 6 ? Jo[Jo.indexOf(e)] = r : Jo.push(r)), r.patchFlag = -2, r;
	}
	if (Ns(e) && (e = e.__vccOpts), t) {
		t = os(t);
		let { class: e, style: n } = t;
		e && !ft(e) && (t.class = Vt(e)), mt(n) && (/* @__PURE__ */ br(n) && !I(n) && (n = ot({}, n)), t.style = It(n));
	}
	let o = ft(e) ? 1 : Ao(e) ? 128 : vi(e) ? 64 : mt(e) ? 4 : L(e) ? 2 : 0;
	return K(e, t, n, r, i, o, a, !0);
}
function os(e) {
	return e ? /* @__PURE__ */ br(e) || no(e) ? ot({}, e) : e : null;
}
function ss(e, t, n = !1, r = !1) {
	let { props: i, ref: a, patchFlag: o, children: s, transition: c } = e, l = t ? q(i || {}, t) : i, u = {
		__v_isVNode: !0,
		__v_skip: !0,
		type: e.type,
		props: l,
		key: l && ns(l),
		ref: t && t.ref ? n && a ? I(a) ? a.concat(rs(t)) : [a, rs(t)] : rs(t) : a,
		scopeId: e.scopeId,
		slotScopeIds: e.slotScopeIds,
		children: s,
		target: e.target,
		targetStart: e.targetStart,
		targetAnchor: e.targetAnchor,
		staticCount: e.staticCount,
		shapeFlag: e.shapeFlag,
		patchFlag: t && e.type !== Uo ? o === -1 ? 16 : o | 16 : o,
		dynamicProps: e.dynamicProps,
		dynamicChildren: e.dynamicChildren,
		appContext: e.appContext,
		dirs: e.dirs,
		transition: c,
		component: e.component,
		suspense: e.suspense,
		ssContent: e.ssContent && ss(e.ssContent),
		ssFallback: e.ssFallback && ss(e.ssFallback),
		placeholder: e.placeholder,
		el: e.el,
		anchor: e.anchor,
		ctx: e.ctx,
		ce: e.ce
	};
	return c && r && Ni(u, c.clone(u)), u;
}
function cs(e = " ", t = 0) {
	return is(Wo, null, e, t);
}
function ls(e = "", t = !1) {
	return t ? (W(), $o(Go, null, e)) : is(Go, null, e);
}
function us(e) {
	return e == null || typeof e == "boolean" ? is(Go) : I(e) ? is(Uo, null, e.slice()) : es(e) ? ds(e) : is(Wo, null, String(e));
}
function ds(e) {
	return e.el === null && e.patchFlag !== -1 || e.memo ? e : ss(e);
}
function fs(e, t) {
	let n = 0, { shapeFlag: r } = e;
	if (t == null) t = null;
	else if (I(t)) n = 16;
	else if (typeof t == "object") {
		if (r & 65) {
			let n = t.default;
			n && (n._c && (n._d = !1), fs(e, n()), n._c && (n._d = !0));
			return;
		}
		{
			n = 32;
			let r = t._;
			!r && !no(t) ? t._ctx = ri : r === 3 && ri && (ri.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
		}
	} else if (L(t)) {
		if (r & 65) {
			fs(e, { default: t });
			return;
		}
		t = {
			default: t,
			_ctx: ri
		}, n = 32;
	} else t = String(t), r & 64 ? (n = 16, t = [cs(t)]) : n = 8;
	e.children = t, e.shapeFlag |= n;
}
function q(...e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		for (let e in r) if (e === "class") t.class !== r.class && (t.class = Vt([t.class, r.class]));
		else if (e === "style") t.style = It([t.style, r.style]);
		else if (it(e)) {
			let n = t[e], i = r[e];
			i && n !== i && !(I(n) && n.includes(i)) ? t[e] = n ? [].concat(n, i) : i : i == null && n == null && !at(e) && (t[e] = i);
		} else e !== "" && (t[e] = r[e]);
	}
	return t;
}
function ps(e, t, n, r = null) {
	Rr(e, t, 7, [n, r]);
}
var ms = La(), hs = 0;
function gs(e, t, n) {
	let r = e.type, i = (t ? t.appContext : e.appContext) || ms, a = {
		uid: hs++,
		vnode: e,
		type: r,
		parent: t,
		appContext: i,
		root: null,
		next: null,
		subTree: null,
		effect: null,
		update: null,
		job: null,
		scope: new tn(!0),
		render: null,
		proxy: null,
		exposed: null,
		exposeProxy: null,
		withProxy: null,
		provides: t ? t.provides : Object.create(i.provides),
		ids: t ? t.ids : [
			"",
			0,
			0
		],
		accessCache: null,
		renderCache: [],
		components: null,
		directives: null,
		propsOptions: co(r, i),
		emitsOptions: Wa(r, i),
		emit: null,
		emitted: null,
		propsDefaults: P,
		inheritAttrs: r.inheritAttrs,
		ctx: P,
		data: P,
		props: P,
		attrs: P,
		slots: P,
		refs: P,
		setupState: P,
		setupContext: null,
		suspense: n,
		suspenseId: n ? n.pendingId : 0,
		asyncDep: null,
		asyncResolved: !1,
		isMounted: !1,
		isUnmounted: !1,
		isDeactivated: !1,
		bc: null,
		c: null,
		bm: null,
		m: null,
		bu: null,
		u: null,
		um: null,
		bum: null,
		da: null,
		a: null,
		rtg: null,
		rtc: null,
		ec: null,
		sp: null
	};
	return a.ctx = { _: a }, a.root = t ? t.root : a, a.emit = Ha.bind(null, a), e.ce && e.ce(a), a;
}
var _s = null, vs = () => _s || ri, ys, bs;
{
	let e = Ft(), t = (t, n) => {
		let r;
		return (r = e[t]) || (r = e[t] = []), r.push(n), (e) => {
			r.length > 1 ? r.forEach((t) => t(e)) : r[0](e);
		};
	};
	ys = t("__VUE_INSTANCE_SETTERS__", (e) => _s = e), bs = t("__VUE_SSR_SETTERS__", (e) => ws = e);
}
var xs = (e) => {
	let t = _s;
	return ys(e), e.scope.on(), () => {
		e.scope.off(), ys(t);
	};
}, Ss = () => {
	_s && _s.scope.off(), ys(null);
};
function Cs(e) {
	return e.vnode.shapeFlag & 4;
}
var ws = !1;
function Ts(e, t = !1, n = !1) {
	t && bs(t);
	let { props: r, children: i } = e.vnode, a = Cs(e);
	ro(e, r, a, t), _o(e, i, n || t);
	let o = a ? Es(e, t) : void 0;
	return t && bs(!1), o;
}
function Es(e, t) {
	let n = e.type;
	e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, _a);
	let { setup: r } = n;
	if (r) {
		xn();
		let n = e.setupContext = r.length > 1 ? As(e) : null, i = xs(e), a = Lr(r, e, 0, [e.props, n]), o = ht(a);
		if (Sn(), i(), (o || e.sp) && !Bi(e) && Fi(e), o) {
			if (a.then(Ss, Ss), t) return a.then((n) => {
				bs(!0);
				try {
					Ds(e, n, t);
				} finally {
					bs(!1);
				}
			}).catch((t) => {
				zr(t, e, 0);
			});
			e.asyncDep = a;
		} else Ds(e, a, t);
	} else Os(e, t);
}
function Ds(e, t, n) {
	L(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : mt(t) && (e.setupState = Or(t)), Os(e, n);
}
function Os(e, t, n) {
	let r = e.type;
	e.render ||= r.render || nt;
	{
		let t = xs(e);
		xn();
		try {
			Ca(e);
		} finally {
			Sn(), t();
		}
	}
}
var ks = { get(e, t) {
	return Mn(e, "get", ""), e[t];
} };
function As(e) {
	return {
		attrs: new Proxy(e.attrs, ks),
		slots: e.slots,
		emit: e.emit,
		expose: (t) => {
			e.exposed = t || {};
		}
	};
}
function js(e) {
	return e.exposed ? e.exposeProxy ||= new Proxy(Or(xr(e.exposed)), {
		get(t, n) {
			if (n in t) return t[n];
			if (n in ha) return ha[n](e);
		},
		has(e, t) {
			return t in e || t in ha;
		}
	}) : e.proxy;
}
function Ms(e, t = !0) {
	return L(e) ? e.displayName || e.name : e.name || t && e.__name;
}
function Ns(e) {
	return L(e) && "__vccOpts" in e;
}
var J = (e, t) => /* @__PURE__ */ Ar(e, t, ws);
function Ps(e, t, n) {
	try {
		Zo(-1);
		let r = arguments.length;
		return r === 2 ? mt(t) && !I(t) ? es(t) ? is(e, null, [t]) : is(e, t) : is(e, null, t) : (r > 3 ? n = Array.prototype.slice.call(arguments, 2) : r === 3 && es(n) && (n = [n]), is(e, t, n));
	} finally {
		Zo(1);
	}
}
var Fs = "3.5.42", Is = void 0, Ls = typeof window < "u" && window.trustedTypes;
if (Ls) try {
	Is = /* @__PURE__ */ Ls.createPolicy("vue", { createHTML: (e) => e });
} catch {}
var Rs = Is ? (e) => Is.createHTML(e) : (e) => e, zs = "http://www.w3.org/2000/svg", Bs = "http://www.w3.org/1998/Math/MathML", Vs = typeof document < "u" ? document : null, Hs = Vs && /* @__PURE__ */ Vs.createElement("template"), Us = {
	insert: (e, t, n) => {
		t.insertBefore(e, n || null);
	},
	remove: (e) => {
		let t = e.parentNode;
		t && t.removeChild(e);
	},
	createElement: (e, t, n, r) => {
		let i = t === "svg" ? Vs.createElementNS(zs, e) : t === "mathml" ? Vs.createElementNS(Bs, e) : n ? Vs.createElement(e, { is: n }) : Vs.createElement(e);
		return e === "select" && r && r.multiple != null && i.setAttribute("multiple", r.multiple), i;
	},
	createText: (e) => Vs.createTextNode(e),
	createComment: (e) => Vs.createComment(e),
	setText: (e, t) => {
		e.nodeValue = t;
	},
	setElementText: (e, t) => {
		e.textContent = t;
	},
	parentNode: (e) => e.parentNode,
	nextSibling: (e) => e.nextSibling,
	querySelector: (e) => Vs.querySelector(e),
	setScopeId(e, t) {
		e.setAttribute(t, "");
	},
	insertStaticContent(e, t, n, r, i, a) {
		let o = n ? n.previousSibling : t.lastChild;
		if (i && (i === a || i.nextSibling)) for (; t.insertBefore(i.cloneNode(!0), n), i !== a && (i = i.nextSibling););
		else {
			Hs.innerHTML = Rs(r === "svg" ? `<svg>${e}</svg>` : r === "mathml" ? `<math>${e}</math>` : e);
			let i = Hs.content;
			if (r === "svg" || r === "mathml") {
				let e = i.firstChild;
				for (; e.firstChild;) i.appendChild(e.firstChild);
				i.removeChild(e);
			}
			t.insertBefore(i, n);
		}
		return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
	}
}, Ws = /* @__PURE__ */ Symbol("_vtc");
function Gs(e, t, n) {
	let r = e[Ws];
	r && (t = (t ? [t, ...r] : [...r]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
var Ks = /* @__PURE__ */ Symbol("_vod"), qs = /* @__PURE__ */ Symbol("_vsh"), Js = {
	name: "show",
	beforeMount(e, { value: t }, { transition: n }) {
		e[Ks] = e.style.display === "none" ? "" : e.style.display, n && t ? n.beforeEnter(e) : Ys(e, t);
	},
	mounted(e, { value: t }, { transition: n }) {
		n && t && n.enter(e);
	},
	updated(e, { value: t, oldValue: n }, { transition: r }) {
		!t != !n && (r ? t ? (r.beforeEnter(e), Ys(e, !0), r.enter(e)) : r.leave(e, () => {
			Ys(e, !1);
		}) : Ys(e, t));
	},
	beforeUnmount(e, { value: t }) {
		Ys(e, t);
	}
};
function Ys(e, t) {
	e.style.display = t ? e[Ks] : "none", e[qs] = !t;
}
var Xs = /* @__PURE__ */ Symbol("");
function Zs(e) {
	let t = vs();
	if (!t) return;
	let n = t.ut = (n = e(t.proxy)) => {
		Array.from(document.querySelectorAll(`[data-v-owner="${t.uid}"]`)).forEach((e) => $s(e, n));
	}, r = () => {
		let r = e(t.proxy);
		t.ce ? $s(t.ce, r) : Qs(t.subTree, r), n(r);
	};
	Xi(() => {
		Qr(r);
	}), Yi(() => {
		H(r, nt, { flush: "post" });
		let e = new MutationObserver(r);
		e.observe(t.subTree.el.parentNode, { childList: !0 }), $i(() => e.disconnect());
	});
}
function Qs(e, t) {
	if (e.shapeFlag & 128) {
		let n = e.suspense;
		e = n.activeBranch, n.pendingBranch && !n.isHydrating && n.effects.push(() => {
			Qs(n.activeBranch, t);
		});
	}
	for (; e.component;) e = e.component.subTree;
	if (e.shapeFlag & 1 && e.el) $s(e.el, t);
	else if (e.type === Uo) e.children.forEach((e) => Qs(e, t));
	else if (e.type === Ko) {
		let { el: n, anchor: r } = e;
		for (; n && ($s(n, t), n !== r);) n = n.nextSibling;
	}
}
function $s(e, t) {
	if (e.nodeType === 1) {
		let n = e.style, r = "";
		for (let e in t) {
			let i = $t(t[e]);
			n.setProperty(`--${e}`, i), r += `--${e}: ${i};`;
		}
		n[Xs] = r;
	}
}
var ec = /(?:^|;)\s*display\s*:/;
function tc(e, t, n) {
	let r = e.style, i = ft(n), a = !1;
	if (n && !i) {
		if (t) {
			if (ft(t)) for (let e of t.split(";")) {
				let t = e.slice(0, e.indexOf(":")).trim();
				n[t] ?? rc(r, t, "");
			}
			else for (let e in t) n[e] ?? rc(r, e, "");
		}
		for (let i in n) {
			i === "display" && (a = !0);
			let o = n[i];
			o == null ? rc(r, i, "") : sc(e, i, !ft(t) && t ? t[i] : void 0, o) || rc(r, i, o);
		}
	} else if (i) {
		if (t !== n) {
			let e = r[Xs];
			e && (n += ";" + e), r.cssText = n, a = ec.test(n);
		}
	} else t && e.removeAttribute("style");
	Ks in e && (e[Ks] = a ? r.display : "", e[qs] && (r.display = "none"));
}
var nc = /\s*!important$/;
function rc(e, t, n) {
	if (I(n)) n.forEach((n) => rc(e, t, n));
	else if (n ??= "", t.startsWith("--")) nc.test(n) ? e.setProperty(t, n.replace(nc, ""), "important") : e.setProperty(t, n);
	else {
		let r = oc(e, t);
		nc.test(n) ? e.setProperty(Et(r), n.replace(nc, ""), "important") : e[r] = n;
	}
}
var ic = [
	"Webkit",
	"Moz",
	"ms"
], ac = {};
function oc(e, t) {
	let n = ac[t];
	if (n) return n;
	let r = wt(t);
	if (r !== "filter" && r in e) return ac[t] = r;
	r = Dt(r);
	for (let n = 0; n < ic.length; n++) {
		let i = ic[n] + r;
		if (i in e) return ac[t] = i;
	}
	return t;
}
function sc(e, t, n, r) {
	return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ft(r) && n === r;
}
var cc = "http://www.w3.org/1999/xlink";
function lc(e, t, n, r, i, a = Wt(t)) {
	r && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(cc, t.slice(6, t.length)) : e.setAttributeNS(cc, t, n) : n == null || a && !Gt(n) ? e.removeAttribute(t) : e.setAttribute(t, a ? "" : pt(n) ? String(n) : n);
}
function uc(e, t, n, r, i) {
	if (t === "innerHTML" || t === "textContent") {
		n != null && (e[t] = t === "innerHTML" ? Rs(n) : n);
		return;
	}
	let a = e.tagName;
	if (t === "value" && a !== "PROGRESS" && !a.includes("-")) {
		let r = a === "OPTION" ? e.getAttribute("value") || "" : e.value, i = n == null ? e.type === "checkbox" ? "on" : "" : String(n);
		(r !== i || !("_value" in e)) && (e.value = i), n ?? e.removeAttribute(t), e._value = n;
		return;
	}
	let o = !1;
	if (n === "" || n == null) {
		let r = typeof e[t];
		r === "boolean" ? n = Gt(n) : n == null && r === "string" ? (n = "", o = !0) : r === "number" && (n = 0, o = !0);
	}
	try {
		e[t] = n;
	} catch {}
	o && e.removeAttribute(i || t);
}
function dc(e, t, n, r) {
	e.addEventListener(t, n, r);
}
function fc(e, t, n, r) {
	e.removeEventListener(t, n, r);
}
var pc = /* @__PURE__ */ Symbol("_vei");
function mc(e, t, n, r, i = null) {
	let a = e[pc] || (e[pc] = {}), o = a[t];
	if (r && o) o.value = r;
	else {
		let [n, s] = _c(t);
		r ? dc(e, n, a[t] = xc(r, i), s) : o && (fc(e, n, o, s), a[t] = void 0);
	}
}
var hc = /(Once|Passive|Capture)$/, gc = /^on:?(?:Once|Passive|Capture)$/;
function _c(e) {
	let t, n;
	for (; (n = e.match(hc)) && !gc.test(e);) t ||= {}, e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = !0;
	return [e[2] === ":" ? e.slice(3) : Et(e.slice(2)), t];
}
var vc = 0, yc = /* @__PURE__ */ Promise.resolve(), bc = () => vc ||= (yc.then(() => vc = 0), Date.now());
function xc(e, t) {
	let n = (e) => {
		if (!e._vts) e._vts = Date.now();
		else if (e._vts <= n.attached) return;
		let r = n.value;
		if (I(r)) {
			let n = e.stopImmediatePropagation;
			e.stopImmediatePropagation = () => {
				n.call(e), e._stopped = !0;
			};
			let i = r.slice(), a = [e];
			for (let n = 0; n < i.length && !e._stopped; n++) {
				let e = i[n];
				e && Rr(e, t, 5, a);
			}
		} else Rr(r, t, 5, [e]);
	};
	return n.value = e, n.attached = bc(), n;
}
var Sc = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Cc = (e, t, n, r, i, a) => {
	let o = i === "svg";
	t === "class" ? Gs(e, r, o) : t === "style" ? tc(e, n, r) : it(t) ? at(t) || mc(e, t, n, r, a) : (t[0] === "." ? (t = t.slice(1), 1) : t[0] === "^" ? (t = t.slice(1), 0) : wc(e, t, r, o)) ? (uc(e, t, r), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && lc(e, t, r, o, a, t !== "value")) : e._isVueCE && (Tc(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !ft(r))) ? uc(e, wt(t), r, a, t) : (t === "true-value" ? e._trueValue = r : t === "false-value" && (e._falseValue = r), lc(e, t, r, o));
};
function wc(e, t, n, r) {
	if (r) return !!(t === "innerHTML" || t === "textContent" || t in e && Sc(t) && L(n));
	if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA") return !1;
	if (t === "width" || t === "height") {
		let t = e.tagName;
		if (t === "IMG" || t === "VIDEO" || t === "CANVAS" || t === "SOURCE") return !1;
	}
	return Sc(t) && ft(n) ? !1 : t in e;
}
function Tc(e, t) {
	let n = e._def.props;
	if (!n) return !1;
	let r = wt(t);
	return Array.isArray(n) ? n.some((e) => wt(e) === r) : Object.keys(n).some((e) => wt(e) === r);
}
var Ec = [
	"ctrl",
	"shift",
	"alt",
	"meta"
], Dc = {
	stop: (e) => e.stopPropagation(),
	prevent: (e) => e.preventDefault(),
	self: (e) => e.target !== e.currentTarget,
	ctrl: (e) => !e.ctrlKey,
	shift: (e) => !e.shiftKey,
	alt: (e) => !e.altKey,
	meta: (e) => !e.metaKey,
	left: (e) => "button" in e && e.button !== 0,
	middle: (e) => "button" in e && e.button !== 1,
	right: (e) => "button" in e && e.button !== 2,
	exact: (e, t) => Ec.some((n) => e[`${n}Key`] && !t.includes(n))
}, Oc = (e, t) => {
	if (!e) return e;
	let n = e._withMods ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n, ...r) => {
		for (let e = 0; e < t.length; e++) {
			let r = Dc[t[e]];
			if (r && r(n, t)) return;
		}
		return e(n, ...r);
	}));
}, kc = {
	esc: "escape",
	space: " ",
	up: "arrow-up",
	left: "arrow-left",
	right: "arrow-right",
	down: "arrow-down",
	delete: "backspace"
}, Ac = (e, t) => {
	let n = e._withKeys ||= {}, r = t.join(".");
	return n[r] || (n[r] = ((n) => {
		if (!("key" in n)) return;
		let r = Et(n.key);
		if (t.some((e) => e === r || kc[e] === r)) return e(n);
	}));
}, jc = /* @__PURE__ */ ot({ patchProp: Cc }, Us), Mc;
function Nc() {
	return Mc ||= bo(jc);
}
var Pc = ((...e) => {
	let t = Nc().createApp(...e), { mount: n } = t;
	return t.mount = (e) => {
		let r = Ic(e);
		if (!r) return;
		let i = t._component;
		!L(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
		let a = n(r, !1, Fc(r));
		return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), a;
	}, t;
});
function Fc(e) {
	if (e instanceof SVGElement) return "svg";
	if (typeof MathMLElement == "function" && e instanceof MathMLElement) return "mathml";
}
function Ic(e) {
	return ft(e) ? document.querySelector(e) : e;
}
var Lc = Object.defineProperty, Y = (e, t) => {
	let n = {};
	for (var r in e) Lc(n, r, {
		get: e[r],
		enumerable: !0
	});
	return t || Lc(n, Symbol.toStringTag, { value: "Module" }), n;
};
function Rc(e) {
	return typeof e == "function";
}
function zc(e) {
	return typeof e == "string";
}
function Bc() {
	return Math.random().toString(36).slice(2, 7);
}
function Vc(e) {
	return e.toLowerCase().replace(/-(.)/g, (e, t) => t.toUpperCase());
}
function Hc(e) {
	return e.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
function Uc(e, t) {
	if (!e) return;
	let n = {};
	for (let r in e) {
		if (!r.startsWith("data-")) continue;
		let i = Vc(r.replace(/^data-/, ""));
		n[i] = t(e[r]);
	}
	return n;
}
var Wc = typeof window < "u" && typeof navigator < "u", Gc = Wc && /Android/i.test(navigator.userAgent), Kc = Wc && /iPad|iPhone|iPod/.test(navigator.userAgent), qc = Wc && /OpenHarmony|harmony/.test(navigator.userAgent), Jc = Wc && !/Android|iPad|iPhone|iPod|OpenHarmony|harmony|Mobile/.test(navigator.userAgent);
typeof WorkerGlobalScope < "u" && globalThis instanceof WorkerGlobalScope;
function Yc(e, t) {
	if (t.startsWith("/")) return t.slice(1);
	let n = e.split("/"), r = t.split("/");
	for (let e of r) {
		let t = e;
		t === ".." ? n.length > 0 && n.pop() : t !== "." && t !== "" && n.push(t);
	}
	return n.join("/");
}
function Xc(e, t) {
	let n = e.split("/").slice(0, -1).join("/"), r = t.split("?"), i = r[0], a = r[1], o = Yc(n, i);
	return a && (o += `?${a}`), o;
}
var Zc = /([+-]?\d+(?:\.\d+)?)rpx/g;
function Qc(e) {
	return zc(e) ? e.replace(Zc, (e, t) => {
		let n = Number((Number(t) / 7.5).toFixed(6));
		return `${Object.is(n, -0) ? 0 : n}vw`;
	}) : e;
}
function $c(e) {
	return typeof e == "number" && Number.isFinite(e) && !Number.isNaN(e) ? `${e}px` : e;
}
function el(e) {
	return `${e}deg`;
}
var tl = {
	matrix(e) {
		return `matrix(${e.join(", ")})`;
	},
	matrix3d(e) {
		return `matrix3d(${e.join(", ")})`;
	},
	rotate(e) {
		let [t] = e.map(el);
		return `rotate(${t})`;
	},
	rotate3d(e) {
		return e[3] = el(e[3]), `rotate3d(${e.join(", ")})`;
	},
	rotateX(e) {
		let [t] = e.map(el);
		return `rotateX(${t})`;
	},
	rotateY(e) {
		let [t] = e.map(el);
		return `rotateY(${t})`;
	},
	rotateZ(e) {
		let [t] = e.map(el);
		return `rotateZ(${t})`;
	},
	scale(e) {
		return `scale(${e.join(", ")})`;
	},
	scale3d(e) {
		return `scale3d(${e.join(", ")})`;
	},
	scaleX(e) {
		return `scaleX(${e[0]})`;
	},
	scaleY(e) {
		return `scaleY(${e[0]})`;
	},
	scaleZ(e) {
		return `scaleZ(${e[0]})`;
	},
	skew(e) {
		return `skew(${e.map(el).join(", ")})`;
	},
	skewX(e) {
		let [t] = e.map(el);
		return `skewX(${t})`;
	},
	skewY(e) {
		let [t] = e.map(el);
		return `skewY(${t})`;
	},
	translate(e) {
		return `translate(${e.map($c).join(", ")})`;
	},
	translate3d(e) {
		return `translate3d(${e.map($c).join(", ")})`;
	},
	translateX(e) {
		let [t] = e.map($c);
		return `translateX(${t})`;
	},
	translateY(e) {
		let [t] = e.map($c);
		return `translateY(${t})`;
	},
	translateZ(e) {
		let [t] = e.map($c);
		return `translateZ(${t})`;
	}
};
function nl(e) {
	let { animates: t, option: n } = e, r = n.transformOrigin, i = n.transition;
	if (r === void 0 || i === void 0) return {
		transformOrigin: "",
		transform: "",
		transition: ""
	};
	let a = [], o = {};
	for (let e = 0; e < t.length; e++) {
		let n = t[e];
		if (n.type === "style") {
			let [e, t] = n.args;
			o[e] = t;
		} else {
			let { type: e, args: t } = n;
			Rc(tl[e]) ? a.push(tl[e](t)) : console.warn(`[Common] SDK inner warning (Transform Handler not found animation type: ${e})`);
		}
	}
	return {
		keyframes: [{
			transform: a.join(" "),
			transformOrigin: r,
			...o
		}],
		options: {
			duration: i.duration,
			easing: i.timingFunction,
			delay: i.delay,
			fill: "forwards"
		}
	};
}
var rl = {}, il = 1, al = 2;
function ol(e, t, n) {
	if (typeof e != "string") throw TypeError("require args must be a string");
	let r = rl[e];
	if (!r) throw Error(`module ${e} not found`);
	if (r.status === il) {
		r.status = al;
		let t = { exports: {} }, i;
		try {
			r.factory && (i = r.factory.call(null, ol, t, t.exports));
		} catch (t) {
			r.status = il;
			let i = `
				name: ${t.name}
				msg: ${t.message}
				stack:
				${t.stack}
			`;
			console.error(`require ${e} error: ${i}`), Rc(globalThis.__diminaReportError) && globalThis.__diminaReportError(t), Rc(n) && n({
				mod: e,
				errMsg: t.message
			});
		}
		r.exports = t.exports === void 0 ? i : t.exports;
	}
	return Rc(t) && t(r.exports), r.exports;
}
ol.async = async (e) => new Promise((t, n) => {
	try {
		t(ol(e));
	} catch (t) {
		n(/* @__PURE__ */ Error(`${t.message}: Failed to initialize asynchronous loading for module '${e}'`));
	}
}), new class {
	constructor() {
		this.callbacks = {};
	}
	store(e, t, n = Bc()) {
		if (t) {
			for (let [t, n] of Object.entries(this.callbacks)) if (n.callback === e) return t;
		}
		return this.callbacks[n] = {
			callback: e,
			keep: t
		}, n;
	}
	invoke(e, t) {
		if (e === void 0) return;
		let n = this.callbacks[e];
		n && Rc(n.callback) && (n.keep || delete this.callbacks[e], n.callback(t));
	}
	remove(e) {
		e ? Object.keys(this.callbacks).forEach((t) => {
			e === t && delete this.callbacks[t];
		}) : Object.entries(this.callbacks).forEach(([e, t]) => {
			t.keep && delete this.callbacks[e];
		});
	}
}();
var sl = "__ddCanvasOwner", cl = "__ddCanvasActive", ll = "dd-canvas-contract-change", ul = "__ddCanvasNode", dl = 33554432;
dl / 4;
var fl = Math.floor(dl / 4 / 4);
function pl(e) {
	let t = Number(e);
	if (!Number.isFinite(t)) return null;
	let n = Math.abs(Math.trunc(t));
	return Number.isSafeInteger(n) ? n : null;
}
function ml(e, t, { allowZero: n = !1, transferable: r = !1 } = {}) {
	let i = pl(e), a = pl(t);
	return i === null || a === null ? "pixel dimensions must be finite non-zero safe integers" : i > 4096 || a > 4096 ? r ? "pixel dimensions exceed the maximum transferable pixel data" : "pixel dimensions exceed the maximum canvas bitmap" : i === 0 || a === 0 ? n ? null : "pixel dimensions must be finite non-zero safe integers" : i > Math.floor((r ? fl : 8388608) / a) ? r ? "pixel dimensions exceed the maximum transferable pixel data" : "pixel dimensions exceed the maximum canvas bitmap" : null;
}
function hl(e, t) {
	if (e === void 0) return t;
	let n = Number(e);
	if (!Number.isFinite(n) || n < 0) return t;
	let r = Math.floor(n);
	if (!Number.isSafeInteger(r) || r > 4096) throw RangeError("canvas dimensions exceed the maximum canvas bitmap");
	return r;
}
var gl = Date.now();
function X() {
	let e = V("bridgeId"), t = V("path"), n = V(t), r, i, a = vs().vnode.slotScopeIds;
	if (a?.length) {
		let e = n, o = t;
		for (let t = 0; t < a.length && e?.pagePath; t++) {
			let t = e.pagePath, n = V(t);
			if (!n) break;
			e = n, o = t;
		}
		li("path", o), li(o, e), r = e.id, i = o;
	} else r = n.id, i = t;
	return {
		attrs: ya(),
		bridgeId: e,
		moduleId: r,
		path: i
	};
}
function Z(e, { event: t, detail: n, info: r, success: i, currentTarget: a }) {
	if (!r.attrs) return;
	let o = r.attrs[`bind${e}`] || r.attrs[`bind:${e}`], s = r.attrs[`catch${e}`] || r.attrs[`catch:${e}`];
	if (s) {
		t?.stopPropagation(), vl(s, {
			type: e,
			detail: n,
			info: r,
			success: i,
			event: t,
			currentTarget: a
		});
		return;
	}
	o && vl(o, {
		type: e,
		detail: n,
		info: r,
		success: i,
		event: t,
		currentTarget: a
	});
}
function _l(e) {
	let t = {
		clientX: e.clientX,
		clientY: e.clientY,
		force: e.force,
		identifier: e.identifier,
		pageX: e.pageX,
		pageY: e.pageY,
		screenX: e.screenX,
		screenY: e.screenY
	};
	return e.x !== void 0 && e.y !== void 0 && (t.x = e.x, t.y = e.y), t;
}
function vl(e, { type: t, detail: n = {}, info: r, success: i, event: a = {}, currentTarget: o }) {
	let { target: s, pageX: c, pageY: l, changedTouches: u = [], touches: d = [] } = a, { bridgeId: f, moduleId: p } = r, m = o ?? a.currentTarget;
	c !== void 0 && l !== void 0 && (n.x = c, n.y = l);
	let h = m ? {
		id: m.id,
		dataset: {
			...m.dataset,
			...m._ds
		},
		offsetLeft: m.offsetLeft,
		offsetTop: m.offsetTop
	} : {}, g = s ? {
		id: s.id,
		dataset: {
			...s.dataset,
			...s._ds
		},
		offsetLeft: s.offsetLeft,
		offsetTop: s.offsetTop
	} : {}, _ = {
		type: t,
		timeStamp: Date.now() - gl,
		detail: n,
		currentTarget: h,
		target: g,
		changedTouches: Array.from(u).map(_l),
		touches: Array.from(d).map(_l)
	}, v = i && window.__callback.store(i);
	window.__message.send({
		type: "t",
		target: "service",
		body: {
			bridgeId: f,
			moduleId: p,
			methodName: e,
			success: v,
			event: _
		}
	});
}
function yl(e, { params: t, bridgeId: n }) {
	window.__message.invoke({
		type: "invokeAPI",
		target: "container",
		body: {
			name: e,
			bridgeId: n,
			params: t
		}
	});
}
function bl(e, { params: t = {}, bridgeId: n, success: r, fail: i, complete: a }) {
	let o, s, c, l = window.__callback;
	r && (o = l.store(r)), i && (s = l.store(i)), c = l.store((e) => {
		a?.(e), l.remove(o), l.remove(s);
	}), window.__message.send({
		type: "componentInvokeAPI",
		target: "service",
		body: {
			apiName: e,
			bridgeId: n,
			callbacks: {
				complete: c,
				fail: s,
				success: o
			},
			params: t
		}
	});
}
function xl(e, t) {
	let n = (e) => {
		t?.(e);
	};
	return window.__message.on(e, n), () => window.__message.off(e, n);
}
function Sl(e, t = "tap") {
	let n = e.attrs || {};
	return !!(n[`bind${t}`] || n[`bind:${t}`] || n[`catch${t}`] || n[`catch:${t}`]);
}
function Cl(e, t = "tap") {
	let n = e.attrs || {};
	return !!(n[`catch${t}`] || n[`catch:${t}`]);
}
var wl = [
	"tap",
	"longpress",
	"longtap",
	"canceltap",
	"touchstart",
	"touchmove",
	"touchend",
	"touchcancel"
];
function Tl(e) {
	return wl.some((t) => Sl(e, t));
}
var El = {
	identifier: 0,
	clientX: 0,
	clientY: 0,
	pageX: 0,
	pageY: 0,
	screenX: 0,
	screenY: 0,
	force: 0
};
function Dl(...e) {
	for (let t of e) {
		let e = t && t[0];
		if (e) return e;
	}
	return El;
}
function Ol(e, t) {
	let n = (t?.())?.getBoundingClientRect?.();
	return Array.from(e || []).map((e) => {
		let t = {
			identifier: e.identifier,
			clientX: e.clientX,
			clientY: e.clientY,
			pageX: e.pageX,
			pageY: e.pageY,
			screenX: e.screenX,
			screenY: e.screenY,
			force: e.force
		};
		return n && (t.x = e.clientX - n.left, t.y = e.clientY - n.top), t;
	});
}
var kl = "dd:activationtap";
function Al(e, t) {
	e && e.dispatchEvent(new CustomEvent(kl, {
		bubbles: !0,
		detail: { sourceEvent: t }
	}));
}
function jl(e) {
	return e.__ddGestureSequenceState ||= { tapSuppressed: !1 }, e.__ddGestureSequenceState;
}
function Ml(e, t) {
	let n = e.__ddAfterTouchEnd || {
		jobs: [],
		scheduled: !1
	};
	e.__ddAfterTouchEnd = n, n.jobs.push(t), !n.scheduled && (n.scheduled = !0, queueMicrotask(() => {
		for (let e of n.jobs.splice(0)) e();
		n.scheduled = !1;
	}));
}
function Nl(e, t) {
	e && (e.__ddStoppedTypes ||= /* @__PURE__ */ new Set(), e.__ddStoppedTypes.add(t));
}
function Pl(e, t) {
	return !!(e && e.__ddStoppedTypes && e.__ddStoppedTypes.has(t));
}
function Fl(e, t = El.identifier) {
	let n = Array.from(e?.changedTouches || []);
	return n.length ? n.map((e) => e.identifier) : [t];
}
function Il(e, ...t) {
	for (let n of t) {
		let t = Array.from(n || []).find((t) => t.identifier === e);
		if (t) return t;
	}
	return null;
}
function Ll(e, t) {
	let n = window.getComputedStyle(e)[t];
	return n === "auto" || n === "scroll" || n === "overlay";
}
function Rl(e, t) {
	let n = e.scrollWidth - e.clientWidth, r = e.scrollLeft;
	return window.getComputedStyle(e).direction === "rtl" && r <= 0 ? t > 0 && r > -n || t < 0 && r < 0 : t > 0 && r > 0 || t < 0 && n - r >= 1;
}
function zl(e, t, n, r, i) {
	let a = t.clientX - r, o = t.clientY - i, s = Math.abs(a) > Math.abs(o);
	for (let t of e?.composedPath?.() || []) {
		if (s && Ll(t, "overflowX") && t.scrollWidth > t.clientWidth) {
			if (Rl(t, a)) return !1;
		} else if (!s && Ll(t, "overflowY") && t.scrollHeight > t.clientHeight) {
			let e = t.scrollHeight - t.clientHeight;
			if (o > 0 && t.scrollTop > 0 || o < 0 && e - t.scrollTop >= 1) return !1;
		}
		if (t === n) break;
	}
	return !0;
}
function Bl(e) {
	return {
		identifier: 0,
		clientX: e.clientX,
		clientY: e.clientY,
		pageX: e.pageX,
		pageY: e.pageY,
		screenX: e.screenX,
		screenY: e.screenY,
		force: e.pressure ?? 0
	};
}
function Vl(e, t, n = {}) {
	if (t.__ddGestureDetach) {
		if (!n.takeOver) return () => {};
		t.__ddGestureDetach();
	}
	let { longPressThreshold: r = 350, moveThreshold: i = 10, getRelativeElement: a = null, tapHandler: o = null, disableScroll: s = !1, resolveTarget: c = null } = n, l = null, u = 0, d = 0, f = 0, p = 0, m = !1, h = [], g = [], _ = null, v = !1, y = !1, b = !1, x = 0, S = !0, C = !1, w = [], T = null, E = null, ee = /* @__PURE__ */ new Set(), D = null, te = null, ne = null, O = (e) => Ol(e, a);
	function re(e, n, r) {
		return {
			target: c ? c(r.target) : r.target,
			currentTarget: t,
			touches: r.touches,
			changedTouches: r.changedTouches,
			clientX: r.clientX,
			clientY: r.clientY,
			pageX: r.pageX,
			pageY: r.pageY,
			cancelable: !!n?.cancelable,
			preventDefault: () => {
				n?.cancelable && n.preventDefault();
			},
			stopPropagation: () => {
				Nl(n, e);
			},
			composedPath: () => n?.composedPath?.() || []
		};
	}
	function k(t, n, r, i) {
		if (!S || Pl(n, t)) return;
		let a = re(t, n, r);
		if (t === "tap" && o) {
			o({
				event: a,
				detail: i,
				info: e
			});
			return;
		}
		Z(t, {
			event: a,
			detail: i,
			info: e
		});
	}
	function A() {
		l &&= (clearTimeout(l), null);
	}
	function ie(e, t, n, r) {
		return {
			target: _ ?? e?.target,
			touches: t,
			changedTouches: n,
			clientX: r?.clientX,
			clientY: r?.clientY,
			pageX: r?.pageX,
			pageY: r?.pageY
		};
	}
	function ae(e, t) {
		y = !0, k("canceltap", e, ie(e, h, g, t));
	}
	function oe(t, n, i, a) {
		_ = t?.target ?? null, ne = jl(t);
		let o = ne;
		u = a.clientX, d = a.clientY, f = a.clientX, p = a.clientY, m = !0, h = O(n), g = O(i), v = !1, y = !1, b = !1;
		let s = ++x;
		A(), l = setTimeout(() => {
			if (l = null, !S || s !== x || v) return;
			let n = ie(t, h, g, a);
			k("longtap", t, n), S && s === x && (k("longpress", t, n), S && s === x && Sl(e, "longpress") && (b = !0, o.tapSuppressed = !0));
		}, r), k("touchstart", t, ie(t, h, g));
	}
	function se(e) {
		return Math.abs(e.clientX - u) > i || Math.abs(e.clientY - d) > i;
	}
	function ce(e, t, n, r) {
		let i = x;
		se(r) && (v || (v = !0, A())), i === x && (f = r.clientX, p = r.clientY, k("touchmove", e, ie(e, O(t), O(n))), i === x && v && ae(e, r));
	}
	function j(e, t, n, r, i = null) {
		A(), !v && i && se(i) && (v = !0);
		let a = !v && !b && !ne?.tapSuppressed, o = ie(e, O(t), O(n)), s = ie(e, h, g, r), c = v && !y;
		y ||= c, ne = null, _ = null, k("touchend", e, o), c && k("canceltap", e, s), Ml(e, () => {
			a && k("tap", e, s);
		});
	}
	function le(e, t, n, r) {
		A();
		let i = ie(e, O(t), O(n)), a = ie(e, h, g, r), o = !y;
		y = !0, ne = null, _ = null, k("touchcancel", e, i), o && k("canceltap", e, a);
	}
	function ue(e, t) {
		let n = Dl(t.changedTouches, t.touches), r = ie(t, O(t.touches), O(t.changedTouches), n);
		E === null && (r.target = t.target), k(e, t, r);
	}
	function de(e) {
		for (let t of Fl(e, E ?? El.identifier)) ee.delete(t);
	}
	function fe() {
		ee.size || (T = null, m = !1);
	}
	function pe(e) {
		if (T === "pointer") return;
		let t = Dl(e.changedTouches, e.touches);
		for (let n of Fl(e, t.identifier)) ee.add(n);
		if (T === null) {
			T = "touch", ee.size <= 1 ? (E = t.identifier, oe(e, e.touches, e.changedTouches, t)) : (E = null, f = t.clientX, p = t.clientY, m = !0, ue("touchstart", e));
			return;
		}
		let n = x;
		ue("touchstart", e), n === x && E !== null && (ee.size > 1 || t.identifier !== E) && A();
	}
	function me(n) {
		if (T === "pointer") return;
		let r = Il(E, n.touches, n.changedTouches) || Dl(n.touches, n.changedTouches), i = (typeof s == "function" ? s() : s) || Cl(e, "touchmove") && (!m || zl(n, r, t, f, p));
		T !== "touch" || E === null ? (f = r.clientX, p = r.clientY, m = !0, ue("touchmove", n)) : ce(n, n.touches, n.changedTouches, r), i && n.cancelable && n.preventDefault();
	}
	function he(e) {
		if (T === "pointer") return;
		let t = Il(E, e.changedTouches), n = E !== null && !e.changedTouches?.length && !e.touches?.length;
		de(e), E === null || !t && !n ? (fe(), ue("touchend", e), Ml(e, () => {})) : (E = null, fe(), j(e, e.touches, e.changedTouches, t || El, t)), ke(e);
	}
	function ge(e) {
		if (T === "pointer") return;
		let t = Il(E, e.changedTouches), n = E !== null && !e.changedTouches?.length && !e.touches?.length;
		de(e), E === null || !t && !n ? (fe(), ue("touchcancel", e)) : (E = null, fe(), x += 1, le(e, e.touches, e.changedTouches, t || El)), ke(e);
	}
	function _e() {
		D = null, te = null, T === "pointer" && (T = null), document.removeEventListener("pointermove", ve), document.removeEventListener("pointerup", be), document.removeEventListener("pointercancel", xe), window.removeEventListener("blur", ye);
	}
	function M(e) {
		if (e.pointerType === "touch" || (e.button ?? 0) !== 0 || T !== null) return;
		T = "pointer", D = e.pointerId;
		let t = Bl(e);
		te = t, document.addEventListener("pointermove", ve), document.addEventListener("pointerup", be), document.addEventListener("pointercancel", xe), window.addEventListener("blur", ye), oe(e, [t], [t], t);
	}
	function ve(e) {
		if (D === null || e.pointerId !== D) return;
		let t = Bl(e);
		te = t, ce(e, [t], [t], t);
	}
	function ye(e) {
		if (D === null) return;
		let t = te || El;
		_e(), x += 1, le(e, [], [t], t), ke(e);
	}
	function be(e) {
		if (D === null || e.pointerId !== D) return;
		let t = Bl(e);
		_e(), j(e, [], [t], t, t), ke(e);
	}
	function xe(e) {
		if (D === null || e.pointerId !== D) return;
		let t = Bl(e);
		_e(), x += 1, le(e, [], [t], t), ke(e);
	}
	function Se(e) {
		if (e.detail > 0) return;
		let t = Bl(e), n = O([t]);
		k("tap", e, {
			target: e.target,
			touches: n,
			changedTouches: n,
			pageX: e.pageX,
			pageY: e.pageY
		});
	}
	function Ce(e) {
		let { sourceEvent: t } = e.detail || {};
		k("tap", e, {
			target: e.target,
			touches: O(t?.touches),
			changedTouches: O(t?.changedTouches),
			clientX: t?.clientX,
			clientY: t?.clientY,
			pageX: t?.pageX,
			pageY: t?.pageY
		});
	}
	let we = Cl(e, "touchmove"), Te = typeof s == "function" ? s() : s, Ee = Cl(e, "touchend"), De = Cl(e, "touchcancel");
	t.addEventListener("touchstart", pe, { passive: !0 }), t.addEventListener("touchmove", me, { passive: !we && !Te }), t.addEventListener("touchend", he, { passive: !Ee }), t.addEventListener("touchcancel", ge, { passive: !De }), t.addEventListener("pointerdown", M), t.addEventListener("click", Se), t.addEventListener(kl, Ce);
	function Oe() {
		if (S) for (S = !1, C = !1, x += 1, A(), E = null, T = null, ee.clear(), _e(), t.__ddGestureDetach === Ae && delete t.__ddGestureDetach, t.removeEventListener("touchstart", pe, { passive: !0 }), t.removeEventListener("touchmove", me, { passive: !we && !Te }), t.removeEventListener("touchend", he, { passive: !Ee }), t.removeEventListener("touchcancel", ge, { passive: !De }), t.removeEventListener("pointerdown", M), t.removeEventListener("click", Se), t.removeEventListener(kl, Ce); w.length;) w.shift()();
	}
	function ke(e) {
		if (C && T === null) {
			if (!e) {
				Oe();
				return;
			}
			Ml(e, () => {
				C && T === null && Oe();
			});
		}
	}
	function Ae({ preserveActive: e = !1, nodeRemoved: t = !1, onDetached: n = null } = {}) {
		if (!S) {
			n?.();
			return;
		}
		if (e && T !== null) {
			C = !0, t && A(), n && w.push(n);
			return;
		}
		Oe(), n?.();
	}
	return t.__ddGestureDetach = Ae, Ae;
}
function Hl(e, t) {
	if (!e) return 0;
	let n = e.getBoundingClientRect(), r = window.visualViewport;
	return (r ? r.height : window.innerHeight) - n.bottom - (t ? n.height : 0);
}
function Q(e) {
	return e.__tagName = Hc(e.__name), e.install = (t) => {
		Wl(t, e);
	}, e;
}
var Ul = "dd-";
function Wl(e, t) {
	e.component(Ul + t.__tagName, t);
}
function Gl(e) {
	if (typeof e != "object" || !e) return e;
	if (Array.isArray(e)) return e.map((e) => Gl(e));
	let t = {};
	for (let n in e) if (Object.prototype.hasOwnProperty.call(e, n)) {
		let r = e[n];
		t[n] = /* @__PURE__ */ wr(r) ? B(r) : /* @__PURE__ */ _r(r) ? /* @__PURE__ */ R(r) : typeof r == "object" && r ? Gl(r) : r;
	}
	return t;
}
function Kl(e, t, n) {
	let r = e.split(/\s+/).filter(Boolean), i = n.split(/\s+/).filter(Boolean), a = [];
	for (let e of r) e === t ? a.push(...i) : a.push(e);
	return [...new Set(a)].join(" ");
}
var ql = {
	__name: "Block",
	setup(e) {
		return X(), (e, t) => U(e.$slots, "default");
	}
}, Jl = /* @__PURE__ */ Y({ default: () => Yl }), Yl = Q(ql), Xl = "__ddLabelActivate", Zl = "[data-dd-label-target], input", Ql = "input";
function $l(e, t) {
	let n = null, r = (e) => {
		n && n[Xl] === t && delete n[Xl], n = e ?? null, n && (n[Xl] = t);
	};
	Yi(() => r(e.value)), H(e, (e) => r(e), { flush: "post" }), $i(() => r(null));
}
function eu(e, t) {
	let n = e?.[Xl];
	return typeof n == "function" ? (n(t && {
		...t,
		currentTarget: e,
		target: e
	}), !0) : typeof e?.matches == "function" && e.matches(Ql) ? (e.focus(), !0) : !1;
}
function tu(e) {
	let t = /* @__PURE__ */ z(!1), n = !1, r, i;
	function a() {
		r !== void 0 && (clearTimeout(r), r = void 0);
	}
	function o() {
		i !== void 0 && (clearTimeout(i), i = void 0);
	}
	function s() {
		a(), o(), t.value = !1;
	}
	function c(c) {
		c._ddHoverPropagationStopped || (e.hoverStopPropagation && (c._ddHoverPropagationStopped = !0), n = !0, a(), o(), !(e.disabled || e.hoverClass === "none") && (c.touches?.length > 1 || (r = setTimeout(() => {
			r = void 0, t.value = !0, n || (i = setTimeout(s, Number(e.hoverStayTime) || 0));
		}, Math.max(Number(e.hoverStartTime) || 0, 0)))));
	}
	function l() {
		n = !1, t.value && (o(), i = setTimeout(s, Math.max(Number(e.hoverStayTime) || 0, 0)));
	}
	function u() {
		n = !1, s();
	}
	return Qi(s), {
		isHover: t,
		onHoverCancel: u,
		onHoverEnd: l,
		onHoverStart: c
	};
}
function nu(e, t, n = {}) {
	let { relativeTo: r = null, ...i } = n, a = null, o = "", s = null, c = !1, l = () => [
		"touchstart",
		"touchmove",
		"touchend",
		"touchcancel"
	].map((t) => !!(e.attrs?.[`catch${t}`] || e.attrs?.[`catch:${t}`])).join(":"), u = () => {
		t.value && (a = Vl(e, t.value, {
			...i,
			takeOver: !0,
			getRelativeElement: r ? () => r.value : null
		}), o = l(), s = t.value, c = !1);
	};
	Yi(u), H(t, () => {
		t.value && t.value !== s && (c = !1, a?.(), u());
	}, { flush: "post" }), Zi(() => {
		if (!(c || o === l())) {
			if (!a) {
				u();
				return;
			}
			c = !0, a({
				preserveActive: !0,
				onDetached: () => {
					c && u();
				}
			});
		}
	}), $i(() => {
		c = !1, a?.({
			preserveActive: !0,
			nodeRemoved: !0
		}), a = null;
	});
}
var ru = [
	"id",
	"tabindex",
	"aria-disabled",
	"type",
	"size",
	"loading",
	"plain",
	"disabled",
	"onKeydown"
], iu = {
	__name: "Button",
	props: {
		id: { type: String },
		size: {
			type: String,
			default: "default",
			validator: (e) => ["default", "mini"].includes(e)
		},
		type: {
			type: String,
			default: "default",
			validator: (e) => [
				"primary",
				"default",
				"warn"
			].includes(e)
		},
		plain: {
			type: Boolean,
			default: !1
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		loading: { type: Boolean },
		formType: {
			type: String,
			validator: (e) => ["submit", "reset"].includes(e)
		},
		openType: {
			type: String,
			validator: (e) => [
				"contact",
				"liveActivity",
				"share",
				"getPhoneNumber",
				"getRealtimePhoneNumber",
				"getUserInfo",
				"launchApp",
				"openSetting",
				"feedback",
				"chooseAvatar",
				"agreePrivacyAuthorization"
			].includes(e)
		},
		appParameter: {
			type: String,
			default: ""
		},
		launchAppid: {
			type: String,
			default: ""
		},
		withCredentials: {
			type: Boolean,
			default: !0
		},
		lang: {
			type: String,
			default: "en"
		},
		sessionFrom: {
			type: String,
			default: "wxapp"
		},
		businessId: {
			type: String,
			default: ""
		},
		sendMessageTitle: {
			type: String,
			default: ""
		},
		sendMessagePath: {
			type: String,
			default: ""
		},
		sendMessageImg: {
			type: String,
			default: ""
		},
		showMessageCard: {
			type: Boolean,
			default: !1
		},
		categoryId: {
			type: Array,
			default: () => []
		},
		needPhoneNumber: {
			type: Boolean,
			default: !1
		},
		native: {
			type: Boolean,
			default: !1
		},
		phoneNumber: {
			type: String,
			default: ""
		},
		smsType: {
			type: Number,
			default: 0
		},
		hoverClass: {
			type: String,
			default: "button-hover"
		},
		hover: {
			type: Boolean,
			default: !1
		},
		hoverStopPropagation: {
			type: Boolean,
			default: !1
		},
		hoverStartTime: {
			type: Number,
			default: 20
		},
		hoverStayTime: {
			type: Number,
			default: 70
		}
	},
	setup(e) {
		let t = e, n = J(() => t.plain ? !0 : void 0), r = J(() => t.disabled ? !0 : void 0), i = J(() => t.loading ? !0 : void 0), { isHover: a, onHoverCancel: o, onHoverEnd: s, onHoverStart: c } = tu(t), l = X(), u = /* @__PURE__ */ z(null), d = V("formEvent", void 0);
		function f({ event: e }) {
			t.disabled || (Z("tap", {
				event: e,
				info: l
			}), t.formType ? d?.(e, t.formType) : h(e));
		}
		function p() {
			u.value?.click();
		}
		nu(l, u, { tapHandler: f }), $l(u, (e) => {
			t.disabled || Al(u.value, e);
		});
		function m(e, t, n, r = {}) {
			let i = {
				...n,
				currentTarget: n.currentTarget,
				target: n.target
			};
			bl(e, {
				bridgeId: l.bridgeId,
				params: r,
				success: (e = {}) => Z(t, {
					event: i,
					info: l,
					detail: e
				}),
				fail: (e = {}) => Z(t, {
					event: i,
					info: l,
					detail: e
				})
			});
		}
		function h(e) {
			switch (t.openType) {
				case "openSetting":
					m("openSetting", "opensetting", e);
					break;
				case "getUserInfo": m("getUserInfo", "getuserinfo", e, {
					lang: t.lang,
					withCredentials: t.withCredentials
				});
			}
		}
		return (t, l) => (W(), G("span", q({
			id: e.id,
			ref_key: "rootRef",
			ref: u
		}, t.$attrs, {
			class: ["dd-button", [
				`dd-button--${e.type}`,
				e.size === "mini" && "dd-button--mini",
				B(n) && "dd-button--plain",
				B(r) && "dd-button--disabled",
				B(i) && "dd-button--loading",
				B(a) ? e.hoverClass : void 0
			]],
			"data-dd-label-target": "",
			role: "button",
			tabindex: e.disabled ? -1 : 0,
			"aria-disabled": e.disabled,
			type: e.type,
			size: e.size,
			loading: B(i),
			plain: B(n),
			disabled: B(r),
			onKeydown: [Ac(Oc(p, ["prevent"]), ["enter"]), Ac(Oc(p, ["prevent"]), ["space"])],
			onTouchstart: l[0] ||= (...e) => B(c) && B(c)(...e),
			onTouchend: l[1] ||= (...e) => B(s) && B(s)(...e),
			onTouchcancel: l[2] ||= (...e) => B(o) && B(o)(...e),
			onMousedown: l[3] ||= (...e) => B(c) && B(c)(...e),
			onMouseup: l[4] ||= (...e) => B(s) && B(s)(...e),
			onMouseleave: l[5] ||= (...e) => B(o) && B(o)(...e)
		}), [U(t.$slots, "default")], 16, ru));
	}
}, au = /* @__PURE__ */ Y({ default: () => ou }), ou = Q(iu), su = "[data-dimina-native-id][data-dimina-native-type]", cu = /* @__PURE__ */ new Map(), lu = /* @__PURE__ */ new Map(), uu = [], du = !1, fu = null, pu = 0;
function mu() {
	return window.DiminaNativeComponentBridge;
}
function hu(e) {
	let t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(su);
	if (!t) return null;
	let n = t.dataset.diminaNativeId, r = t.dataset.diminaNativeType;
	return !n || !r ? null : {
		id: n,
		type: r
	};
}
function gu(e) {
	if (lu.has(e)) return lu.get(e);
	let t = uu.length ? uu.shift() : pu++;
	return lu.set(e, t), t;
}
function _u(e) {
	lu.has(e) && (uu.push(lu.get(e)), lu.delete(e));
}
function vu(e) {
	let t = String(e.identifier);
	return {
		touchIdentifier: t,
		id: gu(t),
		clientX: e.clientX,
		clientY: e.clientY,
		pageX: e.pageX,
		pageY: e.pageY
	};
}
function yu(e) {
	for (let t of e) {
		let e = String(t.identifier);
		cu.has(e) && cu.set(e, vu(t));
	}
}
function bu(e, t) {
	let n = mu();
	n?.dispatchTouch && fu && cu.size && n.dispatchTouch(JSON.stringify({
		action: e,
		actionPointerId: t,
		targetId: fu.id,
		targetType: fu.type,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight,
		pointers: Array.from(cu.values()).map((e) => ({
			id: e.id,
			clientX: e.clientX,
			clientY: e.clientY,
			pageX: e.pageX,
			pageY: e.pageY
		}))
	}));
}
function xu(e) {
	e.preventDefault(), e.stopImmediatePropagation();
}
function Su(e) {
	if (!mu()?.dispatchTouch) return;
	let t = !1;
	for (let n of e.changedTouches) {
		let r = fu || hu(n);
		if (!r || fu && r.id !== fu.id) continue;
		fu = r, yu(e.touches);
		let i = vu(n);
		cu.set(i.touchIdentifier, i), bu(cu.size === 1 ? "down" : "pointerDown", i.id), t = !0;
	}
	t && xu(e);
}
function Cu(e) {
	fu && cu.size && (yu(e.touches), bu("move", -1), xu(e));
}
function wu(e) {
	if (!fu || !cu.size) return;
	let t = !1;
	yu(e.touches);
	for (let n of e.changedTouches) {
		let e = String(n.identifier);
		if (!cu.has(e)) continue;
		let r = vu(n);
		cu.set(e, r), bu(cu.size === 1 ? "up" : "pointerUp", r.id), cu.delete(e), _u(e), t = !0;
	}
	cu.size || (fu = null), t && xu(e);
}
function Tu(e) {
	if (fu && cu.size) {
		yu(e.touches), bu("cancel", -1);
		for (let e of cu.keys()) _u(e);
		cu.clear(), fu = null, xu(e);
	}
}
function Eu() {
	!Gc || du || typeof document > "u" || (du = !0, document.addEventListener("touchstart", Su, {
		capture: !0,
		passive: !1
	}), document.addEventListener("touchmove", Cu, {
		capture: !0,
		passive: !1
	}), document.addEventListener("touchend", wu, {
		capture: !0,
		passive: !1
	}), document.addEventListener("touchcancel", Tu, {
		capture: !0,
		passive: !1
	}));
}
var Du = ["id"], Ou = {
	key: 1,
	class: "dd-camera-native dd-camera-container"
}, ku = ["data-dimina-native-id"], Au = {
	key: 4,
	class: "dd-camera-unavailable"
}, ju = { class: "dd-camera-slot" }, Mu = "native/camera", Nu = {
	__name: "Camera",
	props: {
		id: {
			type: String,
			default: () => `camera-${Pi()}`
		},
		mode: {
			type: String,
			default: "normal",
			validator: (e) => ["normal", "scanCode"].includes(e)
		},
		devicePosition: {
			type: String,
			default: "back",
			validator: (e) => ["front", "back"].includes(e)
		},
		filter: {
			type: Number,
			default: 0
		},
		flash: {
			type: String,
			default: "auto",
			validator: (e) => [
				"auto",
				"on",
				"off",
				"torch"
			].includes(e)
		},
		scanArea: {
			type: Array,
			default: () => []
		},
		needOutput: {
			type: Boolean,
			default: !1
		},
		frameSize: {
			type: String,
			default: "",
			validator: (e) => [
				"",
				"small",
				"medium",
				"large"
			].includes(e)
		},
		centerCrop: {
			type: Boolean,
			default: !0
		},
		resolution: {
			type: String,
			default: "medium",
			validator: (e) => [
				"low",
				"medium",
				"high"
			].includes(e)
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(), r = /* @__PURE__ */ z(), i = X(), a = J(() => Gc || Kc || qc), o = [], s, c, l = 0, u = 0, d = "", f = !1, p = 0, m;
		function h() {
			if (!n.value) return {};
			let e = n.value.getBoundingClientRect();
			return {
				left: e.left,
				top: e.top,
				width: e.width,
				height: e.height,
				pageLeft: e.left + window.scrollX,
				pageTop: e.top + window.scrollY,
				scrollX: window.scrollX,
				scrollY: window.scrollY,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight
			};
		}
		function g() {
			return {
				type: Mu,
				id: t.id,
				mode: t.mode,
				devicePosition: t.mode === "scanCode" ? "back" : t.devicePosition,
				filter: t.filter,
				flash: t.flash,
				scanArea: t.scanArea,
				needOutput: t.needOutput,
				frameSize: t.frameSize,
				centerCrop: t.centerCrop,
				resolution: t.resolution,
				hidden: n.value?.hasAttribute("hidden") || !1,
				rect: h()
			};
		}
		function _(e) {
			a.value && (e !== "propsUpdate" || f) && yl(e, {
				bridgeId: i.bridgeId,
				params: g()
			});
		}
		function v(e) {
			let n = xl(`bind${e}`, (n) => {
				(n.id === void 0 || n.id === t.id || n.cameraId === t.id) && Z(e, {
					type: e,
					info: i,
					detail: n
				});
			});
			o.push(n);
		}
		function y(e = !1) {
			let t = JSON.stringify({
				...h(),
				hidden: n.value?.hasAttribute("hidden") || !1
			});
			(e || t !== d) && (d = t, _("propsUpdate"));
		}
		function b() {
			u ||= requestAnimationFrame(() => {
				u = 0, y();
			});
		}
		function x(e, t = {}) {
			Z(e, {
				type: e,
				info: i,
				detail: t
			});
		}
		function S() {
			p++, l && cancelAnimationFrame(l), l = 0, s?.getTracks().forEach((e) => e.stop()), s = void 0, m = void 0, r.value && (r.value.srcObject = null);
		}
		async function C() {
			if (s && t.mode === "scanCode" && m) {
				try {
					let e = await m.detect(r.value);
					e[0] && x("scancode", {
						type: e[0].format,
						result: e[0].rawValue
					});
				} catch {}
				l = requestAnimationFrame(C);
			}
		}
		async function w() {
			S();
			let e = p;
			if (!navigator.mediaDevices?.getUserMedia || !r.value) {
				x("error", { errMsg: "camera:fail camera is not available" });
				return;
			}
			try {
				let n = await navigator.mediaDevices.getUserMedia({
					audio: !1,
					video: { facingMode: t.mode === "scanCode" || t.devicePosition === "back" ? "environment" : "user" }
				});
				if (e !== p || !r.value) {
					n.getTracks().forEach((e) => e.stop());
					return;
				}
				s = n, r.value.srcObject = s, s.getVideoTracks()[0]?.addEventListener("ended", () => {
					x("stop", { reason: "camera track ended" });
				}), await r.value.play();
				let i = s.getVideoTracks()[0]?.getCapabilities?.().zoom;
				x("initdone", { maxZoom: i?.max || 1 }), t.mode === "scanCode" && window.BarcodeDetector && (m = new window.BarcodeDetector(), C());
			} catch (e) {
				x("error", { errMsg: e?.message || "camera:fail open camera failed" });
			}
		}
		return Yi(() => {
			if (Jc) {
				w();
				return;
			}
			if (a.value) {
				Gc && Eu();
				for (let e of [
					"stop",
					"error",
					"output",
					"scancode",
					"initdone"
				]) v(e);
				Jr(() => {
					f = !0, _("componentMount"), d = JSON.stringify({
						...h(),
						hidden: n.value?.hasAttribute("hidden") || !1
					}), window.addEventListener("resize", b), window.addEventListener("scroll", b, !0), window.ResizeObserver && n.value && (c = new ResizeObserver(b), c.observe(n.value));
				});
			}
		}), H(() => g(), () => _("propsUpdate"), { deep: !0 }), H(() => [t.mode, t.devicePosition], () => {
			Jc && w();
		}), Qi(() => {
			S(), u && cancelAnimationFrame(u), c?.disconnect(), window.removeEventListener("resize", b), window.removeEventListener("scroll", b, !0), _("componentUnmount"), f = !1, o.splice(0).forEach((e) => e());
		}), (t, i) => (W(), G("div", q({
			id: e.id,
			ref_key: "rootRef",
			ref: n
		}, t.$attrs, { class: "dd-camera" }), [B(Jc) ? (W(), G("video", {
			key: 0,
			ref_key: "videoRef",
			ref: r,
			class: "dd-camera-native",
			autoplay: "",
			muted: "",
			playsinline: "",
			style: It({ objectFit: e.centerCrop ? "cover" : "contain" })
		}, null, 4)) : B(Kc) ? (W(), G("div", Ou, [...i[0] ||= [K("div", null, null, -1)]])) : B(Gc) ? (W(), G("embed", {
			key: 2,
			class: "dd-camera-native",
			type: "application/view",
			comp_type: Mu,
			"data-dimina-native-type": "native/camera",
			"data-dimina-native-id": e.id
		}, null, 8, ku)) : B(qc) ? (W(), G("embed", {
			key: 3,
			class: "dd-camera-native",
			type: Mu
		})) : (W(), G("div", Au, "未找到摄像头")), K("div", ju, [U(t.$slots, "default")])], 16, Du));
	}
}, Pu = /* @__PURE__ */ Y({ default: () => Fu }), Fu = Q(Nu), Iu = [
	"canvas-id",
	"type",
	"width",
	"height"
], Lu = { class: "dd-canvas-slot" }, Ru = /* @__PURE__ */ new Map(), zu = /* @__PURE__ */ new Set(), Bu = {
	__name: "Canvas",
	props: {
		canvasId: {
			type: String,
			default: ""
		},
		disableScroll: {
			type: Boolean,
			default: !1
		},
		type: {
			type: String,
			default: ""
		},
		newTouchListener: {
			type: Boolean,
			default: !1
		},
		renderWidth: {
			type: Number,
			default: 300
		},
		renderHeight: {
			type: Number,
			default: 150
		}
	},
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(null), i = /* @__PURE__ */ z(null), a = /* @__PURE__ */ z(!1), o = null, s = null, c = Object.freeze({
			width: 300,
			height: 150
		}), l = J(() => {
			try {
				let e = hl(t.renderWidth, c.width), n = hl(t.renderHeight, c.height);
				return ml(e, n, { allowZero: !0 }) ? c : {
					width: e,
					height: n
				};
			} catch {
				return c;
			}
		});
		nu(n, i, {
			relativeTo: i,
			resolveTarget: (e) => e === r.value ? i.value : e
		});
		function u(e) {
			t.disableScroll && e.cancelable && e.preventDefault();
		}
		let d = {}, f = null;
		function p() {
			let e = m() !== null && !a.value;
			if (!o) return;
			let t = o[cl], r = o[sl];
			if (Object.defineProperty(o, cl, {
				configurable: !0,
				value: e
			}), !e) {
				o.__ddCanvasOwner === n.moduleId && delete o[sl];
				return;
			}
			if (Object.defineProperty(o, sl, {
				configurable: !0,
				value: n.moduleId
			}), t !== o.__ddCanvasActive || r !== o.__ddCanvasOwner) {
				let e = o.ownerDocument?.defaultView?.Event;
				e && o.dispatchEvent(new e(ll, { bubbles: !0 }));
			}
		}
		function m() {
			return t.type ? null : t.canvasId ? `${n.bridgeId}|${n.moduleId}|${t.canvasId}` : "";
		}
		function h() {
			if (zu.delete(g), f === null) return;
			let e = f;
			f = null, Ru.get(e) === d && Ru.delete(e);
			for (let e of [...zu]) e();
		}
		function g() {
			let e = m();
			e && !Ru.has(e) && (zu.delete(g), f = e, Ru.set(e, d), a.value = !1);
		}
		function _() {
			let e = m();
			if (!(e && f === e)) {
				if (h(), e === null) {
					a.value = !1;
					return;
				}
				if (!e) {
					a.value = !0, Z("error", {
						info: n,
						detail: { errMsg: "canvas-id attribute is undefined" }
					});
					return;
				}
				if (!Ru.has(e)) {
					f = e, Ru.set(e, d), a.value = !1;
					return;
				}
				a.value = !0, zu.add(g), queueMicrotask(() => {
					f === null && Z("error", {
						info: n,
						detail: { errMsg: `canvas-id ${t.canvasId} in this page has already existed` }
					});
				});
			}
		}
		return fi(_), fi(p), Yi(() => {
			o = r.value, s = i.value, p(), Object.defineProperty(s, ul, {
				configurable: !0,
				value: o
			});
		}), $i(() => {
			h(), s?.__ddCanvasNode === o && delete s[ul], o?.__ddCanvasOwner === n.moduleId && delete o[sl], o && "__ddCanvasActive" in o && delete o[cl];
		}), (t, n) => (W(), G("div", q({
			ref_key: "rootRef",
			ref: i
		}, t.$attrs, {
			class: "dd-canvas",
			style: B(a) ? { display: "none" } : void 0,
			onTouchmove: u
		}), [K("canvas", {
			ref_key: "canvasRef",
			ref: r,
			"canvas-id": e.canvasId,
			type: e.type || void 0,
			width: B(l).width,
			height: B(l).height
		}, null, 8, Iu), K("div", Lu, [U(t.$slots, "default")])], 16));
	}
}, Vu = /* @__PURE__ */ Y({ default: () => Hu }), Hu = Q(Bu), Uu = [
	"id",
	"tabindex",
	"aria-checked",
	"aria-disabled",
	"onKeydown"
], Wu = { class: "dd-checkbox-wrapper" }, Gu = {
	__name: "Checkbox",
	props: {
		id: { type: String },
		value: {
			type: String,
			default: ""
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		checked: {
			type: Boolean,
			default: !1
		},
		color: {
			type: String,
			default: "#09BB07"
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(t.checked), r = V("checkboxGroup", void 0);
		H(() => t.checked, (e) => {
			n.value = e;
		});
		let i = {
			getValue: () => t.value,
			isChecked: () => n.value,
			setChecked: (e) => {
				n.value = e;
			},
			reset: () => {
				n.value = !1;
			}
		}, a = r?.registerCheckbox(i);
		Qi(() => a?.());
		let o = J(() => {
			if (t.color) return { color: t.color };
		}), s = X(), c = /* @__PURE__ */ z(null);
		function l(e) {
			t.disabled || (r ? r.toggleCheckbox(i, e) : n.value = !n.value);
		}
		function u({ event: e }) {
			t.disabled || (l(e), Z("tap", {
				event: e,
				info: s
			}));
		}
		function d() {
			c.value?.click();
		}
		return nu(s, c, { tapHandler: u }), $l(c, l), (t, r) => (W(), G("div", q({
			id: e.id,
			ref_key: "rootRef",
			ref: c
		}, t.$attrs, {
			class: "dd-checkbox",
			"data-dd-label-target": "",
			role: "checkbox",
			tabindex: e.disabled ? -1 : 0,
			"aria-checked": B(n),
			"aria-disabled": e.disabled,
			onKeydown: [Ac(Oc(d, ["prevent"]), ["enter"]), Ac(Oc(d, ["prevent"]), ["space"])]
		}), [K("div", Wu, [K("div", {
			class: Vt(["dd-checkbox-input", {
				"dd-checkbox-input-checked": B(n),
				"dd-checkbox-input-disabled": e.disabled
			}]),
			style: It(B(o))
		}, null, 6), U(t.$slots, "default")])], 16, Uu));
	}
}, Ku = /* @__PURE__ */ Y({ default: () => qu }), qu = Q(Gu), Ju = ["id"], Yu = {
	__name: "CheckboxGroup",
	props: {
		id: { type: String },
		name: { type: String },
		autoFill: { type: String }
	},
	setup(e) {
		let t = e, n = V("collectFormValue", void 0), r = V("registerFormControl", void 0), i = /* @__PURE__ */ new Set();
		function a() {
			return [...i].filter((e) => e.isChecked()).map((e) => e.getValue());
		}
		function o() {
			n?.(t.name, a());
		}
		function s(e) {
			return i.add(e), o(), () => {
				i.delete(e), o();
			};
		}
		let c = X(), l = /* @__PURE__ */ z(null);
		function u(e, r) {
			e.setChecked(!e.isChecked());
			let i = a();
			n?.(t.name, i), Z("change", {
				event: r,
				info: c,
				currentTarget: l.value,
				detail: { value: i }
			});
		}
		function d() {
			for (let e of i) e.reset();
			o();
		}
		let f = r?.({
			getName: () => t.name,
			getValue: a,
			reset: d
		});
		return Qi(() => f?.()), li("checkboxGroup", {
			registerCheckbox: s,
			toggleCheckbox: u
		}), (t, n) => (W(), G("div", q({
			id: e.id,
			ref_key: "rootRef",
			ref: l
		}, t.$attrs, {
			class: "dd-checkbox-group",
			role: "group"
		}), [U(t.$slots, "default")], 16, Ju));
	}
}, Xu = /* @__PURE__ */ Y({ default: () => Zu }), Zu = Q(Yu), Qu = {
	__name: "ComponentHost",
	props: { name: { type: String } },
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(null);
		nu({
			attrs: n.attrs,
			bridgeId: n.bridgeId,
			moduleId: V(n.path)?.pageId ?? n.moduleId
		}, r);
		let i = J(() => {
			if (!t.name) return "component-host";
			let e = t.name.replace(/^\/+/, "").replace(/\/index$/, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
			return /^[a-zA-Z]/.test(e) || (e = "component-host-" + e), e || "component-host";
		});
		return (e, t) => (W(), $o(ca(B(i)), q({
			ref_key: "hostRef",
			ref: r
		}, e.$attrs), {
			default: oi(() => [U(e.$slots, "default")]),
			_: 3
		}, 16));
	}
}, $u = /* @__PURE__ */ Y({ default: () => ed }), ed = Q(Qu), td = ["src", "referrerpolicy"], nd = {
	__name: "Image",
	props: {
		src: {
			type: String,
			default: ""
		},
		lazyLoad: {
			type: Boolean,
			default: !1
		},
		lazyLoadMargin: {
			type: Number,
			default: 2
		},
		webp: {
			type: Boolean,
			default: !1
		},
		backgroundSize: {
			type: String,
			default: "100% 100%"
		},
		backgroundPosition: {
			type: String,
			default: ""
		},
		backgroundRepeat: {
			type: String,
			default: "no-repeat"
		},
		renderingMode: {
			type: String,
			default: "backgroundImage",
			validator: (e) => ["backgroundImage", "img"].includes(e)
		},
		showMenuByLongpress: {
			type: Boolean,
			default: !1
		},
		referrerPolicy: {
			type: String,
			default: "unsafe-url"
		},
		mode: {
			type: String,
			default: "scaleToFill",
			validator: (e) => [
				"scaleToFill",
				"aspectFit",
				"aspectFill",
				"widthFix",
				"heightFix",
				"top",
				"bottom",
				"center",
				"left",
				"right",
				"top left",
				"top right",
				"bottom left",
				"bottom right"
			].includes(e)
		}
	},
	setup(e) {
		let t = e, n = {
			scaleToFill: "dd-image-scale",
			aspectFit: "dd-image-aspect",
			aspectFill: "dd-image-fill",
			widthFix: "dd-image-width",
			heightFix: "dd-image-height",
			top: "dd-image-top",
			bottom: "dd-image-bottom",
			center: "dd-image-center",
			left: "dd-image-left",
			right: "dd-image-right",
			"top left": "dd-image-top-left",
			"top right": "dd-image-top-right",
			"bottom left": "dd-image-bottom-left",
			"bottom right": "dd-image-bottom-right"
		}, r = J(() => n[t.mode] || ""), i = {
			scaleToFill: { backgroundSize: "100% 100%" },
			aspectFit: {
				backgroundSize: "contain",
				backgroundPosition: "center center"
			},
			aspectFill: {
				backgroundSize: "cover",
				backgroundPosition: "center center"
			},
			widthFix: { backgroundSize: "100% 100%" },
			heightFix: { backgroundSize: "100% 100%" },
			top: { backgroundPosition: "top center" },
			bottom: { backgroundPosition: "bottom center" },
			center: { backgroundPosition: "center center" },
			left: { backgroundPosition: "center left" },
			right: { backgroundPosition: "center right" },
			"top left": { backgroundPosition: "top left" },
			"top right": { backgroundPosition: "top right" },
			"bottom left": { backgroundPosition: "bottom left" },
			"bottom right": { backgroundPosition: "bottom right" }
		}, a = J(() => {
			if (t.renderingMode === "backgroundImage") return {
				backgroundImage: c.value ? `url(${JSON.stringify(c.value)})` : "",
				backgroundSize: t.backgroundSize,
				backgroundPosition: t.backgroundPosition,
				backgroundRepeat: t.backgroundRepeat,
				...i[t.mode]
			};
		}), o = /* @__PURE__ */ z(null), s = /* @__PURE__ */ z(null), c = /* @__PURE__ */ z(t.lazyLoad ? "" : t.src), l, u, d = "", f = "", p = !t.lazyLoad, m = X(), h = "";
		Yi(() => {
			d = s.value.style.width, f = s.value.style.height, b(), _(), window.ResizeObserver && s.value && (u = new ResizeObserver(y), u.observe(s.value)), x();
		}), Qi(() => {
			l?.disconnect(), u?.disconnect();
		}), H(() => t.src, async () => {
			h = "", t.lazyLoad ? (p = !1, c.value = "", await Jr(), _()) : g(), await Jr(), x();
		});
		function g() {
			p = !0, c.value = t.src, l?.disconnect(), l = void 0;
		}
		function _() {
			if (l?.disconnect(), l = void 0, !t.lazyLoad || p || !("IntersectionObserver" in window)) {
				g();
				return;
			}
			let e = Math.max(Number(t.lazyLoadMargin) || 0, 0), n = e * window.innerHeight, r = e * window.innerWidth;
			l = new IntersectionObserver((e) => {
				e.some((e) => e.isIntersecting || e.intersectionRatio > 0) && g();
			}, { rootMargin: `${n}px ${r}px` }), l.observe(s.value);
		}
		H(() => [t.lazyLoad, t.lazyLoadMargin], ([e], [t]) => {
			e ? !t && c.value ? p = !0 : _() : g();
		});
		function v(e) {
			h = t.src, y(), Z("load", {
				event: e,
				info: m,
				detail: {
					width: o.value?.naturalWidth || o.value?.width,
					height: o.value?.naturalHeight || o.value?.height
				}
			});
		}
		function y() {
			let e = o.value, n = s.value;
			if (!e?.naturalWidth || !e?.naturalHeight || !n) return;
			let r = e.naturalWidth / e.naturalHeight;
			t.mode === "widthFix" ? n.style.height = `${n.clientWidth / r}px` : t.mode === "heightFix" && (n.style.width = `${n.clientHeight * r}px`);
		}
		function b() {
			s.value && (s.value.style.width = t.mode === "heightFix" ? "auto" : d, s.value.style.height = t.mode === "widthFix" ? "auto" : f, Jr(y));
		}
		H(() => t.mode, b);
		function x() {
			let e = o.value;
			!e || !t.src || !e.complete || e.naturalWidth <= 0 || h === t.src || v(new Event("load"));
		}
		function S(e) {
			Z("error", {
				event: e,
				info: m,
				detail: { errMsg: t.src }
			});
		}
		function C(e) {
			t.showMenuByLongpress || e.preventDefault();
		}
		return nu(m, s), (t, n) => (W(), G("span", q({
			ref_key: "conRef",
			ref: s
		}, t.$attrs, {
			class: "dd-image",
			style: B(a),
			onContextmenu: C
		}), [K("img", {
			ref_key: "imgRef",
			ref: o,
			class: Vt([B(r), { "dd-image-preloader": e.renderingMode === "backgroundImage" }]),
			src: B(c),
			alt: "",
			decoding: "async",
			loading: "eager",
			referrerpolicy: e.referrerPolicy,
			onLoad: v,
			onError: S
		}, null, 42, td)], 16));
	}
}, rd = {
	__name: "CoverImage",
	props: {
		src: {
			type: String,
			default: ""
		},
		referrerPolicy: {
			type: String,
			default: "no-referrer"
		}
	},
	setup(e) {
		let t = e;
		return X(), (e, n) => (W(), $o(nd, q(e.$attrs, {
			src: t.src,
			"referrer-policy": t.referrerPolicy
		}), null, 16, ["src", "referrer-policy"]));
	}
}, id = /* @__PURE__ */ Y({ default: () => ad }), ad = Q(rd);
function od(e, t, n) {
	let r = n.filter((t) => Sl(e, t));
	if (!r.length) return;
	let i = /* @__PURE__ */ new Map();
	Yi(() => {
		let n = t.value;
		n && r.forEach((t) => {
			let r = (n) => Z(t, {
				event: n,
				info: e
			});
			i.set(t, r), n.addEventListener(t, r);
		});
	}), $i(() => {
		let e = t.value;
		e && (i.forEach((t, n) => {
			e.removeEventListener(n, t);
		}), i.clear());
	});
}
var sd = ["data-session-from"], cd = {
	__name: "View",
	props: {
		inline: {
			type: Boolean,
			default: !1
		},
		hover: {
			type: Boolean,
			default: !1
		},
		sessionFrom: {
			type: String,
			default: "wxapp"
		},
		hoverClass: {
			type: String,
			default: "none"
		},
		hoverStopPropagation: {
			type: Boolean,
			default: !1
		},
		hoverStartTime: {
			type: Number,
			default: 50
		},
		hoverStayTime: {
			type: Number,
			default: 400
		}
	},
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(null);
		nu(n, r), od(n, r, ["transitionend", "animationend"]);
		let { isHover: i, onHoverCancel: a, onHoverEnd: o, onHoverStart: s } = tu(t);
		return (t, n) => (W(), G("div", q({
			ref_key: "viewRef",
			ref: r
		}, t.$attrs, {
			class: ["dd-view", B(i) ? e.hoverClass : void 0],
			style: e.inline ? { display: "inline" } : void 0,
			"data-session-from": e.sessionFrom,
			onTouchstart: n[0] ||= (...e) => B(s) && B(s)(...e),
			onTouchend: n[1] ||= (...e) => B(o) && B(o)(...e),
			onTouchcancel: n[2] ||= (...e) => B(a) && B(a)(...e),
			onMousedown: n[3] ||= (...e) => B(s) && B(s)(...e),
			onMouseup: n[4] ||= (...e) => B(o) && B(o)(...e),
			onMouseleave: n[5] ||= (...e) => B(a) && B(a)(...e)
		}), [U(t.$slots, "default")], 16, sd));
	}
}, ld = {
	__name: "CoverView",
	props: {
		scrollTop: { type: [Number, String] },
		scrollLeft: { type: [Number, String] },
		markerId: { type: [Number, String] },
		hoverClass: {
			type: String,
			default: "none"
		},
		hover: {
			type: Boolean,
			default: !1
		},
		hoverStopPropagation: {
			type: Boolean,
			default: !1
		},
		hoverStartTime: {
			type: Number,
			default: 50
		},
		hoverStayTime: {
			type: Number,
			default: 400
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(null);
		return H([() => t.scrollTop, () => t.scrollLeft], ([e, t]) => {
			let r = n.value?.$el;
			r && (e !== void 0 && (r.scrollTop = Number(e) || 0), t !== void 0 && (r.scrollLeft = Number(t) || 0));
		}, {
			flush: "post",
			immediate: !0
		}), (t, r) => (W(), $o(cd, q({
			ref_key: "viewRef",
			ref: n
		}, t.$attrs, {
			"marker-id": e.markerId,
			hover: e.hover,
			"hover-class": e.hoverClass,
			"hover-stop-propagation": e.hoverStopPropagation,
			"hover-start-time": e.hoverStartTime,
			"hover-stay-time": e.hoverStayTime
		}), {
			default: oi(() => [U(t.$slots, "default")]),
			_: 3
		}, 16, [
			"marker-id",
			"hover",
			"hover-class",
			"hover-stop-propagation",
			"hover-start-time",
			"hover-stay-time"
		]));
	}
}, ud = /* @__PURE__ */ Y({ default: () => dd }), dd = Q(ld), fd = {
	__name: "Form",
	props: {
		reportSubmit: {
			type: Boolean,
			default: !1,
			required: !1
		},
		reportSubmitTimeout: {
			type: Number,
			default: 0,
			required: !1
		}
	},
	setup(e) {
		let t = /* @__PURE__ */ z({}), n = /* @__PURE__ */ new Set();
		function r(e, n) {
			e && (t.value[e] = n);
		}
		function i(e) {
			return n.add(e), () => n.delete(e);
		}
		function a() {
			let e = { .../* @__PURE__ */ R(t.value) };
			for (let t of n) {
				let n = t.getName?.();
				n && (e[n] = t.getValue?.());
			}
			return e;
		}
		li("collectFormValue", r), li("registerFormControl", i);
		let o = X(), s = /* @__PURE__ */ z(null);
		function c(e, r) {
			e.stopPropagation();
			let i = s.value;
			if (r === "submit") Z("submit", {
				event: e,
				info: o,
				currentTarget: i,
				detail: { value: a() }
			});
			else if (r === "reset") {
				for (let e of n) e.reset?.();
				t.value = {}, Z("reset", {
					event: e,
					info: o,
					currentTarget: i
				});
			}
		}
		return li("formEvent", c), (e, t) => (W(), G("span", q({
			ref_key: "rootRef",
			ref: s
		}, e.$attrs), [U(e.$slots, "default")], 16));
	}
}, pd = /* @__PURE__ */ Y({ default: () => md }), md = Q(fd), hd = ["title"], gd = {
	__name: "Icon",
	props: {
		type: {
			type: String,
			required: !0
		},
		size: {
			type: [Number, String],
			default: 23
		},
		color: { type: String }
	},
	setup(e) {
		Zs((e) => ({
			c819827a: B(a),
			v3cd4ae3e: B(o)
		}));
		let t = e, n = J(() => {
			switch (t.type) {
				case "success": return "dd-icon-success";
				case "success_circle": return "dd-icon-success_circle";
				case "success_no_circle": return "dd-icon-success_no_circle";
				case "info": return "dd-icon-info";
				case "info_circle": return "dd-icon-info_circle";
				case "warn": return "dd-icon-warn";
				case "waiting": return "dd-icon-waiting";
				case "cancel": return "dd-icon-cancel";
				case "download": return "dd-icon-download";
				case "search": return "dd-icon-search";
				case "clear": return "dd-icon-clear";
				case "circle": return "dd-icon-circle";
				default: return "dd-icon-success";
			}
		}), r = J(() => {
			switch (t.type) {
				case "success":
				case "success_circle":
				case "success_no_circle": return "成功";
				case "info":
				case "info_circle": return "信息";
				case "warn": return "警告";
				case "waiting": return "等待";
				case "cancel": return "取消";
				case "download": return "下载";
				case "search": return "搜索";
				case "clear": return "清除";
				case "circle": return "空选";
				default: return "成功";
			}
		}), i = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%)$/, a = J(() => {
			let e;
			return e = t.size ? Qc(t.size) : "23px", i.test(e) || (e += "px"), e;
		}), o = J(() => t.color || "initial");
		return (e, t) => (W(), G("i", q(e.$attrs, {
			title: B(r),
			class: ["dd-icon", B(n)]
		}), null, 16, hd));
	}
}, _d = /* @__PURE__ */ Y({ default: () => vd }), vd = Q(gd), yd = /* @__PURE__ */ Y({ default: () => bd }), bd = Q(nd);
function xd(e, t) {
	if (!Sl(e, "keyboardheightchange")) return;
	let n = 0, r = 0;
	function i(t) {
		let n = Math.max(Math.round(t), 0);
		n !== r && (r = n, Z("keyboardheightchange", {
			info: e,
			detail: {
				height: n,
				duration: 0
			}
		}));
	}
	function a() {
		if (!t.value) return;
		let e = window.visualViewport, r = e ? e.height + e.offsetTop : window.innerHeight;
		i(n - r);
	}
	Yi(() => {
		n = Math.max(window.innerHeight, document.documentElement.clientHeight), window.visualViewport?.addEventListener("resize", a), window.addEventListener("resize", a);
	}), H(t, (e) => {
		e ? a() : i(0);
	}), Qi(() => {
		window.visualViewport?.removeEventListener("resize", a), window.removeEventListener("resize", a);
	});
}
var Sd = [
	"id",
	"type",
	"inputmode",
	"maxlength",
	"value",
	"disabled",
	"autocomplete"
], Cd = {
	__name: "Input",
	props: {
		id: { type: String },
		name: { type: String },
		value: {
			type: String,
			default: ""
		},
		type: {
			type: String,
			default: "text",
			validator: (e) => [
				"text",
				"number",
				"idcard",
				"digit",
				"safe-password",
				"nickname"
			].includes(e)
		},
		password: {
			type: Boolean,
			default: !1
		},
		placeholder: {
			type: String,
			default: ""
		},
		placeholderStyle: {
			type: [String, Object],
			default() {
				return {};
			}
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		maxlength: {
			type: [Number, String],
			default: 140
		},
		cursorSpacing: {
			type: Number,
			default: 0
		},
		autoFocus: {
			type: Boolean,
			default: !1
		},
		focus: {
			type: Boolean,
			default: !1
		},
		confirmType: {
			type: String,
			default: "done",
			validator: (e) => [
				"send",
				"search",
				"next",
				"go",
				"done"
			].includes(e)
		},
		alwaysEmbed: {
			type: Boolean,
			default: !1
		},
		confirmHold: {
			type: Boolean,
			default: !1
		},
		cursor: { type: Number },
		cursorColor: { type: String },
		selectionStart: {
			type: Number,
			default: -1
		},
		selectionEnd: {
			type: Number,
			default: -1
		},
		adjustPosition: {
			type: Boolean,
			default: !0
		},
		holdKeyboard: {
			type: Boolean,
			default: !1
		},
		placeholderClass: {
			type: String,
			default: "input-placeholder"
		},
		keyboardAppearance: {
			type: String,
			default: "default"
		},
		dropdownStyle: {
			type: Object,
			default: () => ({})
		},
		autoFill: {
			type: String,
			default: ""
		},
		safePasswordCertPath: {
			type: String,
			default: null
		},
		safePasswordTimeStamp: {
			type: Number,
			default: null
		},
		safePasswordNonce: {
			type: Number,
			default: null
		},
		safePasswordSalt: {
			type: String,
			default: null
		},
		safePasswordCustomHash: { type: String },
		safePasswordLength: {
			type: Number,
			default: 6
		}
	},
	emits: ["update:value"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = J(() => ({
			"dd-input-wrapper": !0,
			"dd-input-disabled": n.disabled
		})), a = J(() => n.password || n.type === "safe-password" ? "password" : n.type === "number" || n.type === "digit" ? "text" : n.type), o = J(() => {
			switch (n.type) {
				case "number": return "numeric";
				case "digit": return "decimal";
				default: return "text";
			}
		}), s = J(() => ({
			color: (() => {
				if (typeof n.placeholderStyle == "string") {
					let e = n.placeholderStyle.match(/color:([^;]+)/);
					if (e) return e[1].trim();
				} else if (n.placeholderStyle && typeof n.placeholderStyle == "object" && Object.prototype.hasOwnProperty.call(n.placeholderStyle, "color")) return n.placeholderStyle.color;
				return "rgba(0,0,0,.3)";
			})(),
			fontSize: (() => {
				let e;
				if (typeof n.placeholderStyle == "string") {
					let t = n.placeholderStyle.match(/font-size:([^;]+)/);
					t && (e = t[1].trim());
				} else n.placeholderStyle && typeof n.placeholderStyle == "object" && Object.prototype.hasOwnProperty.call(n.placeholderStyle, "font-size") && (e = n.placeholderStyle["font-size"]);
				return e ? Qc(e) : "inherit";
			})(),
			fontWeight: (() => {
				if (typeof n.placeholderStyle == "string") {
					let e = n.placeholderStyle.match(/font-weight:([^;]+)/);
					if (e) return e[1].trim();
				} else if (n.placeholderStyle && typeof n.placeholderStyle == "object" && Object.prototype.hasOwnProperty.call(n.placeholderStyle, "font-weight")) return n.placeholderStyle["font-weight"];
				return "inherit";
			})()
		})), c = V("collectFormValue", void 0), l = V("registerFormControl", void 0);
		c?.(n.name, n.value);
		let u = /* @__PURE__ */ z(n.value), d = l?.({
			getName: () => n.name,
			getValue: () => u.value,
			reset: () => {
				y(""), c?.(n.name, u.value);
			}
		});
		Qi(() => d?.());
		let f = J(() => u.value === void 0 || u.value === null || u.value === "" || typeof u.value == "string" && u.value.length === 0), p = /* @__PURE__ */ z(null), m = /* @__PURE__ */ z(null), h = { mounted: (e) => {
			(n.autoFocus || n.focus) && (e.focus(), g(e));
		} };
		function g(e = p.value) {
			if (!e?.setSelectionRange) return;
			let t = Number(n.cursor), r = t >= 0 ? t : Number(n.selectionStart), i = t >= 0 ? t : Number(n.selectionEnd);
			r >= 0 && e.setSelectionRange(r, i >= 0 ? i : r);
		}
		let _ = !1, v = null;
		H([() => n.focus, () => n.value], ([e, t], [, n]) => {
			e && (p.value.focus(), g()), n !== t && y(t);
		});
		function y(e) {
			u.value !== e && (v = null), u.value = e;
		}
		let b = /* @__PURE__ */ z(null);
		$l(b, () => {
			n.disabled || (p.value?.focus(), g());
		});
		let x = X(), S = /* @__PURE__ */ z(!1);
		li("keyboardAccessoryVisible", S), xd(x, S);
		function C(e) {
			m.value = e.keyCode, v = null, e.keyCode === 13 && !e.isComposing && !_ && (n.confirmHold || e.target.blur(), Z("confirm", {
				event: e,
				info: x,
				detail: { value: e.target.value }
			}));
		}
		function w(e) {
			if (e.target.tagName.toLowerCase() !== "input") return;
			let t = e.target.value;
			switch (e.type) {
				case "compositionstart":
					_ = !0, v = null;
					break;
				case "compositionend":
					_ = !1, v = t, E(e);
					break;
				case "input":
					if (_ && e.isComposing === !1 && (_ = !1), _) {
						c?.(n.name, t), u.value = t;
						break;
					}
					if (T(t)) break;
					E(e);
					break;
				case "focusin":
					if (S.value = !0, g(e.target), Z("focus", {
						event: e,
						info: x,
						detail: { value: t }
					}), !Jc && n.adjustPosition) {
						let e = b.value;
						if (!e) return;
						let t = Hl(e, !0);
						yl("adjustPosition", {
							bridgeId: x.bridgeId,
							params: { bottom: t }
						});
					}
					break;
				case "focusout":
					_ = !1, v = null, S.value = !1, Z("blur", {
						event: e,
						info: x,
						detail: {
							value: t,
							cursor: e.target.selectionEnd
						}
					});
					break;
				case "change": Z("change", {
					event: e,
					info: x,
					detail: { value: t }
				});
			}
		}
		function T(e) {
			if (v === null) return !1;
			let t = e === v;
			return v = null, t;
		}
		function E(e) {
			let t = e.target.value;
			c?.(n.name, t), u.value = t, r("update:value", t), Z("input", {
				event: e,
				info: x,
				detail: {
					value: t,
					cursor: e.target.selectionEnd,
					keyCode: m.value
				},
				success: (e) => {
					let t = e.value ?? e;
					y(t), r("update:value", t);
				}
			});
		}
		return (t, n) => (W(), G("div", q({
			ref_key: "wrapperRef",
			ref: b
		}, t.$attrs, {
			class: B(i),
			role: "textbox",
			"data-dd-label-target": "",
			onInput: w,
			onFocusin: w,
			onFocusout: w,
			onChange: w,
			onCompositionstart: w,
			onCompositionend: w
		}), [
			si(K("input", {
				id: e.id,
				ref_key: "inputRef",
				ref: p,
				class: "dd-input",
				type: B(a),
				inputmode: B(o),
				maxlength: e.maxlength,
				value: B(u),
				disabled: e.disabled,
				autocomplete: e.autoFill || void 0,
				onKeydown: C
			}, null, 40, Sd), [[h]]),
			si(K("div", {
				class: Vt(["dd-input-placeholder", e.placeholderClass]),
				style: It(B(s))
			}, Xt(e.placeholder), 7), [[Js, B(f)]]),
			U(t.$slots, "default")
		], 16));
	}
}, wd = /* @__PURE__ */ Y({ default: () => Td }), Td = Q(Cd), Ed = {
	__name: "KeyboardAccessory",
	props: { maxHeight: {
		type: Number,
		default: 200
	} },
	setup(e) {
		let t = e, n = V("keyboardAccessoryVisible", /* @__PURE__ */ z(!1)), r = J(() => n.value && window.innerWidth <= window.innerHeight), i = J(() => ({
			bottom: 0,
			left: 0,
			maxHeight: `${t.maxHeight}px`,
			pointerEvents: r.value ? "auto" : "none",
			position: "fixed",
			visibility: r.value ? "visible" : "hidden",
			width: "100%",
			zIndex: r.value ? 1 : -1
		}));
		return (e, t) => (W(), $o(Di, { to: "body" }, [K("div", q(e.$attrs, {
			class: "dd-keyboard-accessory",
			style: B(i)
		}), [U(e.$slots, "default")], 16)]));
	}
}, Dd = /* @__PURE__ */ Y({ default: () => Od }), Od = Q(Ed), kd = ["for"], Ad = {
	__name: "Label",
	props: { for: { type: String } },
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(null);
		function r(e) {
			if (!(e instanceof Element)) return !1;
			let t = e.closest(Zl);
			return !!(t && n.value?.contains(t));
		}
		function i() {
			return t.for ? document.getElementById(t.for) : n.value?.querySelector(Zl);
		}
		function a(e) {
			if (r(e.target)) return;
			let t = i();
			t && t !== n.value && eu(t, e);
		}
		function o(e) {
			e.preventDefault();
		}
		let s = X();
		function c({ event: e }) {
			a(e), Z("tap", {
				event: e,
				info: s
			});
		}
		return nu(s, n, { tapHandler: c }), (e, r) => (W(), G("label", q({
			ref_key: "labelRef",
			ref: n
		}, e.$attrs, {
			for: t.for,
			onClick: o
		}), [U(e.$slots, "default")], 16, kd));
	}
}, jd = /* @__PURE__ */ Y({ default: () => Md }), Md = Q(Ad), Nd = ["id"], Pd = {
	key: 0,
	class: "dd-map-desktop"
}, Fd = {
	key: 1,
	class: "dd-map-native dd-map-container"
}, Id = ["data-dimina-native-id"], Ld = {
	key: 4,
	class: "dd-map-desktop"
}, Rd = { class: "dd-map-slot" }, zd = "native/map", Bd = {
	__name: "Map",
	props: {
		id: {
			type: String,
			default: () => `map-${Pi()}`
		},
		latitude: {
			type: Number,
			default: 39.92
		},
		longitude: {
			type: Number,
			default: 116.46
		},
		scale: {
			type: Number,
			default: 16
		},
		markers: {
			type: Array,
			default: () => []
		},
		covers: {
			type: Array,
			default: () => []
		},
		includePoints: {
			type: Array,
			default: () => []
		},
		polyline: {
			type: Array,
			default: () => []
		},
		circles: {
			type: Array,
			default: () => []
		},
		controls: {
			type: Array,
			default: () => []
		},
		polygons: {
			type: Array,
			default: () => []
		},
		showLocation: {
			type: Boolean,
			default: !1
		},
		showScale: {
			type: Boolean,
			default: !1
		},
		showCompass: {
			type: Boolean,
			default: !1
		},
		theme: {
			type: String,
			default: "normal"
		},
		subkey: {
			type: String,
			default: ""
		},
		layerStyle: {
			type: Number,
			default: 1
		},
		usePluginId: {
			type: Boolean,
			default: !1
		},
		enableZoom: {
			type: Boolean,
			default: !0
		},
		enableScroll: {
			type: Boolean,
			default: !0
		},
		enableRotate: {
			type: Boolean,
			default: !1
		},
		enable3D: {
			type: Boolean,
			default: !1
		},
		enableOverlooking: {
			type: Boolean,
			default: !1
		},
		enableAutoMaxOverlooking: {
			type: Boolean,
			default: !1
		},
		enableSatellite: {
			type: Boolean,
			default: !1
		},
		enableTraffic: {
			type: Boolean,
			default: !1
		},
		enablePoi: {
			type: Boolean,
			default: !0
		},
		enablePOI: {
			type: Boolean,
			default: void 0
		},
		enableBuilding: {
			type: Boolean,
			default: !0
		},
		enableIndoor: {
			type: Boolean,
			default: !1
		},
		enableIndoorBuildingPick: {
			type: Boolean,
			default: !1
		},
		enableIndoorLevelPick: {
			type: Boolean,
			default: !1
		},
		rotate: {
			type: Number,
			default: 0
		},
		skew: {
			type: Number,
			default: 0
		},
		minScale: {
			type: Number,
			default: 3
		},
		maxScale: {
			type: Number,
			default: 22
		},
		setting: {
			type: Object,
			default: () => ({})
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(), r = X(), i = J(() => Gc || Kc || qc), a = [], o, s = 0, c = "", l = !1;
		function u() {
			if (!n.value) return {};
			let e = n.value.getBoundingClientRect();
			return {
				left: e.left,
				top: e.top,
				width: e.width,
				height: e.height,
				pageLeft: e.left + window.scrollX,
				pageTop: e.top + window.scrollY,
				scrollX: window.scrollX,
				scrollY: window.scrollY,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight
			};
		}
		function d() {
			let e = t.enablePOI === void 0 ? t.enablePoi : t.enablePOI;
			return {
				latitude: t.latitude,
				longitude: t.longitude,
				scale: t.scale,
				markers: t.markers,
				covers: t.covers,
				includePoints: t.includePoints,
				polyline: t.polyline,
				circles: t.circles,
				controls: t.controls,
				polygons: t.polygons,
				showLocation: t.showLocation,
				showScale: t.showScale,
				showCompass: t.showCompass,
				theme: t.theme,
				subkey: t.subkey,
				layerStyle: t.layerStyle,
				usePluginId: t.usePluginId,
				enableZoom: t.enableZoom,
				enableScroll: t.enableScroll,
				enableRotate: t.enableRotate,
				enable3D: t.enable3D,
				enableOverlooking: t.enableOverlooking,
				enableAutoMaxOverlooking: t.enableAutoMaxOverlooking,
				enableSatellite: t.enableSatellite,
				enableTraffic: t.enableTraffic,
				enablePoi: e,
				enablePOI: e,
				enableBuilding: t.enableBuilding,
				enableIndoor: t.enableIndoor,
				enableIndoorBuildingPick: t.enableIndoorBuildingPick,
				enableIndoorLevelPick: t.enableIndoorLevelPick,
				rotate: t.rotate,
				skew: t.skew,
				minScale: t.minScale,
				maxScale: t.maxScale,
				setting: t.setting,
				...t.setting,
				type: zd,
				id: t.id,
				hidden: n.value?.hasAttribute("hidden") || !1,
				rect: u()
			};
		}
		function f(e) {
			i.value && (e !== "propsUpdate" || l) && yl(e, {
				bridgeId: r.bridgeId,
				params: d()
			});
		}
		function p(e, n) {
			let i = xl(e, (e) => {
				(e.id === void 0 || e.id === t.id || e.mapId === t.id) && Z(n, {
					type: n,
					info: r,
					detail: e
				});
			});
			a.push(i);
		}
		function m(e = !1) {
			let t = JSON.stringify({
				...u(),
				hidden: n.value?.hasAttribute("hidden") || !1
			});
			(e || t !== c) && (c = t, f("propsUpdate"));
		}
		function h() {
			s ||= requestAnimationFrame(() => {
				s = 0, m();
			});
		}
		return Yi(() => {
			if (i.value) {
				Gc && Eu();
				for (let e of [
					"callouttap",
					"markertap",
					"labeltap",
					"controltap",
					"regionchange",
					"tap",
					"indoorchange",
					"poitap",
					"anchorpointtap",
					"updated",
					"rendersuccess",
					"error"
				]) p(`bind${e}`, e);
				Jr(() => {
					l = !0, f("componentMount"), c = JSON.stringify({
						...u(),
						hidden: n.value?.hasAttribute("hidden") || !1
					}), window.addEventListener("resize", h), window.addEventListener("scroll", h, !0), window.ResizeObserver && n.value && (o = new ResizeObserver(h), o.observe(n.value));
				});
			}
		}), H(() => d(), () => f("propsUpdate"), { deep: !0 }), Qi(() => {
			s && cancelAnimationFrame(s), o?.disconnect(), window.removeEventListener("resize", h), window.removeEventListener("scroll", h, !0), f("componentUnmount"), l = !1, a.splice(0).forEach((e) => e());
		}), (t, r) => (W(), G("div", q({
			id: e.id,
			ref_key: "rootRef",
			ref: n
		}, t.$attrs, { class: "dd-map" }), [B(Jc) ? (W(), G("div", Pd, "未实现组件")) : B(Kc) ? (W(), G("div", Fd, [...r[0] ||= [K("div", null, null, -1)]])) : B(Gc) ? (W(), G("embed", {
			key: 2,
			class: "dd-map-native",
			type: "application/view",
			comp_type: zd,
			"data-dimina-native-type": "native/map",
			"data-dimina-native-id": e.id
		}, null, 8, Id)) : B(qc) ? (W(), G("embed", {
			key: 3,
			class: "dd-map-native",
			type: zd
		})) : (W(), G("div", Ld, "未实现组件")), K("div", Rd, [U(t.$slots, "default")])], 16, Nd));
	}
}, Vd = /* @__PURE__ */ Y({ default: () => Hd }), Hd = Q(Bd), Ud = {
	__name: "MovableArea",
	props: { scaleArea: {
		type: Boolean,
		default: !1,
		require: !1
	} },
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(null), i = /* @__PURE__ */ new Set();
		li("registerMovableView", (e) => (i.add(e), () => i.delete(e)));
		function a(e, n) {
			if (t.scaleArea && !e.target.closest?.(".dd-movable-view") && !(n !== "end" && e.touches?.length < 2)) for (let t of i) t[n]?.(e);
		}
		function o({ event: e }) {
			Z("tap", {
				event: e,
				info: n
			});
		}
		return nu(n, r, { tapHandler: o }), (e, t) => (W(), G("div", q({
			ref_key: "rootRef",
			ref: r
		}, e.$attrs, {
			class: "dd-movable-area",
			onTouchstart: t[0] ||= (e) => a(e, "start"),
			onTouchmove: t[1] ||= (e) => a(e, "move"),
			onTouchend: t[2] ||= (e) => a(e, "end"),
			onTouchcancel: t[3] ||= (e) => a(e, "end")
		}), [U(e.$slots, "default")], 16));
	}
}, Wd = /* @__PURE__ */ Y({ default: () => Gd }), Gd = Q(Ud), Kd = {
	__name: "MovableView",
	props: {
		direction: {
			type: String,
			default: "none",
			required: !1,
			validator: (e) => [
				"all",
				"vertical",
				"horizontal",
				"none"
			].includes(e)
		},
		inertia: {
			type: Boolean,
			default: !1,
			required: !1
		},
		outOfBounds: {
			type: Boolean,
			default: !1,
			required: !1
		},
		x: {
			type: [Number, String],
			default: 0,
			required: !1
		},
		y: {
			type: [Number, String],
			default: 0,
			required: !1
		},
		damping: {
			type: Number,
			default: 20,
			required: !1
		},
		friction: {
			type: Number,
			default: 2,
			required: !1,
			validator: (e) => e > 0
		},
		disabled: {
			type: Boolean,
			default: !1,
			required: !1
		},
		scale: {
			type: Boolean,
			default: !1,
			required: !1
		},
		scaleMin: {
			type: Number,
			default: .5,
			required: !1
		},
		scaleMax: {
			type: Number,
			default: 10,
			required: !1
		},
		scaleValue: {
			type: Number,
			default: 1,
			required: !1,
			validator: (e) => e >= .5 && e <= 10
		},
		animation: {
			type: Boolean,
			default: !0,
			required: !1
		}
	},
	emits: ["update:x", "update:y"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = X(), a = V("registerMovableView", void 0), o = /* @__PURE__ */ z(null), s = /* @__PURE__ */ z(null), c = 0, l = 0;
		function u(e) {
			let t = Number.parseFloat(e);
			return Number.isFinite(t) ? t : 0;
		}
		let d = /* @__PURE__ */ z(u(n.x)), f = /* @__PURE__ */ z(u(n.y)), p = /* @__PURE__ */ z(Math.min(Math.max(n.scaleValue, n.scaleMin, .5), n.scaleMax, 10)), m = /* @__PURE__ */ z(n.animation ? "0.5s" : "0s"), h = !1, g = !1, _ = !1, v = {
			width: 0,
			height: 0
		}, y = {
			width: 0,
			height: 0
		}, b = null, x = 0, S = 1, C = 0, w = 0, T = 0, E = 0, ee = 0, D = null, te;
		Yi(() => {
			te = a?.({
				start: re,
				move: k,
				end: A
			}), D = new ResizeObserver(() => {
				requestAnimationFrame(() => {
					ne();
				});
			}), o.value && o.value.parentElement && (D.observe(o.value.parentElement), D.observe(s.value)), Jr(() => {
				ne(), m.value = "0s";
				let { x: e, y: t } = O(d.value, f.value);
				d.value = e, f.value = t;
			});
		}), $i(() => {
			te?.(), D &&= (D.disconnect(), null), b &&= (cancelAnimationFrame(b), null);
		});
		function ne() {
			v = o.value.parentElement.getBoundingClientRect(), y = {
				width: s.value.offsetWidth,
				height: s.value.offsetHeight
			}, v.width, y.width, v.x, v.height, y.height, v.y;
		}
		function O(e, t) {
			if (!v || !y) return {
				x: e,
				y: t
			};
			let n = e, r = t;
			return n = v.width >= y.width ? Math.min(Math.max(e, 0), v.width - y.width) : Math.min(Math.max(e, v.width - y.width), 0), r = v.height >= y.height ? Math.min(Math.max(t, 0), v.height - y.height) : Math.min(Math.max(t, v.height - y.height), 0), {
				x: n,
				y: r
			};
		}
		function re(e) {
			if (n.disabled) {
				Z("touchstart", {
					event: e,
					info: i
				});
				return;
			}
			if (m.value = "0s", n.scale && e.touches?.length >= 2) {
				let [t, n] = e.touches;
				x = Math.hypot(n.clientX - t.clientX, n.clientY - t.clientY), S = p.value, g = !0, h = !1, Z("touchstart", {
					event: e,
					info: i
				});
				return;
			}
			h = !0;
			let t = e.touches ? e.touches[0] : e;
			c = t.clientX - d.value, l = t.clientY - f.value, C = t.clientX, w = t.clientY, T = e.timeStamp || performance.now(), E = 0, ee = 0, Z("touchstart", {
				event: e,
				info: i
			});
		}
		function k(e) {
			if (g && e.touches?.length >= 2) {
				e.cancelable && e.preventDefault();
				let [t, r] = e.touches, a = Math.hypot(r.clientX - t.clientX, r.clientY - t.clientY), o = Math.min(Math.max(S * a / Math.max(x, 1), n.scaleMin, .5), n.scaleMax, 10);
				o !== p.value && (p.value = Number(o.toFixed(3)), Z("scale", {
					event: e,
					info: i,
					detail: {
						scale: p.value,
						x: d.value,
						y: f.value
					}
				}));
				return;
			}
			if (n.disabled || !h) {
				n.disabled && Z("touchmove", {
					event: e,
					info: i
				});
				return;
			}
			e.stopPropagation(), b && cancelAnimationFrame(b), b = requestAnimationFrame(() => {
				let t = e.touches ? e.touches[0].clientX : e.clientX, a = e.touches ? e.touches[0].clientY : e.clientY, o = e.timeStamp || performance.now(), s = Math.max(o - T, 1);
				E = (t - C) / s, ee = (a - w) / s, C = t, w = a, T = o;
				let u = t - c, p = a - l, m = O(u, p), h = (e, t) => t + (e - t) / Math.max(n.damping / 5, 1), g = n.outOfBounds && m.x !== u ? h(u, m.x) : m.x, v = n.outOfBounds && m.y !== p ? h(p, m.y) : m.y;
				_ = !0, n.direction === "horizontal" ? (d.value = g, r("update:x", g)) : n.direction === "vertical" ? (f.value = v, r("update:y", v)) : n.direction === "all" && (d.value = g, f.value = v, r("update:x", g), r("update:y", v)), n.direction !== "none" && Z("change", {
					event: e,
					info: i,
					detail: {
						x: d.value,
						y: f.value,
						source: m.x === u && m.y === p ? "touch" : "touch-out-of-bounds"
					}
				});
			});
		}
		function A(e) {
			if (n.disabled) {
				Z("touchend", {
					event: e,
					info: i
				});
				return;
			}
			if (g) {
				g = !1, Z("touchend", {
					event: e,
					info: i
				});
				return;
			}
			if (!h) return;
			h = !1, _ = !1;
			let t = O(d.value, f.value), a = t.x, o = t.y, s = t.x !== d.value || t.y !== f.value ? "out-of-bounds" : "";
			if (!s && n.inertia) {
				let e = 180 / Math.max(n.friction, .01), t = O(d.value + E * e, f.value + ee * e);
				a = t.x, o = t.y, s = a !== d.value || o !== f.value ? "friction" : "";
			}
			m.value = n.animation && s ? `${Math.max(120, 600 / Math.max(n.damping / 10, 1))}ms` : "0s", s && (d.value = a, f.value = o, r("update:x", a), r("update:y", o), Z("change", {
				event: e,
				info: i,
				detail: {
					x: a,
					y: o,
					source: s
				}
			})), b &&= (cancelAnimationFrame(b), null), Z("touchend", {
				event: e,
				info: i
			});
		}
		return H([() => n.x, () => n.y], ([e, t], [r, i]) => {
			if (_ || e === r && t === i) return;
			let { x: a, y: o } = O(u(e), u(t));
			m.value = n.animation ? "0.5s" : "0s", d.value = a, f.value = o;
		}, { flush: "post" }), H([
			() => n.scaleValue,
			() => n.scaleMin,
			() => n.scaleMax
		], ([e]) => {
			n.scale && (p.value = Math.min(Math.max(Number(e) || 1, n.scaleMin, .5), n.scaleMax, 10));
		}), (t, n) => (W(), G("div", q({
			ref_key: "movableView",
			ref: o
		}, t.$attrs, {
			class: ["dd-movable-view", [`direction-${e.direction}`]],
			"aria-dropeffect": "move",
			"aria-label": "可移动",
			onTouchstart: re,
			onTouchmove: k,
			onTouchend: A,
			onTouchcancel: A,
			onMousedown: re,
			onMousemove: k,
			onMouseup: A,
			onMouseleave: A
		}), [K("div", {
			ref_key: "movableViewContent",
			ref: s,
			class: "dd-movable-view-content",
			style: It({
				"--duration": B(m),
				transform: `translate3d(${B(d)}px, ${B(f)}px, 0) scale(${B(p)})`
			})
		}, [U(t.$slots, "default")], 4)], 16));
	}
}, qd = /* @__PURE__ */ Y({ default: () => Jd }), Jd = Q(Kd), Yd = {
	__name: "NavigationBar",
	props: {
		title: {
			type: String,
			required: !1
		},
		loading: {
			type: Boolean,
			default: !1,
			required: !1
		},
		frontColor: {
			type: String,
			required: !1,
			validator: (e) => ["#ffffff", "#000000"].includes(e)
		},
		backgroundColor: {
			type: String,
			required: !1,
			validator: (e) => /^#(?:[0-9A-F]{6}|[0-9A-F]{3})$/i.test(e)
		},
		colorAnimationDuration: {
			type: Number,
			default: 0,
			required: !1
		},
		colorAnimationTimingFunc: {
			type: String,
			default: "linear",
			required: !1,
			validator: (e) => [
				"linear",
				"easeIn",
				"easeOut",
				"easeInOut"
			].includes(e)
		}
	},
	setup(e) {
		let t = e, n = X();
		function r() {
			yl("setNavigationBarTitle", {
				bridgeId: n.bridgeId,
				params: { title: t.title }
			});
		}
		function i() {
			yl("setNavigationBarColor", {
				bridgeId: n.bridgeId,
				params: {
					frontColor: t.frontColor,
					backgroundColor: t.backgroundColor,
					animation: {
						duration: t.colorAnimationDuration,
						timingFunc: t.colorAnimationTimingFunc
					}
				}
			});
		}
		function a() {
			yl(t.loading ? "showNavigationBarLoading" : "hideNavigationBarLoading", {
				bridgeId: n.bridgeId,
				params: {}
			});
		}
		return H(() => t.title, r, { immediate: !0 }), H(() => [
			t.frontColor,
			t.backgroundColor,
			t.colorAnimationDuration,
			t.colorAnimationTimingFunc
		], i, { immediate: !0 }), H(() => t.loading, a, { immediate: !0 }), (e, t) => U(e.$slots, "default");
	}
}, Xd = /* @__PURE__ */ Y({ default: () => Zd }), Zd = Q(Yd), Qd = ["onKeydown"], $d = {
	__name: "Navigator",
	props: {
		target: {
			type: String,
			default: "self"
		},
		url: { type: String },
		redirect: {
			type: Boolean,
			default: !1
		},
		openType: {
			type: String,
			default: "navigate"
		},
		delta: {
			type: Number,
			default: 1
		},
		appId: { type: String },
		path: { type: String },
		extraData: { type: Object },
		version: {
			type: String,
			default: "release"
		},
		shortLink: { type: String },
		scene: {
			type: Number,
			default: 1037
		},
		sceneNote: {
			type: String,
			default: ""
		},
		hoverClass: {
			type: String,
			default: "navigator-hover"
		},
		hover: {
			type: Boolean,
			default: !0
		},
		hoverStopPropagation: {
			type: Boolean,
			default: !1
		},
		hoverStartTime: {
			type: Number,
			default: 50
		},
		hoverStayTime: {
			type: Number,
			default: 600
		}
	},
	setup(e) {
		let t = e, { isHover: n, onHoverCancel: r, onHoverEnd: i, onHoverStart: a } = tu(t), o = X();
		function s(e, t, n) {
			let r = {
				...n,
				currentTarget: n.currentTarget,
				target: n.target
			};
			bl(e, {
				bridgeId: o.bridgeId,
				params: t,
				success: (e = {}) => Z("success", {
					event: r,
					info: o,
					detail: e
				}),
				fail: (e = {}) => Z("fail", {
					event: r,
					info: o,
					detail: e
				}),
				complete: (e = {}) => Z("complete", {
					event: r,
					info: o,
					detail: e
				})
			});
		}
		function c(e) {
			let { openType: n, target: r, url: i, redirect: a } = t;
			if (!i?.includes("javascript:")) {
				if (a) {
					s("redirectTo", { url: Xc(o.path, i) }, e);
					return;
				}
				if (r === "miniProgram") {
					n === "navigate" ? s("navigateToMiniProgram", {
						appId: t.appId,
						path: t.path,
						shortLink: t.shortLink,
						extraData: t.extraData,
						envVersion: t.version,
						scene: t.scene,
						sceneNote: t.sceneNote
					}, e) : n === "navigateBack" ? s("navigateBackMiniProgram", { extraData: t.extraData }, e) : n === "exit" && s("exitMiniProgram", {}, e);
					return;
				}
				switch (n) {
					case "navigate":
						s("navigateTo", { url: Xc(o.path, i) }, e);
						break;
					case "redirect":
						s("redirectTo", { url: Xc(o.path, i) }, e);
						break;
					case "switchTab":
						s("switchTab", { url: Xc(o.path, i) }, e);
						break;
					case "reLaunch":
						s("reLaunch", { url: Xc(o.path, i) }, e);
						break;
					case "navigateBack": s("navigateBack", { delta: t.delta }, e);
				}
			}
		}
		let l = /* @__PURE__ */ z(null);
		function u({ event: e }) {
			Z("tap", {
				event: e,
				info: o
			}), c(e);
		}
		function d() {
			l.value?.click();
		}
		return nu(o, l, { tapHandler: u }), (t, o) => (W(), G("span", q({
			ref_key: "rootRef",
			ref: l
		}, t.$attrs, {
			class: ["dd-navigator", [B(n) ? e.hoverClass : void 0]],
			role: "link",
			tabindex: "0",
			onKeydown: Ac(Oc(d, ["prevent"]), ["enter"]),
			onTouchstart: o[0] ||= (...e) => B(a) && B(a)(...e),
			onTouchend: o[1] ||= (...e) => B(i) && B(i)(...e),
			onTouchcancel: o[2] ||= (...e) => B(r) && B(r)(...e),
			onMousedown: o[3] ||= (...e) => B(a) && B(a)(...e),
			onMouseup: o[4] ||= (...e) => B(i) && B(i)(...e),
			onMouseleave: o[5] ||= (...e) => B(r) && B(r)(...e)
		}), [U(t.$slots, "default")], 16, Qd));
	}
}, ef = /* @__PURE__ */ Y({ default: () => tf }), tf = Q($d), nf = ["src"], rf = {
	__name: "OpenData",
	props: {
		type: {
			type: String,
			default: ""
		},
		openGid: {
			type: String,
			default: ""
		},
		lang: {
			type: String,
			default: "en"
		},
		defaultText: {
			type: String,
			default: ""
		},
		defaultAvatar: {
			type: String,
			default: ""
		},
		keyList: {
			type: Array,
			default: () => []
		}
	},
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(""), i = /* @__PURE__ */ z(""), a = 0;
		function o(e) {
			i.value = t.type === "userAvatarUrl" ? t.defaultAvatar : "", r.value = i.value ? "" : t.defaultText, Z("error", {
				info: n,
				detail: { errMsg: e }
			});
		}
		function s(e) {
			let n = t.type.replace(/^user/, ""), a = n ? n[0].toLowerCase() + n.slice(1) : "", s = e?.[a];
			if (!s) {
				o(`${t.type} is empty.`);
				return;
			}
			a === "avatarUrl" ? (i.value = s, r.value = "") : a === "gender" ? r.value = {
				en: [
					"",
					"Male",
					"Female"
				],
				zh_CN: [
					"",
					"男",
					"女"
				],
				zh_TW: [
					"",
					"男",
					"女"
				]
			}[t.lang]?.[s] || "" : r.value = String(s);
		}
		function c() {
			let e = ++a;
			if (i.value = "", r.value = "", !t.type) return;
			let c, l = {};
			if (t.type === "groupName") c = "getGroupInfoByGId", l = { openGId: t.openGid };
			else if (t.type.startsWith("user")) c = "getUserInfo", l = { lang: t.lang };
			else if (t.type.endsWith("CloudStorage")) c = `get${t.type[0].toUpperCase()}${t.type.slice(1)}`, l = { keyList: t.keyList };
			else {
				o(`${t.type} is not supported.`);
				return;
			}
			bl(c, {
				bridgeId: n.bridgeId,
				params: l,
				success: (i = {}) => {
					e === a && (t.type === "groupName" ? (r.value = i.roomTopic || t.defaultText, i.roomTopic || Z("error", {
						info: n,
						detail: { errMsg: "groupName is empty." }
					}), Z("getgroupname", {
						info: n,
						detail: i
					})) : t.type.startsWith("user") ? s(i.userInfo || i) : r.value = t.defaultText);
				},
				fail: (t = {}) => {
					e === a && o(t.errMsg || `${c}:fail`);
				}
			});
		}
		return H(() => [
			t.type,
			t.openGid,
			t.lang,
			t.defaultText,
			t.defaultAvatar,
			t.keyList
		], c, {
			deep: !0,
			immediate: !0
		}), Qi(() => {
			a++;
		}), (e, t) => (W(), G("span", q(e.$attrs, { class: "dd-open-data" }), [B(i) ? (W(), G("img", {
			key: 0,
			src: B(i),
			alt: "",
			class: "dd-open-data-avatar"
		}, null, 8, nf)) : (W(), G(Uo, { key: 1 }, [cs(Xt(B(r)), 1)], 64))], 16));
	}
}, af = /* @__PURE__ */ Y({ default: () => of }), of = Q(rf), sf = {
	__name: "PageMeta",
	props: {
		diminaRpxUnit: {
			type: String,
			default: "",
			required: !1
		},
		backgroundTextStyle: {
			type: String,
			required: !1,
			validator: (e) => ["dark", "light"].includes(e)
		},
		backgroundColor: {
			type: String,
			required: !1
		},
		backgroundColorTop: {
			type: String,
			required: !1
		},
		backgroundColorBottom: {
			type: String,
			required: !1
		},
		rootBackgroundColor: {
			type: String,
			default: "",
			required: !1
		},
		pageStyle: {
			type: String,
			default: "",
			required: !1
		},
		pageFontSize: {
			type: String,
			default: "",
			required: !1
		},
		rootFontSize: {
			type: String,
			default: "",
			required: !1
		},
		pageOrientation: {
			type: String,
			default: "",
			required: !1
		},
		scrollTop: {
			type: [Number, String],
			default: ""
		},
		scrollDuration: {
			type: Number,
			default: 300
		}
	},
	setup(e) {
		let t = e, n = X(), r, i, a, o;
		function s() {
			yl("setBackgroundTextStyle", {
				bridgeId: n.bridgeId,
				params: { textStyle: t.backgroundTextStyle }
			}), yl("setBackgroundColor", {
				bridgeId: n.bridgeId,
				params: {
					backgroundColor: t.backgroundColor,
					backgroundColorTop: t.backgroundColorTop,
					backgroundColorBottom: t.backgroundColorBottom
				}
			});
		}
		function c(e) {
			return e ? e === "system" ? `${window.__fontSizeSetting__ || 16}px` : Qc(e) : "";
		}
		function l() {
			r && (r.style.cssText = t.pageStyle || "", t.pageFontSize && (r.style.fontSize = c(t.pageFontSize)), t.diminaRpxUnit === "vw" && (document.documentElement.style.fontSize = c(t.rootFontSize)), document.documentElement.style.backgroundColor = t.rootBackgroundColor || "");
		}
		function u() {
			t.scrollTop !== "" && t.scrollTop !== void 0 && t.scrollTop !== null && bl("pageScrollTo", {
				bridgeId: n.bridgeId,
				params: {
					duration: t.scrollDuration,
					scrollTop: Number(t.scrollTop) || 0
				},
				success: () => Z("scrolldone", {
					info: n,
					detail: {}
				})
			});
		}
		function d(e) {
			Z("resize", {
				event: e,
				info: n,
				detail: { size: {
					windowWidth: window.innerWidth,
					windowHeight: window.innerHeight
				} }
			});
		}
		function f(e) {
			Z("scroll", {
				event: e,
				info: n,
				detail: { scrollTop: window.scrollY }
			});
		}
		return H(() => [
			t.backgroundTextStyle,
			t.backgroundColor,
			t.backgroundColorTop,
			t.backgroundColorBottom
		], s), H(() => [
			t.diminaRpxUnit,
			t.pageStyle,
			t.pageFontSize,
			t.rootFontSize,
			t.rootBackgroundColor
		], l), H(() => [t.scrollTop, t.scrollDuration], u), Yi(() => {
			r = document.querySelector(".dd-page"), i = r?.getAttribute("style"), a = document.documentElement.style.fontSize, o = document.documentElement.style.backgroundColor, s(), l(), u(), window.addEventListener("resize", d), window.addEventListener("scroll", f, { passive: !0 });
		}), Qi(() => {
			window.removeEventListener("resize", d), window.removeEventListener("scroll", f), r && (i === null ? r.removeAttribute("style") : r.setAttribute("style", i)), document.documentElement.style.fontSize = a, document.documentElement.style.backgroundColor = o;
		}), (e, t) => U(e.$slots, "default");
	}
}, cf = /* @__PURE__ */ Y({ default: () => lf }), lf = Q(sf), uf = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, df = { class: "dd-picker-column" }, ff = 44, pf = /*#__PURE__*/ uf({
	__name: "PickerColumn",
	props: {
		options: {
			type: Array,
			default: () => []
		},
		value: {
			type: Number,
			default: 0
		}
	},
	emits: ["change"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = /* @__PURE__ */ z(null), a = /* @__PURE__ */ z(n.value), o = /* @__PURE__ */ z(0), s = /* @__PURE__ */ z(0), c = /* @__PURE__ */ z(!1);
		H(() => n.value, (e) => {
			c.value || (e !== a.value && (a.value = e), l());
		}), H(() => n.options, () => {
			Jr(() => {
				c.value || l();
			});
		}), Yi(() => {
			l();
		});
		let l = () => {
			if (!i.value) return;
			let e = -a.value * ff;
			i.value.style.transform = `translateY(${e}px)`, i.value.style.transition = "transform 0.3s ease";
		}, u = (e) => {
			c.value = !0, o.value = e.touches[0].clientY, s.value = e.touches[0].clientY, i.value && (i.value.style.transition = "none");
		}, d = (e) => {
			if (!c.value) return;
			e.preventDefault(), s.value = e.touches[0].clientY;
			let t = s.value - o.value, n = -a.value * ff + t;
			i.value && (i.value.style.transform = `translateY(${n}px)`);
		}, f = (e) => {
			if (!c.value) return;
			c.value = !1;
			let t = s.value - o.value, i = Math.round(t / ff), u = a.value - i;
			u = Math.max(0, Math.min(u, n.options.length - 1)), u !== a.value && (a.value = u, r("change", e, u)), l();
		}, p = (e) => {
			c.value = !0, o.value = e.clientY, s.value = e.clientY, i.value && (i.value.style.transition = "none");
			let t = (e) => {
				if (!c.value) return;
				s.value = e.clientY;
				let t = s.value - o.value, n = -a.value * ff + t;
				i.value && (i.value.style.transform = `translateY(${n}px)`);
			}, u = (e) => {
				if (!c.value) return;
				c.value = !1;
				let i = s.value - o.value, d = Math.round(i / ff), f = a.value - d;
				f = Math.max(0, Math.min(f, n.options.length - 1)), f !== a.value && (a.value = f, r("change", e, f)), l(), document.removeEventListener("mousemove", t), document.removeEventListener("mouseup", u);
			};
			document.addEventListener("mousemove", t), document.addEventListener("mouseup", u);
		};
		return (t, n) => (W(), G("div", df, [
			n[0] ||= K("div", { class: "dd-picker-column-mask" }, null, -1),
			n[1] ||= K("div", { class: "dd-picker-column-indicator" }, null, -1),
			K("div", {
				class: "dd-picker-column-content",
				ref_key: "columnRef",
				ref: i,
				onTouchstart: u,
				onTouchmove: d,
				onTouchend: f,
				onMousedown: p
			}, [(W(!0), G(Uo, null, fa(e.options, (e, t) => (W(), G("div", {
				key: t,
				class: Vt(["dd-picker-column-item", { "dd-picker-column-item-selected": t === B(a) }])
			}, Xt(e), 3))), 128))], 544)
		]));
	}
}, [["__scopeId", "data-v-61501610"]]), mf = { class: "dd-picker-header" }, hf = { class: "dd-picker-title" }, gf = { class: "dd-picker-body" }, _f = {
	key: 1,
	class: "dd-picker-columns"
}, vf = {
	key: 2,
	class: "dd-picker-columns"
}, yf = {
	key: 3,
	class: "dd-picker-columns"
}, bf = {
	__name: "Picker",
	props: {
		headerText: { type: String },
		mode: {
			type: String,
			default: "selector",
			validator: (e) => [
				"selector",
				"multiSelector",
				"time",
				"date",
				"region"
			].includes(e)
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		range: {
			type: [Array, Object],
			default: () => []
		},
		rangeKey: { type: String },
		start: { type: String },
		end: { type: String },
		fields: {
			type: String,
			default: "day",
			validator: (e) => [
				"year",
				"month",
				"day"
			].includes(e)
		},
		value: {
			type: [
				Number,
				String,
				Array
			],
			default: (e) => {
				switch (e.mode) {
					case "selector": return 0;
					case "multiSelector": return [];
					case "time": {
						let e = /* @__PURE__ */ new Date();
						return `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
					}
					case "date": {
						let e = /* @__PURE__ */ new Date();
						return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
					}
				}
			}
		},
		customItem: {
			type: String,
			default: ""
		},
		level: {
			type: String,
			default: ""
		},
		name: { type: String },
		autoFill: { type: String }
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(!1), r = /* @__PURE__ */ z(t.value), i = /* @__PURE__ */ z(t.value), a = /* @__PURE__ */ z({});
		H(() => t.value, (e) => {
			r.value = e, i.value = e;
		}), H(() => t.mode, () => {
			if (t.mode === "multiSelector" && (!Array.isArray(i.value) || i.value.length === 0)) {
				i.value = t.range.map(() => 0);
				let e = {};
				i.value.forEach((t, n) => {
					e[n] = t;
				}), a.value = e;
			}
		}, { immediate: !0 });
		let o = () => {
			if (!t.disabled) {
				if (t.mode === "region") {
					Z("error", {
						info: c,
						detail: { errMsg: "picker:fail region mode is not supported by the current container" }
					});
					return;
				}
				if (n.value = !0, t.mode === "multiSelector") {
					!Array.isArray(r.value) || r.value.length === 0 ? i.value = t.range.map(() => 0) : i.value = [...r.value];
					let e = {};
					i.value.forEach((t, n) => {
						e[n] = t;
					}), a.value = e;
				} else i.value = r.value;
			}
		}, s = (e) => {
			n.value = !1, Z("cancel", {
				event: e,
				info: c,
				detail: {}
			});
		}, c = X(), l = (e) => {
			r.value = i.value, u?.(t.name, r.value), n.value = !1, Z("change", {
				event: e,
				info: c,
				detail: { value: i.value }
			});
		}, u = V("collectFormValue", void 0), d = V("registerFormControl", void 0);
		H(r, (e) => u?.(t.name, e), {
			deep: !0,
			immediate: !0
		});
		let f = d?.({
			getName: () => t.name,
			getValue: () => r.value,
			reset: () => {
				r.value = t.mode === "selector" ? -1 : "", i.value = r.value, u?.(t.name, r.value);
			}
		});
		Qi(() => f?.());
		let p = () => {
			s();
		}, m = (e) => {
			e.stopPropagation();
		}, h = J(() => {
			switch (t.mode) {
				case "selector": return g(t.range);
				case "multiSelector": return t.range.map((e) => g(e));
				case "time": return _();
				case "date": return v();
				default: return [];
			}
		}), g = (e) => !Array.isArray(e) && typeof e == "object" && e ? Object.values(e) : Array.isArray(e) ? e.length > 0 && typeof e[0] == "object" ? t.rangeKey ? e.map((e) => e[t.rangeKey] || "") : e.map((e) => e.name || e.label || e.text || e.value || String(e)) : e : [], _ = () => {
			let e = [], t = [];
			for (let t = 0; t < 24; t++) e.push(String(t).padStart(2, "0"));
			for (let e = 0; e < 60; e++) t.push(String(e).padStart(2, "0"));
			return [e, t];
		}, v = () => {
			let e = [], n = [], r = [], i = (/* @__PURE__ */ new Date()).getFullYear(), a = t.start ? Number.parseInt(t.start.split("-")[0]) : i - 10, o = t.end ? Number.parseInt(t.end.split("-")[0]) : i + 10;
			for (let t = a; t <= o; t++) e.push(String(t));
			for (let e = 1; e <= 12; e++) n.push(String(e).padStart(2, "0"));
			for (let e = 1; e <= 31; e++) r.push(String(e).padStart(2, "0"));
			switch (t.fields) {
				case "year": return [e];
				case "month": return [e, n];
				default: return [
					e,
					n,
					r
				];
			}
		}, y = (e, n, r) => {
			if (t.mode === "multiSelector" && a.value[n] !== r) {
				a.value[n] = r;
				let o = [];
				for (let e = 0; e < t.range.length; e++) o[e] = a.value[e] || 0;
				i.value = o, Z("columnchange", {
					event: e,
					info: c,
					detail: {
						column: n,
						value: r
					}
				});
			}
		}, b = (e, n) => {
			t.mode === "selector" && (i.value = n);
		}, x = (e) => {
			if (typeof i.value == "string" && i.value.includes(":")) {
				let t = i.value.split(":");
				if (e === 0) return Number.parseInt(t[0]) || 0;
				if (e === 1) return Number.parseInt(t[1]) || 0;
			}
			return 0;
		}, S = (e, t, n) => {
			let r = i.value.split(":");
			t === 0 ? r[0] = h.value[0][n] : t === 1 && (r[1] = h.value[1][n]), i.value = r.join(":");
		}, C = (e) => {
			if (typeof i.value == "string") {
				let t = i.value.split("-");
				if (e === 0 && t[0]) return h.value[0].indexOf(t[0]);
				if (e === 1 && t[1]) return h.value[1].indexOf(t[1]);
				if (e === 2 && t[2]) return h.value[2].indexOf(t[2]);
			}
			return 0;
		}, w = (e, n, r) => {
			let a = i.value.split("-");
			n === 0 ? a[0] = h.value[0][r] : n === 1 ? a[1] = h.value[1][r] : n === 2 && (a[2] = h.value[2][r]), t.fields === "year" ? i.value = a[0] : t.fields === "month" ? i.value = `${a[0]}-${a[1]}` : i.value = a.join("-");
		}, T = /* @__PURE__ */ z(null);
		function E({ event: e }) {
			t.disabled || (Z("tap", {
				event: e,
				info: c
			}), o());
		}
		return nu(c, T, { tapHandler: E }), (t, r) => (W(), G(Uo, null, [K("div", q({
			ref_key: "rootRef",
			ref: T
		}, t.$attrs, { class: "dd-picker" }), [U(t.$slots, "default")], 16), B(n) ? (W(), G("div", {
			key: 0,
			class: "dd-picker-overlay",
			onClick: p
		}, [K("div", {
			class: "dd-picker-container",
			onClick: m
		}, [K("div", mf, [
			K("div", {
				class: "dd-picker-action dd-picker-cancel",
				onClick: s
			}, "取消"),
			K("div", hf, Xt(e.headerText || ""), 1),
			K("div", {
				class: "dd-picker-action dd-picker-confirm",
				onClick: l
			}, "确定")
		]), K("div", gf, [e.mode === "selector" ? (W(), $o(pf, {
			key: 0,
			options: B(h),
			value: B(i),
			onChange: b
		}, null, 8, ["options", "value"])) : e.mode === "multiSelector" ? (W(), G("div", _f, [(W(!0), G(Uo, null, fa(B(h), (e, t) => (W(), $o(pf, {
			key: `column-${t}`,
			options: e,
			value: B(a)[t] ?? 0,
			onChange: (e, n) => y(e, t, n)
		}, null, 8, [
			"options",
			"value",
			"onChange"
		]))), 128))])) : e.mode === "time" ? (W(), G("div", vf, [(W(!0), G(Uo, null, fa(B(h), (e, t) => (W(), $o(pf, {
			key: t,
			options: e,
			value: x(t),
			onChange: (e, n) => S(e, t, n)
		}, null, 8, [
			"options",
			"value",
			"onChange"
		]))), 128))])) : e.mode === "date" ? (W(), G("div", yf, [(W(!0), G(Uo, null, fa(B(h), (e, t) => (W(), $o(pf, {
			key: t,
			options: e,
			value: C(t),
			onChange: (e, n) => w(e, t, n)
		}, null, 8, [
			"options",
			"value",
			"onChange"
		]))), 128))])) : ls("", !0)])])])) : ls("", !0)], 64));
	}
}, xf = /* @__PURE__ */ Y({ default: () => Sf }), Sf = Q(bf), Cf = {
	__name: "PickerView",
	props: {
		value: { type: Array },
		maskClass: { type: String },
		indicatorStyle: { type: String },
		indicatorClass: { type: String },
		maskStyle: { type: String },
		immediateChange: {
			type: Boolean,
			default: !1
		},
		name: { type: String },
		autoFill: { type: String }
	},
	setup(e) {
		let t = e, n = -1, r = /* @__PURE__ */ z(null), i = /* @__PURE__ */ z(0), a = /* @__PURE__ */ z(0), o = /* @__PURE__ */ z([...t.value || []]), s;
		function c() {
			i.value = r.value?.offsetHeight || 0, a.value++;
		}
		li("getPickerHeight", () => i.value), li("pickerHeight", i), li("pickerLayoutVersion", a), li("pickerItemStyle", J(() => ({
			indicatorStyle: t.indicatorStyle,
			indicatorClass: t.indicatorClass,
			maskStyle: t.maskStyle,
			maskClass: t.maskClass
		}))), li("itemValue", o), li("pickerImmediateChange", J(() => t.immediateChange)), li("getItemIndex", () => ++n), li("setPickerValue", (e, t) => {
			o.value[e] = t;
		}), H(() => t.value, (e = []) => {
			o.value = [...e];
		}, { deep: !0 });
		let l = X();
		li("pickerEvent", (e, t) => {
			let n = e === "change" ? { value: [...o.value] } : {};
			Z(e, {
				event: t,
				info: l,
				currentTarget: r.value,
				detail: n
			});
		});
		let u = V("collectFormValue", void 0), d = V("registerFormControl", void 0);
		H(o, (e) => u?.(t.name, [...e]), {
			deep: !0,
			immediate: !0
		});
		let f = d?.({
			getName: () => t.name,
			getValue: () => [...o.value],
			reset: () => {
				o.value = [...t.value || []];
			}
		});
		return Yi(() => {
			c(), document.addEventListener("pageReRender", c), window.ResizeObserver && r.value && (s = new ResizeObserver(c), s.observe(r.value));
		}), Qi(() => {
			s?.disconnect(), document.removeEventListener("pageReRender", c), f?.();
		}), (e, t) => (W(), G("div", q({
			ref_key: "pickerView",
			ref: r
		}, e.$attrs, { class: "dd-picker-view" }), [U(e.$slots, "default")], 16));
	}
}, wf = /* @__PURE__ */ Y({ default: () => Tf }), Tf = Q(Cf), Ef = {
	"aria-label": "上下滚动进行选择",
	"aria-dropeffect": "move"
}, Df = {
	__name: "PickerViewColumn",
	setup(e) {
		let t = /* @__PURE__ */ z(null), n = /* @__PURE__ */ z(null), r = /* @__PURE__ */ z(null), i = /* @__PURE__ */ z(0), a = /* @__PURE__ */ z("0.2s"), o = V("pickerItemStyle", J(() => ({}))), s = V("pickerEvent", void 0), c = V("pickerImmediateChange", J(() => !1)), l = V("getPickerHeight", () => 0), u = V("pickerLayoutVersion", /* @__PURE__ */ z(0)), d = V("getItemIndex", () => 0)(), f = V("setPickerValue", void 0), p = V("itemValue", /* @__PURE__ */ z(Array.from({ length: d }).fill(0))), m = J(() => o.value.indicatorClass), h = J(() => o.value.maskClass), g = /* @__PURE__ */ z("34px"), _ = !1, v = 0, y = 0, b = 0, x = !1, S = 0, C = -1;
		function w(e) {
			let t = Math.max(Number(e) || 0, 0);
			return C < 0 ? t : Math.min(t, C);
		}
		let T = /* @__PURE__ */ z(w(p.value[d])), E = 0, ee;
		function D(e) {
			re(), s?.("pickstart", e), _ = !0, a.value = "0s", v = e.touches ? e.touches[0].clientY : e.clientY, E = t.value.offsetHeight, b = T.value, x = !1, S = 0, y = -T.value * E;
		}
		function te(e) {
			_ && (S = (e.touches ? e.touches[0].clientY : e.clientY) - v, y = S - T.value * E, i.value = y);
		}
		function ne(e) {
			let t = e.target;
			for (; t && t.parentElement !== r.value;) t = t.parentElement;
			return !t || t.parentElement !== r.value ? -1 : Array.from(r.value.children).indexOf(t);
		}
		function O(e) {
			if (!_) return;
			_ = !1, a.value = "0.2s", C = Math.max((r.value?.children.length || 1) - 1, 0);
			let t = Math.abs(S) < 3 ? ne(e) : -1;
			t >= 0 ? (T.value = t, i.value = -T.value * E) : y < 0 ? (T.value = Math.min(C, Math.abs(Math.round(y / E))), i.value = -T.value * E) : (T.value = 0, i.value = 0), f?.(d, T.value), x = T.value !== b, c.value && x && s?.("change", e), ee = e, (a.value === "0s" || y === -T.value * E) && re();
		}
		function re() {
			if (!ee) return;
			let e = ee;
			ee = void 0, !c.value && x && s?.("change", e), x = !1, s?.("pickend", e);
		}
		H(() => p.value[d], (e) => {
			let t = w(e);
			T.value = t, i.value = -t * E;
		});
		function k() {
			if (!t.value || !n.value || !r.value || !E) return;
			let e = l();
			if (e <= 0) return;
			let i = (e - E) / 2;
			t.value.style.cssText = o.value.indicatorStyle || "", t.value.style.height = `${E}px`, t.value.style.top = `${i}px`, n.value.style.cssText = o.value.maskStyle || "", n.value.style.backgroundSize = `100% ${i}px`, Array.from(r.value.children).forEach((e) => {
				e.style.height = `${E}px`;
			}), r.value.style.paddingTop = `${i}px`;
		}
		function A() {
			if (!t.value || !r.value) return;
			let e = t.value.offsetHeight;
			e > 0 && (E = e), C = Math.max(r.value.children.length - 1, 0), T.value = w(p.value[d]), f?.(d, T.value), k(), i.value = -T.value * E;
		}
		return H(o, () => k(), { deep: !0 }), H(u, () => A()), Yi(async () => {
			await Jr(), t.value.style.cssText = o.value.indicatorStyle || "";
			let e = r.value.firstElementChild;
			if (e) {
				let n = window.getComputedStyle(e), r = Number.parseFloat(n.lineHeight), i = Number.parseFloat(n.fontSize) || 16;
				g.value = `${Number.isFinite(r) ? r : i * 1.2}px`, t.value.style.height = g.value;
			}
			E = t.value.offsetHeight || Number.parseFloat(g.value) || 34, A(), a.value = "0s";
		}), (e, o) => (W(), G("div", q(e.$attrs, { class: "dd-picker-view-column" }), [K("div", Ef, [
			K("div", {
				ref_key: "maskRef",
				ref: n,
				class: Vt(["dd-picker__mask", B(h)])
			}, null, 2),
			K("div", {
				ref_key: "indicatorRef",
				ref: t,
				class: Vt(["dd-picker__indicator", B(m)])
			}, null, 2),
			K("div", {
				ref_key: "contentRef",
				ref: r,
				class: "dd-picker__content",
				style: It({
					"--duration": B(a),
					transform: `translateY(${B(i)}px)`
				}),
				onTransitionend: Oc(re, ["self"]),
				onTouchstart: D,
				onTouchmove: Oc(te, ["prevent"]),
				onTouchend: Oc(O, ["prevent"]),
				onTouchcancel: O,
				onMousedown: D,
				onMousemove: Oc(te, ["prevent"]),
				onMouseup: O,
				onMouseleave: O
			}, [U(e.$slots, "default")], 36)
		])], 16));
	}
}, Of = /* @__PURE__ */ Y({ default: () => kf }), kf = Q(Df), Af = ["aria-valuenow"], jf = ["aria-valuenow"], Mf = ["hidden"], Nf = {
	__name: "Progress",
	props: {
		percent: {
			type: [Number, String],
			required: !1
		},
		showInfo: {
			type: Boolean,
			default: !1,
			required: !1
		},
		borderRadius: {
			type: [Number, String],
			default: 0,
			required: !1
		},
		fontSize: {
			type: [Number, String],
			default: 16,
			required: !1
		},
		strokeWidth: {
			type: [Number, String],
			default: 6,
			required: !1
		},
		color: {
			type: String,
			default: "#09BB07",
			required: !1
		},
		activeColor: {
			type: String,
			default: "#09BB07",
			required: !1
		},
		backgroundColor: {
			type: String,
			default: "#EBEBEB",
			required: !1
		},
		active: {
			type: Boolean,
			default: !1,
			required: !1
		},
		activeMode: {
			type: String,
			default: "backwards",
			required: !1
		},
		duration: {
			type: Number,
			default: 30,
			required: !1
		}
	},
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(0), i, a = 0;
		function o(e) {
			let t = Number(e);
			return Number.isFinite(t) ? Math.min(Math.max(t, 0), 100) : 0;
		}
		function s() {
			i !== void 0 && (clearInterval(i), i = void 0);
		}
		function c() {
			s();
			let e = o(t.percent);
			if (!t.active) {
				r.value = e, a = e;
				return;
			}
			r.value = t.activeMode === "forwards" ? a : 0;
			let c = () => {
				if (e <= r.value + 1) {
					r.value = e, a = e, s(), Z("activeend", {
						info: n,
						detail: { curPercent: r.value }
					});
					return;
				}
				r.value += 1;
			};
			c(), r.value < e && (i = setInterval(c, Math.max(Number(t.duration) || 0, 0)));
		}
		H([
			() => t.percent,
			() => t.active,
			() => t.activeMode,
			() => t.duration
		], c, { immediate: !0 }), Qi(s);
		let l = J(() => {
			let e = n.attrs || {};
			return "activeColor" in e || "active-color" in e ? t.activeColor : "color" in e ? t.color : t.activeColor;
		});
		return (t, n) => (W(), G("div", q(t.$attrs, {
			class: "dd-progress",
			role: "progressbar",
			"aria-valuenow": B(r),
			"aria-valuemin": "0",
			"aria-valuemax": "100"
		}), [K("div", {
			class: "dd-progress-bar",
			"aria-label": "",
			"aria-valuenow": `${e.percent}%`,
			style: It({
				borderRadius: `${e.borderRadius}px`,
				backgroundColor: e.backgroundColor,
				height: `${e.strokeWidth}px`
			})
		}, [K("div", {
			class: "dd-progress-inner-bar",
			style: It({
				width: `${B(r)}%`,
				backgroundColor: B(l)
			})
		}, null, 4)], 12, jf), K("p", {
			class: "dd-progress-info",
			style: It({ fontSize: e.fontSize }),
			hidden: !e.showInfo
		}, Xt(B(r)) + "% ", 13, Mf)], 16, Af));
	}
}, Pf = /* @__PURE__ */ Y({ default: () => Ff }), Ff = Q(Nf), If = [
	"id",
	"tabindex",
	"aria-checked",
	"aria-disabled",
	"onKeydown"
], Lf = { class: "dd-radio-wrapper" }, Rf = {
	__name: "Radio",
	props: {
		id: { type: String },
		value: {
			type: String,
			default: ""
		},
		checked: {
			type: Boolean,
			default: !1
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		color: {
			type: String,
			default: "#09BB07"
		}
	},
	setup(e) {
		let t = e, n = V("radioGroup", void 0), r = /* @__PURE__ */ z(!!t.checked);
		H(() => t.checked, (e) => {
			r.value = e;
		});
		let i = {
			getValue: () => t.value,
			isChecked: () => r.value,
			setChecked: (e) => {
				r.value = e;
			},
			reset: () => {
				r.value = !1;
			}
		}, a = n?.registerRadio(i);
		Qi(() => a?.());
		let o = J(() => {
			if (t.color && r.value) return {
				backgroundColor: t.color,
				borderColor: t.color
			};
		}), s = X(), c = /* @__PURE__ */ z(null);
		function l(e) {
			t.disabled || (n ? n.selectRadio(i, e) : r.value = !0);
		}
		function u({ event: e }) {
			t.disabled || (l(e), Z("tap", {
				event: e,
				info: s,
				detail: {}
			}));
		}
		function d() {
			c.value?.click();
		}
		return nu(s, c, { tapHandler: u }), $l(c, l), (t, n) => (W(), G("div", q({
			id: e.id,
			ref_key: "rootRef",
			ref: c
		}, t.$attrs, {
			class: "dd-radio",
			"data-dd-label-target": "",
			role: "radio",
			tabindex: e.disabled ? -1 : 0,
			"aria-checked": B(r),
			"aria-disabled": e.disabled,
			onKeydown: [Ac(Oc(d, ["prevent"]), ["enter"]), Ac(Oc(d, ["prevent"]), ["space"])]
		}), [K("div", Lf, [K("div", {
			class: Vt(["dd-radio-input", {
				"dd-radio-input-checked": B(r),
				"dd-radio-input-disabled": e.disabled
			}]),
			style: It(B(o))
		}, null, 6), U(t.$slots, "default")])], 16, If));
	}
}, zf = /* @__PURE__ */ Y({ default: () => Bf }), Bf = Q(Rf), Vf = ["id"], Hf = {
	__name: "RadioGroup",
	props: {
		id: { type: String },
		name: { type: String },
		autoFill: { type: String }
	},
	setup(e) {
		let t = e, n = V("collectFormValue", void 0), r = V("registerFormControl", void 0), i = /* @__PURE__ */ new Set();
		function a() {
			return [...i].find((e) => e.isChecked());
		}
		function o() {
			return a()?.getValue() ?? "";
		}
		function s(e) {
			if (i.add(e), e.isChecked()) for (let t of i) t !== e && t.setChecked(!1);
			return n?.(t.name, o()), () => i.delete(e);
		}
		let c = X(), l = /* @__PURE__ */ z(null);
		function u(e, r) {
			if (e.isChecked()) return;
			for (let t of i) t.setChecked(t === e);
			let a = o();
			n?.(t.name, a), Z("change", {
				event: r,
				info: c,
				currentTarget: l.value,
				detail: { value: a }
			});
		}
		function d() {
			for (let e of i) e.reset();
			[...i].filter((e) => e.isChecked()).slice(1).forEach((e) => e.setChecked(!1)), n?.(t.name, o());
		}
		let f = r?.({
			getName: () => t.name,
			getValue: o,
			reset: d
		});
		return Qi(() => f?.()), li("radioGroup", {
			registerRadio: s,
			selectRadio: u
		}), (t, n) => (W(), G("div", q({
			id: e.id,
			ref_key: "rootRef",
			ref: l
		}, t.$attrs, { class: "dd-radio-group" }), [U(t.$slots, "default")], 16, Vf));
	}
}, Uf = /* @__PURE__ */ Y({ default: () => Wf }), Wf = Q(Hf);
function Gf(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Kf(e) {
	if (Array.isArray(e)) return e;
}
function qf(e, t) {
	var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n != null) {
		var r, i, a, o, s = [], c = !0, l = !1;
		try {
			if (a = (n = n.call(e)).next, t !== 0) for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
		} catch (e) {
			l = !0, i = e;
		} finally {
			try {
				if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
			} finally {
				if (l) throw i;
			}
		}
		return s;
	}
}
function Jf() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Yf(e, t) {
	return Kf(e) || qf(e, t) || Xf(e, t) || Jf();
}
function Xf(e, t) {
	if (e) {
		if (typeof e == "string") return Gf(e, t);
		var n = {}.toString.call(e).slice(8, -1);
		return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? Gf(e, t) : void 0;
	}
}
var Zf = Object.entries, Qf = Object.setPrototypeOf, $f = Object.isFrozen, ep = Object.getPrototypeOf, tp = Object.getOwnPropertyDescriptor, np = Object.freeze, rp = Object.seal, ip = Object.create, ap = typeof Reflect < "u" && Reflect, op = ap.apply, sp = ap.construct;
np ||= function(e) {
	return e;
}, rp ||= function(e) {
	return e;
}, op ||= function(e, t) {
	var n = [...arguments].slice(2);
	return e.apply(t, n);
}, sp ||= function(e) {
	return new e(...[...arguments].slice(1));
};
var cp = Op(Array.prototype.forEach), lp = Op(Array.prototype.lastIndexOf), up = Op(Array.prototype.pop), dp = Op(Array.prototype.push), fp = Op(Array.prototype.splice), pp = Array.isArray, mp = Op(String.prototype.toLowerCase), hp = Op(String.prototype.toString), gp = Op(String.prototype.match), _p = Op(String.prototype.replace), vp = Op(String.prototype.indexOf), yp = Op(String.prototype.trim), bp = Op(Number.prototype.toString), xp = Op(Boolean.prototype.toString), Sp = typeof BigInt > "u" ? null : Op(BigInt.prototype.toString), Cp = typeof Symbol > "u" ? null : Op(Symbol.prototype.toString), wp = Op(Object.prototype.hasOwnProperty), Tp = Op(Object.prototype.toString), Ep = Op(RegExp.prototype.test), Dp = kp(TypeError);
function Op(e) {
	return function(t) {
		t instanceof RegExp && (t.lastIndex = 0);
		var n = [...arguments].slice(1);
		return op(e, t, n);
	};
}
function kp(e) {
	return function() {
		return sp(e, [...arguments]);
	};
}
function $(e, t) {
	let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : mp;
	if (Qf && Qf(e, null), !pp(t)) return e;
	let r = t.length;
	for (; r--;) {
		let i = t[r];
		if (typeof i == "string") {
			let e = n(i);
			e !== i && ($f(t) || (t[r] = e), i = e);
		}
		e[i] = !0;
	}
	return e;
}
function Ap(e) {
	for (let t = 0; t < e.length; t++) wp(e, t) || (e[t] = null);
	return e;
}
function jp(e) {
	let t = ip(null);
	for (let r of Zf(e)) {
		var n = Yf(r, 2);
		let i = n[0], a = n[1];
		wp(e, i) && (t[i] = pp(a) ? Ap(a) : a && typeof a == "object" && a.constructor === Object ? jp(a) : a);
	}
	return t;
}
function Mp(e) {
	switch (typeof e) {
		case "string": return e;
		case "number": return bp(e);
		case "boolean": return xp(e);
		case "bigint": return Sp ? Sp(e) : "0";
		case "symbol": return Cp ? Cp(e) : "Symbol()";
		case "undefined": return Tp(e);
		case "function":
		case "object": {
			if (e === null) return Tp(e);
			let t = e, n = Np(t, "toString");
			if (typeof n == "function") {
				let e = n(t);
				return typeof e == "string" ? e : Tp(e);
			}
			return Tp(e);
		}
		default: return Tp(e);
	}
}
function Np(e, t) {
	for (; e !== null;) {
		let n = tp(e, t);
		if (n) {
			if (n.get) return Op(n.get);
			if (typeof n.value == "function") return Op(n.value);
		}
		e = ep(e);
	}
	function n() {
		return null;
	}
	return n;
}
function Pp(e) {
	try {
		return Ep(e, ""), !0;
	} catch {
		return !1;
	}
}
var Fp = np(/* @__PURE__ */ "a.abbr.acronym.address.area.article.aside.audio.b.bdi.bdo.big.blink.blockquote.body.br.button.canvas.caption.center.cite.code.col.colgroup.content.data.datalist.dd.decorator.del.details.dfn.dialog.dir.div.dl.dt.element.em.fieldset.figcaption.figure.font.footer.form.h1.h2.h3.h4.h5.h6.head.header.hgroup.hr.html.i.img.input.ins.kbd.label.legend.li.main.map.mark.marquee.menu.menuitem.meter.nav.nobr.ol.optgroup.option.output.p.picture.pre.progress.q.rp.rt.ruby.s.samp.search.section.select.shadow.slot.small.source.spacer.span.strike.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.tr.track.tt.u.ul.var.video.wbr".split(".")), Ip = np(/* @__PURE__ */ "svg.a.altglyph.altglyphdef.altglyphitem.animatecolor.animatemotion.animatetransform.circle.clippath.defs.desc.ellipse.enterkeyhint.exportparts.filter.font.g.glyph.glyphref.hkern.image.inputmode.line.lineargradient.marker.mask.metadata.mpath.part.path.pattern.polygon.polyline.radialgradient.rect.stop.style.switch.symbol.text.textpath.title.tref.tspan.view.vkern".split(".")), Lp = np([
	"feBlend",
	"feColorMatrix",
	"feComponentTransfer",
	"feComposite",
	"feConvolveMatrix",
	"feDiffuseLighting",
	"feDisplacementMap",
	"feDistantLight",
	"feDropShadow",
	"feFlood",
	"feFuncA",
	"feFuncB",
	"feFuncG",
	"feFuncR",
	"feGaussianBlur",
	"feImage",
	"feMerge",
	"feMergeNode",
	"feMorphology",
	"feOffset",
	"fePointLight",
	"feSpecularLighting",
	"feSpotLight",
	"feTile",
	"feTurbulence"
]), Rp = np([
	"animate",
	"color-profile",
	"cursor",
	"discard",
	"font-face",
	"font-face-format",
	"font-face-name",
	"font-face-src",
	"font-face-uri",
	"foreignobject",
	"hatch",
	"hatchpath",
	"mesh",
	"meshgradient",
	"meshpatch",
	"meshrow",
	"missing-glyph",
	"script",
	"set",
	"solidcolor",
	"unknown",
	"use"
]), zp = np(/* @__PURE__ */ "math.menclose.merror.mfenced.mfrac.mglyph.mi.mlabeledtr.mmultiscripts.mn.mo.mover.mpadded.mphantom.mroot.mrow.ms.mspace.msqrt.mstyle.msub.msup.msubsup.mtable.mtd.mtext.mtr.munder.munderover.mprescripts".split(".")), Bp = np([
	"maction",
	"maligngroup",
	"malignmark",
	"mlongdiv",
	"mscarries",
	"mscarry",
	"msgroup",
	"mstack",
	"msline",
	"msrow",
	"semantics",
	"annotation",
	"annotation-xml",
	"mprescripts",
	"none"
]), Vp = np(["#text"]), Hp = np(/* @__PURE__ */ "accept.action.align.alt.autocapitalize.autocomplete.autopictureinpicture.autoplay.background.bgcolor.border.capture.cellpadding.cellspacing.checked.cite.class.clear.color.cols.colspan.command.commandfor.controls.controlslist.coords.crossorigin.datetime.decoding.default.dir.disabled.disablepictureinpicture.disableremoteplayback.download.draggable.enctype.enterkeyhint.exportparts.face.for.headers.height.hidden.high.href.hreflang.id.inert.inputmode.integrity.ismap.kind.label.lang.list.loading.loop.low.max.maxlength.media.method.min.minlength.multiple.muted.name.nonce.noshade.novalidate.nowrap.open.optimum.part.pattern.placeholder.playsinline.popover.popovertarget.popovertargetaction.poster.preload.pubdate.radiogroup.readonly.rel.required.rev.reversed.role.rows.rowspan.spellcheck.scope.selected.shape.size.sizes.slot.span.srclang.start.src.srcset.step.style.summary.tabindex.title.translate.type.usemap.valign.value.width.wrap.xmlns".split(".")), Up = np(/* @__PURE__ */ "accent-height.accumulate.additive.alignment-baseline.amplitude.ascent.attributename.attributetype.azimuth.basefrequency.baseline-shift.begin.bias.by.class.clip.clippathunits.clip-path.clip-rule.color.color-interpolation.color-interpolation-filters.color-profile.color-rendering.cx.cy.d.dx.dy.diffuseconstant.direction.display.divisor.dominant-baseline.dur.edgemode.elevation.end.exponent.fill.fill-opacity.fill-rule.filter.filterunits.flood-color.flood-opacity.font-family.font-size.font-size-adjust.font-stretch.font-style.font-variant.font-weight.fx.fy.g1.g2.glyph-name.glyphref.gradientunits.gradienttransform.height.href.id.image-rendering.in.in2.intercept.k.k1.k2.k3.k4.kerning.keypoints.keysplines.keytimes.lang.lengthadjust.letter-spacing.kernelmatrix.kernelunitlength.lighting-color.local.marker-end.marker-mid.marker-start.markerheight.markerunits.markerwidth.maskcontentunits.maskunits.max.mask.mask-type.media.method.mode.min.name.numoctaves.offset.operator.opacity.order.orient.orientation.origin.overflow.paint-order.path.pathlength.patterncontentunits.patterntransform.patternunits.pointer-events.points.preservealpha.preserveaspectratio.primitiveunits.r.rx.ry.radius.refx.refy.repeatcount.repeatdur.restart.result.rotate.scale.seed.shape-rendering.slope.specularconstant.specularexponent.spreadmethod.startoffset.stddeviation.stitchtiles.stop-color.stop-opacity.stroke-dasharray.stroke-dashoffset.stroke-linecap.stroke-linejoin.stroke-miterlimit.stroke-opacity.stroke.stroke-width.style.surfacescale.systemlanguage.tabindex.tablevalues.targetx.targety.transform.transform-origin.text-anchor.text-decoration.text-orientation.text-rendering.textlength.type.u1.u2.unicode.values.vector-effect.viewbox.visibility.version.vert-adv-y.vert-origin-x.vert-origin-y.width.word-spacing.wrap.writing-mode.xchannelselector.ychannelselector.x.x1.x2.xmlns.y.y1.y2.z.zoomandpan".split(".")), Wp = np(/* @__PURE__ */ "accent.accentunder.align.bevelled.close.columnalign.columnlines.columnspacing.columnspan.denomalign.depth.dir.display.displaystyle.encoding.fence.frame.height.href.id.largeop.length.linethickness.lquote.lspace.mathbackground.mathcolor.mathsize.mathvariant.maxsize.minsize.movablelimits.notation.numalign.open.rowalign.rowlines.rowspacing.rowspan.rspace.rquote.scriptlevel.scriptminsize.scriptsizemultiplier.selection.separator.separators.stretchy.subscriptshift.supscriptshift.symmetric.voffset.width.xmlns".split(".")), Gp = np([
	"xlink:href",
	"xml:id",
	"xlink:title",
	"xml:space",
	"xmlns:xlink"
]), Kp = rp(/{{[\w\W]*|^[\w\W]*}}/g), qp = rp(/<%[\w\W]*|^[\w\W]*%>/g), Jp = rp(/\${[\w\W]*/g), Yp = rp(/^data-[\-\w.\u00B7-\uFFFF]+$/), Xp = rp(/^aria-[\-\w]+$/), Zp = rp(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i), Qp = rp(/^(?:\w+script|data):/i), $p = rp(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g), em = rp(/^html$/i), tm = rp(/^[a-z][.\w]*(-[.\w]+)+$/i), nm = rp(/<[/\w!]/g), rm = rp(/<[/\w]/g), im = rp(/<\/no(script|embed|frames)/i), am = rp(/\/>/i), om = {
	element: 1,
	attribute: 2,
	text: 3,
	cdataSection: 4,
	entityReference: 5,
	entityNode: 6,
	processingInstruction: 7,
	comment: 8,
	document: 9,
	documentType: 10,
	documentFragment: 11,
	notation: 12
}, sm = [
	"style",
	"script",
	"xmp",
	"iframe",
	"noembed",
	"noframes",
	"plaintext",
	"noscript"
], cm = np($({}, sm)), lm = function() {
	let e = {};
	return cp(sm, (t) => {
		e[t] = rp(RegExp("</" + t + "(?=[\\t\\n\\f\\r />])", "i"));
	}), np(e);
}(), um = function() {
	return typeof window > "u" ? null : window;
}, dm = function(e, t) {
	if (typeof e != "object" || typeof e.createPolicy != "function") return null;
	let n = null, r = "data-tt-policy-suffix";
	t && t.hasAttribute(r) && (n = t.getAttribute(r));
	let i = "dompurify" + (n ? "#" + n : "");
	try {
		return e.createPolicy(i, {
			createHTML(e) {
				return e;
			},
			createScriptURL(e) {
				return e;
			}
		});
	} catch {
		return console.warn("TrustedTypes policy " + i + " could not be created."), null;
	}
}, fm = function() {
	return {
		afterSanitizeAttributes: [],
		afterSanitizeElements: [],
		afterSanitizeShadowDOM: [],
		beforeSanitizeAttributes: [],
		beforeSanitizeElements: [],
		beforeSanitizeShadowDOM: [],
		uponSanitizeAttribute: [],
		uponSanitizeElement: [],
		uponSanitizeShadowNode: []
	};
}, pm = function(e, t, n, r) {
	return wp(e, t) && pp(e[t]) ? $(r.base ? jp(r.base) : {}, e[t], r.transform) : n;
}, mm = function(e, t, n) {
	let r = wp(e, t) ? e[t] : void 0;
	return r && typeof r == "object" ? jp(r) : n();
};
function hm() {
	let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : um(), t = (e) => hm(e);
	if (t.version = "3.4.15", t.removed = [], !e || !e.document || e.document.nodeType !== om.document || !e.Element) return t.isSupported = !1, t;
	let n = e.document, r = n, i = r.currentScript;
	e.DocumentFragment;
	let a = e.HTMLTemplateElement, o = e.Node, s = e.Element, c = e.NodeFilter;
	e.NamedNodeMap === void 0 && (e.NamedNodeMap || e.MozNamedAttrMap), e.HTMLFormElement;
	let l = e.DOMParser, u = e.trustedTypes, d = s.prototype, f = Np(d, "cloneNode"), p = Np(d, "remove"), m = Np(d, "removeAttributeNode"), h = Np(d, "nextSibling"), g = Np(d, "childNodes"), _ = Np(d, "parentNode"), v = Np(d, "shadowRoot"), y = Np(d, "attributes"), b = o && o.prototype ? Np(o.prototype, "nodeType") : null, x = o && o.prototype ? Np(o.prototype, "nodeName") : null, S = o && o.prototype ? Np(o.prototype, "ownerDocument") : null, C = function(e) {
		return b ? b(e) : e.nodeType;
	}, w = function(e) {
		return x ? x(e) : e.nodeName;
	};
	if (typeof a == "function") {
		let e = n.createElement("template");
		e.content && e.content.ownerDocument && (n = e.content.ownerDocument);
	}
	let T, E = "", ee, D = !1, te = 0, ne = function() {
		if (te > 0) throw Dp("A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the \"DOMPurify and Trusted Types\" section of the README.");
	}, O = function(e) {
		ne(), te++;
		try {
			return T.createHTML(e);
		} finally {
			te--;
		}
	}, re = function(e) {
		ne(), te++;
		try {
			return T.createScriptURL(e);
		} finally {
			te--;
		}
	}, k = function() {
		return D ||= (ee = dm(u, i), !0), ee;
	}, A = n, ie = A.implementation, ae = A.createNodeIterator, oe = A.createDocumentFragment, se = A.getElementsByTagName, ce = r.importNode, j = fm();
	t.isSupported = typeof Zf == "function" && typeof _ == "function" && ie && ie.createHTMLDocument !== void 0;
	let le = Kp, ue = qp, de = Jp, fe = Yp, pe = Xp, me = Qp, he = $p, ge = tm, _e = Zp, M = null, ve = $({}, [
		...Fp,
		...Ip,
		...Lp,
		...zp,
		...Vp
	]), ye = null, be = $({}, [
		...Hp,
		...Up,
		...Wp,
		...Gp
	]), xe = Object.seal(ip(null, {
		tagNameCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		attributeNameCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		allowCustomizedBuiltInElements: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: !1
		}
	})), Se = null, Ce = null, we = Object.seal(ip(null, {
		tagCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		attributeCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		}
	})), Te = !0, Ee = !0, De = !1, Oe = !0, ke = !1, Ae = !0, je = !1, Me = !1, Ne = null, Pe = null, Fe = !1, N = !1, Ie = !1, Le = !1, Re = !0, ze = !1, Be = "user-content-", Ve = !0, He = !1, Ue = {}, We = null, Ge = $({}, /* @__PURE__ */ "annotation-xml.audio.colgroup.desc.foreignobject.head.iframe.math.mi.mn.mo.ms.mtext.noembed.noframes.noscript.plaintext.script.selectedcontent.style.svg.template.thead.title.video.xmp".split(".")), Ke = null, qe = $({}, [
		"audio",
		"video",
		"img",
		"source",
		"image",
		"track"
	]), Je = null, Ye = $({}, [
		"alt",
		"class",
		"for",
		"id",
		"label",
		"name",
		"pattern",
		"placeholder",
		"role",
		"summary",
		"title",
		"value",
		"style",
		"xmlns"
	]), Xe = "http://www.w3.org/1998/Math/MathML", Ze = "http://www.w3.org/2000/svg", Qe = "http://www.w3.org/1999/xhtml", $e = Qe, et = !1, P = null, tt = $({}, [
		Xe,
		Ze,
		Qe
	], hp), nt = np([
		"mi",
		"mo",
		"mn",
		"ms",
		"mtext"
	]), rt = $({}, nt), it = np(["annotation-xml"]), at = $({}, it), ot = $({}, [
		"title",
		"style",
		"font",
		"a",
		"script"
	]), st = null, ct = ["application/xhtml+xml", "text/html"], F = null, I = null, lt = n.createElement("form"), ut = function(e) {
		return e instanceof RegExp || e instanceof Function;
	}, dt = function() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		if (I && I === e) return;
		(!e || typeof e != "object") && (e = {}), e = jp(e), st = ct.indexOf(e.PARSER_MEDIA_TYPE) === -1 ? "text/html" : e.PARSER_MEDIA_TYPE, F = st === "application/xhtml+xml" ? hp : mp, M = pm(e, "ALLOWED_TAGS", ve, { transform: F }), ye = pm(e, "ALLOWED_ATTR", be, { transform: F }), P = pm(e, "ALLOWED_NAMESPACES", tt, { transform: hp }), Je = pm(e, "ADD_URI_SAFE_ATTR", Ye, {
			transform: F,
			base: Ye
		}), Ke = pm(e, "ADD_DATA_URI_TAGS", qe, {
			transform: F,
			base: qe
		}), We = pm(e, "FORBID_CONTENTS", Ge, { transform: F }), Se = pm(e, "FORBID_TAGS", jp({}), { transform: F }), Ce = pm(e, "FORBID_ATTR", jp({}), { transform: F }), Ue = wp(e, "USE_PROFILES") ? e.USE_PROFILES && typeof e.USE_PROFILES == "object" ? jp(e.USE_PROFILES) : e.USE_PROFILES : !1, Te = e.ALLOW_ARIA_ATTR !== !1, Ee = e.ALLOW_DATA_ATTR !== !1, De = e.ALLOW_UNKNOWN_PROTOCOLS || !1, Oe = e.ALLOW_SELF_CLOSE_IN_ATTR !== !1, ke = e.SAFE_FOR_TEMPLATES || !1, Ae = e.SAFE_FOR_XML !== !1, je = e.WHOLE_DOCUMENT || !1, N = e.RETURN_DOM || !1, Ie = e.RETURN_DOM_FRAGMENT || !1, Le = e.RETURN_TRUSTED_TYPE || !1, Fe = e.FORCE_BODY || !1, Re = e.SANITIZE_DOM !== !1, ze = e.SANITIZE_NAMED_PROPS || !1, Ve = e.KEEP_CONTENT !== !1, He = e.IN_PLACE || !1, _e = Pp(e.ALLOWED_URI_REGEXP) ? e.ALLOWED_URI_REGEXP : Zp, $e = typeof e.NAMESPACE == "string" ? e.NAMESPACE : Qe, rt = mm(e, "MATHML_TEXT_INTEGRATION_POINTS", () => $({}, nt)), at = mm(e, "HTML_INTEGRATION_POINTS", () => $({}, it));
		let t = mm(e, "CUSTOM_ELEMENT_HANDLING", () => ip(null));
		if (xe = ip(null), wp(t, "tagNameCheck") && ut(t.tagNameCheck) && (xe.tagNameCheck = t.tagNameCheck), wp(t, "attributeNameCheck") && ut(t.attributeNameCheck) && (xe.attributeNameCheck = t.attributeNameCheck), wp(t, "allowCustomizedBuiltInElements") && typeof t.allowCustomizedBuiltInElements == "boolean" && (xe.allowCustomizedBuiltInElements = t.allowCustomizedBuiltInElements), rp(xe), ke && (Ee = !1), Ie && (N = !0), Ue && (M = $({}, Vp), ye = ip(null), Ue.html === !0 && ($(M, Fp), $(ye, Hp)), Ue.svg === !0 && ($(M, Ip), $(ye, Up), $(ye, Gp)), Ue.svgFilters === !0 && ($(M, Lp), $(ye, Up), $(ye, Gp)), Ue.mathMl === !0 && ($(M, zp), $(ye, Wp), $(ye, Gp))), we.tagCheck = null, we.attributeCheck = null, wp(e, "ADD_TAGS") && (typeof e.ADD_TAGS == "function" ? we.tagCheck = e.ADD_TAGS : pp(e.ADD_TAGS) && (M === ve && (M = jp(M)), $(M, e.ADD_TAGS, F))), wp(e, "ADD_ATTR") && (typeof e.ADD_ATTR == "function" ? we.attributeCheck = e.ADD_ATTR : pp(e.ADD_ATTR) && (ye === be && (ye = jp(ye)), $(ye, e.ADD_ATTR, F))), wp(e, "ADD_FORBID_CONTENTS") && pp(e.ADD_FORBID_CONTENTS) && (We === Ge && (We = jp(We)), $(We, e.ADD_FORBID_CONTENTS, F)), Ve && (M["#text"] = !0), je && $(M, [
			"html",
			"head",
			"body"
		]), M.table && ($(M, ["tbody"]), delete Se.tbody), e.TRUSTED_TYPES_POLICY) {
			if (typeof e.TRUSTED_TYPES_POLICY.createHTML != "function") throw Dp("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
			if (typeof e.TRUSTED_TYPES_POLICY.createScriptURL != "function") throw Dp("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
			let t = T;
			T = e.TRUSTED_TYPES_POLICY;
			try {
				E = O("");
			} catch (e) {
				throw T = t, e;
			}
		} else e.TRUSTED_TYPES_POLICY === null ? (T = void 0, E = "") : (T === void 0 && (T = k()), T && typeof E == "string" && (E = O("")));
		np && np(e), I = e;
	}, L = $({}, [
		...Ip,
		...Lp,
		...Rp
	]), ft = $({}, [...zp, ...Bp]), pt = function(e, t, n) {
		return t.namespaceURI === Qe ? e === "svg" : t.namespaceURI === Xe ? e === "svg" && (n === "annotation-xml" || rt[n]) : !!L[e];
	}, mt = function(e, t, n) {
		return t.namespaceURI === Qe ? e === "math" : t.namespaceURI === Ze ? e === "math" && at[n] : !!ft[e];
	}, ht = function(e, t, n) {
		return t.namespaceURI === Ze && !at[n] || t.namespaceURI === Xe && !rt[n] ? !1 : !ft[e] && (ot[e] || !L[e]);
	}, gt = function(e) {
		let t = _(e);
		(!t || !t.tagName) && (t = {
			namespaceURI: $e,
			tagName: "template"
		});
		let n = mp(e.tagName), r = mp(t.tagName);
		return P[e.namespaceURI] ? e.namespaceURI === Ze ? pt(n, t, r) : e.namespaceURI === Xe ? mt(n, t, r) : e.namespaceURI === Qe ? ht(n, t, r) : !!(st === "application/xhtml+xml" && P[e.namespaceURI]) : !1;
	}, _t = function(e) {
		dp(t.removed, { element: e });
		try {
			_(e).removeChild(e);
		} catch {
			if (p(e), !_(e)) throw Dp("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
		}
	}, vt = function(e, t, n) {
		try {
			m(e, t);
		} catch {
			try {
				e.removeAttribute(n);
			} catch {}
		}
	}, yt = function(e) {
		St(e);
		let t = g(e);
		if (t) {
			let e = [];
			cp(t, (t) => {
				dp(e, t);
			}), cp(e, (e) => {
				try {
					p(e);
				} catch {}
			});
		}
		let n = y(e);
		if (n) for (let t = n.length - 1; t >= 0; --t) {
			let r = n[t], i = r && r.name;
			typeof i == "string" && vt(e, r, i);
		}
	}, bt = function(e, n, r) {
		if (!r) try {
			r = n.getAttributeNode(e);
		} catch {
			r = null;
		}
		dp(t.removed, {
			attribute: r || null,
			from: n
		});
		try {
			r ? m(n, r) : n.removeAttribute(e);
		} catch {
			try {
				n.removeAttribute(e);
			} catch {}
		}
		if (e === "is") {
			if (N || Ie) try {
				_t(n);
			} catch {}
			else try {
				n.setAttribute(e, "");
			} catch {}
		}
	}, xt = function(e) {
		let t = y(e);
		if (t) for (let n = t.length - 1; n >= 0; --n) {
			let r = t[n], i = r && r.name;
			typeof i != "string" || ye[F(i)] || vt(e, r, i);
		}
	}, St = function(e) {
		let t = [e];
		for (; t.length > 0;) {
			let e = t.pop();
			C(e) === om.element && xt(e);
			let n = g(e);
			if (n) for (let e = n.length - 1; e >= 0; --e) t.push(n[e]);
		}
	}, Ct = function(e, t) {
		return Ae ? e === "patchsrc" || e === "for" && t !== "label" && t !== "output" : !1;
	}, wt = function(e) {
		if (!Ae) return;
		let t = [e];
		for (; t.length > 0;) {
			let e = t.pop(), n = C(e);
			if (n === om.processingInstruction || n === om.comment && Ep(rm, e.data)) {
				try {
					p(e);
				} catch {}
				continue;
			}
			if (n === om.element) {
				let t = e, n = F(w(e));
				try {
					t.hasAttribute && t.hasAttribute("patchsrc") && t.removeAttribute("patchsrc"), t.hasAttribute && t.hasAttribute("for") && Ct("for", n) && t.removeAttribute("for");
				} catch {}
			}
			let r = g(e);
			if (r) for (let e = r.length - 1; e >= 0; --e) t.push(r[e]);
		}
	}, Tt = function(e) {
		let t = null, r = null;
		if (Fe) e = "<remove></remove>" + e;
		else {
			let t = gp(e, /^[\r\n\t ]+/);
			r = t && t[0];
		}
		st === "application/xhtml+xml" && $e === Qe && (e = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>" + e + "</body></html>");
		let i = T ? O(e) : e;
		if ($e === Qe) try {
			t = new l().parseFromString(i, st);
		} catch {}
		if (!t || !t.documentElement) {
			t = ie.createDocument($e, "template", null);
			try {
				t.documentElement.innerHTML = et ? E : i;
			} catch {}
		}
		let a = t.body || t.documentElement;
		return e && r && a.insertBefore(n.createTextNode(r), a.childNodes[0] || null), $e === Qe ? se.call(t, je ? "html" : "body")[0] : je ? t.documentElement : a;
	}, Et = function(e) {
		let t = S ? S(e) : e.ownerDocument;
		return ae.call(t || e, e, c.SHOW_ELEMENT | c.SHOW_COMMENT | c.SHOW_TEXT | c.SHOW_PROCESSING_INSTRUCTION | c.SHOW_CDATA_SECTION, null);
	}, Dt = function(e) {
		return e = _p(e, le, " "), e = _p(e, ue, " "), e = _p(e, de, " "), e;
	}, Ot = function(e) {
		e.normalize();
		let t = S ? S(e) : e.ownerDocument, n = ae.call(t || e, e, c.SHOW_TEXT | c.SHOW_COMMENT | c.SHOW_CDATA_SECTION | c.SHOW_PROCESSING_INSTRUCTION, null), r = n.nextNode();
		for (; r;) r.data = Dt(r.data), r = n.nextNode();
		let i = e.querySelectorAll?.call(e, "template");
		i && cp(i, (e) => {
			At(e.content) && Ot(e.content);
		});
	}, kt = function(e) {
		let t = x ? x(e) : null;
		return typeof t != "string" || F(t) !== "form" ? !1 : typeof e.nodeName != "string" || typeof e.textContent != "string" || typeof e.removeChild != "function" || e.attributes !== y(e) || typeof e.removeAttribute != "function" || typeof e.removeAttributeNode != "function" || typeof e.getAttributeNode != "function" || typeof e.setAttribute != "function" || typeof e.namespaceURI != "string" || typeof e.insertBefore != "function" || typeof e.hasChildNodes != "function" || e.nodeType !== b(e) || e.childNodes !== g(e);
	}, At = function(e) {
		if (!b || typeof e != "object" || !e) return !1;
		try {
			return b(e) === om.documentFragment;
		} catch {
			return !1;
		}
	}, jt = function(e) {
		if (!b || typeof e != "object" || !e) return !1;
		try {
			return typeof b(e) == "number";
		} catch {
			return !1;
		}
	};
	function Mt(e, n, r) {
		e.length !== 0 && cp(e, (e) => {
			e.call(t, n, r, I);
		});
	}
	let Nt = function(e, t) {
		return !!(Ae && e.hasChildNodes() && !jt(e.firstElementChild) && Ep(nm, e.textContent) && Ep(nm, e.innerHTML) || Ae && e.namespaceURI === Qe && cm[t] && (jt(e.firstElementChild) || typeof e.textContent == "string" && Ep(lm[t], e.textContent)) || e.nodeType === om.processingInstruction || Ae && e.nodeType === om.comment && Ep(rm, e.data));
	}, Pt = function(e, t) {
		return e instanceof RegExp ? Ep(e, t) : e instanceof Function && !!e(t, ...[...arguments].slice(2));
	}, Ft = function(e, t, n) {
		if (!Se[t] && Vt(t) && Pt(xe.tagNameCheck, t)) return !1;
		if (Ve && !We[t]) {
			let t = _(e), r = g(e);
			if (r && t) {
				let i = r.length;
				for (let a = i - 1; a >= 0; --a) {
					let i = e === n ? f(r[a], !0) : r[a];
					t.insertBefore(i, h(e));
				}
			}
		}
		return _t(e), !0;
	}, It = function(e, t, n, r) {
		return e.length === 0 ? t : t === n || t === r ? jp(t) : t;
	}, Lt = function(e, t) {
		return e === t || _(e) !== null ? !1 : (He && St(e), !0);
	}, Rt = function(e, n) {
		if (Mt(j.beforeSanitizeElements, e, null), Lt(e, n)) return !0;
		if (kt(e)) return _t(e), !0;
		let r = F(w(e));
		if (M = It(j.uponSanitizeElement, M, ve, Ne), Mt(j.uponSanitizeElement, e, {
			tagName: r,
			allowedTags: M
		}), Lt(e, n)) return !0;
		if (Nt(e, r)) return _t(e), !0;
		if (Se[r] || !(we.tagCheck instanceof Function && we.tagCheck(r)) && !M[r]) {
			let t = Ft(e, r, n);
			return t === !1 && Mt(j.afterSanitizeElements, e, null), t;
		}
		if (C(e) === om.element && !gt(e) || (r === "noscript" || r === "noembed" || r === "noframes") && Ep(im, e.innerHTML)) return _t(e), !0;
		if (ke && e.nodeType === om.text) {
			let n = Dt(e.textContent);
			e.textContent !== n && (dp(t.removed, { element: e.cloneNode() }), e.textContent = n);
		}
		return Mt(j.afterSanitizeElements, e, null), !1;
	}, zt = function(e, t, r) {
		if (Ce[t] || Ct(t, e) || Re && (t === "id" || t === "name") && (r in n || r in lt)) return !1;
		let i = ye[t] || we.attributeCheck instanceof Function && we.attributeCheck(t, e);
		return Ee && Ep(fe, t) || Te && Ep(pe, t) ? !0 : i ? Je[t] || Ep(_e, _p(r, he, "")) || (t === "src" || t === "xlink:href" || t === "href") && e !== "script" && vp(r, "data:") === 0 && Ke[e] || De && !Ep(me, _p(r, he, "")) ? !0 : !r : Vt(e) && Pt(xe.tagNameCheck, e) && Pt(xe.attributeNameCheck, t, e) || t === "is" && xe.allowCustomizedBuiltInElements && Pt(xe.tagNameCheck, r);
	}, Bt = $({}, [
		"annotation-xml",
		"color-profile",
		"font-face",
		"font-face-format",
		"font-face-name",
		"font-face-src",
		"font-face-uri",
		"missing-glyph"
	]), Vt = function(e) {
		return !Bt[mp(e)] && Ep(ge, e);
	}, Ht = function(e, t, n, r) {
		if (T && typeof u == "object" && typeof u.getAttributeType == "function" && !n) switch (u.getAttributeType(e, t)) {
			case "TrustedHTML": return O(r);
			case "TrustedScriptURL": return re(r);
		}
		return r;
	}, Ut = function(e, t, n, r) {
		try {
			return n ? e.setAttributeNS(n, t, r) : e.setAttribute(t, r), !kt(e) || (_t(e), !1);
		} catch {
			return bt(t, e), !1;
		}
	}, Wt = function(e) {
		Mt(j.beforeSanitizeAttributes, e, null);
		let n = e.attributes;
		if (!n || kt(e)) return;
		ye = It(j.uponSanitizeAttribute, ye, be, Pe);
		let r = {
			attrName: "",
			attrValue: "",
			keepAttr: !0,
			allowedAttributes: ye,
			forceKeepAttr: void 0
		}, i = n.length, a = F(e.nodeName);
		for (; i--;) {
			let o = n[i], s = o.name, c = o.namespaceURI, l = o.value, u = F(s), d = l, f = s === "value" ? d : yp(d), p = !1;
			if (r.attrName = u, r.attrValue = f, r.keepAttr = !0, r.forceKeepAttr = void 0, Mt(j.uponSanitizeAttribute, e, r), f = r.attrValue, ze && (u === "id" || u === "name") && vp(f, Be) !== 0 && (bt(s, e, o), f = Be + f, p = !0), Ae && Ep(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, f)) {
				bt(s, e, o);
				continue;
			}
			if (u === "attributename" && gp(f, "href")) {
				bt(s, e, o);
				continue;
			}
			if (!r.forceKeepAttr) {
				if (!r.keepAttr) {
					bt(s, e, o);
					continue;
				}
				if (!Oe && Ep(am, f)) {
					bt(s, e, o);
					continue;
				}
				if (ke && (f = Dt(f)), !zt(a, u, f)) {
					bt(s, e, o);
					continue;
				}
				f = Ht(a, u, c, f), f !== d && Ut(e, s, c, f) && p && up(t.removed);
			}
		}
		Mt(j.afterSanitizeAttributes, e, null);
	}, Gt = function(e) {
		let t = null, n = Et(e);
		for (Mt(j.beforeSanitizeShadowDOM, e, null); t = n.nextNode();) if (Mt(j.uponSanitizeShadowNode, t, null), Rt(t, e), Wt(t), At(t.content) && Gt(t.content), C(t) === om.element) {
			let e = v(t);
			At(e) && (Kt(e), Gt(e));
		}
		Mt(j.afterSanitizeShadowDOM, e, null);
	}, Kt = function(e) {
		let t = [{
			node: e,
			shadow: null
		}];
		for (; t.length > 0;) {
			let e = t.pop();
			if (e.shadow) {
				Gt(e.shadow);
				continue;
			}
			let n = e.node, r = C(n) === om.element, i = g(n);
			if (i) for (let e = i.length - 1; e >= 0; --e) t.push({
				node: i[e],
				shadow: null
			});
			if (r) {
				let e = x ? x(n) : null;
				if (typeof e == "string" && F(e) === "template") {
					let e = n.content;
					At(e) && t.push({
						node: e,
						shadow: null
					});
				}
			}
			if (r) {
				let e = v(n);
				At(e) && t.push({
					node: null,
					shadow: e
				}, {
					node: e,
					shadow: null
				});
			}
		}
	};
	return t.sanitize = function(e) {
		let n = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, i = null, a = null, o = null, s = null;
		if (et = !e, et && (e = "<!-->"), typeof e != "string" && !jt(e) && (e = Mp(e), typeof e != "string")) throw Dp("dirty is not a string, aborting");
		if (!t.isSupported) return e;
		Me ? (M = Ne, ye = Pe) : dt(n), (j.uponSanitizeElement.length > 0 || j.uponSanitizeAttribute.length > 0) && (M = jp(M)), j.uponSanitizeAttribute.length > 0 && (ye = jp(ye)), t.removed = [];
		let c = He && typeof e != "string" && jt(e);
		if (c) {
			wt(e);
			let t = w(e);
			if (typeof t == "string") {
				let n = F(t);
				if (!M[n] || Se[n]) throw yt(e), Dp("root node is forbidden and cannot be sanitized in-place");
			}
			if (kt(e)) throw yt(e), Dp("root node is clobbered and cannot be sanitized in-place");
			try {
				Kt(e);
			} catch (t) {
				throw yt(e), t;
			}
		} else if (jt(e)) i = Tt("<!---->"), a = i.ownerDocument.importNode(e, !0), a.nodeType === om.element && a.nodeName === "BODY" || a.nodeName === "HTML" ? i = a : i.appendChild(a), Kt(i);
		else {
			if (!N && !ke && !je && e.indexOf("<") === -1) return T && Le ? O(e) : e;
			if (i = Tt(e), !i) return N ? null : Le ? E : "";
		}
		i && Fe && _t(i.firstChild);
		let l = c ? e : i;
		try {
			let e = Et(l);
			for (; o = e.nextNode();) Rt(o, l), Wt(o), At(o.content) && Gt(o.content);
		} catch (n) {
			throw c && (yt(e), cp(t.removed, (e) => {
				e.element && St(e.element);
			})), n;
		}
		if (c) return cp(t.removed, (e) => {
			e.element && St(e.element);
		}), ke && Ot(e), e;
		if (N) {
			if (ke && Ot(i), Ie) for (s = oe.call(i.ownerDocument); i.firstChild;) s.appendChild(i.firstChild);
			else s = i;
			return (ye.shadowroot || ye.shadowrootmode) && (s = ce.call(r, s, !0)), s;
		}
		let u = je ? i.outerHTML : i.innerHTML;
		return je && M["!doctype"] && i.ownerDocument && i.ownerDocument.doctype && i.ownerDocument.doctype.name && Ep(em, i.ownerDocument.doctype.name) && (u = "<!DOCTYPE " + i.ownerDocument.doctype.name + ">\n" + u), ke && (u = Dt(u)), T && Le ? O(u) : u;
	}, t.setConfig = function() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		dt(e), Me = !0, Ne = M, Pe = ye;
	}, t.clearConfig = function() {
		I = null, Me = !1, Ne = null, Pe = null, T = ee, E = "";
	}, t.isValidAttribute = function(e, t, n) {
		I || dt({});
		let r = F(e), i = F(t);
		return zt(r, i, n);
	}, t.addHook = function(e, t) {
		typeof t == "function" && wp(j, e) && dp(j[e], t);
	}, t.removeHook = function(e, t) {
		if (wp(j, e)) {
			if (t !== void 0) {
				let n = lp(j[e], t);
				return n === -1 ? void 0 : fp(j[e], n, 1)[0];
			}
			return up(j[e]);
		}
	}, t.removeHooks = function(e) {
		wp(j, e) && (j[e] = []);
	}, t.removeAllHooks = function() {
		j = fm();
	}, t;
}
var gm = hm(), _m = /* @__PURE__ */ "a.abbr.address.article.aside.b.bdi.bdo.big.blockquote.br.caption.center.cite.code.col.colgroup.dd.del.div.dl.dt.em.fieldset.font.footer.h1.h2.h3.h4.h5.h6.header.hr.i.img.ins.label.legend.li.mark.nav.ol.p.pre.q.rt.ruby.s.section.small.span.strong.sub.sup.table.tbody.td.tfoot.th.thead.tr.tt.u.ul".split("."), vm = new Set(_m), ym = {
	ensp: " ",
	emsp: " ",
	nbsp: "\xA0"
};
function bm(e) {
	return gm.sanitize(String(e ?? ""), {
		ALLOWED_TAGS: _m,
		ALLOW_DATA_ATTR: !0,
		ALLOW_UNKNOWN_PROTOCOLS: !1,
		FORBID_ATTR: [
			"srcdoc",
			"formaction",
			"xlink:href"
		]
	});
}
function xm(e, t, n) {
	if (!t || typeof t != "object") return;
	if (t.type === "text") {
		let r = ym[n] ?? " ";
		e.append(document.createTextNode(String(t.text ?? "").replaceAll(" ", r)));
		return;
	}
	let r = String(t.name ?? "").toLowerCase();
	if (!vm.has(r)) return;
	let i = document.createElement(r);
	if (t.attrs && typeof t.attrs == "object" && !Array.isArray(t.attrs)) for (let [e, n] of Object.entries(t.attrs)) try {
		i.setAttribute(e, String(n ?? ""));
	} catch {}
	for (let e of Array.isArray(t.children) ? t.children : []) xm(i, e, n);
	e.append(i);
}
function Sm(e, t) {
	let n = document.createElement("div");
	for (let r of e) xm(n, r, t);
	return n.innerHTML;
}
var Cm = ["innerHTML"], wm = {
	__name: "RichText",
	props: {
		nodes: {
			type: [Array, String],
			default: () => []
		},
		space: {
			type: String,
			validator: (e) => [
				"ensp",
				"emsp",
				"nbsp"
			].includes(e)
		},
		userSelect: {
			type: Boolean,
			default: !1
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(""), r = V("info", {})?.sId;
		function i(e, t) {
			if (!e || !t) return e;
			let n = new DOMParser().parseFromString(e, "text/html");
			for (let e of n.body.querySelectorAll("*")) e.setAttribute(t, "");
			return n.body.innerHTML;
		}
		return fi(() => {
			let e = /* @__PURE__ */ R(t.nodes), a = typeof e == "string" ? e : Sm(Array.isArray(e) ? e : [], t.space);
			n.value = i(bm(a), r);
		}), (t, r) => (W(), G("div", q(t.$attrs, {
			class: { "dd-rich-text": e.userSelect },
			innerHTML: B(n)
		}), null, 16, Cm));
	}
}, Tm = /* @__PURE__ */ Y({ default: () => Em }), Em = Q(wm), Dm = {
	__name: "RootPortal",
	props: { enable: {
		type: Boolean,
		default: !0
	} },
	setup(e) {
		return (t, n) => e.enable ? (W(), G(Uo, { key: 0 }, [K("span", q(t.$attrs, { class: "dd-root-portal-host" }), null, 16), (W(), $o(Di, { to: "html" }, [U(t.$slots, "default")]))], 64)) : (W(), G("span", q({ key: 1 }, t.$attrs, { class: "dd-root-portal-content" }), [U(t.$slots, "default")], 16));
	}
}, Om = /* @__PURE__ */ Y({ default: () => km }), km = Q(Dm), Am = {
	__name: "ScrollView",
	props: {
		scrollX: {
			type: Boolean,
			default: !1
		},
		scrollY: {
			type: Boolean,
			default: !1
		},
		upperThreshold: {
			type: [Number, String],
			default: 50
		},
		lowerThreshold: {
			type: [Number, String],
			default: 50
		},
		scrollTop: { type: [Number, String] },
		scrollLeft: { type: [Number, String] },
		scrollIntoView: { type: String },
		scrollWithAnimation: {
			type: Boolean,
			default: !1
		},
		enableBackToTop: {
			type: Boolean,
			default: !1
		},
		enablePassive: {
			type: Boolean,
			default: !1
		},
		refresherEnabled: {
			type: Boolean,
			default: !1
		},
		refresherThreshold: {
			type: Number,
			default: 45
		},
		refresherDefaultStyle: {
			type: String,
			default: "black",
			validator: (e) => [
				"black",
				"white",
				"none"
			].includes(e)
		},
		refresherBackground: { type: String },
		refresherTriggered: {
			type: Boolean,
			default: !1
		},
		bounces: {
			type: Boolean,
			default: !0
		},
		showScrollbar: {
			type: Boolean,
			default: !0
		},
		fastDeceleration: {
			type: Boolean,
			default: !1
		},
		enableFlex: {
			type: Boolean,
			default: !1
		},
		scrollAnchoring: {
			type: Boolean,
			default: !1
		},
		enhanced: {
			type: Boolean,
			default: !1
		},
		pagingEnabled: {
			type: Boolean,
			default: !1
		},
		usingSticky: {
			type: Boolean,
			default: !1
		},
		scrollEnabled: {
			type: Boolean,
			default: !0
		},
		throttle: {
			type: Boolean,
			default: !0
		}
	},
	setup(e) {
		let t = e, n = X(), r = /* @__PURE__ */ z(null), i = J(() => !t.enhanced || !t.showScrollbar), a = 0, o = 0, s = 0, c = 0, l = 0;
		function u(e) {
			if (t.throttle && e.timeStamp - l < 20) return;
			l = e.timeStamp;
			let { scrollTop: i, scrollLeft: u, scrollHeight: d, scrollWidth: f, clientHeight: p, clientWidth: m } = r.value, h = a - u, g = o - i;
			a = u, o = i, Z("scroll", {
				event: e,
				info: n,
				detail: {
					scrollLeft: u,
					scrollTop: i,
					scrollHeight: d,
					scrollWidth: f,
					deltaX: h,
					deltaY: g
				}
			}), t.scrollY && (i <= t.upperThreshold && g > 0 && e.timeStamp - s > 200 && (s = e.timeStamp, Z("scrolltoupper", {
				event: e,
				info: n,
				detail: { direction: "top" }
			})), i + p >= d - t.lowerThreshold && g < 0 && e.timeStamp - c > 200 && (c = e.timeStamp, Z("scrolltolower", {
				event: e,
				info: n,
				detail: { direction: "bottom" }
			}))), t.scrollX && (u <= t.upperThreshold && h > 0 && e.timeStamp - s > 200 && (s = e.timeStamp, Z("scrolltoupper", {
				event: e,
				info: n,
				detail: { direction: "left" }
			})), u + m >= f - t.lowerThreshold && h < 0 && e.timeStamp - c > 200 && (c = e.timeStamp, Z("scrolltolower", {
				event: e,
				info: n,
				detail: { direction: "right" }
			})));
		}
		function d(e) {
			t.scrollEnabled && (t.scrollX || t.scrollY) ? Z("touchmove", {
				event: e,
				info: n
			}) : e.preventDefault();
		}
		let f, p = 0, m = !1;
		function h(e) {
			t.scrollEnabled && (t.refresherEnabled && r.value?.scrollTop <= 0 && (f = e.touches?.[0]?.clientY, p = 0), t.enhanced && Z("dragstart", {
				event: e,
				info: n,
				detail: g()
			}));
		}
		function g(e = {}) {
			let t = r.value;
			return {
				scrollLeft: t?.scrollLeft || 0,
				scrollTop: t?.scrollTop || 0,
				...e
			};
		}
		function _(e) {
			if (f === void 0 || (r.value?.scrollTop ?? 0) <= 0) return;
			let t = p;
			f = void 0, p = 0, t > 0 && Z("refresherabort", {
				event: e,
				info: n,
				detail: { dy: t }
			});
		}
		function v(e) {
			_(e), f !== void 0 && (p = Math.max((e.touches?.[0]?.clientY || f) - f, 0), p > 0 && Z("refresherpulling", {
				event: e,
				info: n,
				detail: { dy: p }
			})), t.enhanced && Z("dragging", {
				event: e,
				info: n,
				detail: g()
			});
		}
		function y(e) {
			_(e), f !== void 0 && (p >= t.refresherThreshold ? (m = !0, Z("refresherrefresh", {
				event: e,
				info: n,
				detail: { dy: p }
			})) : p > 0 && Z("refresherabort", {
				event: e,
				info: n,
				detail: { dy: p }
			}), f = void 0, p = 0), t.enhanced && Z("dragend", {
				event: e,
				info: n,
				detail: g()
			});
		}
		H(() => t.refresherTriggered, (e, r) => {
			e && !r && !m ? (m = !0, Z("refresherrefresh", {
				info: n,
				detail: { dy: t.refresherThreshold }
			})) : !e && r && m && (m = !1, Z("refresherrestore", {
				info: n,
				detail: { dy: 0 }
			}));
		}), H(() => [t.scrollTop, t.scrollLeft], ([e, n]) => {
			r.value && r.value.scrollTo({
				top: e === void 0 ? r.value.scrollTop : Number(e) || 0,
				left: n === void 0 ? r.value.scrollLeft : Number(n) || 0,
				behavior: t.scrollWithAnimation ? "smooth" : "instant"
			});
		}, { flush: "post" });
		function b(e) {
			if (!e || !r.value) return;
			let n = window.CSS?.escape ? CSS.escape(e) : e.replace(/(["'\\#.:[\],>+~*^$|=()])/g, "\\$1"), i = r.value.querySelector(`#${n}`);
			if (!i) return;
			let a = r.value.getBoundingClientRect(), o = i.getBoundingClientRect();
			r.value.scrollTo({
				top: t.scrollY ? r.value.scrollTop + o.top - a.top : r.value.scrollTop,
				left: t.scrollX ? r.value.scrollLeft + o.left - a.left : r.value.scrollLeft,
				behavior: t.scrollWithAnimation ? "smooth" : "instant"
			});
		}
		return H(() => t.scrollIntoView, b, { flush: "post" }), Yi(() => {
			r.value && ((t.scrollTop !== void 0 || t.scrollLeft !== void 0) && r.value.scrollTo({
				top: t.scrollTop === void 0 ? r.value.scrollTop : Number(t.scrollTop) || 0,
				left: t.scrollLeft === void 0 ? r.value.scrollLeft : Number(t.scrollLeft) || 0,
				behavior: t.scrollWithAnimation ? "smooth" : "instant"
			}), t.scrollIntoView && b(t.scrollIntoView));
		}), (e, n) => (W(), G("div", q({
			ref_key: "scrollView",
			ref: r
		}, e.$attrs, {
			class: ["dd-scroll-view", [{
				"scroll-x": !!t.scrollX,
				"scroll-y": !!t.scrollY,
				"scroll-disabled": !t.scrollEnabled,
				"hide-scrollbar": B(i)
			}]],
			onScroll: u,
			onTouchstart: h,
			onTouchmove: n[0] ||= (e) => {
				d(e), v(e);
			},
			onTouchend: y,
			onTouchcancel: y
		}), [U(e.$slots, "default")], 16));
	}
}, jm = /* @__PURE__ */ Y({ default: () => Mm }), Mm = Q(Am), Nm = [
	"id",
	"aria-valuemin",
	"aria-valuemax",
	"aria-valuenow",
	"aria-disabled"
], Pm = { class: "dd-slider-wrapper" }, Fm = ["hidden"], Im = "#1aad19", Lm = "#e9e9e9", Rm = {
	__name: "Slider",
	props: {
		id: { type: String },
		name: { type: String },
		min: {
			type: Number,
			default: 0,
			required: !1
		},
		max: {
			type: Number,
			default: 100,
			required: !1
		},
		step: {
			type: Number,
			default: 1,
			required: !1
		},
		disabled: {
			type: Boolean,
			default: !1,
			required: !1
		},
		value: {
			type: Number,
			default: 0,
			required: !1
		},
		color: {
			type: String,
			default: "#e9e9e9",
			required: !1
		},
		selectedColor: {
			type: String,
			default: "#1aad19",
			required: !1
		},
		activeColor: {
			type: String,
			default: "#1aad19",
			required: !1
		},
		backgroundColor: {
			type: String,
			default: "#e9e9e9",
			required: !1
		},
		blockSize: {
			type: Number,
			default: 28,
			required: !1,
			validator: (e) => e >= 12 && e <= 28
		},
		blockColor: {
			type: String,
			default: "#ffffff",
			required: !1
		},
		showValue: {
			type: Boolean,
			default: !1,
			required: !1
		},
		autoFill: {
			type: String,
			default: ""
		}
	},
	setup(e) {
		let t = e, n = X(), r = J(() => {
			let { activeColor: e, selectedColor: n } = t;
			return e === Im ? n === Im ? Im : n : e;
		}), i = J(() => {
			let { backgroundColor: e, color: n } = t;
			return e === Lm ? n === Lm ? { backgroundColor: Lm } : { backgroundColor: n } : { backgroundColor: e };
		});
		function a(e) {
			let t = Number(e);
			if (Number.isInteger(t)) return 0;
			let [n, r] = t.toString().toLowerCase().split("e"), i = n.split(".")[1]?.length ?? 0, a = r === void 0 ? 0 : Number(r);
			return Math.max(0, i - a);
		}
		function o(e) {
			let n = Number(t.min), r = Number(t.max), i = Math.max(Number(t.step) || 1, 2 ** -52), o = n + Math.round((Math.min(Math.max(e, n), r) - n) / i) * i, s = Math.max(a(n), a(r), a(i)), c = s > 0 ? Number(o.toFixed(s)) : o;
			return Math.min(Math.max(c, n), r);
		}
		let s = /* @__PURE__ */ z(null), c = /* @__PURE__ */ z(null), l = /* @__PURE__ */ z(o(Number(t.value))), u = V("collectFormValue", void 0), d = V("registerFormControl", void 0);
		u?.(t.name, l.value);
		let f = J(() => Number(t.max) - Number(t.min)), p = J(() => f.value > 0 ? (l.value - Number(t.min)) / f.value * 100 : 0), m = J(() => {
			let e = Number(t.blockSize) || 28;
			return Math.min(Math.max(e, 12), 28);
		}), h = J(() => {
			let e = Number(t.min), n = Number(t.max), r = Math.max(String(Math.trunc(Math.abs(e))).length, String(Math.trunc(Math.abs(n))).length), i = Math.max(a(t.min), a(t.max), a(t.step)), o = +(e < 0), s = +(i > 0);
			return `${o + r + s + i}ch`;
		}), g = !1, _ = null;
		function v() {
			t.disabled || (g = !0, _ = l.value);
		}
		H(() => t.value, (e) => {
			l.value = o(Number(e)), u?.(t.name, l.value);
		});
		let y = d?.({
			getName: () => t.name,
			getValue: () => l.value,
			reset: () => {
				l.value = Number(t.min), u?.(t.name, l.value);
			}
		});
		Qi(() => y?.());
		let b = J(() => ({
			backgroundColor: t.blockColor,
			height: `${m.value}px`,
			marginLeft: `${-m.value / 2}px`,
			marginTop: `${-m.value / 2}px`,
			width: `${m.value}px`
		}));
		function x(e) {
			return {
				currentTarget: c.value,
				target: e?.target ?? c.value,
				pageX: e?.pageX,
				pageY: e?.pageY,
				touches: e?.touches,
				changedTouches: e?.changedTouches,
				cancelable: e?.cancelable,
				preventDefault: () => e?.preventDefault?.(),
				stopPropagation: () => e?.stopPropagation?.()
			};
		}
		function S(e) {
			g && !t.disabled && (e.cancelable && e.preventDefault(), w(e));
		}
		function C(e) {
			let n = (e.touches?.[0] ?? e.changedTouches?.[0])?.clientX ?? e.clientX, r = s.value?.getBoundingClientRect();
			if (n === void 0 || !r?.width) return null;
			let i = o((n - r.left) / r.width * f.value + Number(t.min));
			return i !== l.value && (l.value = i, u?.(t.name, i)), i;
		}
		function w(e, t = "changing") {
			let r = C(e);
			r !== null && Z(t, {
				event: x(e),
				info: n,
				detail: { value: r }
			});
		}
		function T(e) {
			if (!g || t.disabled) return;
			g = !1;
			let r = C(e), i = _;
			_ = null, r !== null && r !== i && Z("change", {
				event: x(e),
				info: n,
				detail: { value: r }
			});
		}
		function E(e) {
			if (t.disabled) return;
			let r = l.value, i = C(e);
			i !== null && i !== r && Z("change", {
				event: x(e),
				info: n,
				detail: { value: i }
			});
		}
		function ee(e) {
			let t = (e.touches?.[0] ?? e.changedTouches?.[0])?.clientX ?? e.clientX, n = s.value?.getBoundingClientRect();
			return !n?.width || t === void 0 ? !1 : t >= n.left && t <= n.left + n.width;
		}
		function D({ event: e }) {
			t.disabled || (!g && ee(e) && E(e), Z("tap", {
				event: e,
				info: n
			}));
		}
		return nu(n, c, { tapHandler: D }), Yi(() => {
			window.addEventListener("mousemove", S), window.addEventListener("mouseup", T), window.addEventListener("touchmove", S, { passive: !1 }), window.addEventListener("touchend", T), window.addEventListener("touchcancel", T);
		}), Qi(() => {
			window.removeEventListener("mousemove", S), window.removeEventListener("mouseup", T), window.removeEventListener("touchmove", S), window.removeEventListener("touchend", T), window.removeEventListener("touchcancel", T);
		}), (t, n) => (W(), G("div", q({
			id: e.id,
			ref_key: "sliderRoot",
			ref: c
		}, t.$attrs, {
			class: ["dd-slider", { "dd-slider-disabled": e.disabled }],
			role: "slider",
			"aria-valuemin": e.min,
			"aria-valuemax": e.max,
			"aria-valuenow": B(l),
			"aria-disabled": e.disabled
		}), [K("div", Pm, [K("div", {
			ref_key: "sliderHandle",
			ref: s,
			class: "dd-slider-tap-area"
		}, [K("div", {
			class: "dd-slider-handle-wrapper",
			style: It(B(i))
		}, [
			K("div", {
				class: "dd-slider-handle",
				style: It({
					...B(b),
					left: `${B(p)}%`,
					backgroundColor: "transparent"
				}),
				onTouchstart: v,
				onMousedown: v
			}, null, 36),
			K("div", {
				class: "dd-slider-thumb",
				style: It({
					...B(b),
					left: `${B(p)}%`
				})
			}, null, 4),
			K("div", {
				class: "dd-slider-track",
				style: It({
					width: `${B(p)}%`,
					backgroundColor: B(r)
				})
			}, null, 4),
			n[0] ||= K("div", { class: "dd-slider-step" }, null, -1)
		], 4)], 512), K("span", {
			class: "dd-slider-value",
			hidden: !e.showValue
		}, [K("p", {
			"parse-text-content": "",
			style: It({ width: B(h) })
		}, Xt(B(l)), 5)], 8, Fm)])], 16, Nm));
	}
}, zm = /* @__PURE__ */ Y({ default: () => Bm }), Bm = Q(Rm), Vm = ["aria-label"], Hm = ["data-dot-index"], Um = {
	__name: "Swiper",
	props: {
		indicatorDots: {
			type: Boolean,
			default: !1
		},
		indicatorColor: {
			type: String,
			default: "rgba(0, 0, 0, .3)"
		},
		indicatorActiveColor: {
			type: String,
			default: "#000000"
		},
		autoplay: {
			type: Boolean,
			default: !1
		},
		current: {
			type: Number,
			default: 0
		},
		currentItemId: {
			type: String,
			default: ""
		},
		skipHiddenItemLayout: {
			type: Boolean,
			default: !1
		},
		interval: {
			type: Number,
			default: 5e3
		},
		duration: {
			type: Number,
			default: 500
		},
		circular: {
			type: Boolean,
			default: !1
		},
		vertical: {
			type: Boolean,
			default: !1
		},
		displayMultipleItems: {
			type: Number,
			default: 1
		},
		previousMargin: {
			type: String,
			default: "0px"
		},
		easingFunction: {
			type: String,
			default: "default",
			validator: (e) => [
				"default",
				"linear",
				"easeInCubic",
				"easeOutCubic",
				"easeInOutCubic"
			].includes(e)
		},
		nextMargin: {
			type: String,
			default: "0px"
		},
		snapToEdge: {
			type: Boolean,
			default: !1
		}
	},
	setup(e) {
		let t = e, n = X(), r = va(), i = /* @__PURE__ */ z(0), a = /* @__PURE__ */ z([]), o = /* @__PURE__ */ z([]), s = /* @__PURE__ */ z([]), c = /* @__PURE__ */ z(t.current), l = !1;
		function u(e) {
			let t = [], n = Array.isArray(e) ? [...e].reverse() : [], r = /* @__PURE__ */ new WeakSet();
			for (; n.length;) {
				let e = n.pop();
				if (!e || typeof e != "object" || r.has(e)) continue;
				if (r.add(e), e.type?.__name === "SwiperItem") {
					t.push(e);
					continue;
				}
				let i = e.children;
				if (i?.default && typeof i.default == "function" && (i = i.default()), Array.isArray(i)) for (let e = i.length - 1; e >= 0; e--) n.push(i[e]);
			}
			return t;
		}
		function d(e, t) {
			return e.map((e, n) => ss(e, {
				key: `${t}-${n}-${e.key ?? n}`,
				"data-dd-cloned": ""
			}));
		}
		let f = /* @__PURE__ */ z(null), p = /* @__PURE__ */ z(null), m = 0, h = 0, g = !1, _ = !1, v = !1, y = {
			width: 0,
			height: 0
		}, b = 0, x = 0, S = 0, C = 0, w = 0, T, E, ee = "", D = /* @__PURE__ */ z({
			transform: t.vertical ? `translateY(-${t.current}00%)` : `translateX(-${t.current}00%)`,
			transition: `transform ${t.duration}ms ease`,
			flexDirection: t.vertical ? "column" : "row"
		}), te = J(() => ({ touchAction: t.vertical ? "pan-x" : "pan-y" })), ne = J(() => {
			switch (t.easingFunction) {
				case "linear": return "linear";
				case "easeInCubic": return "ease-in";
				case "easeOutCubic": return "ease-out";
				case "easeInOutCubic": return "ease-in-out";
				default: return "ease-in";
			}
		}), O = J(() => Math.max(1, Number(t.displayMultipleItems) || 1)), re = J(() => t.circular && i.value > O.value), k = J(() => Math.max(i.value - O.value, 0)), A = J(() => o.value.length > 0 || s.value.length > 0);
		function ie(e) {
			let t = i.value;
			if (!t) return 0;
			let n = Math.round(Number(e) || 0);
			return re.value ? (n % t + t) % t : Math.min(Math.max(n, 0), k.value);
		}
		function ae(e = c.value) {
			return ie(e);
		}
		function oe(e = c.value) {
			let t = a.value[ae(e)];
			return t?.props?.itemId ?? t?.props?.["item-id"] ?? "";
		}
		function se(e) {
			return a.value.findIndex((t) => (t?.props?.itemId ?? t?.props?.["item-id"] ?? "") === e);
		}
		function ce(e) {
			let t = ae(), n = O.value;
			return t <= e && e < t + n || e < t + n - i.value;
		}
		function j(e) {
			return { backgroundColor: ce(e) ? t.indicatorActiveColor : t.indicatorColor };
		}
		fi(() => {
			if (r.default) {
				let e = u(r.default());
				i.value = e.length, a.value = e, re.value ? (o.value = d(e.slice(-O.value), "leading"), s.value = d(e.slice(0, O.value), "trailing")) : (o.value = [], s.value = []);
			} else i.value = 0, a.value = [], o.value = [], s.value = [];
			t.autoplay ? Ce() : we();
		});
		function le(e, t) {
			let n = e / Math.max(t, 16);
			return Math.sign(n) * Math.abs(n) ** 1.05;
		}
		function ue(e, n, r) {
			if (v) {
				g && r.cancelable && r.preventDefault();
				return;
			}
			let i = Math.abs(e), a = Math.abs(n);
			i < 2 && a < 2 || (t.vertical ? (g = i < a, g && r.cancelable && r.preventDefault()) : (g = i > a, g && i > a && r.cancelable && r.preventDefault()), v = !0);
		}
		function de() {
			if (!f.value || !p.value) return;
			let e = t.previousMargin ? Qc(t.previousMargin) : "", n = t.nextMargin ? Qc(t.nextMargin) : "", r = `${Math.abs(100 / O.value)}%`;
			t.vertical ? (f.value.style.left = 0, f.value.style.right = 0, f.value.style.top = e, f.value.style.bottom = n, p.value.style.width = "100%", p.value.style.height = r) : (f.value.style.left = e, f.value.style.right = n, f.value.style.top = 0, f.value.style.bottom = 0, p.value.style.height = "100%", p.value.style.width = r);
		}
		function fe(e) {
			if (!t.snapToEdge || re.value || i.value < 2 || !f.value || !p.value) return e;
			let n = t.vertical ? "offsetTop" : "offsetLeft", r = t.vertical ? "offsetHeight" : "offsetWidth", a = p.value[r] || 1;
			if (e === 0 && t.previousMargin) return f.value[n] / a;
			if (e === k.value && t.nextMargin) {
				let e = f.value.parentElement[r] - f.value[n] - f.value[r];
				return k.value - e / a;
			}
			return e;
		}
		function pe(e, t = !1) {
			let n = A.value ? e + o.value.length : e;
			return t ? n : fe(n);
		}
		function me(e, n = !1) {
			let r = pe(e, n);
			D.value.transform = `translate${t.vertical ? "Y" : "X"}(-${r * 100}%)`;
		}
		function he(e) {
			(!re.value || e !== -1 && e !== i.value) && (e = ie(e)), e !== c.value && (c.value = e, xe(), Z("change", {
				info: n,
				detail: {
					current: ae(e),
					currentItemId: oe(e),
					source: ee
				}
			}));
		}
		H([
			() => t.vertical,
			() => t.autoplay,
			() => t.current,
			() => t.currentItemId,
			() => t.previousMargin,
			() => t.nextMargin,
			() => t.circular,
			() => t.displayMultipleItems,
			() => t.snapToEdge,
			() => t.interval
		], ([e, t, n, r, i, a, o, s, u, d], [f, p, m, h, g, _, v, y, b, x]) => {
			f !== e && (D.value.flexDirection = e ? "column" : "row", de(), xe(), D.value.transition = "none"), (p !== t || x !== d) && (t ? Ce() : we()), y !== s && (c.value = ie(c.value), de(), xe(), D.value.transition = "none");
			let S = r ? se(r) : -1;
			r !== h && S >= 0 && !l ? (ee = "", he(S)) : n !== c.value && !l && !r && (ee = "", he(n)), (g !== i || a !== _ || b !== u) && (de(), xe(), D.value.transition = "none"), v !== o && (c.value = ie(c.value), xe(), D.value.transition = "none");
		}), H(i, () => {
			let e = t.currentItemId ? se(t.currentItemId) : -1;
			e >= 0 && (c.value = e), c.value !== -1 && c.value !== i.value && (c.value = ie(c.value)), p.value && (me(c.value), D.value.transition = "none");
		});
		function ge(e) {
			if (!e.touches && e.button !== 0) return;
			_ = !0, we(), T &&= (cancelAnimationFrame(T), void 0), D.value.transition && D.value.transition !== "none" && be({ type: "transitionend" }), D.value.transition = "none", S = Date.now(), g = !1, v = !1, m = e.touches ? e.touches[0].clientX : e.clientX, h = e.touches ? e.touches[0].clientY : e.clientY, b = 0, x = 0, y = {
				width: p.value.offsetWidth,
				height: p.value.offsetHeight
			};
			let t = p.value.getBoundingClientRect();
			C = t.x, w = t.y;
		}
		function _e(e) {
			_ && (b = (e.touches ? e.touches[0].clientX : e.clientX) - m, x = (e.touches ? e.touches[0].clientY : e.clientY) - h, ue(b, x, e), g && (T && cancelAnimationFrame(T), T = requestAnimationFrame(() => {
				let e = t.vertical ? x : b, n = t.vertical ? y.height : y.width, r = e / n;
				if (e *= 1.1, !re.value) {
					let t = c.value === 0, n = c.value === k.value;
					if (t && e > 0 || n && e < 0) {
						let t = .6 - .3 / (Math.abs(r) + .8);
						e *= t;
					}
				}
				if (t.vertical) {
					let t = -pe(c.value) * 100 + e / y.height * 100;
					D.value.transform = `translateY(${t}%)`;
				} else {
					let t = -pe(c.value) * 100 + e / y.width * 100;
					D.value.transform = `translateX(${t}%)`;
				}
			})));
		}
		function M() {
			if (!_) return;
			if (_ = !1, v = !1, !g) {
				me(c.value), Ce();
				return;
			}
			let e = Date.now() - S;
			T &&= (cancelAnimationFrame(T), void 0);
			let n = t.vertical ? x : b;
			if (n === 0) {
				g = !1, Ce();
				return;
			}
			let r = le(n, e), a = t.vertical ? y.height : y.width, o = Math.abs(n) / a, s = () => {
				let e = A.value ? c.value === -1 || c.value === i.value : c.value === 0 || c.value === k.value, n = Math.min(Math.max(Math.abs(r) * 2.5, .6), 2), a = Math.min(Math.max(o * 1.8, .5), 1.5), s = n * .7 + a * .3, l = Math.max(Math.min(Math.round(t.duration / s), t.duration), 150), u;
				u = Math.abs(r) > .5 || o > .3 ? "cubic-bezier(0.175, 0.885, 0.32, 1.275)" : e ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : ne.value, D.value.transition = `transform ${l}ms ${u}`, me(c.value);
			};
			if (i.value > O.value) {
				if (Math.abs(r) > .15 || o > .15) {
					let e = Math.min(Math.max(Math.abs(r) * 3.5, .8), 4), i = Math.min(Math.max(o * 1.8, .6), 1.8), a = e * .8 + i * .2, c = Math.max(Math.min(Math.round(t.duration / a), t.duration), 100), l;
					l = Math.abs(r) > .8 ? "cubic-bezier(0.25, 0.1, 0.25, 1.0)" : ne.value, D.value.transition = `transform ${c}ms ${l}`, ee = "touch", n > 0 ? ye(s) : ve(s);
				} else s();
			} else s();
			g = !1, Ce();
		}
		function ve(e) {
			let t = re.value ? c.value + 1 : Math.min(c.value + 1, k.value);
			if (t === c.value) {
				e?.();
				return;
			}
			l = !0, he(t);
		}
		function ye(e) {
			let t = re.value ? c.value - 1 : Math.max(c.value - 1, 0);
			if (t === c.value) {
				e?.();
				return;
			}
			l = !0, he(t);
		}
		function be(e) {
			l = !1, re.value && (c.value === i.value ? (c.value = 0, me(0, !0), D.value.transition = "none") : c.value === -1 && (c.value = i.value - 1, me(c.value, !0), D.value.transition = "none")), T &&= (cancelAnimationFrame(T), void 0), Z("animationfinish", {
				event: e,
				info: n,
				detail: {
					current: ae(),
					currentItemId: oe(),
					source: ee
				}
			});
		}
		function xe() {
			if (T &&= (cancelAnimationFrame(T), void 0), p.value) {
				let e = p.value.getBoundingClientRect();
				C = e.x, w = e.y;
			}
			me(c.value), D.value.transition = `transform ${t.duration}ms ${ne.value}`, T = requestAnimationFrame(Se);
		}
		function Se() {
			T &&= (cancelAnimationFrame(T), void 0);
			let e = p.value.getBoundingClientRect();
			if (t.vertical) {
				let t = w - e.y;
				Z("transition", {
					info: n,
					detail: {
						dx: 0,
						dy: t
					}
				});
			} else {
				let t = C - e.x;
				Z("transition", {
					info: n,
					detail: {
						dx: t,
						dy: 0
					}
				});
			}
		}
		function Ce() {
			we(), t.autoplay && i.value > O.value && (E = setInterval(() => {
				g || (ee = "autoplay", l = !0, re.value ? he(c.value + 1) : he(c.value < k.value ? c.value + 1 : 0));
			}, t.interval));
		}
		function we() {
			E &&= (clearInterval(E), null);
		}
		return Yi(() => {
			de();
			let e = t.currentItemId ? se(t.currentItemId) : -1;
			c.value = ie(e >= 0 ? e : c.value), me(c.value), D.value.transition = "none", Ce();
		}), Qi(() => {
			we(), cancelAnimationFrame(T), T = null;
		}), (n, r) => (W(), G("div", q(n.$attrs, { class: ["dd-swiper", { "dd-swiper-skip-hidden": e.skipHiddenItemLayout }] }), [K("div", {
			class: "dd-swiper-wrapper",
			style: It(B(te)),
			"aria-label": t.vertical ? "可竖向滚动" : "可横向滚动",
			onTouchstart: ge,
			onTouchmove: _e,
			onTouchend: M,
			onTouchcancel: M,
			onMousedown: ge,
			onMousemove: _e,
			onMouseup: M,
			onMouseleave: M
		}, [K("div", {
			ref_key: "swiperSliders",
			ref: f,
			class: "dd-swiper-slides"
		}, [K("div", {
			ref_key: "swiperFrame",
			ref: p,
			class: "dd-swiper-slide-frame",
			style: It(B(D)),
			onTransitionend: be
		}, [
			B(o).length ? (W(!0), G(Uo, { key: 0 }, fa(B(o), (e, t) => (W(), $o(ca(e), {
				key: `leading-${t}`,
				"data-dd-cloned": ""
			}))), 128)) : ls("", !0),
			U(n.$slots, "default"),
			B(s).length ? (W(!0), G(Uo, { key: 1 }, fa(B(s), (e, t) => (W(), $o(ca(e), {
				key: `trailing-${t}`,
				"data-dd-cloned": ""
			}))), 128)) : ls("", !0)
		], 36)], 512), t.indicatorDots && B(i) > 0 ? (W(), G("div", {
			key: 0,
			class: Vt(["dd-swiper-dots", {
				"dd-swiper-dots-horizontal": !t.vertical,
				"dd-swiper-dots-vertical": !!t.vertical
			}])
		}, [(W(!0), G(Uo, null, fa(B(i), (e) => (W(), G("div", {
			key: e,
			"data-dot-index": e - 1,
			class: Vt(["dd-swiper-dot", { "dd-swiper-dot-active": ce(e - 1) }]),
			style: It(j(e - 1))
		}, null, 14, Hm))), 128))], 2)) : ls("", !0)], 44, Vm)], 16));
	}
}, Wm = /* @__PURE__ */ Y({ default: () => Gm }), Gm = Q(Um), Km = ["item-id"], qm = {
	__name: "SwiperItem",
	props: { itemId: { type: String } },
	setup(e) {
		let t = e;
		return (e, n) => (W(), G("div", q(e.$attrs, {
			class: "dd-swiper-item",
			"item-id": t.itemId
		}), [U(e.$slots, "default")], 16, Km));
	}
}, Jm = /* @__PURE__ */ Y({ default: () => Ym }), Ym = Q(qm), Xm = [
	"id",
	"tabindex",
	"aria-checked",
	"aria-disabled",
	"onKeydown"
], Zm = [
	"id",
	"tabindex",
	"aria-checked",
	"aria-disabled",
	"onKeydown"
], Qm = {
	__name: "Switch",
	props: {
		id: { type: String },
		name: { type: String },
		checked: {
			type: Boolean,
			default: !1
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		type: {
			type: String,
			default: "switch",
			validator: (e) => ["switch", "checkbox"].includes(e)
		},
		color: {
			type: String,
			default: "#04BE02"
		},
		autoFill: {
			type: String,
			default: ""
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(t.checked), r = V("collectFormValue", void 0), i = V("registerFormControl", void 0);
		H(() => t.checked, (e) => {
			n.value = e, r?.(t.name, n.value);
		}, { immediate: !0 });
		let a = i?.({
			getName: () => t.name,
			getValue: () => n.value,
			reset: () => {
				n.value = !1, r?.(t.name, n.value);
			}
		});
		Qi(() => a?.());
		let o = J(() => {
			let e = n.value ? t.color ?? "#04BE02" : void 0;
			return t.type === "checkbox" ? { color: e } : { backgroundColor: e };
		}), s = X(), c = /* @__PURE__ */ z(null);
		function l(e) {
			t.disabled || (n.value = !n.value, r?.(t.name, n.value), Z("change", {
				event: e,
				info: s,
				detail: { value: n.value }
			}));
		}
		function u({ event: e }) {
			t.disabled || (l(e), Z("tap", {
				event: e,
				info: s
			}));
		}
		function d() {
			c.value?.click();
		}
		return nu(s, c, { tapHandler: u }), $l(c, l), (t, r) => e.type === "checkbox" ? (W(), G("div", q({
			key: 0,
			id: e.id,
			ref_key: "rootRef",
			ref: c
		}, t.$attrs, {
			class: ["dd-checkbox-input", {
				"dd-checkbox-input-checked": B(n),
				"dd-checkbox-input-disabled": e.disabled
			}],
			"data-dd-label-target": "",
			role: "checkbox",
			tabindex: e.disabled ? -1 : 0,
			"aria-checked": B(n),
			"aria-disabled": e.disabled,
			onKeydown: [Ac(Oc(d, ["prevent"]), ["enter"]), Ac(Oc(d, ["prevent"]), ["space"])]
		}), [K("i", {
			class: "dd-checkbox-input-inner",
			style: It(B(o))
		}, null, 4)], 16, Xm)) : (W(), G("div", q({
			key: 1,
			id: e.id,
			ref_key: "rootRef",
			ref: c
		}, t.$attrs, {
			class: ["dd-switch-input", {
				"dd-switch-input-checked": B(n),
				"dd-switch-input-disabled": e.disabled
			}],
			"data-dd-label-target": "",
			role: "switch",
			tabindex: e.disabled ? -1 : 0,
			"aria-checked": B(n),
			"aria-disabled": e.disabled,
			onKeydown: [Ac(Oc(d, ["prevent"]), ["enter"]), Ac(Oc(d, ["prevent"]), ["space"])]
		}), [K("i", {
			class: "dd-switch-input-inner",
			style: It(B(o))
		}, null, 4)], 16, Zm));
	}
}, $m = /* @__PURE__ */ Y({ default: () => eh }), eh = Q(Qm), th = {
	__name: "Template",
	props: {
		is: {
			type: String,
			required: !0
		},
		data: { type: Object }
	},
	setup(e) {
		let t = e, n = J(() => `dd-tpl-${t.is}`), r = J(() => ({ ...t.data || {} }));
		return (e, t) => (W(), $o(ca(B(n)), Ht(os({
			...e.$attrs,
			data: B(r)
		})), null, 16));
	}
}, nh = /* @__PURE__ */ Y({ default: () => rh }), rh = Q(th), ih = {
	__name: "Text",
	props: {
		selectable: {
			type: Boolean,
			default: !1
		},
		userSelect: {
			type: Boolean,
			default: !1
		},
		space: {
			type: String,
			validator: (e) => [
				"ensp",
				"emsp",
				"nbsp"
			].includes(e)
		},
		decode: {
			type: Boolean,
			default: !1
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(null);
		function r(e) {
			let n = {
				nbsp: "\xA0",
				ensp: " ",
				emsp: " "
			};
			return n[t.space] && (e = e.replace(/ /g, n[t.space])), t.decode && (e = e.replace(/&nbsp;/g, "\xA0").replace(/&ensp;/g, " ").replace(/&emsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&")), e;
		}
		function i() {
			if (n.value) {
				let e = document.createTreeWalker(n.value, NodeFilter.SHOW_TEXT), t = [], i = e.nextNode();
				for (; i;) t.push(i), i = e.nextNode();
				for (let e of t) {
					let t = e.nodeValue, n = r(t), i = n.split("\\n");
					if (i.length > 1) {
						let t = document.createDocumentFragment();
						for (let e = 0; e < i.length; e++) t.appendChild(document.createTextNode(i[e])), e < i.length - 1 && t.appendChild(document.createElement("br"));
						e.parentNode.replaceChild(t, e);
					} else if (n !== t) {
						let t = document.createTextNode(n);
						e.parentNode.replaceChild(t, e);
					}
				}
			}
		}
		Yi(i), Zi(i), nu(X(), n);
		let a = J(() => t.userSelect || t.selectable);
		return (e, t) => (W(), G("span", q({
			ref_key: "textRef",
			ref: n
		}, e.$attrs, { class: ["dd-text", { "dd-text-selectable": B(a) }] }), [U(e.$slots, "default")], 16));
	}
}, ah = /* @__PURE__ */ Y({ default: () => oh }), oh = Q(ih), sh = [
	"id",
	"value",
	"disabled",
	"maxlength",
	"autocomplete"
], ch = {
	__name: "Textarea",
	props: {
		id: { type: String },
		name: { type: String },
		value: {
			type: String,
			required: !1,
			default: ""
		},
		placeholder: {
			type: String,
			required: !1
		},
		placeholderStyle: {
			type: [String, Object],
			required: !1,
			default() {
				return {};
			}
		},
		disabled: {
			type: Boolean,
			default: !1,
			required: !1
		},
		maxlength: {
			type: Number,
			default: 140,
			required: !1
		},
		autoFocus: {
			type: Boolean,
			default: !1,
			required: !1
		},
		focus: {
			type: Boolean,
			default: !1,
			required: !1
		},
		autoHeight: {
			type: Boolean,
			default: !1,
			required: !1
		},
		cursorSpacing: {
			type: Number,
			default: 0,
			required: !1
		},
		cursor: {
			type: Number,
			default: -1,
			required: !1
		},
		showConfirmBar: {
			type: Boolean,
			default: !0,
			required: !1
		},
		selectionStart: {
			type: Number,
			default: -1,
			required: !1
		},
		selectionEnd: {
			type: Number,
			default: -1,
			required: !1
		},
		adjustPosition: {
			type: Boolean,
			default: !0,
			required: !1
		},
		holdKeyboard: {
			type: Boolean,
			default: !1,
			required: !1
		},
		disableDefaultPadding: {
			type: Boolean,
			default: !1,
			required: !1
		},
		confirmType: {
			type: String,
			default: "return",
			required: !1,
			validator: (e) => [
				"send",
				"search",
				"next",
				"go",
				"done",
				"return"
			].includes(e)
		},
		confirmHold: {
			type: Boolean,
			default: !1,
			required: !1
		},
		adjustKeyboardTo: {
			type: String,
			default: "cursor",
			required: !1,
			validator: (e) => ["cursor", "bottom"].includes(e)
		},
		placeholderClass: {
			type: String,
			default: "textarea-placeholder"
		},
		fixed: {
			type: Boolean,
			default: !1
		},
		keyboardAppearance: {
			type: String,
			default: "default"
		},
		confirm: {
			type: Boolean,
			default: !0
		},
		autoFill: {
			type: String,
			default: ""
		}
	},
	emits: ["update:value"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = J(() => ({
			color: (() => {
				if (typeof n.placeholderStyle == "string") {
					let e = n.placeholderStyle.match(/color:([^;]+)/);
					if (e) return e[1].trim();
				} else if (n.placeholderStyle && typeof n.placeholderStyle == "object" && Object.prototype.hasOwnProperty.call(n.placeholderStyle, "color")) return n.placeholderStyle.color;
				return "rgba(0,0,0,.3)";
			})(),
			fontSize: (() => {
				let e;
				if (typeof n.placeholderStyle == "string") {
					let t = n.placeholderStyle.match(/font-size:([^;]+)/);
					t && (e = t[1].trim());
				} else n.placeholderStyle && typeof n.placeholderStyle == "object" && Object.prototype.hasOwnProperty.call(n.placeholderStyle, "font-size") && (e = n.placeholderStyle["font-size"]);
				return e ? Qc(e) : "inherit";
			})(),
			fontWeight: (() => {
				if (typeof n.placeholderStyle == "string") {
					let e = n.placeholderStyle.match(/font-weight:([^;]+)/);
					if (e) return e[1].trim();
				} else if (n.placeholderStyle && typeof n.placeholderStyle == "object" && Object.prototype.hasOwnProperty.call(n.placeholderStyle, "font-weight")) return n.placeholderStyle["font-weight"];
				return "inherit";
			})()
		})), a = V("collectFormValue", void 0), o = V("registerFormControl", void 0);
		a?.(n.name, n.value);
		let s = /* @__PURE__ */ z(null), c = /* @__PURE__ */ z(null), l = /* @__PURE__ */ z(n.value), u = o?.({
			getName: () => n.name,
			getValue: () => l.value,
			reset: () => {
				g(""), a?.(n.name, l.value);
			}
		});
		Qi(() => u?.());
		let d = J(() => l.value === void 0 || l.value === null || l.value === "" || typeof l.value == "string" && l.value.length === 0), f = { mounted: (e) => {
			(n.autoFocus || n.focus) && (e.focus(), p(e));
		} };
		function p(e = s.value) {
			if (!e?.setSelectionRange) return;
			let t = Number(n.cursor), r = t >= 0 ? t : Number(n.selectionStart), i = t >= 0 ? t : Number(n.selectionEnd);
			r >= 0 && e.setSelectionRange(r, i >= 0 ? i : r);
		}
		let m = !1, h = null;
		H([() => n.focus, () => n.value], ([e, t], [, n]) => {
			e && (s.value.focus(), p()), n !== t && g(t);
		});
		function g(e) {
			l.value !== e && (h = null), l.value = e;
		}
		let _ = /* @__PURE__ */ z(null), v = X(), y = /* @__PURE__ */ z(!1);
		li("keyboardAccessoryVisible", y), xd(v, y);
		function b(e) {
			c.value = e.keyCode, h = null, e.keyCode === 13 && !e.isComposing && !m && (n.confirmHold || e.target.blur(), Z("confirm", {
				event: e,
				info: v,
				detail: { value: e.target.value }
			}));
		}
		let x;
		function S(e) {
			let t = s.value;
			if (!t) return;
			let r = window.getComputedStyle(t), i = Number.parseFloat(r.fontSize) || 16, a = Number.parseFloat(r.lineHeight) || i * 1.2, o = Math.max(t.scrollHeight, a), c = Math.max(Math.floor(o / a), 1);
			n.autoHeight && (_.value.style.height = `${o}px`), !m && c !== x && (x = c, Z("linechange", {
				event: e,
				info: v,
				detail: {
					height: o,
					heightRpx: o * 750 / Math.max(window.innerWidth, 1),
					lineCount: c
				}
			}));
		}
		Yi(() => Jr(() => S())), H(() => [n.value, n.autoHeight], () => Jr(() => S()));
		function C(e) {
			if (e.target.tagName.toLowerCase() !== "textarea") return;
			let t = e.target.value;
			switch (e.type) {
				case "compositionstart":
					m = !0, h = null;
					break;
				case "compositionend":
					m = !1, h = t, T(e), S(e);
					break;
				case "input":
					if (m && e.isComposing === !1 && (m = !1), m) {
						a?.(n.name, t), l.value = t, S(e);
						break;
					}
					if (w(t)) break;
					T(e), S(e);
					break;
				case "focusin":
					if (y.value = !0, p(e.target), Z("focus", {
						event: e,
						info: v,
						detail: { value: t }
					}), !Jc && n.adjustPosition) {
						let e = _.value;
						if (!e) return;
						let t = Hl(e);
						yl("adjustPosition", {
							bridgeId: v.bridgeId,
							params: { bottom: t }
						});
					}
					break;
				case "focusout":
					m = !1, h = null, y.value = !1, Z("blur", {
						event: e,
						info: v,
						detail: {
							value: t,
							cursor: e.target.selectionEnd
						}
					});
					break;
				case "change": Z("change", {
					event: e,
					info: v,
					detail: { value: t }
				});
			}
		}
		function w(e) {
			if (h === null) return !1;
			let t = e === h;
			return h = null, t;
		}
		function T(e) {
			let t = e.target.value;
			a?.(n.name, t), l.value = t, r("update:value", t), Z("input", {
				event: e,
				info: v,
				detail: {
					value: t,
					cursor: e.target.selectionEnd,
					keyCode: c.value
				},
				success: (e) => {
					let t = e.value ?? e;
					g(t), r("update:value", t);
				}
			});
		}
		let E = J(() => ({
			"dd-textarea-wrapper": !0,
			"dd-textarea-disabled": n.disabled
		}));
		return (t, n) => (W(), G("div", q({
			ref_key: "wrapperRef",
			ref: _
		}, t.$attrs, {
			class: B(E),
			role: "textbox",
			onInput: C,
			onFocusin: C,
			onFocusout: C,
			onChange: C,
			onCompositionstart: C,
			onCompositionend: C
		}), [
			si(K("textarea", {
				id: e.id,
				ref_key: "textareaRef",
				ref: s,
				class: "dd-textarea",
				value: B(l),
				disabled: e.disabled,
				maxlength: e.maxlength,
				autocomplete: e.autoFill || void 0,
				onKeydown: b
			}, null, 40, sh), [[f]]),
			si(K("div", {
				class: Vt(["dd-textarea-placeholder", e.placeholderClass]),
				style: It(B(i))
			}, Xt(e.placeholder), 7), [[Js, B(d)]]),
			U(t.$slots, "default")
		], 16));
	}
}, lh = /* @__PURE__ */ Y({ default: () => uh }), uh = Q(ch), dh = ["id", "data-dimina-native-id"], fh = ["id"], ph = ["id"], mh = [
	"id",
	"src",
	"controls",
	"autoplay",
	"loop",
	"muted",
	"poster",
	"referrerpolicy"
], hh = "native/video", gh = {
	__name: "Video",
	props: {
		id: {
			type: String,
			default: () => `video-${Math.random().toString(36).slice(2, 10)}`
		},
		src: {
			type: String,
			default: ""
		},
		duration: {
			type: Number,
			default: 0
		},
		controls: {
			type: Boolean,
			required: !1,
			default: !0
		},
		autoplay: {
			type: Boolean,
			default: !1
		},
		loop: {
			type: Boolean,
			default: !1
		},
		muted: {
			type: Boolean,
			default: !1
		},
		initialTime: {
			type: Number,
			default: 0
		},
		objectFit: {
			type: String,
			default: "contain"
		},
		poster: {
			type: String,
			default: ""
		},
		pageGesture: {
			type: Boolean,
			default: !1
		},
		direction: {
			type: [Number, String],
			default: -1
		},
		showProgress: {
			type: Boolean,
			default: !0
		},
		showFullscreenBtn: {
			type: Boolean,
			default: !0
		},
		showPlayBtn: {
			type: Boolean,
			default: !0
		},
		showCenterPlayBtn: {
			type: Boolean,
			default: !0
		},
		enableProgressGesture: {
			type: Boolean,
			default: !0
		},
		showMuteBtn: {
			type: Boolean,
			default: !1
		},
		title: {
			type: String,
			default: ""
		},
		playBtnPosition: {
			type: String,
			default: "bottom"
		},
		enablePlayGesture: {
			type: Boolean,
			default: !1
		},
		autoPauseIfNavigate: {
			type: Boolean,
			default: !0
		},
		autoPauseIfOpenNative: {
			type: Boolean,
			default: !0
		},
		vslideGesture: {
			type: Boolean,
			default: !1
		},
		vslideGestureInFullscreen: {
			type: Boolean,
			default: !0
		},
		adUnitId: {
			type: String,
			default: ""
		},
		unitId: {
			type: String,
			default: ""
		},
		adPlayTime: {
			type: Number,
			default: 0
		},
		danmuBtn: {
			type: Boolean,
			default: !1
		},
		enableDanmu: {
			type: Boolean,
			default: !1
		},
		danmuList: {
			type: Array,
			default: () => []
		},
		live: {
			type: [Number, Boolean],
			default: !1
		},
		customCache: {
			type: Boolean,
			default: !0
		},
		blockSize: {
			type: Number,
			default: 0
		},
		posterForCrawler: {
			type: String,
			default: ""
		},
		showLiveBtn: {
			type: Boolean,
			default: !0
		},
		showBottomProgress: {
			type: Boolean,
			default: !0
		},
		showCenterProgressDuration: {
			type: Boolean,
			default: !1
		},
		showVolumeBtn: {
			type: Boolean,
			default: !1
		},
		showCastingButton: {
			type: Boolean,
			default: !1
		},
		seekType: {
			type: String,
			default: "accurate"
		},
		pictureInPictureMode: {
			type: [Array, String],
			default: ""
		},
		pictureInPictureShowProgress: {
			type: Boolean,
			default: !1
		},
		enableAutoRotation: {
			type: Boolean,
			default: !1
		},
		showScreenLockButton: {
			type: Boolean,
			default: !1
		},
		showSnapshotButton: {
			type: Boolean,
			default: !1
		},
		showBackgroundPlaybackButton: {
			type: Boolean,
			default: !1
		},
		backgroundPoster: {
			type: String,
			default: ""
		},
		referrerPolicy: {
			type: String,
			default: "no-referrer"
		},
		isDrm: {
			type: Boolean,
			default: !1
		},
		provisionUrl: {
			type: String,
			default: ""
		},
		certificateUrl: {
			type: String,
			default: ""
		},
		licenseUrl: {
			type: String,
			default: ""
		},
		preferredPeakBitRate: {
			type: Number,
			default: -1
		}
	},
	setup(e) {
		let t = e, n = /* @__PURE__ */ z(), r = X(), i = J(() => Gc || Kc || qc), a = 0, o = "", s = [], c, l = !1;
		function u() {
			let e = n.value;
			if (!e) return {};
			let t = e.getBoundingClientRect();
			return {
				left: t.left,
				top: t.top,
				width: t.width,
				height: t.height,
				pageLeft: t.left + window.scrollX,
				pageTop: t.top + window.scrollY,
				scrollX: window.scrollX,
				scrollY: window.scrollY,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight
			};
		}
		function d() {
			return {
				type: hh,
				id: t.id,
				src: t.src,
				duration: t.duration,
				controls: t.controls,
				autoplay: t.autoplay,
				loop: t.loop,
				muted: t.muted,
				initialTime: t.initialTime,
				objectFit: t.objectFit,
				poster: t.poster,
				pageGesture: t.pageGesture,
				direction: t.direction,
				showProgress: t.showProgress,
				showFullscreenBtn: t.showFullscreenBtn,
				showPlayBtn: t.showPlayBtn,
				showCenterPlayBtn: t.showCenterPlayBtn,
				enableProgressGesture: t.enableProgressGesture,
				showMuteBtn: t.showMuteBtn,
				title: t.title,
				playBtnPosition: t.playBtnPosition,
				enablePlayGesture: t.enablePlayGesture,
				autoPauseIfNavigate: t.autoPauseIfNavigate,
				autoPauseIfOpenNative: t.autoPauseIfOpenNative,
				vslideGesture: t.vslideGesture,
				vslideGestureInFullscreen: t.vslideGestureInFullscreen,
				adUnitId: t.adUnitId,
				unitId: t.unitId,
				adPlayTime: t.adPlayTime,
				danmuBtn: t.danmuBtn,
				enableDanmu: t.enableDanmu,
				danmuList: t.danmuList,
				live: t.live,
				customCache: t.customCache,
				blockSize: t.blockSize,
				posterForCrawler: t.posterForCrawler,
				showLiveBtn: t.showLiveBtn,
				showBottomProgress: t.showBottomProgress,
				showCenterProgressDuration: t.showCenterProgressDuration,
				showVolumeBtn: t.showVolumeBtn,
				showCastingButton: t.showCastingButton,
				seekType: t.seekType,
				pictureInPictureMode: t.pictureInPictureMode,
				pictureInPictureShowProgress: t.pictureInPictureShowProgress,
				enableAutoRotation: t.enableAutoRotation,
				showScreenLockButton: t.showScreenLockButton,
				showSnapshotButton: t.showSnapshotButton,
				showBackgroundPlaybackButton: t.showBackgroundPlaybackButton,
				backgroundPoster: t.backgroundPoster,
				referrerPolicy: t.referrerPolicy,
				isDrm: t.isDrm,
				provisionUrl: t.provisionUrl,
				certificateUrl: t.certificateUrl,
				licenseUrl: t.licenseUrl,
				preferredPeakBitRate: t.preferredPeakBitRate,
				hidden: n.value?.hasAttribute("hidden") || !1,
				rect: u()
			};
		}
		function f(e) {
			i.value && (e !== "propsUpdate" || l) && yl(e, {
				bridgeId: r.bridgeId,
				params: d()
			});
		}
		function p(e = !1) {
			let t = JSON.stringify({
				...u(),
				hidden: n.value?.hasAttribute("hidden") || !1
			});
			(e || t !== o) && (o = t, f("propsUpdate"));
		}
		function m() {
			a ||= requestAnimationFrame(() => {
				a = 0, p();
			});
		}
		function h(e, n, i = (e) => e) {
			let a = xl(e, (e) => {
				e.id === t.id && Z(n, {
					type: n,
					info: r,
					detail: i(e)
				});
			});
			s.push(a);
		}
		function g(e) {
			let i = n.value;
			if (i && e.id === t.id) switch (e.command) {
				case "play":
					i.play()?.catch((e) => {
						Z("error", {
							info: r,
							detail: { errMsg: e?.message || "video play failed" }
						});
					});
					break;
				case "pause":
					i.pause();
					break;
				case "stop":
					i.pause(), i.currentTime = 0;
					break;
				case "seek":
					i.currentTime = Number(e.position) || 0;
					break;
				case "playbackRate":
					i.playbackRate = Number(e.rate) || 1;
					break;
				case "requestFullScreen":
					i.requestFullscreen?.() || i.webkitRequestFullscreen?.();
					break;
				case "exitFullScreen":
					document.exitFullscreen?.() || document.webkitExitFullscreen?.();
					break;
				case "exitPictureInPicture": document.pictureInPictureElement && document.exitPictureInPicture?.();
			}
		}
		function _() {
			let e = xl("videoContext", (e) => {
				if (e.id === t.id) {
					if (i.value) {
						yl("videoContext", {
							bridgeId: r.bridgeId,
							params: e
						});
						return;
					}
					g(e);
				}
			});
			s.push(e);
		}
		function v(e, t, n = {}) {
			Z(e, {
				event: t,
				info: r,
				detail: n
			});
		}
		function y(e) {
			let n = e.target;
			t.initialTime > 0 && Number.isFinite(n.duration) && (n.currentTime = Math.min(t.initialTime, n.duration)), v("loadedmetadata", e, { duration: n.duration || 0 });
		}
		function b(e) {
			let t = e.target, n = t.buffered;
			v("progress", e, {
				buffered: n?.length ? n.end(n.length - 1) : 0,
				duration: t.duration || 0
			});
		}
		return Yi(() => {
			_(), i.value && (Gc && Eu(), h("bindplay", "play"), h("bindpause", "pause"), h("bindended", "ended"), h("bindwaiting", "waiting"), h("binderror", "error"), h("bindloadeddata", "loadeddata"), h("bindloadstart", "loadstart"), h("bindloadedmetadata", "loadedmetadata"), h("bindfullscreenchange", "fullscreenchange"), h("bindprogress", "progress"), h("bindseeking", "seeking"), h("bindseeked", "seeked"), h("bindcontrolstoggle", "controlstoggle"), h("bindenterpictureinpicture", "enterpictureinpicture"), h("bindleavepictureinpicture", "leavepictureinpicture"), h("bindpreloadedmetadata", "preloadedmetadata"), h("bindrendererror", "rendererror"), h("bindseekcomplete", "seekcomplete"), h("bindinsertweblayerfailed", "insertweblayerfailed"), h("bindinsertweblayersuccess", "insertweblayersuccess"), h("bindtimeupdate", "timeupdate", (e) => ({
				currentTime: e.currentTime,
				duration: e.duration
			})), Jr(() => {
				l = !0, f("componentMount"), o = JSON.stringify({
					...u(),
					hidden: n.value?.hasAttribute("hidden") || !1
				}), window.addEventListener("resize", m), window.addEventListener("scroll", m, !0), window.ResizeObserver && n.value && (c = new ResizeObserver(m), c.observe(n.value));
			}));
		}), H(() => d(), () => f("propsUpdate"), { deep: !0 }), Qi(() => {
			a && cancelAnimationFrame(a), c?.disconnect(), window.removeEventListener("resize", m), window.removeEventListener("scroll", m, !0), f("componentUnmount"), l = !1, s.splice(0).forEach((e) => e());
		}), (t, r) => B(Gc) ? (W(), G("embed", q({
			key: 0,
			id: e.id,
			ref_key: "rootRef",
			ref: n,
			width: "300",
			height: "225"
		}, t.$attrs, {
			class: "dd-video",
			"data-dimina-native-type": "native/video",
			"data-dimina-native-id": e.id,
			type: "application/view",
			comp_type: hh
		}), null, 16, dh)) : B(Kc) ? (W(), G("div", q({
			key: 1,
			id: e.id,
			ref_key: "rootRef",
			ref: n
		}, t.$attrs, { class: "dd-video" }), [...r[13] ||= [K("div", { class: "dd-video-container" }, [K("div", { style: {
			width: "101%",
			height: "101%"
		} })], -1)]], 16, fh)) : B(qc) ? (W(), G("embed", q({
			key: 2,
			id: e.id,
			ref_key: "rootRef",
			ref: n
		}, t.$attrs, {
			class: "dd-video",
			type: hh
		}), null, 16, ph)) : B(Jc) ? (W(), G("video", q({
			key: 3,
			id: e.id,
			ref_key: "rootRef",
			ref: n,
			width: "300",
			height: "225"
		}, t.$attrs, {
			class: "dd-video",
			src: e.src,
			controls: e.controls,
			autoplay: e.autoplay,
			loop: e.loop,
			muted: e.muted,
			poster: e.poster || e.posterForCrawler,
			referrerpolicy: e.referrerPolicy,
			playsinline: !0,
			"webkit-playsinline": !0,
			style: { objectFit: e.objectFit },
			onPlay: r[0] ||= (e) => v("play", e),
			onPause: r[1] ||= (e) => v("pause", e),
			onEnded: r[2] ||= (e) => v("ended", e),
			onWaiting: r[3] ||= (e) => v("waiting", e),
			onError: r[4] ||= (e) => v("error", e, { errMsg: e.target?.error?.message || "video error" }),
			onLoadstart: r[5] ||= (e) => v("loadstart", e),
			onLoadeddata: r[6] ||= (e) => v("loadeddata", e),
			onLoadedmetadata: y,
			onProgress: b,
			onSeeking: r[7] ||= (e) => v("seeking", e, { currentTime: e.target?.currentTime || 0 }),
			onSeeked: r[8] ||= (e) => v("seeked", e, { currentTime: e.target?.currentTime || 0 }),
			onFullscreenchange: r[9] ||= (n) => v("fullscreenchange", n, {
				fullScreen: !!t.document.fullscreenElement,
				direction: e.direction
			}),
			onEnterpictureinpicture: r[10] ||= (e) => v("enterpictureinpicture", e),
			onLeavepictureinpicture: r[11] ||= (e) => v("leavepictureinpicture", e),
			onTimeupdate: r[12] ||= (e) => v("timeupdate", e, {
				currentTime: e.target?.currentTime || 0,
				duration: e.target?.duration || 0
			})
		}), null, 16, mh)) : (W(), G("div", q({ key: 4 }, t.$attrs, { class: "dd-video dd-video-placeholder" }), " 未实现组件 ", 16));
	}
}, _h = /* @__PURE__ */ Y({ default: () => vh }), vh = Q(gh), yh = /* @__PURE__ */ Y({ default: () => bh }), bh = Q(cd), xh = ["id", "src"], Sh = ["id", "data-dimina-native-id"], Ch = "$1�$2", wh = "native/webview", Th = {
	__name: "WebView",
	props: {
		id: {
			type: String,
			default: () => `webview-${Pi()}`
		},
		src: {
			type: String,
			default: ""
		}
	},
	setup(e) {
		let t = e, n = /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x7E]|%(?:[^0-9A-F]|[0-9A-F][^0-9A-F]|$))+/gi, r = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g, i = /* @__PURE__ */ z(), a = J(() => t.src.replace(r, Ch).replace(n, encodeURI)), o = X(), s = [], c = 0, l = "", u, d = !1;
		function f() {
			let e = i.value;
			if (!e) return {};
			let t = e.getBoundingClientRect();
			return {
				left: t.left,
				top: t.top,
				width: t.width,
				height: t.height,
				pageLeft: t.left + window.scrollX,
				pageTop: t.top + window.scrollY,
				scrollX: window.scrollX,
				scrollY: window.scrollY,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight
			};
		}
		function p() {
			let e = {};
			for (let t in o.attrs) (t.startsWith("bind") || t.startsWith("catch")) && (e[t.replace(/^(?:bind:|bind|catch:|catch)/, "")] = o.attrs[t]);
			return e;
		}
		function m() {
			return {
				type: wh,
				url: a.value,
				src: a.value,
				id: t.id,
				bridgeId: o.bridgeId,
				hidden: i.value?.hasAttribute("hidden") || !1,
				rect: f(),
				attributes: {
					moduleId: o.moduleId,
					attrs: p(),
					src: a.value,
					javascript: "\n				function handleSdkFn(){\n					window.__wxjs_environment = 'miniprogram';\n					var sdk = document.createElement('script');\n					sdk.onload = function(){ window.dispatchEvent(new Event('didiJsBridgeLoaded')); };\n					sdk.src = 'https://dpubstatic.udache.com/static/dpubimg/UBi0mvYdYcbwXv5qZ9ANw_jdimina_next.js?' + Date.now();\n					document.getElementsByTagName('html')[0].appendChild(sdk);\n				}\n				handleSdkFn();"
				}
			};
		}
		function h(e) {
			Jc || (e !== "propsUpdate" || d) && yl(e, {
				bridgeId: o.bridgeId,
				params: m()
			});
		}
		function g(e = !1) {
			let t = JSON.stringify({
				...f(),
				hidden: i.value?.hasAttribute("hidden") || !1
			});
			(e || t !== l) && (l = t, h("propsUpdate"));
		}
		function _() {
			c ||= requestAnimationFrame(() => {
				c = 0, g();
			});
		}
		function v(e, n, r = (e) => e) {
			let i = xl(e, (e) => {
				(e.id === void 0 || e.id === t.id || e.webviewId === t.id) && Z(n, {
					type: n,
					info: o,
					detail: r(e)
				});
			});
			s.push(i);
		}
		function y(e) {
			e.source === i.value?.contentWindow && Z("message", {
				type: "message",
				info: o,
				detail: { data: e.data }
			});
		}
		function b(e) {
			Z("load", {
				type: "load",
				event: e,
				info: o,
				detail: { src: a.value }
			});
		}
		function x(e) {
			Z("error", {
				type: "error",
				event: e,
				info: o,
				detail: {
					url: a.value,
					fullUrl: a.value
				}
			});
		}
		return Yi(() => {
			if (Jc) {
				window.addEventListener("message", y);
				return;
			}
			v("bindmessage", "message", (e) => ({ data: e.data })), v("bindload", "load", (e) => ({
				src: e.src || e.url,
				id: e.id
			})), v("binderror", "error", (e) => ({
				url: e.url,
				fullUrl: e.fullUrl,
				id: e.id
			})), Gc && Eu(), d = !0, h("componentMount"), l = JSON.stringify({
				...f(),
				hidden: i.value?.hasAttribute("hidden") || !1
			}), window.addEventListener("resize", _), window.addEventListener("scroll", _, !0), window.ResizeObserver && i.value && (u = new ResizeObserver(_), u.observe(i.value));
		}), H(() => [t.id, a.value], () => h("propsUpdate")), Qi(() => {
			window.removeEventListener("message", y), c && cancelAnimationFrame(c), u?.disconnect(), window.removeEventListener("resize", _), window.removeEventListener("scroll", _, !0), h("componentUnmount"), d = !1, s.splice(0).forEach((e) => e());
		}), (t, n) => B(Jc) ? (W(), G("iframe", q({
			key: 0,
			id: e.id,
			ref_key: "rootRef",
			ref: i
		}, t.$attrs, {
			class: "dd-web-view dd-web-view-pc",
			src: B(a),
			onLoad: b,
			onError: x
		}), null, 16, xh)) : (W(), G("embed", q({
			key: 1,
			id: e.id,
			ref_key: "rootRef",
			ref: i
		}, t.$attrs, {
			class: "dd-web-view",
			type: wh,
			"data-dimina-native-id": e.id,
			"data-dimina-native-type": wh
		}), null, 16, Sh));
	}
}, Eh = /* @__PURE__ */ Y({ default: () => Dh }), Dh = Q(Th), Oh = Object.values(/* @__PURE__ */ Object.assign({
	"./component/block/index.js": Jl,
	"./component/button/index.js": au,
	"./component/camera/index.js": Pu,
	"./component/canvas/index.js": Vu,
	"./component/checkbox/index.js": Ku,
	"./component/checkbox-group/index.js": Xu,
	"./component/component-host/index.js": $u,
	"./component/cover-image/index.js": id,
	"./component/cover-view/index.js": ud,
	"./component/form/index.js": pd,
	"./component/icon/index.js": _d,
	"./component/image/index.js": yd,
	"./component/input/index.js": wd,
	"./component/keyboard-accessory/index.js": Dd,
	"./component/label/index.js": jd,
	"./component/map/index.js": Vd,
	"./component/movable-area/index.js": Wd,
	"./component/movable-view/index.js": qd,
	"./component/navigation-bar/index.js": Xd,
	"./component/navigator/index.js": ef,
	"./component/open-data/index.js": af,
	"./component/page-meta/index.js": cf,
	"./component/picker/index.js": xf,
	"./component/picker-view/index.js": wf,
	"./component/picker-view-column/index.js": Of,
	"./component/progress/index.js": Pf,
	"./component/radio/index.js": zf,
	"./component/radio-group/index.js": Uf,
	"./component/rich-text/index.js": Tm,
	"./component/root-portal/index.js": Om,
	"./component/scroll-view/index.js": jm,
	"./component/slider/index.js": zm,
	"./component/swiper/index.js": Wm,
	"./component/swiper-item/index.js": Jm,
	"./component/switch/index.js": $m,
	"./component/template/index.js": nh,
	"./component/text/index.js": ah,
	"./component/textarea/index.js": lh,
	"./component/video/index.js": _h,
	"./component/view/index.js": yh,
	"./component/web-view/index.js": Eh
})).map((e) => e.default), kh = "data-dd-external-class-scope", Ah = { "component-host": ["dd-wrapper"] };
function jh(e, t) {
	if (!t?.actions?.length) return;
	let n = 0, r = t.actions;
	function i() {
		if (n >= r.length) return;
		let t = r[n], a = nl(t), o = e.animate(a.keyframes, a.options);
		o.onfinish = () => {
			n++, i();
		};
	}
	i();
}
var Mh = /* @__PURE__ */ new WeakMap();
function Nh(e) {
	return new Map(Array.from(e, (t) => [t, {
		priority: e.getPropertyPriority(t),
		value: e.getPropertyValue(t)
	}]));
}
function Ph(e) {
	let t = Mh.get(e);
	if (t) {
		for (let n of t.keys()) e.style.removeProperty(n);
		for (let [n, r] of t) r && e.style.setProperty(n, r.value, r.priority);
		Mh.delete(e);
	}
}
function Fh(e, t) {
	let n = Qc(t);
	if (typeof n != "string" || !n.trim()) return;
	let r = Nh(e.style);
	e.style.cssText += n;
	let i = Nh(e.style), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set([...r.keys(), ...i.keys()]);
	for (let e of o) {
		let t = r.get(e), n = i.get(e);
		(t?.value !== n?.value || t?.priority !== n?.priority) && a.set(e, t || null);
	}
	a.size && Mh.set(e, a);
}
function Ih(e, t) {
	e._ds = Uc(t.ctx.attrs, Gl);
}
function Lh(e, t, n) {
	let r = n.ctx;
	if (t.props && Array.isArray(r.provides.externalClasses)) for (let n of r.provides.externalClasses) {
		let r = t.props[Vc(n)];
		if (r) {
			e.className = Kl(e.className, n, r), e.hasAttribute(t.sId) || e.setAttribute(t.sId, "");
			let i = new Set((e.getAttribute(kh) || "").split(/\s+/).filter(Boolean));
			i.add(t.sId), e.setAttribute(kh, [...i].join(" "));
		}
	}
}
function Rh(e = {}) {
	let t = {};
	for (let [n, r] of Object.entries(e || {})) {
		let e = n.match(/^(capture-)?(bind|catch)(?::)?(.+)$/);
		if (!e || r == null || r === "") continue;
		let [, i, a, o] = e, s = i ? a === "catch" ? "captureCatch" : "captureBind" : a;
		t[o] = t[o] || {}, t[o][s] = r;
	}
	return t;
}
function zh(e, t, n) {
	let r = n.component?.proxy;
	return e._ddEventBindings?.find((e) => e.owner === t.instance && e.target === r && e.nodeType === t.value);
}
function Bh(e, t, n) {
	let r = {
		owner: t.instance,
		target: n.component?.proxy,
		nodeType: t.value,
		eventAttr: Rh(n.props)
	};
	e._ddEventBindings = e._ddEventBindings || [], e._ddEventBindings.push(r);
}
function Vh(e, t, n) {
	let r = zh(e, t, n);
	r && (r.eventAttr = Rh(n.props));
}
function Hh(e, t, n) {
	let r = zh(e, t, n);
	if (!r) return;
	let i = e._ddEventBindings.indexOf(r);
	i >= 0 && e._ddEventBindings.splice(i, 1);
}
var Uh = /* @__PURE__ */ new WeakMap();
function Wh(e) {
	let t = e.ctx?.provides, n = t?.path, r = n ? t[n]?.id : void 0;
	return t?.bridgeId === void 0 || r === void 0 ? null : {
		attrs: e.props || {},
		bridgeId: t.bridgeId,
		moduleId: r
	};
}
function Gh(e = {}) {
	let t = e["disable-scroll"] ?? e.disableScroll;
	return t != null && t !== !1 && t !== "false";
}
function Kh(e = {}) {
	return [...[
		"touchstart",
		"touchmove",
		"touchend",
		"touchcancel"
	].map((t) => !!(e[`catch${t}`] || e[`catch:${t}`])), Gh(e)].join(":");
}
function qh(e, t) {
	if (e.tagName !== "CANVAS" || e.__ddGestureDetach) return;
	let n = Wh(t);
	if (!n || !Tl(n) && !Gh(n.attrs)) return;
	let r = Vl(n, e, {
		disableScroll: () => Gh(n.attrs),
		getRelativeElement: () => e
	});
	Uh.set(e, {
		detach: r,
		info: n,
		gestureSignature: Kh(n.attrs),
		latestVNode: t
	});
}
function Jh(e, t) {
	t.pendingSwap || (t.pendingSwap = !0, t.detach({
		preserveActive: !0,
		onDetached: () => {
			Uh.get(e) === t && (Uh.delete(e), qh(e, t.latestVNode));
		}
	}));
}
function Yh(e, t) {
	let n = Uh.get(e), r = t.props || {};
	if (n && e.__ddGestureDetach !== n.detach) {
		Uh.delete(e);
		return;
	}
	if (!n) {
		qh(e, t);
		return;
	}
	if (n.latestVNode = t, !Tl({ attrs: r }) && !Gh(r)) {
		Jh(e, n);
		return;
	}
	if (n.gestureSignature !== Kh(r)) {
		Jh(e, n);
		return;
	}
	n.info.attrs = r;
}
function Xh(e) {
	let t = Uh.get(e);
	t && (t.detach({
		preserveActive: !0,
		nodeRemoved: !0
	}), Uh.delete(e));
}
function Zh(e) {
	return e.directive("c-style", {
		mounted(e, t) {
			Fh(e, t.value);
		},
		beforeUpdate(e) {
			Ph(e);
		},
		updated(e, t) {
			Fh(e, t.value);
		}
	}), e.directive("c-animation", {
		mounted(e, t) {
			jh(e, t.value);
		},
		updated(e, t) {
			jh(e, t.value);
		}
	}), e.directive("c-data", {
		mounted(e, t, n) {
			Ih(e, n);
		},
		updated(e, t, n) {
			Ih(e, n);
		}
	}), e.directive("c-class", {
		mounted(e, t, n) {
			Lh(e, t.instance, n);
		},
		updated(e, t, n) {
			Lh(e, t.instance, n);
		}
	}), e.directive("c-prop-bindings", { mounted(e, t) {
		e._propBindings = t.value || {};
	} }), e.directive("c-event-node", {
		mounted(e, t, n) {
			Bh(e, t, n), qh(e, n);
		},
		updated(e, t, n) {
			Vh(e, t, n), Yh(e, n);
		},
		beforeUnmount(e, t, n) {
			Hh(e, t, n), Xh(e);
		}
	}), Oh.forEach((t) => {
		t.mixins = [{ inheritAttrs: !1 }], Wl(e, t);
		for (let n of Ah[t.__tagName] || []) e.component(n, t);
	});
}
Oh.map((e) => e.__tagName);
var Qh = fe, $h = de;
function eg(e, t) {
	let n = Number(e);
	return Number.isFinite(n) && n > 0 ? n : t;
}
function tg({ destHeight: e, destWidth: t, fallbackHeight: n, fallbackWidth: r, pixelRatio: i }) {
	let a = eg(i, 1), o = Math.trunc(eg(t, r * a)), s = Math.trunc(eg(e, n * a));
	if (!Number.isSafeInteger(o) || !Number.isSafeInteger(s) || o <= 0 || s <= 0) throw Error("destination size is invalid");
	if (o > $h || s > $h || o * s > Qh) throw Error("destination size exceeds the maximum exportable image");
	return {
		height: s,
		width: o
	};
}
function ng(e, t) {
	Array.isArray(t) ? e.push(...t) : t != null && e.push(t);
}
function rg(e) {
	return e.key ? (...t) => {
		let n = e.fn(...t);
		return n && (n.key = e.key), n;
	} : e.fn;
}
function ig(e, t) {
	return (...n) => {
		let r = e(...n), i = t(...n), a = [];
		ng(a, r), ng(a, i);
		let o = i?.key ?? r?.key;
		return o !== void 0 && (a.key = o), a;
	};
}
function ag(e, t) {
	let n = (t) => {
		if (!t) return;
		let n = rg(t), r = e[t.name];
		e[t.name] = r ? ig(r, n) : n;
	};
	for (let e of t || []) Array.isArray(e) ? e.forEach(n) : n(e);
	return e;
}
var og = "data-dd-component-host", sg = "data-dd-style-isolation", cg = "data-dd-style-host", lg = "diminaWxmlStyle";
function ug() {
	let e = /* @__PURE__ */ pr({});
	return {
		data: e,
		templateData: new Proxy(e, { getOwnPropertyDescriptor(e, t) {
			return Reflect.getOwnPropertyDescriptor(e, t) || (typeof t == "string" && !t.startsWith("$") && !t.startsWith("_") ? {
				configurable: !0,
				enumerable: !1,
				value: void 0
			} : void 0);
		} })
	};
}
function dg(e) {
	return e === "shared" ? "shared" : e === "apply-shared" ? "apply-shared" : "isolated";
}
function fg(e) {
	return e === "apply-shared" || e === "shared";
}
function pg(e, t, n) {
	return !e || typeof e != "object" ? e : ss(e, {
		[og]: "",
		[sg]: t,
		[cg]: n
	});
}
function mg(e, t) {
	let n = new Set((e.getAttribute(cg) || "").split(/\s+/).filter(Boolean));
	n.add(t), e.setAttribute(cg, [...n].join(" "));
}
function hg(e = {}) {
	let t = {};
	for (let [n, r] of Object.entries(e)) {
		let e = n.match(/^(capture-)?(bind|catch)(?::)?(.+)$/);
		if (!e || r == null || r === "") continue;
		let [, i, a, o] = e, s = i ? a === "catch" ? "captureCatch" : "captureBind" : a;
		t[o] = t[o] || {}, t[o][s] = r;
	}
	return t;
}
function gg(e = []) {
	let t = [...e], n = [];
	for (; t.length > 0;) {
		let e = t.findIndex((e) => !t.some((t) => t !== e && t.owner === e.target));
		n.push(...t.splice(e >= 0 ? e : 0, 1));
	}
	return n;
}
function _g(e) {
	return e?.nodeType === 1 && typeof e.setAttribute == "function";
}
function vg(e, t, n, r) {
	if (!_g(e)) return;
	let i = (e, n) => {
		let a = e.hasAttribute(og), o = a && fg(dg(e.getAttribute(sg))), s = r && e.hasAttribute(r), c = n || o || s;
		if (c) for (let n of t) e.setAttribute(n, "");
		let l = a ? o : c;
		for (let t of e.children) i(t, l);
	};
	i(e, n);
}
function yg(e, t, n) {
	let r = e.parentElement;
	for (; r;) {
		if (r.hasAttribute(og)) return fg(dg(r.getAttribute(sg)));
		if (n && r.hasAttribute(n) || r === t) return !0;
		r = r.parentElement;
	}
	return !1;
}
function bg(e, t, n) {
	if (!_g(e) || t.length === 0) return null;
	vg(e, t, !0, n);
	let r = new MutationObserver((r) => {
		for (let i of r) for (let r of i.addedNodes) _g(r) && vg(r, t, yg(r, e, n), n);
	});
	return r.observe(e, {
		childList: !0,
		subtree: !0
	}), r;
}
function xg(e, t = []) {
	if (!e) return t;
	if (Array.isArray(e)) {
		for (let n of e) xg(n, t);
		return t;
	}
	return e.component?.subTree ? xg(e.component.subTree, t) : e.suspense?.activeBranch ? xg(e.suspense.activeBranch, t) : e.type === Uo ? xg(e.children, t) : (_g(e.el) && !t.includes(e.el) && t.push(e.el), t);
}
function Sg(e, t, n) {
	let r = [...new Set(t.filter(Boolean))], i = e.map((e) => bg(e, r, n)).filter(Boolean);
	return () => i.forEach((e) => e.disconnect());
}
function Cg(e) {
	let t = document.body?.classList.contains("dd-page") ? document.body : null;
	if (!t) return () => {};
	let n = [...new Set(e.filter(Boolean))].filter((e) => !t.hasAttribute(e) && (t.setAttribute(e, ""), !0));
	return () => {
		for (let e of n) t.removeAttribute(e);
	};
}
function wg(e, t) {
	if (!e) return !1;
	if (Object.prototype.hasOwnProperty.call(e, t)) return !0;
	let n = t.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`);
	return Object.prototype.hasOwnProperty.call(e, n);
}
function Tg(e, t) {
	if (e) return Object.prototype.hasOwnProperty.call(e, t) ? e[t] : e[t.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`)];
}
function Eg(e, t, n) {
	let r = { ...t };
	return e?.style && wg(n?.props, lg) && (r.style = Tg(n.props, lg)), delete r[lg], r;
}
function Dg(e, t, n) {
	let r = { ...t }, i = new Set(n?.dynamicProps || []);
	for (let [t, a] of Object.entries(e || {})) {
		if (a.type !== Boolean || r[t] !== "" || !wg(n?.props, t)) continue;
		let e = t.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`);
		!i.has(t) && !i.has(e) && (r[t] = !0);
	}
	return r;
}
var Og = {
	_Fragment: Uo,
	_createTextVNode: cs,
	_createVNode: is,
	_createBlock: $o,
	_createCommentVNode: ls,
	_createElementBlock: G,
	_createElementVNode: K,
	_createSlots: ag,
	_normalizeClass: Vt,
	_normalizeStyle: It,
	_openBlock: W,
	_renderList: fa,
	_renderSlot: U,
	_resolveComponent: oa,
	_resolveDirective: la,
	_resolveDynamicComponent: ca,
	_toDisplayString: Xt,
	_withCtx: oi,
	_withDirectives: si
}, kg = "dimina-canvas-node", Ag = [
	"closePath",
	"moveTo",
	"lineTo",
	"rect",
	"arc",
	"arcTo",
	"quadraticCurveTo",
	"bezierCurveTo"
], jg = new Set(Ag), Mg = /* @__PURE__ */ new Set([
	"beginPath",
	...Ag,
	"clearRect",
	"fillRect",
	"strokeRect",
	"fillText",
	"strokeText",
	"save",
	"restore",
	"translate",
	"rotate",
	"scale",
	"transform",
	"setTransform"
]), Ng = {
	setGlobalAlpha: "globalAlpha",
	setLineCap: "lineCap",
	setLineJoin: "lineJoin",
	setLineWidth: "lineWidth",
	setMiterLimit: "miterLimit",
	setTextAlign: "textAlign",
	setGlobalCompositeOperation: "globalCompositeOperation",
	setLineDashOffset: "lineDashOffset",
	setShadowBlur: "shadowBlur",
	setShadowColor: "shadowColor",
	setShadowOffsetX: "shadowOffsetX",
	setShadowOffsetY: "shadowOffsetY"
}, Pg = /\d+\.?\d*px/, Fg = {
	Int8Array,
	Uint8Array,
	Uint8ClampedArray,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	Float32Array,
	Float64Array
}, Ig = /* @__PURE__ */ "VERSION.SHADING_LANGUAGE_VERSION.VENDOR.RENDERER.MAX_VIEWPORT_DIMS.ALIASED_POINT_SIZE_RANGE.ALIASED_LINE_WIDTH_RANGE.COMPRESSED_TEXTURE_FORMATS.MAX_TEXTURE_SIZE.MAX_CUBE_MAP_TEXTURE_SIZE.MAX_RENDERBUFFER_SIZE.MAX_VERTEX_ATTRIBS.MAX_TEXTURE_IMAGE_UNITS.MAX_VERTEX_TEXTURE_IMAGE_UNITS.MAX_COMBINED_TEXTURE_IMAGE_UNITS.MAX_VERTEX_UNIFORM_VECTORS.MAX_FRAGMENT_UNIFORM_VECTORS.MAX_VARYING_VECTORS.RED_BITS.GREEN_BITS.BLUE_BITS.ALPHA_BITS.DEPTH_BITS.STENCIL_BITS.SUBPIXEL_BITS.SAMPLE_BUFFERS.SAMPLES.MAX_3D_TEXTURE_SIZE.MAX_ARRAY_TEXTURE_LAYERS.MAX_COLOR_ATTACHMENTS.MAX_DRAW_BUFFERS.MAX_ELEMENT_INDEX.MAX_ELEMENTS_INDICES.MAX_ELEMENTS_VERTICES.MAX_FRAGMENT_INPUT_COMPONENTS.MAX_SAMPLES.MAX_SERVER_WAIT_TIMEOUT.MAX_TEXTURE_LOD_BIAS.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS.MAX_UNIFORM_BLOCK_SIZE.MAX_UNIFORM_BUFFER_BINDINGS.MAX_VARYING_COMPONENTS.MAX_VERTEX_OUTPUT_COMPONENTS.UNIFORM_BUFFER_OFFSET_ALIGNMENT".split("."), Lg = [
	"LOW_FLOAT",
	"MEDIUM_FLOAT",
	"HIGH_FLOAT",
	"LOW_INT",
	"MEDIUM_INT",
	"HIGH_INT"
];
function Rg(e) {
	let t = {}, n = /* @__PURE__ */ new Set();
	for (let r = e; r && r !== Object.prototype; r = Object.getPrototypeOf(r)) for (let i of Object.getOwnPropertyNames(r)) if (!n.has(i) && /^[A-Z][A-Z0-9_]*$/.test(i)) {
		n.add(i);
		try {
			typeof e[i] == "number" && (t[i] = e[i]);
		} catch {}
	}
	return t;
}
function zg(e, t) {
	if (e == null || typeof e == "string" || typeof e == "number" || typeof e == "boolean") return e;
	let n = t?.(e);
	if (n) return { __canvasResourceId: n };
	if (ArrayBuffer.isView(e)) return {
		__canvasTypedArray: e.constructor.name,
		data: Array.from(e)
	};
	if (Array.isArray(e)) return e.map((e) => zg(e, t));
	if (typeof e == "object") {
		let n = {}, r = new Set(Object.keys(e));
		for (let t of [
			"alpha",
			"antialias",
			"depth",
			"desynchronized",
			"failIfMajorPerformanceCaveat",
			"powerPreference",
			"premultipliedAlpha",
			"preserveDrawingBuffer",
			"stencil",
			"name",
			"precision",
			"rangeMax",
			"rangeMin",
			"size",
			"type"
		]) t in e && r.add(t);
		for (let i of r) {
			let r = zg(e[i], t);
			r !== void 0 && (n[i] = r);
		}
		return n;
	}
}
function Bg(e, t = {}) {
	let n = [];
	for (let [r, i] of Object.entries(t)) {
		let t;
		try {
			t = e[r];
		} catch {
			continue;
		}
		(t === null || [
			"string",
			"number",
			"boolean"
		].includes(typeof t)) && n.push({
			prop: r,
			sequence: i,
			value: t
		});
	}
	return n;
}
function Vg(e, t = !0) {
	if (!e) return null;
	let n = Rg(e), r = {};
	for (let t of Ig) {
		let n = e[t];
		if (typeof n == "number") try {
			r[n] = zg(e.getParameter(n));
		} catch {}
	}
	let i = [];
	try {
		i = e.getSupportedExtensions?.() || [];
	} catch {}
	let a = {};
	for (let n of i) {
		if (!t) {
			a[n] = { constants: {} };
			continue;
		}
		try {
			let t = e.getExtension(n);
			a[n] = { constants: t ? Rg(t) : {} };
		} catch {
			a[n] = { constants: {} };
		}
	}
	let o = {};
	for (let t of ["VERTEX_SHADER", "FRAGMENT_SHADER"]) for (let n of Lg) {
		let r = e[t], i = e[n];
		if (typeof r == "number" && typeof i == "number") try {
			let t = e.getShaderPrecisionFormat(r, i);
			t && (o[`${r}:${i}`] = zg(t));
		} catch {}
	}
	let s = null;
	try {
		s = zg(e.getContextAttributes?.());
	} catch {}
	return {
		supported: !0,
		constants: n,
		parameters: r,
		contextAttributes: s,
		supportedExtensions: i,
		extensions: a,
		shaderPrecisionFormats: o,
		drawingBufferWidth: e.drawingBufferWidth,
		drawingBufferHeight: e.drawingBufferHeight,
		contextLost: !!e.isContextLost?.()
	};
}
function Hg() {
	let e = {};
	for (let t of ["webgl", "webgl2"]) {
		let n = document.createElement("canvas");
		n.width = 1, n.height = 1;
		let r = null;
		try {
			r = n.getContext(t), !r && t === "webgl" && (r = n.getContext("experimental-webgl"));
		} catch {}
		e[t] = r ? Vg(r) : { supported: !1 };
		try {
			r?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
		} catch {}
	}
	return e;
}
function Ug(e) {
	return e?.tagName?.toLowerCase() === "canvas";
}
function Wg(e) {
	if (Ug(e)) return e;
	let t = e?.[le];
	return Ug(t) && e.contains?.(t) ? t : null;
}
var Gg = class {
	constructor() {
		this.app = null, this.pageId = null, this.instance = /* @__PURE__ */ new Map(), this.pageRenderVersion = /* @__PURE__ */ z(0), this.hmrRemountQueues = /* @__PURE__ */ new Map(), this.moduleIds = /* @__PURE__ */ new WeakMap(), this.moduleRootIds = /* @__PURE__ */ new WeakMap(), this.setupData = /* @__PURE__ */ new Map(), this.initializedModules = /* @__PURE__ */ new Set(), this.preInitUpdates = /* @__PURE__ */ new Map(), this.intersectionObservers = /* @__PURE__ */ new Map(), this.mediaQueryObservers = /* @__PURE__ */ new Map(), this.componentAnimations = /* @__PURE__ */ new Map(), this.performanceObservers = /* @__PURE__ */ new Map(), this.canvasNodes = /* @__PURE__ */ new Map(), this.canvasResources = /* @__PURE__ */ new Map(), this.canvasRafIds = /* @__PURE__ */ new Map(), this.canvasCapabilities = null, this.resourceLoadIds = /* @__PURE__ */ new Map(), this._pageReRenderPending = !1, this.canvasDrawQueues = /* @__PURE__ */ new WeakMap(), this.canvasBatchFrames = /* @__PURE__ */ new WeakMap(), this.canvasScopeQueues = /* @__PURE__ */ new Map(), this.canvasImageTimeout = 1e4, this._pendingSetups = /* @__PURE__ */ new Map(), this._instanceWaiters = /* @__PURE__ */ new Map(), this.handleBeforeUnload = this.handleBeforeUnload.bind(this), this.installVueRuntimeHelpers(), window.addEventListener("beforeunload", this.handleBeforeUnload);
	}
	installVueRuntimeHelpers(e = window) {
		Object.assign(e, Og);
	}
	handleBeforeUnload() {
		if (this.intersectionObservers.size > 0) {
			for (let e of this.intersectionObservers.values()) e.forEach((e) => e.disconnect());
			this.intersectionObservers.clear();
		}
		for (let { mediaQueryList: e, listener: t } of this.mediaQueryObservers.values()) e.removeEventListener?.("change", t), e.removeListener?.(t);
		this.mediaQueryObservers.clear();
		for (let e of this.componentAnimations.values()) e.forEach((e) => e.cancel());
		this.componentAnimations.clear();
		for (let e of this.performanceObservers.values()) e.disconnect();
		this.performanceObservers.clear();
		for (let e of [...this.canvasNodes.keys()]) this.disposeCanvasNode(e);
		for (let e of this.canvasRafIds.values()) cancelAnimationFrame(e);
		this.canvasRafIds.clear(), this.canvasScopeQueues.clear(), this.resourceLoadIds.clear();
	}
	registerResourceLoad(e, t) {
		e && (typeof t == "string" && t ? this.resourceLoadIds.set(e, t) : this.resourceLoadIds.delete(e));
	}
	createDomReadyBody(e, t = this.resourceLoadIds.get(e)) {
		let n = { bridgeId: e };
		return typeof t == "string" && t && (n.resourceLoadId = t), n;
	}
	syncReactiveState(e, t = {}) {
		for (let n in e) n in t || delete e[n];
		Object.assign(e, t);
	}
	firstRender(e) {
		let { bridgeId: t, pagePath: n, pageId: r, query: i, resourceLoadId: a } = e, o = this.makeOptions({
			path: n,
			bridgeId: t,
			pageId: r,
			query: i,
			resourceLoadId: a
		});
		this.app != null && this.app.unmount(), this.app = Pc(o.app), this.app.use(Zh), this.registerTplComponentsByPath(e.pagePath, t), this.app.mount(document.body);
	}
	registerTplComponentsByPath(e, t, n = /* @__PURE__ */ new Set()) {
		if (n.has(e)) return;
		n.add(e);
		let r = Je.getModuleByPath(e);
		if (!r?.moduleInfo) return;
		let { id: i, tplComponents: a = {}, usingComponents: o = {}, componentPlaceholder: s = {} } = r.moduleInfo, c = this.createComponent(e, t, o, /* @__PURE__ */ new Map(), s);
		for (let [e, t] of Object.entries(a)) this.app.component(`dd-${e}`, this.createTplComponent({
			id: i,
			components: c,
			render: t
		}));
		for (let e of Object.values(o)) this.registerTplComponentsByPath(e, t, n);
	}
	createTplComponent({ id: e, components: t, render: n }) {
		return {
			__scopeId: `data-v-${e}`,
			components: t,
			props: { data: Object },
			setup(e) {
				let { data: t, templateData: n } = ug();
				return fi(() => {
					let n = e.data || {};
					for (let e in t) e in n || delete t[e];
					Object.assign(t, n);
				}), n;
			},
			render: n
		};
	}
	makeOptions(e) {
		let { path: t, bridgeId: n, pageId: r, resourceLoadId: i } = e, a = Je.getModuleByPath(t), { id: o, appStyleScopeId: s, sharedStyleScopeIds: c = [], usingComponents: l, componentPlaceholder: u = {}, tplComponents: d, customTabBar: f } = a.moduleInfo, p = a.moduleInfo.render, m = f?.componentName, h = typeof m == "string" && Object.prototype.hasOwnProperty.call(l || {}, m);
		this.pageId = r, this.pagePath = t;
		let g = this, _ = "dd-page", v = `data-v-${o}`, y = [
			s ? `data-v-${s}` : null,
			v,
			...c.map((e) => `data-v-${e}`)
		].filter(Boolean), b = this.createComponent(t, n, l, /* @__PURE__ */ new Map(), u), x = this.createDomReadyBody(n, i);
		return {
			id: o,
			tplComponents: d,
			app: {
				render: () => {
					let e = oa(_);
					return Ps(Mo, { onResolve: () => {
						N.invoke({
							type: "domReady",
							target: "container",
							body: x
						});
					} }, { default: () => Ps(e, { key: g.pageRenderVersion.value }) });
				},
				components: { [_]: {
					name: t,
					__scopeId: v,
					async setup(e, { expose: r }) {
						r();
						let i = vs();
						li("bridgeId", n), li("path", t), li(t, { id: g.pageId }), li("info", {
							id: g.pageId,
							sId: v
						});
						let a = i.proxy;
						a.__page__ = !0, g.setModuleInstance(g.pageId, a);
						let o = () => {}, s = () => {}, c = !1, l = () => {
							c ||= (window.requestAnimationFrame(() => {
								N.send({
									type: "pageScroll",
									target: "service",
									body: {
										bridgeId: n,
										moduleId: g.pageId,
										scrollTop: window.scrollY
									}
								}), c = !1;
							}), !0);
						};
						Yi(() => {
							s = Cg(y), o = Sg(xg(i.subTree), y, v), window.addEventListener("scroll", l, { passive: !0 }), Jr(() => {
								N.send({
									type: "pageAttached",
									target: "service",
									body: {
										bridgeId: n,
										moduleId: g.pageId
									}
								}), N.send({
									type: "pageReady",
									target: "service",
									body: {
										bridgeId: n,
										moduleId: g.pageId
									}
								});
							});
						}), $i(() => {
							o(), s(), window.removeEventListener("scroll", l);
						});
						let { data: u, templateData: d } = ug();
						g.setupData.set(g.pageId, u);
						let f = await N.wait(g.pageId);
						return g.applyInitialData(g.pageId, u, f), d;
					},
					components: b,
					render: h ? function(...e) {
						return Ps(Uo, null, [(Je.getModuleByPath(t)?.moduleInfo?.render || p).apply(this, e), Ps(oa(`dd-${m}`))]);
					} : p
				} }
			}
		};
	}
	getParentModuleId(e) {
		let t = e?.parent;
		for (; t;) {
			let e = this.moduleIds.get(t.proxy);
			if (e) return e;
			t = t.parent;
		}
	}
	applyInitialData(e, t, n) {
		let r = Object.entries(n);
		for (let e = 0; e < r.length; e++) {
			let [n, i] = r[e];
			T(t, n, i);
		}
		let i = this.preInitUpdates.get(e);
		if (i) {
			let n = i.data || i;
			if ((i.changes || []).length > 0) for (let e of i.changes) T(t, e.path, e.value);
			else for (let [e, r] of Object.entries(n)) T(t, e, r);
			this.preInitUpdates.delete(e);
		}
		return this.initializedModules.add(e), i;
	}
	refreshProxyAccess(e, t) {
		let n = this.instance.get(e)?.$;
		if (!n) return;
		let { accessCache: r, ctx: i } = n;
		for (let [e, n] of Object.entries(t)) r && Object.prototype.hasOwnProperty.call(r, e) && delete r[e], i && !Object.prototype.hasOwnProperty.call(i, e) && (i[e] = n);
		n.update?.();
	}
	setModuleInstance(e, t) {
		t && (this.instance.set(e, t), this.moduleIds.set(t, e), this._instanceWaiters.has(e) && (this._instanceWaiters.get(e).forEach((e) => e(t)), this._instanceWaiters.delete(e)));
	}
	deleteModuleInstance(e) {
		let t = this.instance.get(e);
		t && this.moduleIds.delete(t), this.instance.delete(e);
	}
	registerModuleRoots(e, t) {
		for (let n of t) {
			let t = this.moduleRootIds.get(n) || [];
			t.includes(e) || (t.push(e), this.moduleRootIds.set(n, t));
		}
	}
	unregisterModuleRoots(e, t) {
		for (let n of t) {
			let t = this.moduleRootIds.get(n);
			if (!t) continue;
			let r = t.filter((t) => t !== e);
			r.length > 0 ? this.moduleRootIds.set(n, r) : this.moduleRootIds.delete(n);
		}
	}
	getRenderParentModuleId(e, t) {
		for (let n of e) {
			let e = n.parentElement;
			for (; e;) {
				let n = (this.moduleRootIds.get(e) || []).findLast((e) => e !== t);
				if (n) return n;
				e = e.parentElement;
			}
		}
	}
	collectCustomEventPath(e, t) {
		let n = [], r = e;
		for (; r;) {
			for (let i of gg(r._ddEventBindings)) {
				let a = this.moduleIds.get(i.owner), o = this.moduleIds.get(i.target);
				if (!a) continue;
				let s = i.nodeType === "component";
				(r !== e || s || a !== t) && (s && o === t || n.push({
					moduleId: a,
					nodeModuleId: o,
					isComponentHost: s,
					eventAttr: i.eventAttr,
					targetInfo: {
						id: r.id,
						dataset: {
							...r.dataset,
							...r._ds
						}
					}
				}));
			}
			r = r.parentElement;
		}
		return n;
	}
	createComponent(e, t, n, r = /* @__PURE__ */ new Map(), i = {}) {
		if (!n || Object.keys(n).length === 0) return;
		let a = {}, o = this;
		for (let [s, c] of Object.entries(n)) {
			let l = c, u = `${e}\0${l}`, f = r.get(u);
			if (f) {
				a[`dd-${s}`] = f;
				continue;
			}
			let p = Je.getModuleByPath(l);
			if (!p?.moduleInfo) {
				let t = i[s], o = t && n[t];
				if (o) {
					if (l = o, u = `${e}\0${l}`, f = r.get(u), f) {
						a[`dd-${s}`] = f;
						continue;
					}
					p = Je.getModuleByPath(l);
				}
			}
			if (!p?.moduleInfo) continue;
			let { id: m, usingComponents: h, componentPlaceholder: g = {}, customTabBar: _ } = p.moduleInfo, v = `data-v-${m}`, y = dg(p.moduleInfo.styleIsolation), b = {
				name: l,
				__scopeId: v,
				components: void 0,
				props: {
					...p.props,
					[lg]: { type: null }
				},
				async setup(n, { attrs: r, expose: i }) {
					let a = V("info"), s = V("path"), c = vs();
					i({
						props: n,
						sId: c.vnode.scopeId || a.sId
					});
					let u = o.getParentModuleId(c) || a.id, f = V(e, null), h = f?.id || u, g = f ? e : s, b = `${m}_${D()}`;
					li("info", {
						id: b,
						sId: v
					}), li("path", l), li(l, {
						id: b,
						pagePath: g,
						pageId: h
					});
					let x = c.proxy;
					o.setModuleInstance(b, x);
					let S = () => je(p.propertySchemas, Dg(p.propertySchemas, Eg(p.propertySchemas, Gl(n), c.vnode), c.vnode), {
						isAbsent: (e) => !wg(c.vnode.props, e) && !(e === "style" && wg(c.vnode.props, lg)),
						warn: (e) => console.warn("[system]", "[render]", e)
					}), C = [];
					for (let [e, t] of Object.entries(p.props ?? {})) t.cls && C.push(e);
					li("externalClasses", C);
					let w = hg(r), T = S(), E = Object.keys(p.propertySchemas || {}).filter((e) => wg(c.vnode.props, e) || e === "style" && wg(c.vnode.props, lg)), ee = N.waitAndSend(b, {
						type: "mC",
						target: "service",
						body: {
							bridgeId: t,
							moduleId: b,
							path: l,
							isCustomTabBar: _ === !0,
							pageId: h,
							parentId: u,
							eventAttr: w,
							targetInfo: {
								dataset: ne(r, Gl),
								id: r.id,
								class: r.class
							},
							properties: T,
							propertyNames: E,
							propBindings: null
						}
					}), te = !1, O, re = () => {
						te || (te = !0, O?.());
					};
					o._pendingSetups.set(b, new Promise((e) => O = e)), Yi(() => {
						let e = xg(c.subTree);
						o.registerModuleRoots(b, e);
						for (let t of e) t.setAttribute(og, ""), t.setAttribute(sg, y), mg(t, m);
						Jr(() => {
							let n = o.getRenderParentModuleId(e, b);
							N.send({
								type: "mA",
								target: "service",
								body: {
									bridgeId: t,
									moduleId: b,
									parentId: n || u
								}
							});
							let r = x.$el?._propBindings, i = o.collectCustomEventPath(x.$el, b);
							N.send({
								type: "mR",
								target: "service",
								body: {
									bridgeId: t,
									moduleId: b,
									propBindings: r,
									eventPath: i
								}
							});
						});
					});
					let k;
					$i(() => {
						k?.();
						let e = xg(c.subTree);
						o.unregisterModuleRoots(b, e), N.send({
							type: "mU",
							target: "service",
							body: {
								bridgeId: t,
								moduleId: b
							}
						}), o.deleteModuleInstance(b), o.setupData.delete(b), o.initializedModules.delete(b), o.preInitUpdates.delete(b), o._pendingSetups.delete(b), re();
					});
					let { data: A, templateData: ie } = ug();
					o.setupData.set(b, A), p.builtinBehaviors?.has("wx://form-field") && (k = V("registerFormControl", void 0)?.({
						getName: () => Object.prototype.hasOwnProperty.call(A, "name") ? A.name : n.name,
						getValue: () => Object.prototype.hasOwnProperty.call(A, "value") ? A.value : n.value
					}));
					let ae = T, oe = !0;
					H(() => Gl(n), () => {
						let e = oe ? T : S();
						if (Object.assign(A, e), oe) {
							oe = !1;
							return;
						}
						let n = Object.entries(e).reduce((e, [t, n]) => (d(n, ae[t]) || (e[t] = n), e), {});
						ae = e, Object.keys(n).length !== 0 && N.send({
							type: "t",
							target: "service",
							body: {
								bridgeId: t,
								moduleId: b,
								methodName: "tO",
								event: n
							}
						});
					}, { immediate: !0 });
					let se = await ee;
					return o._pendingSetups.delete(b), re(), o.applyInitialData(b, A, se), ie;
				},
				render(...e) {
					return pg((Je.getModuleByPath(l)?.moduleInfo?.render || p.moduleInfo.render).apply(this, e), y, m);
				}
			};
			r.set(u, b), b.components = this.createComponent(l, t, h, r, g), a[`dd-${s}`] = b;
		}
		return a;
	}
	remountPage(e) {
		return this.app ? !e || e !== this.pageId ? {
			remounted: !1,
			reason: "page-not-current"
		} : (this.pageRenderVersion.value += 1, { remounted: !0 }) : {
			remounted: !1,
			reason: "app-not-mounted"
		};
	}
	capturePageSnapshot(e) {
		let t = this.setupData.get(e);
		return t ? Kg(Gl(t)) : null;
	}
	replayPageSnapshot(e, t) {
		let n = this.setupData.get(e);
		if (!n || !t || typeof t != "object") return !1;
		for (let e of Object.keys(n)) delete n[e];
		return Object.assign(n, t), !0;
	}
	beginHmrRemount(e) {
		let t = [];
		return this.hmrRemountQueues.set(e, t), t;
	}
	endHmrRemount(e) {
		let t = this.hmrRemountQueues.get(e) || [];
		this.hmrRemountQueues.delete(e);
		for (let e of t) this.updateModule(e);
	}
	async remountPageWithSnapshot(e) {
		let t = this.capturePageSnapshot(e);
		this.beginHmrRemount(e);
		let n = this.remountPage(e);
		if (!n.remounted) return this.hmrRemountQueues.delete(e), n;
		try {
			return await Jr(), N.resolveWait(e, t || {}), this.replayPageSnapshot(e, t), this.endHmrRemount(e), {
				remounted: !0,
				replayed: t !== null
			};
		} catch (t) {
			throw this.hmrRemountQueues.delete(e), t;
		}
	}
	async handleHmr(e) {
		if (e?.level !== "L3") return {
			status: "fallback",
			reason: "unsupported-hmr-level"
		};
		if (!Array.isArray(e.affectedPages) || !e.affectedPages.includes(this.pagePath)) return {
			status: "applied",
			reason: "current-page-not-affected"
		};
		let t;
		try {
			let n = await Je.reloadViewModule(this.pagePath, e.buildId);
			if (t = Je.replaceModule(this.pagePath, n, e.buildId), !t.committed) throw Error(t.reason || "module-replace-failed");
			let r = await this.remountPageWithSnapshot(this.pageId);
			if (!r.remounted) throw Error(r.reason || "page-remount-failed");
			return { status: "applied" };
		} catch (e) {
			return t?.rollback?.(), {
				status: "fallback",
				reason: e.message || "hmr-l3-failed"
			};
		}
	}
	updateModule(e) {
		let t = this.hmrRemountQueues.get(e?.moduleId);
		if (t) {
			t.push({
				...e,
				data: e.data ? Kg(Gl(e.data)) : e.data
			});
			return;
		}
		let { moduleId: n, data: r, changes: i = [] } = e, a = this.setupData.get(n);
		if (a) {
			let e = !1, t = {};
			if (!this.initializedModules.has(n)) {
				let e = this.preInitUpdates.get(n) || {
					data: {},
					changes: []
				};
				Object.assign(e.data, r), e.changes.push(...i), this.preInitUpdates.set(n, e);
			}
			if (i.length === 0) for (let n in r) Object.prototype.hasOwnProperty.call(a, n) || (e = !0, t[n] = r[n]), T(a, n, r[n]);
			for (let n of i) {
				let r = n.path[0];
				Object.prototype.hasOwnProperty.call(a, r) || (e = !0), T(a, n.path, n.value), t[r] = a[r];
			}
			e && this.refreshProxyAccess(n, t);
		} else console.warn("[system]", "[render]", `module ${n} is not exist.`);
		this.schedulePageReRender();
	}
	schedulePageReRender() {
		this._pageReRenderPending || (this._pageReRenderPending = !0, Jr(() => {
			this._pageReRenderPending = !1, document.dispatchEvent(new CustomEvent("pageReRender"));
		}));
	}
	updateModules(e) {
		let { bridgeId: t, updates: n = [], callbackIds: r = [] } = e;
		n.forEach((e) => this.updateModule(e)), r.length > 0 && Jr(() => {
			r.forEach((e) => {
				N.send({
					type: "triggerCallback",
					target: "service",
					body: {
						bridgeId: t,
						id: e
					}
				});
			});
		});
	}
	_waitForInstance(e, t = 500) {
		let n = this.instance.get(e);
		return n ? Promise.resolve(n) : new Promise((n) => {
			let r = this._instanceWaiters.get(e) || [];
			r.push(n), this._instanceWaiters.set(e, r), setTimeout(() => {
				let t = this._instanceWaiters.get(e);
				if (t) {
					let r = t.indexOf(n);
					r !== -1 && t.splice(r, 1), t.length === 0 && this._instanceWaiters.delete(e);
				}
				n(void 0);
			}, t);
		});
	}
	async waitForEl(e, t = 500) {
		return e ? e.__page__ ? document.body : e.$el || new Promise((n) => {
			let r = new MutationObserver((t, r) => {
				let i = e.$el;
				i && (r.disconnect(), n(i));
			});
			e.$parent.$el?.nodeType === Node.COMMENT_NODE ? r.observe(document.body, {
				childList: !0,
				subtree: !0
			}) : r.observe(e.$parent.$el, { childList: !0 }), setTimeout(() => {
				r.disconnect(), n();
			}, t);
		}) : void 0;
	}
	async waitForElement(e, t, n, r = 500) {
		if (!e[n]) return console.warn("[system]", "[render]", `waitForElement method ${n} in ${e.nodeType}`), null;
		let i = e[n](t);
		return this.hasMatchedElements(i) ? i : new Promise((i) => {
			let a = new MutationObserver((r, a) => {
				let o = e[n](t);
				this.hasMatchedElements(o) && (a.disconnect(), i(o));
			});
			a.observe(e, {
				childList: !0,
				subtree: !0
			}), setTimeout(() => {
				a.disconnect(), i();
			}, r);
		});
	}
	hasMatchedElements(e) {
		return e ? e instanceof NodeList || Array.isArray(e) ? e.length > 0 : !0 : !1;
	}
	getCanvasNodeId(e) {
		return e.__diminaCanvasNodeId || Object.defineProperty(e, "__diminaCanvasNodeId", {
			value: `canvas_${D()}`,
			configurable: !0
		}), e.__diminaCanvasNodeId;
	}
	getCanvasCapabilities() {
		return this.canvasCapabilities ||= Hg(), this.canvasCapabilities;
	}
	publishCanvasCapabilities(e) {
		N.send({
			type: "canvasCapabilities",
			target: "service",
			body: {
				bridgeId: e,
				capabilities: this.getCanvasCapabilities()
			}
		});
	}
	registerCanvasNode(e, t = e.getAttribute?.("type") || "2d") {
		let n = this.getCanvasNodeId(e), r = !this.canvasNodes.has(n), i = e.getBoundingClientRect?.(), a = Math.round(i?.width || 0), o = Math.round(i?.height || 0), s = he(a, o, { allowZero: !0 });
		return r && !s && a > 0 && o > 0 && (e.width !== a && (e.width = a), e.height !== o && (e.height = o)), r && this.canvasNodes.set(n, {
			canvas: e,
			contexts: /* @__PURE__ */ new Map(),
			resourceIds: /* @__PURE__ */ new Set()
		}), {
			__diminaNodeType: kg,
			nodeId: n,
			type: t,
			width: e.width ?? (!s && a > 0 ? a : 300),
			height: e.height ?? (!s && o > 0 ? o : 150),
			webglCapabilities: this.getCanvasCapabilities()
		};
	}
	createOffscreenCanvas({ bridgeId: e, params: t }) {
		let { nodeId: n, width: r = 300, height: i = 150, type: a = "2d" } = t, o = he(r, i, { allowZero: !0 });
		if (o) {
			console.warn("[system]", "[render]", `createOffscreenCanvas ${n} rejected: ${o}`);
			return;
		}
		let s = document.createElement("canvas");
		s.width = r, s.height = i, this.canvasNodes.set(n, {
			canvas: s,
			type: a,
			contexts: /* @__PURE__ */ new Map(),
			resourceIds: /* @__PURE__ */ new Set(),
			bridgeId: e
		}), (a === "webgl" || a === "experimental-webgl" || a === "webgl2") && this.publishCanvasCapabilities(e);
	}
	createGameCanvas({ bridgeId: e, params: t }) {
		let { nodeId: n, width: r = 300, height: i = 150, type: a = "2d" } = t, o = he(r, i, { allowZero: !0 });
		if (o) {
			console.warn("[system]", "[render]", `createGameCanvas ${n} rejected: ${o}`);
			return;
		}
		if (this.canvasNodes.get(n)) return;
		let s = document.createElement("canvas");
		s.width = r, s.height = i, s.setAttribute("data-dimina-game-canvas", ""), Object.assign(s.style, {
			display: "block",
			position: "fixed",
			inset: "0",
			width: "100%",
			height: "100%",
			touchAction: "none"
		});
		let c = (e) => ({
			identifier: e.identifier,
			clientX: e.clientX,
			clientY: e.clientY,
			pageX: e.pageX,
			pageY: e.pageY,
			force: Number.isFinite(e.force) ? e.force : 0
		}), l = /* @__PURE__ */ new Map(), u = (t, n, r, i) => {
			N.send({
				type: "gameTouch",
				target: "service",
				body: {
					bridgeId: e,
					eventType: t,
					touches: n,
					changedTouches: r,
					timeStamp: i
				}
			});
		};
		for (let e of [
			"touchstart",
			"touchmove",
			"touchend",
			"touchcancel"
		]) {
			let t = (t) => {
				t.cancelable && t.preventDefault(), u(e, Array.from(t.touches || [], c), Array.from(t.changedTouches || [], c), t.timeStamp);
			};
			l.set(e, t), s.addEventListener(e, t, { passive: !1 });
		}
		let d = !1, f = !1;
		for (let [e, t] of Object.entries({
			mousedown: "touchstart",
			mousemove: "touchmove",
			mouseup: "touchend",
			mouseleave: "touchcancel"
		})) {
			let n = (n) => {
				if (e === "mousedown") {
					if (n.button !== 0) return;
					d = !0, f = !0;
				} else if (e === "mousemove" && !f) return;
				else if (e !== "mousemove" && !d) return;
				n.cancelable && n.preventDefault();
				let r = c({
					identifier: 0,
					clientX: n.clientX,
					clientY: n.clientY,
					pageX: n.pageX,
					pageY: n.pageY,
					force: d ? .5 : 0
				}), i = t === "touchend" || t === "touchcancel";
				u(t, i ? [] : [r], [r], n.timeStamp), i && (d = !1);
			};
			l.set(e, n), s.addEventListener(e, n, { passive: !1 });
		}
		document.body.append(s), this.canvasNodes.set(n, {
			canvas: s,
			type: a,
			contexts: /* @__PURE__ */ new Map(),
			resourceIds: /* @__PURE__ */ new Set(),
			bridgeId: e,
			cleanup: () => {
				for (let [e, t] of l) s.removeEventListener(e, t);
				s.remove();
			}
		}), this.publishCanvasCapabilities(e), N.invoke({
			type: "domReady",
			target: "container",
			body: this.createDomReadyBody(e)
		});
	}
	disposeCanvasNode(e, t) {
		let n = this.canvasNodes.get(e);
		if (!(!n || n.bridgeId && t && n.bridgeId !== t)) {
			n.cleanup?.();
			for (let e of n.resourceIds || []) {
				let t = this.canvasResources.get(e);
				t && (typeof t == "object" || typeof t == "function") && ("onload" in t && (t.onload = null), "onerror" in t && (t.onerror = null)), this.canvasResources.delete(e);
			}
			for (let e of n.contexts?.keys() || []) this.canvasResources.delete(e);
			for (let [t, n] of [...this.canvasRafIds]) t.startsWith(`${e}:`) && (cancelAnimationFrame(n), this.canvasRafIds.delete(t));
			this.canvasNodes.delete(e);
		}
	}
	disposeCanvasNodes({ bridgeId: e, params: t }) {
		for (let n of new Set(t.nodeIds || [])) this.disposeCanvasNode(n, e);
	}
	resolveCanvasArg(e, t) {
		if (e == null) return e;
		if (Array.isArray(e)) return e.map((e) => this.resolveCanvasArg(e, t));
		if (typeof e != "object") return e;
		if (e.__canvasResourceId) return this.canvasResources.get(e.__canvasResourceId);
		if (e.__canvasNodeId) return this.canvasNodes.get(e.__canvasNodeId)?.canvas;
		if (e.__canvasTypedArray) {
			let t = Fg[e.__canvasTypedArray];
			if (t) return new t(e.data || []);
			if (e.__canvasTypedArray === "DataView") return new DataView(new Uint8Array(e.data || []).buffer);
		}
		if (e.__canvasArrayBuffer) return new Uint8Array(e.data || []).buffer;
		if (e.__canvasImageData) {
			let n = he(e.width, e.height, { transferable: !0 });
			if (n) throw RangeError(n);
			let r = t?.createImageData?.(e.width, e.height);
			if (!r?.data) throw TypeError("target context cannot create ImageData");
			if (r.data.length !== e.data?.length) throw RangeError("ImageData data length does not match its dimensions");
			return r.data.set(e.data), r;
		}
		let n = {};
		for (let [r, i] of Object.entries(e)) n[r] = this.resolveCanvasArg(i, t);
		return n;
	}
	getCanvasResource(e) {
		return this.canvasResources.get(e);
	}
	getCanvasResourceId(e) {
		if (e == null) return null;
		for (let [t, n] of this.canvasResources) if (n === e) return t;
		return null;
	}
	setCanvasResource(e, t, n) {
		e && (this.canvasResources.set(e, t), n?.resourceIds?.add(e));
	}
	getCanvasImage(e, t) {
		let n = this.getCanvasResource(e);
		return n || (n = new Image(), n.crossOrigin = "anonymous", this.setCanvasResource(e, n, t)), n;
	}
	executeCanvasOperation(e, t, n) {
		switch (t.op) {
			case "setCanvasProperty":
				if (t.prop === "width" || t.prop === "height") {
					let n = he(t.prop === "width" ? t.value : e.canvas.width, t.prop === "height" ? t.value : e.canvas.height, { allowZero: !0 });
					if (n) throw RangeError(n);
				}
				e.canvas[t.prop] = t.value;
				break;
			case "getContext": {
				let n = null, r;
				try {
					n = e.canvas.getContext(t.contextType, this.resolveCanvasArg(t.attributes));
				} catch (e) {
					r = e instanceof Error ? e.message : String(e);
				}
				e.contexts.set(t.contextId, n), this.setCanvasResource(t.contextId, n, e);
				let i = t.contextType === "webgl" || t.contextType === "experimental-webgl" || t.contextType === "webgl2";
				return {
					contextId: t.contextId,
					context: n ? {
						success: !0,
						capabilities: i ? Vg(n, !1) : null
					} : {
						success: !1,
						statusMessage: r || `getContext(${t.contextType}) returned null`
					}
				};
			}
			case "contextSetProperty": {
				let e = this.getCanvasResource(t.contextId);
				if (e) {
					let n = t.prop in e;
					if (n) try {
						e[t.prop] = this.resolveCanvasArg(t.value);
					} catch (e) {
						console.warn("[system]", "[render]", `Canvas context property ${t.prop} failed: ${e}`);
					}
					if (t.feedback === "state") {
						let r;
						try {
							r = n ? e[t.prop] : this.resolveCanvasArg(t.previousValue);
						} catch {
							break;
						}
						if (r === null || [
							"string",
							"number",
							"boolean"
						].includes(typeof r)) return {
							contextId: t.contextId,
							state: {
								prop: t.prop,
								sequence: t.sequence,
								value: r
							}
						};
					}
				}
				break;
			}
			case "contextCall": {
				let n = this.getCanvasResource(t.contextId), r = n?.[t.method], i = t.method === "reset" && n && typeof r != "function";
				if (typeof r != "function" && !i) break;
				let a = (t.args || []).map((e) => this.resolveCanvasArg(e, n));
				if (t.method === "putImageData" && a[0]?.data instanceof Uint8ClampedArray && Object.prototype.toString.call(a[0]) !== "[object ImageData]") {
					let e = a[0], t = he(e.width, e.height, { transferable: !0 });
					if (t) throw RangeError(t);
					let r = n.createImageData(e.width, e.height);
					if (r.data.length !== e.data.length) throw RangeError("ImageData data length does not match its dimensions");
					r.data.set(e.data), a[0] = r;
				}
				try {
					if (i) {
						let t = e.canvas.width;
						e.canvas.width = t;
					} else {
						let i = r.apply(n, a);
						this.setCanvasResource(t.resultId, i, e);
					}
				} catch (e) {
					console.warn("[system]", "[render]", `Canvas context call ${t.method} failed: ${e}`);
				}
				let o = { contextId: t.contextId };
				if (t.feedback === "shader") {
					let e = a[0], r = {
						compileStatus: !1,
						infoLog: ""
					};
					try {
						r = {
							shaderType: n.getShaderParameter(e, n.SHADER_TYPE),
							compileStatus: n.getShaderParameter(e, n.COMPILE_STATUS),
							infoLog: n.getShaderInfoLog(e) || ""
						};
					} catch {}
					o.resource = {
						resourceId: t.args?.[0]?.__canvasResourceId,
						metadata: r
					};
				} else if (t.feedback === "program") {
					let e = a[0], r = {
						linkStatus: !1,
						validateStatus: !1,
						infoLog: ""
					};
					try {
						r = {
							linkStatus: n.getProgramParameter(e, n.LINK_STATUS),
							validateStatus: n.getProgramParameter(e, n.VALIDATE_STATUS),
							infoLog: n.getProgramInfoLog(e) || ""
						};
					} catch {}
					o.resource = {
						resourceId: t.args?.[0]?.__canvasResourceId,
						metadata: r
					};
				}
				return t.typedArrayUpdateId && Number.isInteger(t.typedArrayArgIndex) && (o.typedArray = {
					id: t.typedArrayUpdateId,
					value: zg(a[t.typedArrayArgIndex])
				}), t.feedback === "stateSnapshot" && (o.state = Bg(n, t.stateSequences)), o;
			}
			case "contextStateSnapshot": {
				let e = this.getCanvasResource(t.contextId);
				if (!e) break;
				return {
					contextId: t.contextId,
					state: Bg(e, t.stateSequences)
				};
			}
			case "contextQuery": {
				let e = this.getCanvasResource(t.contextId), n = e?.[t.method];
				if (typeof n != "function") break;
				let r = null;
				try {
					r = n.apply(e, (t.args || []).map((e) => this.resolveCanvasArg(e)));
				} catch (e) {
					console.warn("[system]", "[render]", `Canvas context query ${t.method} failed: ${e}`);
				}
				return {
					contextId: t.contextId,
					query: {
						key: t.key,
						value: zg(r, (e) => this.getCanvasResourceId(e))
					}
				};
			}
			case "contextFeedback": break;
			case "getExtension": {
				let n = this.getCanvasResource(t.contextId), r = null;
				try {
					r = n?.getExtension?.(t.name) || null;
				} catch (e) {
					console.warn("[system]", "[render]", `Canvas extension ${t.name} failed: ${e}`);
				}
				this.setCanvasResource(t.extensionId, r, e);
				break;
			}
			case "extensionCall": {
				let n = this.getCanvasResource(t.extensionId), r = n?.[t.method];
				if (typeof r == "function") try {
					let i = r.apply(n, (t.args || []).map((e) => this.resolveCanvasArg(e)));
					this.setCanvasResource(t.resultId, i, e);
				} catch (e) {
					console.warn("[system]", "[render]", `Canvas extension call ${t.method} failed: ${e}`);
				}
				break;
			}
			case "resourceCall": {
				let n = this.getCanvasResource(t.resourceId), r = n?.[t.method];
				if (typeof r == "function") {
					let i = r.apply(n, (t.args || []).map((e) => this.resolveCanvasArg(e)));
					this.setCanvasResource(t.resultId, i, e);
				}
				break;
			}
			case "createImage":
				this.getCanvasImage(t.imageId, e);
				break;
			case "imageSetSrc": {
				let r = this.getCanvasImage(t.imageId, e), i = (e) => {
					if (r.onload = null, r.onerror = null, t.callback) this.triggerCallback(n, t.callback, e);
					else {
						let r = e.ok ? t.onload : t.onerror;
						this.triggerCallback(n, r, e.value);
					}
				};
				r.onload = () => {
					i({
						ok: !0,
						value: {
							width: r.width,
							height: r.height
						}
					});
				}, r.onerror = () => {
					i({
						ok: !1,
						value: { errMsg: `createImage:fail ${t.src}` }
					});
				}, r.src = t.src;
				break;
			}
			case "getImageData": {
				let e = this.getCanvasResource(t.contextId);
				if (e) {
					let r = he(t.width, t.height, { transferable: !0 });
					if (r) throw RangeError(r);
					let i = e.getImageData(t.x, t.y, t.width, t.height), a = t.resultEnvelope ? {
						__canvasImageData: !0,
						data: Array.from(i.data),
						width: i.width,
						height: i.height
					} : {
						data: Array.from(i.data),
						width: i.width,
						height: i.height
					};
					this.triggerCallback(n, t.callback, t.resultEnvelope ? {
						ok: !0,
						value: a
					} : a);
				}
				break;
			}
			case "toDataURL": {
				let r = t.mimeType || "image/png", i = t.quality === void 0 ? e.canvas.toDataURL(r) : e.canvas.toDataURL(r, t.quality);
				this.triggerCallback(n, t.callback, t.resultEnvelope ? {
					ok: !0,
					value: i
				} : i);
				break;
			}
			default: console.warn("[system]", "[render]", `Unsupported canvas node operation: ${t.op}`);
		}
	}
	canvasNodeFlush({ bridgeId: e, params: t }) {
		let n = this.canvasNodes.get(t.nodeId);
		if (!n) {
			console.warn("[system]", "[render]", `canvas node ${t.nodeId} not found`);
			for (let n of t.operations || []) this.triggerCallback(e, n.callback, n.resultEnvelope ? {
				ok: !1,
				error: "canvas node not found"
			} : void 0);
			this.triggerCallback(e, t.feedback, {});
			return;
		}
		let r = {
			contexts: {},
			typedArrays: []
		}, i = /* @__PURE__ */ new Set();
		for (let a of t.operations || []) {
			a.contextId && i.add(a.contextId);
			let t;
			try {
				t = this.executeCanvasOperation(n, a, e);
			} catch (t) {
				let n = t instanceof Error ? t.message : String(t);
				console.warn("[system]", "[render]", `Canvas operation ${a.op} failed: ${n}`), this.triggerCallback(e, a.callback, a.resultEnvelope ? {
					ok: !1,
					error: n
				} : void 0);
				continue;
			}
			t && (t.contextId && (r.contexts[t.contextId] ||= {}, t.context && Object.assign(r.contexts[t.contextId], t.context), t.resource?.resourceId && (r.contexts[t.contextId].resources ||= [], r.contexts[t.contextId].resources.push(t.resource)), t.query && (r.contexts[t.contextId].queries ||= [], r.contexts[t.contextId].queries.push(t.query)), t.state && (r.contexts[t.contextId].state ||= [], r.contexts[t.contextId].state.push(...Array.isArray(t.state) ? t.state : [t.state]))), t.typedArray && r.typedArrays.push(t.typedArray));
		}
		for (let e of t.feedback ? i : []) {
			let t = this.getCanvasResource(e);
			if (!t || typeof t.getError != "function") continue;
			r.contexts[e] ||= {}, r.contexts[e].contextLost = !!t.isContextLost?.();
			let n = [];
			for (let e = 0; e < 32; e++) {
				let e = t.getError();
				if (e === t.NO_ERROR) break;
				n.push(e);
			}
			n.length > 0 && (r.contexts[e].errors = n);
		}
		this.triggerCallback(e, t.feedback, r);
	}
	canvasNodeRequestAnimationFrame({ bridgeId: e, params: t }) {
		let n = `${t.nodeId}:${t.requestId}`, r = requestAnimationFrame((r) => {
			this.canvasRafIds.delete(n), this.triggerCallback(e, t.callback, r);
		});
		this.canvasRafIds.set(n, r);
	}
	canvasNodeCancelAnimationFrame({ params: e }) {
		let t = `${e.nodeId}:${e.requestId}`, n = this.canvasRafIds.get(t);
		n !== void 0 && (cancelAnimationFrame(n), this.canvasRafIds.delete(t));
	}
	async selectorQuery(e) {
		let { bridgeId: t, params: { tasks: n, success: r } } = e, i = async () => (await Promise.all(n.map(async (e) => {
			let { moduleId: t, selector: n, single: r, fields: i } = e, a = await this.waitForEl(this.instance.get(t));
			if (!a) return console.warn("[system]", "[render]", `module ${t} dom is not exist.`), null;
			if (!a.querySelector) return console.warn("system", "[render]", `selectorQuery el node type is ${a.nodeType}`), null;
			let o = n.split(",").map((e) => `${e.trim()}:not([data-dd-cloned] *)`).join(",");
			if (r) {
				let e = a.querySelector(o);
				return e ? await this.parseElement(e, i) : null;
			}
			{
				let e = a.querySelectorAll(o), t = [];
				for (let n of e) {
					let e = await this.parseElement(n, i);
					t.push(e);
				}
				return t;
			}
		}))).filter(Boolean);
		try {
			let e = await new Promise((e) => {
				requestAnimationFrame(async () => {
					e(await i());
				});
			});
			N.send({
				type: "triggerCallback",
				target: "service",
				body: {
					bridgeId: t,
					id: r,
					args: e
				}
			});
		} catch (e) {
			console.error("[system]", "[render]", "selectorQuery error:", e);
		}
	}
	videoContext(e) {
		N.event.emit("videoContext", e.params);
	}
	ensureElementReady(e) {
		return new Promise((t) => {
			if (this.isElementReady(e)) return t(e);
			let n = new ResizeObserver((r) => {
				(r[0]?.contentRect?.height > 0 || r[0]?.contentRect?.width > 0) && (n.disconnect(), t(e));
			});
			n.observe(e), setTimeout(() => {
				n.disconnect(), t(e);
			}, 500);
		});
	}
	isElementReady(e) {
		if (!e) return !1;
		let t = e.getBoundingClientRect();
		return t.height > 0 || t.width > 0;
	}
	async parseElement(e, t) {
		await this.ensureElementReady(e);
		let n = {};
		if (t.id && (n.id = e.id ?? ""), t.dataset && (n.dataset = e._ds), t.mark && (n.mark = e.dataset?.mark ?? ""), t.rect) {
			let { left: t, top: r, right: i, bottom: a, width: o, height: s } = this.getElementRect(e);
			n.left = t, n.top = r, n.right = i, n.bottom = a, n.width = o, n.height = s;
		}
		if (t.size) {
			if (t.rect) {
				let { width: t, height: r } = this.getElementRect(e);
				n.width = t, n.height = r;
			} else n.width = e.offsetWidth, n.height = e.offsetHeight;
		}
		if (t.scrollOffset && (n.scrollHeight = e.scrollHeight, n.scrollLeft = e.scrollLeft, n.scrollTop = e.scrollTop, n.scrollWidth = e.scrollWidth), t.properties && Array.isArray(t.properties)) {
			let r = {};
			t.properties.forEach((t) => {
				t !== "id" && t !== "class" && t !== "style" && !t.startsWith("bind") && !t.startsWith("on") && (r[t] = e.getAttribute(t) ?? "");
			}), n.properties = r;
		}
		if (t.computedStyle && Array.isArray(t.computedStyle)) {
			let r = window.getComputedStyle(e), i = {};
			t.computedStyle.forEach((e) => {
				i[e] = r.getPropertyValue(e) || "";
			}), n.computedStyle = i;
		}
		if (t.node) {
			let t = Wg(e);
			n.node = t ? this.registerCanvasNode(t) : null;
		}
		return n;
	}
	getElementRect(e) {
		return e.getBoundingClientRect();
	}
	triggerCallback(e, t, n = [], r) {
		if (!t) return;
		let i = {
			bridgeId: e,
			id: t
		};
		n !== void 0 && (i.args = n), r !== void 0 && (i.data = r), N.send({
			type: "triggerCallback",
			target: "service",
			body: i
		});
	}
	triggerCanvasFailure(e, t, n) {
		let r = { errMsg: n };
		this.triggerCallback(e, t.fail, r, r), this.triggerCallback(e, t.complete, r, r);
	}
	async getCanvasElement(e, t, n) {
		let r = !t || t === n, i = r ? document.body : await this.waitForEl(this.instance.get(t));
		if (!i?.querySelector) return null;
		let a = r ? this.pageId : t, o = () => [...i.matches?.("canvas[canvas-id]") ? [i] : [], ...i.querySelectorAll("canvas[canvas-id]")].filter((t) => t.getAttribute("canvas-id") === String(e) && !t.getAttribute("type")), s = (e) => {
			let t = e.closest?.(`[${og}]`);
			return r ? t === null : t === null || t === i;
		}, c = () => {
			let e = o();
			return e.find((e) => e.__ddCanvasOwner === a && e.__ddCanvasActive === !0) || e.find((e) => e.__ddCanvasOwner === a && e.__ddCanvasActive === void 0 && e.closest?.(".dd-canvas")?.style.display !== "none") || e.find((e) => e.__ddCanvasOwner === void 0 && e.__ddCanvasActive === void 0 && s(e)) || null;
		};
		return c() || new Promise((e) => {
			let t = () => {
				let r = c();
				return r ? (n.disconnect(), i.removeEventListener(j, t), e(r), !0) : !1;
			}, n = new MutationObserver(t);
			n.observe(i, {
				attributes: !0,
				attributeFilter: ["canvas-id", "type"],
				childList: !0,
				subtree: !0
			}), i.addEventListener(j, t), setTimeout(() => {
				n.disconnect(), i.removeEventListener(j, t), e(null);
			}, 500);
		});
	}
	ensureCanvasResolution(e) {
		let t = e.getBoundingClientRect(), n = Math.max(Math.round(t.width), 1), r = Math.max(Math.round(t.height), 1), i = he(n, r);
		if (i) throw RangeError(i);
		let a = !1;
		return e.width !== n && (e.width = n, a = !0), e.height !== r && (e.height = r, a = !0), a;
	}
	loadCanvasImage(e) {
		return new Promise((t, n) => {
			let r = new Image(), i = null, a = (e, t) => {
				i !== null && (clearTimeout(i), i = null), r.onload = null, r.onerror = null, e(t);
			};
			r.crossOrigin = "anonymous", r.onload = () => a(t, r), r.onerror = () => a(n, /* @__PURE__ */ Error(`Failed to load image: ${e}`)), i = setTimeout(() => a(n, /* @__PURE__ */ Error(`Timed out loading image: ${e}`)), this.canvasImageTimeout), r.src = e;
		});
	}
	async replayCanvasActions(e, t = [], n = null) {
		for (let r of t) {
			let { type: t, args: i = [] } = r || {};
			await this.applyCanvasAction(e, t, i, n);
		}
	}
	async applyCanvasAction(e, t, n, r = null) {
		if (r && t === "save") {
			e.save(), r.depth += 1;
			return;
		}
		if (r && t === "restore") {
			if (r.depth === 0) return;
			e.restore(), --r.depth;
			return;
		}
		if (Mg.has(t)) {
			e[t](...n);
			return;
		}
		let i = Ng[t];
		if (i) {
			e[i] = n[0];
			return;
		}
		switch (t) {
			case "fillPath":
			case "strokePath":
			case "clip":
				Array.isArray(n[0]) && this.replayCanvasPath(e, n[0]), e[t === "fillPath" ? "fill" : t === "strokePath" ? "stroke" : "clip"]();
				break;
			case "fill":
			case "stroke":
				e[t](...n);
				break;
			case "drawImage": {
				let [t, ...r] = n, i = await this.loadCanvasImage(t);
				e.drawImage(i, ...r);
				break;
			}
			case "setFillStyle":
			case "setStrokeStyle": {
				let r = await this.resolveCanvasStyle(e, n[0]);
				e[t === "setFillStyle" ? "fillStyle" : "strokeStyle"] = r;
				break;
			}
			case "setShadow":
				e.shadowOffsetX = n[0], e.shadowOffsetY = n[1], e.shadowBlur = n[2], e.shadowColor = n[3];
				break;
			case "setLineDash":
				e.setLineDash(n[0] || []), e.lineDashOffset = n[1] || 0;
				break;
			case "setTextBaseline":
				e.textBaseline = n[0] === "normal" ? "alphabetic" : n[0];
				break;
			case "setFont":
				e.font = n[0];
				break;
			case "setFontSize":
				e.font = String(e.font).replace(Pg, `${n[0]}px`);
				break;
			default: throw Error(`Unsupported canvas action: ${t}`);
		}
	}
	replayCanvasPath(e, t = []) {
		e.beginPath();
		for (let n of t) {
			let { type: t, args: r = [] } = n || {};
			if (!jg.has(t)) throw Error(`Unsupported canvas path action: ${t}`);
			e[t](...r);
		}
	}
	async resolveCanvasStyle(e, t) {
		if (!t || typeof t != "object") return t;
		if (t.__canvasStyle === "gradient") {
			let n = t.data || [], r = t.type === "radial" ? e.createRadialGradient(n[0], n[1], 0, n[0], n[1], n[2]) : e.createLinearGradient(n[0], n[1], n[2], n[3]);
			for (let [e, n] of t.colorStop || []) r.addColorStop(e, n);
			return r;
		}
		if (t.__canvasStyle === "pattern") {
			let n = await this.loadCanvasImage(t.image);
			return e.createPattern(n, t.repetition);
		}
		return t;
	}
	resetCanvasForDraw(e, t) {
		let n = e.font, { width: r } = t;
		t.width = r, e.font = n;
	}
	beginCanvasBatch(e, t, n) {
		let r = this.canvasBatchFrames.get(t);
		if (n && r) {
			let t = e.font;
			for (let t = 0; t <= r.depth; t++) e.restore();
			e.font = t;
		} else n || this.resetCanvasForDraw(e, t);
		e.save();
		let i = { depth: 0 };
		return this.canvasBatchFrames.set(t, i), i;
	}
	enqueueCanvasTask(e, t) {
		let n = (this.canvasDrawQueues.get(e) || Promise.resolve()).then(t).catch(() => {}).then(() => {
			this.canvasDrawQueues.get(e) === n && this.canvasDrawQueues.delete(e);
		});
		return this.canvasDrawQueues.set(e, n), n;
	}
	enqueueCanvasScopeTask(e, t) {
		let n = (this.canvasScopeQueues.get(e) || Promise.resolve()).then(t).catch(() => {}).then(() => {
			this.canvasScopeQueues.get(e) === n && this.canvasScopeQueues.delete(e);
		});
		return this.canvasScopeQueues.set(e, n), n;
	}
	queueCanvasOperation({ bridgeId: e, params: t }, n) {
		let r = JSON.stringify([e, t.moduleId || e]), i;
		return this.enqueueCanvasScopeTask(r, async () => {
			if (t.canvasValidationError) {
				i = {
					canvas: null,
					lookupError: null
				};
				return;
			}
			let n, r;
			try {
				n = await this.getCanvasElement(t.canvasId, t.moduleId, e);
			} catch (e) {
				r = e;
			}
			i = {
				canvas: n,
				lookupError: r
			};
		}).then(() => {
			let { canvas: r, lookupError: a } = i, o = () => n.call(this, {
				bridgeId: e,
				params: t,
				canvas: r,
				lookupError: a
			});
			return r ? this.enqueueCanvasTask(r, o) : o();
		});
	}
	drawCanvas(e) {
		return this.queueCanvasOperation(e, this.runCanvasDraw);
	}
	async runCanvasDraw({ bridgeId: e, params: t, canvas: n, lookupError: r }) {
		let { canvasId: i, actions: a = [], reserve: o = !1 } = t;
		try {
			if (r) throw r;
			if (!n) {
				this.triggerCanvasFailure(e, t, `drawCanvas:fail canvas ${i} not found`);
				return;
			}
			this.ensureCanvasResolution(n) && this.canvasBatchFrames.delete(n);
			let s = n.getContext("2d"), c = this.beginCanvasBatch(s, n, o);
			await this.replayCanvasActions(s, a, c);
			let l = { errMsg: "drawCanvas:ok" };
			this.triggerCallback(e, t.success, l, l), this.triggerCallback(e, t.complete, l, l);
		} catch (n) {
			this.triggerCanvasFailure(e, t, `drawCanvas:fail ${n.message}`);
		}
	}
	canvasToTempFilePath(e) {
		return this.queueCanvasOperation(e, this.runCanvasToTempFilePath);
	}
	async runCanvasToTempFilePath({ bridgeId: e, params: t, canvas: n, lookupError: r }) {
		let i = t.fileType === "jpg" || t.fileType === "png" ? t.fileType : "png";
		try {
			if (t.canvasValidationError) {
				this.triggerCanvasFailure(e, t, `canvasToTempFilePath:fail ${t.canvasValidationError}`);
				return;
			}
			if (r) throw r;
			if (!n) {
				this.triggerCanvasFailure(e, t, `canvasToTempFilePath:fail canvas ${t.canvasId} not found`);
				return;
			}
			let a = Number(t.x) || 0, o = Number(t.y) || 0, s = a < 0 || a > n.width ? 0 : a, c = o < 0 || o > n.height ? 0 : o, l = Number(t.width), u = Number(t.height), d = l ? Math.min(n.width - s, l) : n.width - s, f = u ? Math.min(n.height - c, u) : n.height - c, { height: p, width: m } = tg({
				destHeight: t.destHeight,
				destWidth: t.destWidth,
				fallbackHeight: f,
				fallbackWidth: d,
				pixelRatio: t.pixelRatio
			}), h = document.createElement("canvas");
			h.width = m, h.height = p;
			let g = h.getContext("2d");
			if (!g) throw Error("2d context is unavailable");
			g.drawImage(n, s, c, d, f, 0, 0, m, p);
			let _ = i === "jpg" ? "image/jpeg" : "image/png", v = Number(t.quality), y = i !== "jpg" || Number.isNaN(v) || v <= 0 || v > 1 ? 1 : v, b = h.toDataURL(_, y).replace(/^data:image\/(jpg|jpeg|png);base64,/, "");
			N.invoke({
				type: "invokeAPI",
				target: "container",
				body: {
					name: "saveCanvasTempFile",
					bridgeId: e,
					params: {
						dataURL: b,
						fileType: i,
						success: t.success,
						fail: t.fail,
						complete: t.complete
					}
				}
			});
		} catch (n) {
			this.triggerCanvasFailure(e, t, `canvasToTempFilePath:fail ${n.message}`);
		}
	}
	canvasGetImageData(e) {
		return this.queueCanvasOperation(e, this.runCanvasGetImageData);
	}
	async runCanvasGetImageData({ bridgeId: e, params: t, canvas: n, lookupError: r }) {
		try {
			if (t.canvasValidationError) {
				this.triggerCanvasFailure(e, t, `canvasGetImageData:fail ${t.canvasValidationError}`);
				return;
			}
			if (r) throw r;
			if (!n) {
				this.triggerCanvasFailure(e, t, `canvasGetImageData:fail canvas ${t.canvasId} not found`);
				return;
			}
			let i = he(t.width, t.height, { transferable: !0 });
			if (i) {
				this.triggerCanvasFailure(e, t, `canvasGetImageData:fail ${i}`);
				return;
			}
			let a = n.getContext("2d").getImageData(t.x, t.y, t.width, t.height), o = {
				width: a.width,
				height: a.height,
				data: Array.from(a.data),
				errMsg: "canvasGetImageData:ok"
			};
			this.triggerCallback(e, t.success, o, o), this.triggerCallback(e, t.complete, o, o);
		} catch (n) {
			this.triggerCanvasFailure(e, t, `canvasGetImageData:fail ${n.message}`);
		}
	}
	canvasPutImageData(e) {
		return this.queueCanvasOperation(e, this.runCanvasPutImageData);
	}
	async runCanvasPutImageData({ bridgeId: e, params: t, canvas: n, lookupError: r }) {
		try {
			if (t.canvasValidationError) {
				this.triggerCanvasFailure(e, t, `canvasPutImageData:fail ${t.canvasValidationError}`);
				return;
			}
			if (r) throw r;
			if (!n) {
				this.triggerCanvasFailure(e, t, `canvasPutImageData:fail canvas ${t.canvasId} not found`);
				return;
			}
			let i = he(t.width, t.height, { transferable: !0 });
			if (i) {
				this.triggerCanvasFailure(e, t, `canvasPutImageData:fail ${i}`);
				return;
			}
			let a = n.getContext("2d"), o = a.createImageData(t.width, t.height);
			o.data.set(t.data || []), a.putImageData(o, t.x, t.y);
			let s = { errMsg: "canvasPutImageData:ok" };
			this.triggerCallback(e, t.success, s, s), this.triggerCallback(e, t.complete, s, s);
		} catch (n) {
			this.triggerCanvasFailure(e, t, `canvasPutImageData:fail ${n.message}`);
		}
	}
	showToast({ params: e }) {
		window.__globalAPI.showToast(e);
	}
	hideToast({ params: e }) {
		window.__globalAPI.hideToast(e);
	}
	addIntersectionObserver(e) {
		(async () => {
			let { bridgeId: t, params: { targetSelector: n, relativeInfo: r, moduleId: i, options: a, success: o } } = e, s = await this._waitForInstance(i), c = await this.waitForEl(s);
			if (!c) {
				console.error("[system]", "[render]", "Failed to find element for intersection observer");
				return;
			}
			let l = [];
			for (let e of r) {
				let t = {
					root: null,
					threshold: a.thresholds,
					rootMargin: e.margins,
					initialRatio: a.initialRatio,
					observeAll: a.observeAll
				};
				if (e.selector === null) {
					t.root = null, l.push({ options: t });
					continue;
				}
				let r = await this.waitForElement(c, e.selector, "querySelector"), i = await this.waitForElement(c, n, a.observeAll ? "querySelectorAll" : "querySelector");
				if (!r || !i) {
					console.warn("[system]", "[render]", "Failed to find elements");
					continue;
				}
				if (Array.isArray(i) || i instanceof NodeList ? Array.from(i).some((e) => e && r.contains(e)) : r.contains(i)) t.root = r;
				else if (window.getComputedStyle(r).position === "fixed") {
					let e = window.getComputedStyle(r), n = Number.parseFloat(e.top) || 0, i = n + Number.parseFloat(e.height) || 0, a = Number.parseFloat(e.left) || 0, o = a + Number.parseFloat(e.width) || 0;
					t.root = null, t.type = "fixed", t.rootMargin = `${-n}px ${-(window.innerWidth - o)}px ${-(window.innerHeight - i)}px ${-a}px`;
				} else continue;
				l.push({ options: t });
			}
			let u = await this.waitForElement(c, n, a.observeAll ? "querySelectorAll" : "querySelector");
			if (!u) {
				console.error("[system]", "[render]", "Failed to find target element for intersection observer");
				return;
			}
			let d = Array.from(this._pendingSetups.entries()).filter(([e]) => e !== i).map(([, e]) => e);
			d.length > 0 && await Promise.all(d);
			let f = l.map(({ options: e }) => {
				let n = e.initialRatio, r = new IntersectionObserver((r) => {
					r.forEach((r) => {
						if (r.intersectionRatio === n) return;
						n = r.intersectionRatio;
						let { top: i, bottom: a } = r.boundingClientRect, s = window.innerHeight;
						!e.type && !r.isIntersecting && i >= 0 && a <= s || N.send({
							type: "triggerCallback",
							target: "service",
							body: {
								bridgeId: t,
								id: o,
								args: { info: {
									boundingClientRect: r.boundingClientRect,
									intersectionRatio: r.intersectionRatio,
									intersectionRect: r.intersectionRect,
									relativeRect: r.rootBounds,
									time: r.time,
									dataset: r.target._ds || {}
								} }
							}
						});
					});
				}, e);
				return e.observeAll ? Array.from(u).forEach((e) => r.observe(e)) : r.observe(u), r;
			}), p = D();
			this.intersectionObservers.set(p, f), N.send({
				type: "triggerCallback",
				target: "service",
				body: {
					bridgeId: t,
					id: o,
					args: { observerId: p }
				}
			});
		})();
	}
	removeIntersectionObserver({ params: { observerId: e } }) {
		if (!e) return;
		let t = this.intersectionObservers.get(e);
		t && (t.forEach((e) => e.disconnect()), this.intersectionObservers.delete(e));
	}
	addMediaQueryObserver({ bridgeId: e, params: t }) {
		let { condition: n = {}, success: r } = t, i = {
			minWidth: "min-width",
			maxWidth: "max-width",
			width: "width",
			minHeight: "min-height",
			maxHeight: "max-height",
			height: "height"
		}, a = [];
		for (let [e, t] of Object.entries(i)) Number.isFinite(n[e]) && n[e] >= 0 && a.push(`(${t}: ${n[e]}px)`);
		n.orientation && a.push(`(orientation: ${n.orientation})`);
		let o = window.matchMedia(a.join(" and ") || "all"), s = D(), c = (t) => this.triggerCallback(e, r, {
			observerId: s,
			matches: t.matches
		});
		o.addEventListener ? o.addEventListener("change", c) : o.addListener?.(c), this.mediaQueryObservers.set(s, {
			mediaQueryList: o,
			listener: c
		}), this.triggerCallback(e, r, {
			observerId: s,
			matches: o.matches
		});
	}
	removeMediaQueryObserver({ params: { observerId: e } }) {
		let t = this.mediaQueryObservers.get(e);
		t && (t.mediaQueryList.removeEventListener ? t.mediaQueryList.removeEventListener("change", t.listener) : t.mediaQueryList.removeListener?.(t.listener), this.mediaQueryObservers.delete(e));
	}
	async componentAnimate({ bridgeId: e, params: t }) {
		let { moduleId: n, selector: r, keyframes: i = [], duration: a = 0, success: o } = t, s = (await this.waitForEl(this.instance.get(n)))?.querySelectorAll?.(r) || [], c = `${n}:${r}`;
		this.componentAnimations.get(c)?.forEach((e) => e.cancel());
		let l = Array.from(i, (e) => {
			let t = { ...e };
			return t.ease && !t.easing && (t.easing = t.ease, delete t.ease), t;
		}), u = Array.from(s, (e) => e.animate(l, {
			duration: Math.max(Number(a) || 0, 0),
			fill: "forwards"
		})), d = new Set(u);
		this.componentAnimations.set(c, d), await Promise.allSettled(u.map((e) => e.finished)), this.componentAnimations.get(c) === d && this.componentAnimations.delete(c), this.triggerCallback(e, o);
	}
	async componentClearAnimation({ bridgeId: e, params: t }) {
		let { moduleId: n, selector: r, options: i = {}, success: a } = t, o = `${n}:${r}`, s = this.componentAnimations.get(o) || [];
		for (let e of s) {
			if (i.final) try {
				e.finish(), e.commitStyles?.();
			} catch {}
			e.cancel();
		}
		this.componentAnimations.delete(o), this.triggerCallback(e, a);
	}
	addPerformanceObserver({ bridgeId: e, params: t }) {
		let { entryTypes: n = [], success: r } = t, i = D();
		if (typeof PerformanceObserver > "u") {
			this.triggerCallback(e, r, {
				observerId: i,
				unsupported: !0
			});
			return;
		}
		let a = new Set(PerformanceObserver.supportedEntryTypes || []), o = n.filter((e) => a.size === 0 || a.has(e)), s = new PerformanceObserver((t) => {
			let n = t.getEntries().map((e) => typeof e.toJSON == "function" ? e.toJSON() : {
				name: e.name,
				entryType: e.entryType,
				startTime: e.startTime,
				duration: e.duration
			});
			this.triggerCallback(e, r, {
				observerId: i,
				data: { entryList: JSON.stringify(n) }
			});
		});
		o.length > 0 && s.observe({ entryTypes: o }), this.performanceObservers.set(i, s), this.triggerCallback(e, r, { observerId: i });
	}
	removePerformanceObserver({ params: { observerId: e } }) {
		this.performanceObservers.get(e)?.disconnect(), this.performanceObservers.delete(e);
	}
};
function Kg(e, t = /* @__PURE__ */ new WeakMap()) {
	if (typeof e != "object" || !e || typeof e == "function") return e;
	if (t.has(e)) return t.get(e);
	if (Array.isArray(e)) {
		let n = [];
		return t.set(e, n), e.forEach((e) => n.push(Kg(e, t))), n;
	}
	let n = {};
	t.set(e, n);
	for (let [r, i] of Object.entries(e)) n[r] = Kg(i, t);
	return n;
}
var qg = new Gg();
new class {
	constructor() {
		console.log("[system]", "[render]", "init"), this.env = Ye, this.message = N, window.__message = N, window.__callback = ce, this.init(), this.initHmr();
	}
	initHmr() {
		this.hmrState = Ze(), this.message.on("enableDevHmr", (e) => {
			Qe(this.hmrState, e);
		}), this.message.on("hmr", (e) => {
			let t = $e(this.hmrState, e);
			if (!t.accepted) {
				this.message.invoke({
					type: "hmr:result",
					target: "container",
					body: {
						buildId: e?.buildId,
						level: e?.level,
						status: "fallback",
						reason: t.reason
					}
				});
				return;
			}
			t.payload.level === "L2" ? Ge(ze, t.payload).then((e) => {
				let n = e.find((e) => !e.applied);
				this.message.invoke({
					type: "hmr:result",
					target: "container",
					body: {
						buildId: t.payload.buildId,
						level: t.payload.level,
						status: n ? "fallback" : "applied",
						reason: n?.reason
					}
				});
			}) : qg.handleHmr?.(t.payload).then((e) => {
				this.message.invoke({
					type: "hmr:result",
					target: "container",
					body: {
						buildId: t.payload.buildId,
						level: t.payload.level,
						status: e?.status || "fallback",
						reason: e?.reason
					}
				});
			});
		});
	}
	init() {
		this.message.on("loadResource", (e) => {
			let { bridgeId: t, appId: n, pagePath: r, root: i = ".", baseUrl: a = "/", resourceLoadId: o, runtimeType: s } = e;
			qg.registerResourceLoad(t, o), Je.loadResource({
				bridgeId: t,
				appId: n,
				pagePath: r,
				root: i,
				baseUrl: a,
				resourceLoadId: o,
				runtimeType: s
			});
		}), this.message.on("firstRender", (e) => {
			let { bridgeId: t, pageId: n, pagePath: r, initialProps: i, query: a } = e;
			Je.setInitialData(i), qg.firstRender({
				pagePath: r,
				pageId: n,
				bridgeId: t,
				query: a
			});
		}), this.message.on("u", (e) => {
			queueMicrotask(() => {
				qg.updateModule(e);
			});
		}), this.message.on("ub", (e) => {
			queueMicrotask(() => {
				qg.updateModules(e);
			});
		}), this.message.on("invokeAPI", (e) => {
			qg[e.name](e);
		}), this.message.on("triggerCallback", (e) => {
			let { success: t, data: n } = e;
			t && ce.invoke(t, n);
		});
	}
}(), window.modDefine = o, window.modRequire = s;
//#endregion
