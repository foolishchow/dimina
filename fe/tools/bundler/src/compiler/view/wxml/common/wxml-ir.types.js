/**
 * WXML IR / renderer 契约类型（fe-tools-bundler-typecheck · D-TC-10）。
 * 仅 JSDoc typedef；无运行时导出值。白名单内权威类型源——不以 vue/index.js 为准。
 */

/**
 * @typedef {import('./document.js').Span} Span
 * @typedef {import('./document.js').Attr} Attr
 * @typedef {import('./document.js').Value} Value
 */

/**
 * @typedef {object} WxmlDocument
 * @property {null|Span} [span]
 * @property {object[]} body
 * @property {string} [sourceFile]
 * @property {string} [_source]
 */

/**
 * load 产物：展开后的 Document 本体（body 等）上挂 templateModule / scriptModule / sourceTexts。
 * （非 `{ document }` 包装。）
 *
 * @typedef {WxmlDocument & {
 *   templateModule?: object[],
 *   scriptModule?: object[],
 *   sourceTexts?: Map<string, string>,
 * }} LoadedGraph
 */

/**
 * @typedef {object} WxmlRenderResult
 * @property {string} code
 * @property {unknown} [map]
 * @property {Record<string, unknown>} [meta]
 */

/**
 * @typedef {object} WxmlRenderer
 * @property {string} id
 * @property {(input: { loaded?: LoadedGraph }, ctx?: object) => WxmlRenderResult} render
 */

/**
 * @typedef {object} LoadTemplatesCtx
 * @property {boolean} [isComponent]
 * @property {string} [modulePath]
 * @property {string} [sourcePath]
 * @property {Record<string, string>} [components]
 * @property {unknown} [componentPlaceholder]
 * @property {Set<string>} [processedPaths]
 * @property {boolean} [hasOriginalContent]
 * @property {string} workPath
 * @property {RegExp} stripTemplateExtsRegex
 * @property {Record<string, Function>} tools
 * @property {Record<string, Function>} env
 */

export {}
