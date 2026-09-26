import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readProjectConfig } from '../src/packer/graph/config-fixpoint.ts'
import { buildPackerContext } from '../src/packer/store/env-compute.ts'

/**
 * fe-tools-env-l1-extract（F-R1-5）：原 env.spec.js 测 env.storeProjectConfig 薄壳
 * （已删——src/ 0 caller 死代码）。改为 config-fixpoint.readProjectConfig 直测，
 * 保留 project.config.json + project.private.config.json 合并优先级覆盖
 * （config-fixpoint 无自有测试）。
 */

// Mock fs module
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...actual,
		default: {
			...actual.default,
			existsSync: vi.fn(),
			readFileSync: vi.fn(),
			mkdirSync: vi.fn(),
		},
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	}
})

describe('readProjectConfig（config-fixpoint 直测）', () => {
	const mockWorkPath = path.join(os.tmpdir(), 'dimina-test-project')
	const originalEnv = { ...process.env }

	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks()

		// Get the correct fs methods (either from default or directly)
		const { existsSync, readFileSync } = fs.default || fs

		// Set up default mock implementations
		existsSync.mockImplementation((filePath) => {
			return filePath.includes('project.config.json') || filePath.includes('project.private.config.json')
		})

		readFileSync.mockImplementation((filePath) => {
			if (filePath.includes('project.config.json')) {
				return JSON.stringify({
					appid: 'wx1234567890abcdef',
					projectname: 'Default Project Name',
				})
			}
			if (filePath.includes('project.private.config.json')) {
				return JSON.stringify({
					projectname: 'Private Project Name',
				})
			}
			return '{}'
		})
	})

	afterEach(() => {
		process.env = { ...originalEnv }
	})

	function runReadProjectConfig() {
		const configData = {}
		readProjectConfig({ ctx: buildPackerContext(mockWorkPath, '/out'), configData, npm: null })
		return configData.projectInfo ?? {}
	}

	it('should load and merge both config files with private config taking precedence', () => {
		// Test case when both config files exist
		const config = runReadProjectConfig()

		expect(config).toEqual({
			appid: 'wx1234567890abcdef', // From project.config.json
			projectname: 'Private Project Name', // Overridden by private config
		})
	})

	it('should work when only project.config.json exists', () => {
		const { existsSync } = fs.default || fs
		existsSync.mockImplementation((filePath) => {
			return filePath.includes('project.config.json')
		})

		const config = runReadProjectConfig()

		expect(config).toEqual({
			appid: 'wx1234567890abcdef',
			projectname: 'Default Project Name',
		})
	})

	it('should work when only project.private.config.json exists', () => {
		const { existsSync } = fs.default || fs
		existsSync.mockImplementation((filePath) => {
			return filePath.includes('project.private.config.json')
		})

		const config = runReadProjectConfig()

		expect(config).toEqual({
			projectname: 'Private Project Name',
		})
	})

	it('should handle when both config files are missing', () => {
		const { existsSync } = fs.default || fs
		existsSync.mockReturnValue(false)

		const config = runReadProjectConfig()

		expect(config).toEqual({})
	})

	it('should handle JSON parse errors', () => {
		const { readFileSync } = fs.default || fs
		readFileSync.mockImplementation((filePath) => {
			if (filePath.includes('project.config.json')) {
				throw new Error('Invalid JSON')
			}
			return '{}'
		})

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const config = runReadProjectConfig()

		expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to parse project.config.json:', 'Invalid JSON')
		expect(config).toEqual({})

		consoleWarnSpy.mockRestore()
	})
})
