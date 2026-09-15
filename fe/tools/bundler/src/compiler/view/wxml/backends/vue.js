/**
 * vue backend（backend₀ · fe-tools-wxml-ir · T-IR2 + wxml-bridge · W2）。
 *
 * 归属（technical-design 阶段归属表）：slot 分组、dimina-slot-group、
 * 标签→Vue、指令改写、compileTemplate 属 Vue 侧。v1（先切缝，再迁语义）：
 * - render 消费 **LoadedGraph**（投影句柄 `_$`），驱动
 *   normalizeTemplateDom / transHtmlTag（经 ctx.tools 注入，算法仍在
 *   view-compiler 工具袋）产出 Vue 模板串（code）；
 * - compileTemplate + 缓存/打包/sourcemap 组装留在 view-compiler
 *   「既有缓存/打包壳」（technical-design 模块落点注）；
 * - 不得以「原始 WXML 字符串 → cheerio → 产物」为权威路径（投影仅来自
 *   Document/LoadedGraph —— cheerio 不变量 F-005）。
 *
 * W2（fe-tools-wxml-bridge）：render 额外产出行源表（meta.lineOrigins）——
 * 展开后 DOM（post-normalize）逐顶层节点序列化，每 html 行映射到真实
 * {source, line}（include 内联节点经 loaded._elemFiles 标记源文件 +
 *   deriveLineColumn 跨文件归位）；transHtmlTag 后行数对比标记 shifted。
 * compileModule 用行源表构建 inMap（sourcemap.js createOriginsSourcemap）。
 */
import { deriveLineColumn } from '../document.js'

export const VUE_BACKEND_ID = 'vue'

/**
 * 展开后 DOM → 行源表（html 行 → {source, line}；跨文件归位）。
 * - include 内联节点：loaded._elemFiles 标记源文件；startIndex 为该文件内
 *   偏移 → deriveLineColumn(fileText, startIndex) 得真实行。
 * - 主文件节点缺省 loaded.sourceFile；合成节点（多根包装/component-host）
 *   标主文件第 1 行（synthetic）。
 * - 顶层间空白/未序列化行 → 主文件第 1 行（fallback）。
 */
function buildLineOrigins($, { sourceFile, sourceTexts }) {
	const html = $.html()
	const totalLines = html.split('\n').length
	// 每行记录最深含它的元素的 origin（父先填、子后填覆盖 → 最深赢）
	const origins = new Array(totalLines)

	const WIR_SRC = Symbol.for('db.wxml-bridge.source')
	const originFor = (elem) => {
		// 自身带标（include 节点）；否则沿祖先链找最近带标祖先（容忍 normalize 克隆/搬移）
		let entry = elem?.[WIR_SRC] ?? null
		let node = elem
		while (!entry && node) {
			entry = node?.[WIR_SRC] ?? null
			node = node.parent && node.parent.type === 'root' ? null : node.parent
		}
		const file = entry?.source ?? sourceFile
		const text = entry?.text ?? sourceTexts?.get(file)
		let line = 1
		if (text && typeof elem.startIndex === 'number') {
			line = deriveLineColumn(text, elem.startIndex)?.line ?? 1
		}
		return { source: file, line }
	}

	const lineOfOffset = (offset) => {
		let line = 1
		for (let i = 0; i < offset && i < html.length; i++) {
			if (html.charCodeAt(i) === 10) line++
		}
		return line
	}

	const walk = (elems, searchPos) => {
		for (const elem of elems) {
			if (!elem || elem.type === 'text' || elem.type === 'comment') {
				continue
			}
			let serialized = ''
			try {
				serialized = $.html(elem) ?? ''
			}
			catch {
				serialized = ''
			}
			if (!serialized) continue
			const idx = html.indexOf(serialized, searchPos)
			if (idx >= 0) {
				const startLine = lineOfOffset(idx)
				const lineCount = serialized.split('\n').length
				const origin = originFor(elem)
				for (let l = startLine; l < startLine + lineCount && l <= totalLines; l++) {
					origins[l - 1] = origin
				}
				const children = elem.children || []
				if (children.length > 0) {
					// 子节点位于父序列化【内部】——从父起点（idx）开始搜索；
					// （+1 防自匹配——父与子序列化不同串，无碍）
					walk(children, idx)
				}
			}
			// idx < 0：子串定位失败 → 不填，归 fallback（祖先 origin 已由父覆盖或不填）
		}
	}
	walk($.root().children().toArray(), 0)

	for (let i = 0; i < totalLines; i++) {
		if (!origins[i]) {
			origins[i] = { source: sourceFile, line: 1 }
		}
	}
	return origins
}

