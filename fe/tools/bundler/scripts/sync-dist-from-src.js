#!/usr/bin/env node
// Mirror `src/**` → `dist/**` (D-UV-2). No module-graph bundling.
// Cleared `dist` is refilled here; `postbuild` must then run copy-sdk-assets
// before anything consumes `dist/sdk`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(packageRoot, 'src')
const distDir = path.join(packageRoot, 'dist')

if (!fs.existsSync(srcDir)) {
	console.error(`[sync-dist-from-src] missing src at ${srcDir}`)
	process.exit(1)
}

fs.rmSync(distDir, { recursive: true, force: true })
fs.cpSync(srcDir, distDir, { recursive: true })

console.log(`[sync-dist-from-src] mirrored ${srcDir} → ${distDir}`)
