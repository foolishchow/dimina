import fs from 'node:fs'
import path from 'node:path'
import { parentPort } from 'node:worker_threads'

/**
 * @typedef {{ path: string, code: string }} EmitFile
 * @typedef {{ path: string, map: string }} EmitSourcemap
 * @typedef {{ entryId: string, kind: string, files: EmitFile[], sourcemaps?: EmitSourcemap[] }} EmitEntry
 */

/**
 * 唯一写盘出口（materialize 名不副实修复）。
 * D-E-3 统一出口 + D-E-7 独立 + D-E-11 不管 count + D-E-12 不管 rebase。
 * collectOutput 路径 postMessage(M1)；否则 mkdir -p(writeDir) + writeFileSync。
 * @param {{ entry: EmitEntry, collectOutput: boolean, writeDir: string }} params
 * @returns {void}
 */
export function write({ entry, collectOutput, writeDir }) {
	if (collectOutput) {
		parentPort.postMessage({ type: 'output', entry })
		return
	}
	if (!fs.existsSync(writeDir)) {
		fs.mkdirSync(writeDir, { recursive: true })
	}
	for (const file of entry.files) {
		fs.writeFileSync(path.join(writeDir, path.basename(file.path)), file.code)
	}
	if (entry.sourcemaps) {
		for (const sm of entry.sourcemaps) {
			fs.writeFileSync(path.join(writeDir, path.basename(sm.path)), sm.map)
		}
	}
}