function buildSourceContents(sourceTexts) {
	const out = new Map()
	if (!sourceTexts) {
		return out
	}
	for (const [src, content] of sourceTexts) {
		if (typeof content === 'string') {
			out.set(src, content)
		}
	}
	return out
}

/**
 * @param {{ loaded: object }} input LoadedGraph（含 `_$` 投影句柄、`_elemFiles`、sourceTexts）
 * @param {object} ctx BackendContext（components / componentPlaceholder / tools）
 * @returns {{ code: string, map: null, meta: { backend, lineOrigins?, sourceContents?, shifted? } }}
 */
function render({ loaded }, ctx = {}) {
	const { components = {}, componentPlaceholder, tools } = ctx
	const $ = loaded?._$
	if (!$) {
		throw new TypeError('[wxml] vue backend: LoadedGraph projection handle (_$) is missing — render must consume a LoadedGraph, not raw WXML source')
	}
	if (!tools || typeof tools.transHtmlTag !== 'function') {
		throw new TypeError('[wxml] vue backend: ctx.tools.transHtmlTag is required (transitional injection)')
	}
	const { normalizeTemplateDom } = tools
	if (typeof normalizeTemplateDom === 'function') {
		normalizeTemplateDom($, $.root(), components)
	}

	// W2：post-normalize 序列化上建立行源表（与 transHtmlTag 输入同串）
	const html = $.html()
	const lineOrigins = buildLineOrigins($, {
		sourceFile: loaded.sourceFile ?? 'index.wxml',
		sourceTexts: loaded.sourceTexts,
	})

	const res = []
	tools.transHtmlTag(html, res, components, componentPlaceholder)
	const code = res.join('')

	// F14 双不变量：
	// ①无跨文件源（无 include/import）→ 行源表不启用，compileModule 回退
	//   createLineSourcemap —— 无 include 页行为 0 变化（硬不变量「= 今日」）
	// ②有跨文件源 → 启用行源表（跨文件归位），transHtmlTag 行结构保持探针
	//   （行数一致按索引对齐；否则截断/补尾 + shifted 标记）
	const hasCrossFile = lineOrigins.some(o => o.source !== (loaded.sourceFile ?? 'index.wxml'))
	let shifted = false
	let alignedOrigins = null
	if (hasCrossFile) {
		// 跨文件归位启用时才对齐行结构；无跨文件源 → null → compileModule 回退
		alignedOrigins = lineOrigins
		const codeLines = code.split('\n').length
		const htmlLines = html.split('\n').length
		if (codeLines !== htmlLines) {
			shifted = true
			if (codeLines < htmlLines) {
				alignedOrigins = lineOrigins.slice(0, codeLines)
			}
			else {
				const last = lineOrigins[lineOrigins.length - 1] ?? { source: loaded.sourceFile ?? 'index.wxml', line: 1 }
				while (alignedOrigins.length < codeLines) {
					alignedOrigins.push({ ...last })
				}
			}
		}
	}

	return {
		code,
		map: null,
		meta: {
			backend: VUE_BACKEND_ID,
			lineOrigins: alignedOrigins,
			sourceContents: buildSourceContents(loaded.sourceTexts),
			shifted,
		},
	}
}

export const vueBackend = Object.freeze({
	id: VUE_BACKEND_ID,
	render,
})
