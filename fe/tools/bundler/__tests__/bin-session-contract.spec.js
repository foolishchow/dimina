import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.resolve(testDir, '../src/bin/index.js')

/**
 * A-BS02 (build part) — dimina-cli build routes through the session API.
 * O1 covers one-shot; `-w` extends this spec in O2, `dev` in O3.
 */
describe('dimina-cli bin contract (session wiring)', () => {
	let tempDir
	let outputDir
	const pagePath = 'pages/index/index'

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bin-session-contract-'))
		outputDir = path.join(tempDir, 'out')
		writeFile('app.json', JSON.stringify({ pages: [pagePath] }))
		writeFile('app.js', 'App({})\n')
		writeFile('app.wxss', '')
		writeFile('project.config.json', JSON.stringify({ appid: 'bin-session-app' }))
		writeFile(`${pagePath}.json`, '{}')
		writeFile(`${pagePath}.js`, 'Page({})\n')
		writeFile(`${pagePath}.wxml`, '<view>cli</view>\n')
		writeFile(`${pagePath}.wxss`, '')
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	function writeFile(relativePath, content) {
		const filePath = path.join(tempDir, relativePath)
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	}

	it('build compiles via session (exit 0 + published artifacts)', () => {
		const result = spawnSync(process.execPath, [
			cliPath,
			'build',
			'--work-path', tempDir,
			'--target-path', outputDir,
			'--no-app-id-dir',
		], {
			encoding: 'utf8',
			env: {
				...process.env,
				NO_COLOR: '1',
			},
		})

		expect(result.status).toBe(0)
		expect(fs.existsSync(outputDir)).toBe(true)
		// 发布产物：main/app-config.json 存在
		expect(fs.existsSync(path.join(outputDir, 'main', 'app-config.json'))).toBe(true)
	})

	it('build exits non-zero with the documented error message on failure', () => {
		const missing = path.join(tempDir, 'missing-app')
		const result = spawnSync(process.execPath, [
			cliPath,
			'build',
			'--work-path', missing,
			'--target-path', outputDir,
		], {
			encoding: 'utf8',
			env: {
				...process.env,
				NO_COLOR: '1',
			},
		})

		expect(result.status).toBe(1)
		expect(result.stderr).toContain(`${missing} 编译出错`)
	})

	it('build -w runs via session.watch: initial build, rebuild on change, SIGINT terminates', async () => {
		const child = spawn(process.execPath, [
			cliPath,
			'build',
			'--work-path', tempDir,
			'--target-path', outputDir,
			'--no-app-id-dir',
			'--watch',
		], {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				NO_COLOR: '1',
			},
		})

		let stdout = ''
		child.stdout.on('data', chunk => (stdout += chunk))
		child.stderr.on('data', chunk => (stdout += chunk))

		try {
			// 初始编译完成：产物出现
			await waitUntil(() => fs.existsSync(path.join(outputDir, 'main', 'app-config.json')), 20_000)

			// 触发 rebuild：追加页面模板改动
			fs.appendFileSync(path.join(tempDir, `${pagePath}.wxml`), '<view>changed</view>\n')
			await waitUntil(() => stdout.includes('重新编译'), 20_000)

			// SIGINT：与今日一致（bin 无 signal handler，默认终止）
			child.kill('SIGINT')
			await exitWithin(child, 5_000)
		}
		finally {
			if (child.exitCode === null) {
				child.kill('SIGKILL')
			}
		}
	})
})

function waitUntil(predicate, timeoutMs, intervalMs = 100) {
	const deadline = Date.now() + timeoutMs
	return new Promise((resolve, reject) => {
		const tick = () => {
			if (predicate()) {
				resolve()
				return
			}
			if (Date.now() > deadline) {
				reject(new Error(`waitUntil timed out after ${timeoutMs}ms`))
				return
			}
			setTimeout(tick, intervalMs)
		}
		tick()
	})
}

function exitWithin(child, timeoutMs) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`process did not exit within ${timeoutMs}ms`)), timeoutMs)
		child.once('exit', () => {
			clearTimeout(timer)
			resolve()
		})
	})
}
