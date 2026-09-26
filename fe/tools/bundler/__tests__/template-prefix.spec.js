import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkTemplateCompatibility, getTemplateDirectiveName } from '../src/packer/aspect/compatibility.ts'
import { getPages, storeInfo } from '../src/packer/store/env.ts'
import { compileML } from '../src/compiler/view/index.ts'
import { runWithAbilities, buildCtxFromStoreInfo } from './helpers/run-with-abilities.js'

describe('template directive prefixes', () => {
	let tempDir
	let targetDir

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-prefix-'))
		targetDir = path.join(tempDir, 'dist')
		process.env.TARGET_PATH = targetDir
		fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
		fs.writeFileSync(path.join(tempDir, 'project.config.json'), JSON.stringify({ appid: 'template-prefix-app' }))
		fs.mkdirSync(path.join(tempDir, 'pages/index'), { recursive: true })
		fs.writeFileSync(path.join(tempDir, 'pages/index/index.json'), '{}')
		fs.writeFileSync(path.join(tempDir, 'pages/index/index.js'), 'Page({ data: { hidden: true } })\n')
	})

	afterEach(() => {
		vi.restoreAllMocks()
		delete process.env.TARGET_PATH
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	it('derives allowed directive prefixes from configured template types', () => {
		const si = storeInfo(tempDir, { fileTypes: { template: ['qdml'] } })
		const ctx = buildCtxFromStoreInfo(si)

		expect(getTemplateDirectiveName('wx:if')).toBe('if')
		expect(getTemplateDirectiveName('dd:for')).toBe('for')
		expect(getTemplateDirectiveName('qd:key')).toBe('key')
		expect(getTemplateDirectiveName('wwx:if')).toBeNull()
		expect(getTemplateDirectiveName('bind:if')).toBeNull()
	})

	it('reports invalid prefixes instead of silently accepting them', () => {
		const si = storeInfo(tempDir)
		const ctx = buildCtxFromStoreInfo(si)
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		checkTemplateCompatibility(
			'<view typo:if="{{hidden}}" wx:unknown="value" bind:if="handler" />',
			'/pages/index/index.wxml',
		)

		expect(warn).toHaveBeenCalledTimes(2)
		expect(warn.mock.calls[0][0]).toContain('typo:if')
		expect(warn.mock.calls[1][0]).toContain('wx:unknown')
	})

	it('keeps an invalid prefixed condition as a normal attribute', async () => {
		fs.writeFileSync(
			path.join(tempDir, 'pages/index/index.wxml'),
			'<view typo:if="{{hidden}}">still rendered</view>\n',
		)
		const si = storeInfo(tempDir)
		const ctx = buildCtxFromStoreInfo(si)
		await runWithAbilities(targetDir, async () => compileML(getPages().mainPages, null, { completedTasks: 0 }, undefined, undefined, null, ctx))

		const output = fs.readFileSync(path.join(targetDir, 'main/pages_index_index.js'), 'utf8')
		expect(output).toContain('typo:if')
		expect(output).not.toMatch(/hidden\)\s*\?\s*\(/)
	})
})
