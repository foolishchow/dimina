import { afterEach, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let root
afterEach(() => { if (root) fs.rmSync(root, { recursive: true, force: true }); delete globalThis.DiminaServiceBridge })
it('runs USER_DATA_PATH cache operations through real Promise and callback bridge adapters', async () => {
	vi.resetModules()
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'dimina-js-cache-'))
	globalThis.DiminaServiceBridge = { invoke: vi.fn(), publish: vi.fn() }
	const { callback } = await import('@dimina/common')
	const { getFileSystemManager } = await import('../src/api/core/file/index.js')
	const { env } = await import('../src/api/core/base/index.js')
	const nativePath = value => path.join(root, value.slice(env.USER_DATA_PATH.length))
	globalThis.DiminaServiceBridge.invoke.mockImplementation(raw => {
		const { name, params } = raw.body
		queueMicrotask(() => {
			try {
				const result = { errMsg: `${name}:ok` }
				switch (name) {
					case 'FileSystemManager.access': fs.accessSync(nativePath(params.path)); break
					case 'FileSystemManager.mkdir': fs.mkdirSync(nativePath(params.dirPath), { recursive: params.recursive }); break
					case 'FileSystemManager.writeFile': fs.writeFileSync(nativePath(params.filePath), params.data, params.encoding); break
					case 'FileSystemManager.readFile': result.data = fs.readFileSync(nativePath(params.filePath), params.encoding); break
					case 'FileSystemManager.unlink': fs.unlinkSync(nativePath(params.filePath)); break
					default: throw new Error(`unexpected ${name}`)
				}
				callback.invoke(params.success, result); callback.invoke(params.complete, result)
			}
			catch (error) {
				const result = { errMsg: `${name}:fail ${error.message}` }
				callback.invoke(params.fail, result); callback.invoke(params.complete, result)
			}
		})
	})
	const manager = getFileSystemManager(), base = `${env.USER_DATA_PATH}/form-cache`, file = `${base}/form.json`
	await expect(manager.access({ path: base })).rejects.toMatchObject({ errMsg: expect.stringContaining('access:fail') })
	await manager.mkdir({ dirPath: base, recursive: true })
	const text = JSON.stringify({ form: 'x'.repeat(2 * 1024 * 1024) + '中文' })
	await manager.writeFile({ filePath: file, data: text, encoding: 'utf8' })
	await expect(manager.readFile({ filePath: file, encoding: 'utf8' })).resolves.toMatchObject({ data: text })
	const complete = vi.fn()
	await new Promise((resolve, reject) => {
		manager.writeFile({ filePath: file, data: '{}', encoding: 'utf8', success: resolve, fail: reject, complete })
	})
	expect(complete).toHaveBeenCalledOnce()
	await new Promise((resolve, reject) => manager.readFile({ filePath: file, encoding: 'utf8', success: result => {
		expect(result.data).toBe('{}'); resolve()
	}, fail: reject }))
	await manager.unlink({ filePath: file })
	await expect(manager.readFile({ filePath: file, encoding: 'utf8' })).rejects.toMatchObject({ errMsg: expect.stringContaining('readFile:fail') })
})
