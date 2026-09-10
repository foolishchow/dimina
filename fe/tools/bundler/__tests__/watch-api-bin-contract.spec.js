import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const binDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/bin')

function readBin(name) {
	return fs.readFileSync(path.join(binDir, name), 'utf8')
}

describe('watch-api bin contract (A-005, updated for bundler-session)', () => {
	it('bins route through session; no chokidar inlining, no direct watcher import', () => {
		for (const name of ['index.js', 'dev.js']) {
			const source = readBin(name)
			// R-BC2: CLI ⊆ session — bin no longer touches createBuildWatcher directly
			expect(source, name).toMatch(/createBundler/)
			expect(source, name).not.toMatch(/createBuildWatcher/)
			expect(source, name).not.toMatch(/\bfrom\s+['"]chokidar['"]/)
			expect(source, name).not.toMatch(/\bimport\s+chokidar\b/)
		}
		// session delegates to the low-level watcher (kept as the single chokidar owner)
		const sessionSrc = fs.readFileSync(
			path.resolve(binDir, '../session/index.js'),
			'utf8',
		)
		expect(sessionSrc).toMatch(/createBuildWatcher/)
	})
})
