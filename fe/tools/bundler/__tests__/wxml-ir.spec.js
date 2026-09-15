/**
 * fe-tools-wxml-ir — T-IR0..3 单测（W2：标准 Document，无 _$ 泄漏）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// 副作用：view-compiler 模块加载时注册 backend₀ 'vue'
import '../src/compiler/view/index.js'
import {
	attachProjection,
	deriveLineColumn,
	isSpecialNode,
	plainTree,
	templateNodeKind,
	valueKind,
} from '../src/compiler/view/wxml/document.js'
import { serialize } from '../src/compiler/view/wxml/document-ops.js'
import { parseWxml } from '../src/compiler/view/wxml/parse.js'
import { loadTemplates } from '../src/compiler/view/wxml/load.js'
import { getBackend, listBackends, registerBackend, unregisterBackend } from '../src/compiler/view/wxml/backends/registry.js'
import { createStubBackend } from '../src/compiler/view/wxml/backends/stub.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(testDir, '../src/compiler')
const transformSrc = fs.readFileSync(path.join(srcRoot, 'view/wxml/transform/index.js'), 'utf8')
const wxmlFiles = ['view/wxml/document.js', 'view/wxml/parse.js', 'view/wxml/load.js', 'view/wxml/backends/registry.js', 'view/wxml/backends/vue.js', 'view/wxml/backends/stub.js']

function toCompileTemplateSpan() {
	const start = transformSrc.indexOf('export function toCompileTemplate(')
	const end = transformSrc.indexOf('export function transTagTemplate(', start)
	expect(start).toBeGreaterThan(-1)
	expect(end).toBeGreaterThan(start)
	return transformSrc.slice(start, end)
}

describe('wxml parse（T-IR0 · A-WIR0/A-WIR1/A-WIR6）', () => {
	const SRC = '<view class="a"><text>hello</text><include src="/p/a.wxml" /><import src="/p/b.wxml" /><wxs module="m" /><template name="t1"><text>x</text></template><template is="t1" /></view>'

	it('parseWxml 产出 Document：元素/文本/注释分型 + loc 半开', () => {
		const doc = parseWxml('<view>hi<!--c--></view>', { sourceFile: '/index.wxml' })
		expect(doc.sourceFile).toBe('/index.wxml')
		const view = doc.body.find(n => n.type === 'element' && n.name === 'view')
		expect(view).toBeTruthy()
		expect(view.loc).toBeTruthy()
		expect(view.loc.end).toBeGreaterThan(view.loc.start)
		expect(view.attrs).toEqual([])
		expect(view.directives).toEqual([])
		expect(view.slot).toBeNull()
		const text = view.children.find(n => n.type === 'text')
		expect(text.value).toBe('hi')
		expect(text.loc.end - text.loc.start).toBe('hi'.length)
		const comment = view.children.find(n => n.type === 'comment')
		expect(comment.value).toBe('c')
	})

	it('特殊节点保留在树上（include/import/wxs/template；D-WIR-3）', () => {
		const doc = parseWxml(SRC)
		const tags = doc.body[0].children.filter(isSpecialNode).map(n => n.type)
		expect(tags).toEqual(expect.arrayContaining(['include', 'import', 'wxs', 'template-def', 'template-ref']))
	})

	it('template 定义 vs 引用可指认（R-WIR0）', () => {
		const doc = parseWxml(SRC)
		const templates = doc.body[0].children.filter(n => n.type === 'template-def' || n.type === 'template-ref')
		expect(templates.map(templateNodeKind).sort()).toEqual(['template-def', 'template-ref'])
	})

	it('isSpecialNode 判别', () => {
		const doc = parseWxml(SRC)
		const includeNode = doc.body[0].children.find(n => n.type === 'include')
		expect(isSpecialNode(includeNode)).toBe(true)
		expect(isSpecialNode(doc.body[0])).toBe(false)
	})

	it('loc 为 JS string 索引（offset 语义：文本节点长度自证）', () => {
		const source = '<view>\n  <text>abc</text>\n</view>'
		const doc = parseWxml(source)
		const textElem = doc.body[0].children.find(n => n.type === 'element' && n.name === 'text')
		const text = textElem.children.find(n => n.type === 'text')
		expect(source.slice(text.loc.start, text.loc.end)).toBe('abc')
	})

	it('错误路径带 [wxml] 前缀（R-WIR9）', () => {
		expect(() => parseWxml(null)).toThrow(/\[wxml\] parse:/)
		expect(() => parseWxml(42, { sourceFile: '/a.wxml' })).toThrow(/sourceFile=\/a\.wxml/)
	})

	it('valueKind 三态：static / expr（字符串体）（D-WIR-7）', () => {
		expect(valueKind('red').kind).toBe('static')
		const expr = valueKind('{{item.name}}')
		expect(expr.kind).toBe('expr')
		expect(typeof expr.raw).toBe('string')
	})

	it('deriveLineColumn 行列派生（1 基）', () => {
		expect(deriveLineColumn('a\nbc\nd', 4)).toEqual({ line: 2, column: 3 })
		expect(deriveLineColumn('a\nbc\nd', 5)).toEqual({ line: 3, column: 1 })
		expect(deriveLineColumn('', 0)).toEqual({ line: 1, column: 1 })
		expect(deriveLineColumn('x', -1)).toBeNull()
	})

	it('Document 无 _$ / _elem 泄漏', () => {
		const doc = parseWxml('<view class="a">x</view>')
		expect(doc._$).toBeUndefined()
		expect(Object.keys(doc)).not.toContain('_$')
		expect(JSON.stringify(plainTree(doc))).not.toContain('_$')
		expect(JSON.stringify(plainTree(doc))).not.toContain('_elem')
		const view = doc.body[0]
		expect(view.attrs[0].name).toBe('class')
		expect(view.attrs[0].value.kind).toBe('static')
		expect(view.attrs[0].value.raw).toBe('a')
	})
})

describe('wxml load（T-IR1 · A-WIR1）', () => {
	const MAIN = '<view>main</view><include src="/parts/a.wxml" /><import src="/parts/b.wxml" />'
	const INCLUDE_CONTENT = '<view>A</view><template name="ta"><text>ta</text></template><wxs module="wa" />'
	const IMPORT_CONTENT = '<template name="tb"><text>tb</text></template>'

	function makeEnv({ throwOn } = {}) {
		const edges = []
		return {
			edges,
			env: {
				getContentByPath: (p) => {
					if (throwOn && p.includes(throwOn)) {
						throw new Error('boom')
					}
					if (p.endsWith('a.wxml')) {
						return INCLUDE_CONTENT
					}
					if (p.endsWith('b.wxml')) {
						return IMPORT_CONTENT
					}
					return ''
				},
				getDependencyGraph: () => ({ addFile: (owner, dep, kind) => edges.push([owner, dep, kind]) }),
				getViewScriptTags: () => ['wxs'],
			},
		}
	}

	function makeTools() {
		const calls = { templates: [], wxs: [], assets: 0, compat: [] }
		return {
			calls,
			tools: {
				transTagTemplate: (doc, out, p) => { calls.templates.push(p); out.push({ path: `tpl@${p}`, tpl: 'STUB' }) },
				transTagWxs: (doc, out, p) => { calls.wxs.push(p); out.push({ path: `wxs@${p}` }) },
				transAsses: () => { calls.assets++ },
				resolveTemplateDependencyPath: (wp, base, src) => `${wp}${src}`,
				collectIncludedComponentTags: () => new Set(),
				processIncludedFileWxsDependencies: () => {},
				processIncludeConditionalAttrs: (_node, includeDoc) => {
					if (includeDoc && Array.isArray(includeDoc.body)) {
						return includeDoc.body.splice(0, includeDoc.body.length)
					}
					return includeDoc
				},
				checkTemplateCompatibility: (content, src) => { calls.compat.push(src) },
			},
		}
	}

	function makeLoaded(main = MAIN, { throwOn } = {}) {
		const document = parseWxml(main, { sourceFile: '/index.wxml' })
		attachProjection(document, '_source', main)
		const { env, edges } = makeEnv({ throwOn })
		const { tools, calls } = makeTools()
		const loaded = loadTemplates(document, {
			isComponent: false,
			modulePath: 'pages/index/index',
			sourcePath: '/pages/index/index',
			components: {},
			processedPaths: new Set(),
			hasOriginalContent: true,
			workPath: '/work',
			stripTemplateExtsRegex: /\.(wxml|wxs)$/i,
			tools,
			env,
		})
		return { loaded, edges, calls }
	}

	it('include 展开内联（template/wxs 剥离）；import 不内联仅收集', () => {
		const { loaded } = makeLoaded()
		const html = serialize(loaded)
		expect(html).toContain('<view>A</view>')
		expect(html).not.toContain('name="ta"')
		expect(html).not.toContain('include')
		expect(html).not.toContain('import')
		expect(html).toContain('<view>main</view>')
		expect(loaded._$).toBeUndefined()
	})

	it('templateModule / scriptModule 收集：主文档 + include + import 三源', () => {
		const { loaded, calls } = makeLoaded()
		expect(calls.templates).toEqual(expect.arrayContaining([
			'/parts/a',
			'/pages/index/index',
			'/parts/b',
		]))
		expect(calls.wxs.length).toBeGreaterThanOrEqual(2)
		expect(loaded.templateModule.length).toBe(3)
		expect(loaded.scriptModule.length).toBeGreaterThanOrEqual(2)
	})

	it('依赖图边记录（include/import → view 边）', () => {
		const { edges } = makeLoaded()
		expect(edges).toEqual(expect.arrayContaining([
			['pages/index/index', '/work/parts/a.wxml', 'view'],
			['pages/index/index', '/work/parts/b.wxml', 'view'],
		]))
	})

	it('sourceTexts 可追溯（主 + include + import）', () => {
		const { loaded } = makeLoaded()
		expect(loaded.sourceTexts.get('/index.wxml')).toBe(MAIN)
		expect(loaded.sourceTexts.get('/parts/a.wxml')).toBe(INCLUDE_CONTENT)
		expect(loaded.sourceTexts.get('/parts/b.wxml')).toBe(IMPORT_CONTENT)
	})

	it('多根包装（页）：>1 根包一层 view', () => {
		const { loaded } = makeLoaded('<view>1</view><view>2</view>')
		expect(loaded.body).toHaveLength(1)
		expect(loaded.body[0].name).toBe('view')
		expect(loaded.body[0].children.filter(n => n.type === 'element')).toHaveLength(2)
	})

	it('兼容检查对 include/import 内容执行（顺序保真）', () => {
		const { calls } = makeLoaded()
		expect(calls.compat).toEqual(expect.arrayContaining(['/parts/a.wxml', '/parts/b.wxml']))
	})

	it('读盘失败：[wxml] + sourceFile（R-WIR9）', () => {
		expect(() => makeLoaded(MAIN, { throwOn: 'a.wxml' })).toThrow(/\[wxml\] load: include read failed src=\/parts\/a\.wxml sourceFile=\/parts\/a\.wxml/)
	})

	it('缺 Document / ctx 校验：[wxml] 前缀', () => {
		expect(() => loadTemplates({}, { tools: makeTools().tools, env: makeEnv().env, workPath: '/w', stripTemplateExtsRegex: /x/ }))
			.toThrow(/\[wxml\] load: document body is required/)
		const document = parseWxml('<view/>')
		expect(() => loadTemplates(document, { tools: {}, env: makeEnv().env, workPath: '/w', stripTemplateExtsRegex: /x/ }))
			.toThrow(/\[wxml\] load: ctx\.tools missing/)
	})
})

describe('wxml backend registry（T-IR3 · A-WIR2）', () => {
	it("backend₀ 'vue' 已由 view-compiler 模块注册", () => {
		expect(getBackend('vue')).toBeTruthy()
		expect(getBackend('vue').render).toBeTypeOf('function')
		expect(listBackends()).toContain('vue')
	})

	it('同 id 注册抛错（禁静默覆盖）', () => {
		const stub = createStubBackend()
		registerBackend(stub)
		expect(getBackend('stub')).toBe(stub)
		expect(() => registerBackend(createStubBackend())).toThrow(/\[wxml\] registerBackend: backend id 'stub' already registered/)
		unregisterBackend('stub')
		expect(getBackend('stub')).toBeNull()
	})

	it('形状校验：[wxml] 前缀', () => {
		expect(() => registerBackend(null)).toThrow(/\[wxml\] registerBackend/)
		expect(() => registerBackend({ id: 'x' })).toThrow(/\[wxml\] registerBackend: backend\.render/)
	})

	it('stub 收到 LoadedGraph（标准 Document 与收集物），非原始 WXML 字符串', () => {
		const loaded = parseWxml('<view>x</view>', { sourceFile: '/i.wxml' })
		loaded.templateModule = [{ path: 'tpl-1' }]
		loaded.scriptModule = []
		const stub = createStubBackend()
		registerBackend(stub)
		const result = stub.render({ loaded }, { sourcemap: false })
		unregisterBackend('stub')
		expect(result.meta.stub).toBe(true)
		expect(stub.calls[0].hasDocumentBody).toBe(true)
		expect(stub.calls[0].templateModule).toEqual([{ path: 'tpl-1' }])
	})
})

describe('vue backend render（T-IR2）', () => {
	it('经 Document 驱动 normalizeTemplateDom / transHtmlTag → code', () => {
		const vue = getBackend('vue')
		const loaded = parseWxml('<view>hi</view>', { sourceFile: '/i.wxml' })
		loaded.templateModule = []
		loaded.scriptModule = []
		const calls = []
		const { code, meta } = vue.render({ loaded }, {
			components: {},
			tools: {
				normalizeTemplateDom: () => { calls.push('normalize') },
				transHtmlTag: (html, res) => { calls.push(html); res.push(html.toUpperCase()) },
			},
		})
		expect(calls[0]).toBe('normalize')
		expect(code).toBe(calls[1].toUpperCase())
		expect(meta.backend).toBe('vue')
	})

	it('缺工具 / 缺 Document：[wxml] 前缀（R-WIR9）', () => {
		const vue = getBackend('vue')
		expect(() => vue.render({ loaded: {} }, {})).toThrow(/\[wxml\] vue backend: LoadedGraph document body is missing/)
		const withBody = parseWxml('<view/>')
		expect(() => vue.render({ loaded: withBody }, {})).toThrow(/\[wxml\] vue backend: ctx\.tools\.transHtmlTag/)
	})
})

describe('seam 结构锚定（fe-tools-wxml-ir）', () => {
	it('toCompileTemplate 经 parse → load → getBackend（缝真实；直连内联即失败）', () => {
		const span = toCompileTemplateSpan()
		expect(span).toContain('parseWxml(')
		expect(span).toContain('loadTemplates(')
		expect(span).toContain('getBackend(')
		expect(span).toContain("backend.render(")
		expect(span).not.toContain('cheerio.load(')
		expect(span).not.toContain('transHtmlTag(')
	})

	it('compiler/wxml 无 platform 判别（R-WIR4 / P-WIR03）', () => {
		for (const file of wxmlFiles) {
			const src = fs.readFileSync(path.join(srcRoot, file), 'utf8')
			expect(src.match(/platform\s*===/), file).toBeNull()
		}
	})
})
