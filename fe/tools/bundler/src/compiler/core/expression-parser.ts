/**
 * 表达式解析器 - 使用 Oxc AST 解析器提取依赖
 */

import { parseSync } from 'oxc-parser'

// JavaScript 关键字和全局对象，不应该被识别为数据依赖
const KEYWORDS = new Set([
	'true', 'false', 'null', 'undefined',
	'NaN', 'Infinity',
	'this', 'arguments',
	'Array', 'Object', 'String', 'Number', 'Boolean',
	'Math', 'Date', 'RegExp', 'Error',
	'JSON', 'console', 'window', 'document',
	'parseInt', 'parseFloat', 'isNaN', 'isFinite',
	'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent'
])

/**
 * 提取表达式中的所有变量依赖路径
 * 使用 Oxc AST 解析器进行精确分析
 * @param {string} expression - 表达式字符串，如 "count || defaultValue" 或 "item.name"
 * @returns {Array<string>} - 依赖的变量名数组，如 ["count", "defaultValue"] 或 ["item"]
 */
export function extractDependencies(expression: string | null | undefined): string[] {
	if (!expression || typeof expression !== 'string') {
		return []
	}

	const dependencies = new Set<string>()

	try {
		// 将表达式包装为完整的语句以便 Oxc 解析
		const code = `(${expression})`
		const ast = parseSync('expression.js', code, {
			sourceType: 'module',
			lang: 'js',
		}).program

		visitExpressionAst(ast as unknown, null, dependencies)
	} catch (error) {
		// AST 解析失败时回退到空数组
		console.warn('[expression-parser] AST 解析失败，表达式:', expression, '错误:', (error as Error).message)
		return []
	}

	return Array.from(dependencies) as string[]
}

function visitExpressionAst(node: unknown, parent: unknown, dependencies: Set<string>): void {
	if (!node || typeof node !== 'object') {
		return
	}

	if ((node as { type?: string }).type === 'Identifier') {
		collectIdentifier(node, parent, dependencies)
		return
	}

	// 处理成员表达式，确保只提取根对象，并跳过子节点避免重复处理属性名
	if ((node as { type?: string }).type === 'MemberExpression') {
		let root = (node as { object?: unknown }).object
		while ((root as { type?: string } | null | undefined)?.type === 'MemberExpression' || (root as { type?: string } | null | undefined)?.type === 'ChainExpression') {
			root = (root as { type?: string }).type === 'ChainExpression' ? (root as { expression?: unknown }).expression : (root as { object?: unknown }).object
		}

		if ((root as { type?: string } | null | undefined)?.type === 'Identifier' && !KEYWORDS.has((root as { name?: string }).name!)) {
			dependencies.add((root as { name: string }).name)
		}
		return
	}

	for (const [key, value] of Object.entries(node)) {
		if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') {
			continue
		}

		if (Array.isArray(value)) {
			for (const child of value) {
				visitExpressionAst(child, node, dependencies)
			}
		}
		else {
			visitExpressionAst(value, node, dependencies)
		}
	}
}

function collectIdentifier(node: { name?: string }, parent: unknown, dependencies: Set<string>): void {
	const name = node.name as string

	// 跳过关键字和全局对象
	if (KEYWORDS.has(name)) {
		return
	}

	// 如果是 obj.prop，我们只要 obj，不要 prop
	if ((parent as { type?: string; property?: unknown; computed?: boolean } | null | undefined)?.type === 'MemberExpression' && (parent as { property?: unknown }).property === node && !(parent as { computed?: boolean }).computed) {
		return
	}

	// 对象字面量的非计算 key 是静态属性名，不是数据依赖
	if ((parent as { type?: string; key?: unknown; computed?: boolean; shorthand?: boolean } | null | undefined)?.type === 'Property' && (parent as { key?: unknown }).key === node && !(parent as { computed?: boolean }).computed && !(parent as { shorthand?: boolean }).shorthand) {
		return
	}

	dependencies.add(name)
}

/**
 * 解析表达式并生成依赖路径信息
 * @param {string} expression - 表达式字符串
 * @returns {Object} - { expression: 原始表达式, dependencies: 依赖数组, isSimple: 是否简单绑定 }
 */
export function parseExpression(expression: string | null | undefined): { expression: string; dependencies: string[]; isSimple: boolean } {
	if (!expression || typeof expression !== 'string') {
		return {
			expression: '',
			dependencies: [],
			isSimple: true
		}
	}

	const dependencies = extractDependencies(expression)

	// 判断是否为简单绑定（单个变量，无运算符）
	// 简单绑定：count, item, data
	// 复杂绑定：count + 1, item.name, count || defaultValue
	const isSimple = dependencies.length === 1 && expression.trim() === dependencies[0]

	return {
		expression: expression.trim(),
		dependencies,
		isSimple
	}
}

/**
 * 解析成员访问表达式，提取根对象和路径
 * @param {string} expression - 表达式字符串，如 "item.name" 或 "data[0].value"
 * @returns {Object} - { root: 根对象, path: 完整路径 }
 */
export function parseMemberExpression(expression: string | null | undefined): { root: string | null; path: string | null } {
	if (!expression || typeof expression !== 'string') {
		return { root: null, path: null }
	}

	expression = expression.trim()

	// 提取第一个标识符作为根对象
	const rootMatch = expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/)
	if (!rootMatch) {
		return { root: null, path: null }
	}

	const root = rootMatch[1]

	// 如果表达式就是根对象本身，返回
	if (expression === root) {
		return { root, path: root }
	}

	// 否则返回完整路径
	return { root, path: expression }
}

/**
 * 检查表达式是否包含某个依赖
 * @param {string} expression - 表达式字符串
 * @param {string} dependency - 要检查的依赖变量名
 * @returns {boolean} 如果表达式包含该依赖则返回 true，否则返回 false
 */
export function hasDependency(expression: string, dependency: string): boolean {
	const deps = extractDependencies(expression)
	return deps.includes(dependency)
}

/**
 * 批量解析多个属性绑定表达式
 * @param {Object} bindings - 绑定对象，如 { count2: "count", value: "item.name" }
 * @returns {Object} - 解析后的绑定信息
 */
export function parseBindings(bindings: Record<string, unknown> | null | undefined): Record<string, unknown> {
	if (!bindings || typeof bindings !== 'object') {
		return {}
	}

	const parsed: Record<string, unknown> = {}

	for (const [propName, expression] of Object.entries(bindings)) {
		parsed[propName] = parseExpression(expression as string)
	}

	return parsed
}
