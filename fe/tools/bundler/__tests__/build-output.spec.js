import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distViewCompiler = path.join(packageRoot, 'dist/core/view-compiler.js')
const srcViewCompiler = path.join(packageRoot, 'src/core/view-compiler.js')

/**
 * D-UV-6: assert mirrored ESM tree (no Vite transform). Prefer dist after
 * `pnpm build`; fall back to src as the 1:1 mirror source of truth.
 */
function resolveViewCompilerPath() {
	if (fs.existsSync(distViewCompiler)) {
		return distViewCompiler
	}
	return srcViewCompiler
}

describe('compiler build output', () => {
	it('esm 产物不应为 Babel 依赖保留运行时 require 调用', () => {
		const viewCompilerPath = resolveViewCompilerPath()
		expect(fs.existsSync(viewCompilerPath)).toBe(true)

		const output = fs.readFileSync(viewCompilerPath, 'utf-8')

		expect(output).not.toMatch(/require\(["']@babel\/core["']\)/)
		expect(output).not.toMatch(/require\(["']@babel\/traverse["']\)/)
		expect(output).not.toMatch(/require\(["']@babel\/types["']\)/)
		expect(output).not.toMatch(/require\(["']@babel\/plugin-transform-modules-commonjs["']\)/)
	})
})
