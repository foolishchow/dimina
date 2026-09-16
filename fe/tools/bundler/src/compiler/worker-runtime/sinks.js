import fs from 'node:fs'
import path from 'node:path'

export class PostMessageSink {
	#count = 0
	constructor(parentPort) { this.parentPort = parentPort }
	write(entry) { this.parentPort.postMessage({ type: 'output', entry }); this.#count++ }
	get count() { return this.#count }
}

// F32：FileSink 照 output.write 直写路径搬家（behavior 0：字节一致）
// P-WR07：writeDir 不含子目录（原 output.write 的 writeDir 含 main/，用 basename；
// FileSink 的 writeDir 是测试 outputDir，用完整 file.path + mkdir 子目录）
export class FileSink {
	#count = 0
	constructor(writeDir) { this.writeDir = writeDir }
	write(entry) {
		for (const file of entry.files) {
			const dest = path.join(this.writeDir, file.path)
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.writeFileSync(dest, file.code)
		}
		if (entry.sourcemaps) for (const sm of entry.sourcemaps) {
			const dest = path.join(this.writeDir, sm.path)
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.writeFileSync(dest, sm.map)
		}
		this.#count++
	}
	get count() { return this.#count }
}
