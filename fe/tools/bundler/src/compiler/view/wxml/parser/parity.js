/**
 * 双 parser 语义对拍辅助（fe-tools-wxml-refactor · W3 · P-WR04）。
 *
 * 比较 type/name、attrs 名与值分类、directives、特殊节点字段、可用 span。
 * cheerio 属性 span 为 null 不构成不等价（D-WR-5）。
 */
import { attrValueRaw } from '../document.js'

/**
 * @param {object} a
 * @param {object} b
 * @param {{ ignoreAttrSpan?: boolean }} [opts]
 * @returns {{ ok: boolean, path: string, reason?: string }}
 */
export function compareDocumentsSemantic(a, b, opts = {}) {
	const ignoreAttrSpan = opts.ignoreAttrSpan !== false
	const diffs = []
	walkCompare(a?.body || [], b?.body || [], 'body', diffs, ignoreAttrSpan)
	if (a?.sourceFile !== undefined || b?.sourceFile !== undefined) {
		if (a?.sourceFile !== b?.sourceFile) {
			diffs.push({ path: 'sourceFile', reason: `${a?.sourceFile} !== ${b?.sourceFile}` })
		}
	}
	if (diffs.length === 0) {
		return { ok: true, path: '', diffs: [] }
	}
	return { ok: false, path: diffs[0].path, reason: diffs[0].reason, diffs }
}

function walkCompare(left, right, path, diffs, ignoreAttrSpan) {
	if (left.length !== right.length) {
		diffs.push({ path, reason: `length ${left.length} !== ${right.length}` })
		return
	}
	for (let i = 0; i < left.length; i++) {
		compareNode(left[i], right[i], `${path}[${i}]`, diffs, ignoreAttrSpan)
		if (diffs.length > 0) {
			return
		}
	}
}

function compareNode(a, b, path, diffs, ignoreAttrSpan) {
	if (!a || !b) {
		diffs.push({ path, reason: `missing node a=${!!a} b=${!!b}` })
		return
	}
	if (a.type !== b.type) {
		diffs.push({ path: `${path}.type`, reason: `${a.type} !== ${b.type}` })
		return
	}
	if (a.type === 'text' || a.type === 'comment') {
		if (String(a.value ?? '') !== String(b.value ?? '')) {
			diffs.push({ path: `${path}.value`, reason: `${JSON.stringify(a.value)} !== ${JSON.stringify(b.value)}` })
		}
		compareSpanOptional(a.span || a.loc, b.span || b.loc, `${path}.span`, diffs)
		return
	}

	const nameA = semanticName(a)
	const nameB = semanticName(b)
	if (nameA !== nameB) {
		diffs.push({ path: `${path}.name`, reason: `${nameA} !== ${nameB}` })
		return
	}

	if ((a.src ?? null) !== (b.src ?? null) && (a.type === 'include' || a.type === 'import' || a.type === 'wxs')) {
		diffs.push({ path: `${path}.src`, reason: `${a.src} !== ${b.src}` })
		return
	}
	if (a.type === 'wxs' && (a.module ?? null) !== (b.module ?? null)) {
		diffs.push({ path: `${path}.module`, reason: `${a.module} !== ${b.module}` })
		return
	}
	if (a.type === 'template-ref' && (a.is ?? '') !== (b.is ?? '')) {
		diffs.push({ path: `${path}.is`, reason: `${a.is} !== ${b.is}` })
		return
	}
	if (a.type === 'slot' && (a.name ?? null) !== (b.name ?? null)) {
		diffs.push({ path: `${path}.name`, reason: `${a.name} !== ${b.name}` })
		return
	}

	compareAttrs(a.attrs || [], b.attrs || [], `${path}.attrs`, diffs, ignoreAttrSpan)
	if (diffs.length > 0) {
		return
	}

	// directives：一侧为空时不强制相等（cheerio 投影常为 []）
	const da = a.directives || []
	const db = b.directives || []
	if (da.length > 0 && db.length > 0) {
		if (da.length !== db.length) {
			diffs.push({ path: `${path}.directives`, reason: `length ${da.length} !== ${db.length}` })
			return
		}
		for (let i = 0; i < da.length; i++) {
			if (da[i].kind !== db[i].kind) {
				diffs.push({ path: `${path}.directives[${i}].kind`, reason: `${da[i].kind} !== ${db[i].kind}` })
				return
			}
		}
	}

	compareSpanOptional(a.span || a.loc, b.span || b.loc, `${path}.span`, diffs)
	const kidsA = a.children || a.body || []
	const kidsB = b.children || b.body || []
	walkCompare(kidsA, kidsB, `${path}.children`, diffs, ignoreAttrSpan)
}

function semanticName(node) {
	if (!node) {
		return null
	}
	if (node.type === 'include' || node.type === 'import') {
		return node.type
	}
	if (node.type === 'template-def' || node.type === 'template-ref') {
		return 'template'
	}
	if (node.type === 'slot') {
		return 'slot'
	}
	if (node.type === 'wxs') {
		return 'wxs'
	}
	return node.name ?? null
}

function compareAttrs(a, b, path, diffs, ignoreAttrSpan) {
	const mapA = attrMap(a)
	const mapB = attrMap(b)
	const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)])
	for (const key of keys) {
		const va = mapA[key]
		const vb = mapB[key]
		if (!va || !vb) {
			diffs.push({ path: `${path}.${key}`, reason: `missing on ${va ? 'b' : 'a'}` })
			return
		}
		if (va.raw !== vb.raw) {
			diffs.push({ path: `${path}.${key}.raw`, reason: `${JSON.stringify(va.raw)} !== ${JSON.stringify(vb.raw)}` })
			return
		}
		if (va.kind !== vb.kind) {
			// cheerio makeValue：含 {{}} 一律 expr；napi 可能 template——值 raw 已比，kind 放宽
			const soft = new Set(['expr', 'template'])
			if (!(soft.has(va.kind) && soft.has(vb.kind))) {
				diffs.push({ path: `${path}.${key}.kind`, reason: `${va.kind} !== ${vb.kind}` })
				return
			}
		}
		if (!ignoreAttrSpan) {
			compareSpanOptional(va.span, vb.span, `${path}.${key}.span`, diffs)
		}
	}
}

function attrMap(attrs) {
	const out = {}
	for (const attr of attrs || []) {
		if (!attr?.name) {
			continue
		}
		out[attr.name] = {
			raw: attrValueRaw(attr),
			kind: attr.value?.kind ?? (attr.value == null ? 'empty' : 'static'),
			span: attr.span ?? null,
		}
	}
	return out
}

function compareSpanOptional(a, b, path, diffs) {
	if (!a || !b) {
		return
	}
	if (a.start !== b.start || a.end !== b.end) {
		diffs.push({ path, reason: `[${a.start},${a.end}) !== [${b.start},${b.end})` })
	}
}
