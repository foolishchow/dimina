import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const binDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/bin')

function readBin(name) {
	return fs.readFileSync(path.join(binDir, name), 'utf8')
}

describe('watch-api bin contract (A-005)', () => {
	it('build and dev bins consume createBuildWatcher without inlining chokidar', () => {
		for (const name of ['index.js', 'dev.js']) {
			const source = readBin(name)
			expect(source, name).toMatch(/createBuildWatcher/)
			expect(source, name).not.toMatch(/\bfrom\s+['"]chokidar['"]/)
			expect(source, name).not.toMatch(/\bimport\s+chokidar\b/)
		}
	})
})
