/**
 * resolveSdkRoot — located in common/ (M-F3) so the preview adapter can use
 * it without importing from bin/dev.js (which would create a bin ↔ session
 * cycle once dev.js routes through session.dev). Moved from bin/dev.js;
 * bin/dev.js re-exports for compatibility (P-004 allowed this move).
 *
 * Publishes from compiler/dist/sdk (copy-sdk-assets output) — A2.0; the
 * source form honours an explicit DIMINA_DEV_SDK_DIR override.
 */

import path from 'node:path'
import process from 'node:process'

export function resolveSdkRoot() {
	if (process.env.DIMINA_DEV_SDK_DIR) {
		return path.resolve(process.env.DIMINA_DEV_SDK_DIR)
	}
	return path.resolve(
		path.dirname(new URL('../../package.json', import.meta.url).pathname),
		'dist',
		'sdk',
	)
}