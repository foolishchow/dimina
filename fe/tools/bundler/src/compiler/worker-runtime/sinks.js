import fs from 'node:fs'
import path from 'node:path'

export class PostMessageSink {
	#count = 0
	constructor(parentPort) { this.parentPort = parentPort }
	write(entry) { this.parentPort.postMessage({ type: 'output', entry }); this.#count++ }
	get count() { return this.#count }
}

// F32：FileSink 照 output.write 直写路径搬家（behavior 0：字节一致）
export class FileSink {
	#count = 0
	constructor(writeDir) { this.writeDir = writeDir }
	write(entry) {
		if (!fs.existsSync(this.writeDir)) fs.mkdirSync(this.writeDir, { recursive: true })
		for (const file of entry.files) fs.writeFileSync(path.join(this.writeDir, path.basename(file.path)), file.code)
		if (entry.sourcemaps) for (const sm of entry.sourcemaps) fs.writeFileSync(path.join(this.writeDir, path.basename(sm.path)), sm.map)
		this.#count++
	}
	get count() { return this.#count }
}
