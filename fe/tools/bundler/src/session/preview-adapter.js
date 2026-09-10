/**
 * createWebPreviewAdapter — thin adapter over createDevServer +
 * synthesizeReloadLevel (O3). It owns the D1a preview concerns that are
 * NOT session concerns:
 *
 *   - sdkRoot resolution (common/sdk-root.js)
 *   - wsPath '/ws' fixed (L-I1), matching today's bin/dev.js
 *   - buildIdCounter for synthesizeReloadLevel — adapter state, recreated
 *     per .dev() call, never session base (M-S2)
 *   - host/port belong to listen() (real createDevServer does NOT take
 *     them) — createServer({ serveRoot, appId }) only
 *   - setPendingReload(watchCtx) synthesizes the reload level internally
 *
 * Action: fe-tools-bundler-session (docs/actions/fe-tools-bundler-session/)
 */

import { createDevServer } from '../common/dev-server.js'
import { synthesizeReloadLevel } from '../common/dev-reload.js'
import { resolveSdkRoot } from '../common/sdk-root.js'

/**
 * @returns {object} PreviewAdapter
 */
export function createWebPreviewAdapter() {
	const state = {
		/** @type {ReturnType<typeof createDevServer> | undefined} */
		devServer: undefined,
		buildIdCounter: 0,
	}

	return {
		/**
		 * Turn a watch rebuild context into a pending-reload payload. The
		 * dev server may not exist yet (beforeBuild fires only on rebuilds,
		 * which happen after createServer), so missing devServer is a no-op.
		 *
		 * @param {object} watchCtx { event, filePath, count, plan, appId }
		 */
		setPendingReload(watchCtx) {
			if (!state.devServer) {
				return
			}
			const payload = synthesizeReloadLevel({
				...watchCtx,
				buildId: ++state.buildIdCounter,
			})
			state.devServer.setPendingReload(payload)
		},

		/** Wrap today's createDevServer; host/port are NOT accepted here (belong to listen). */
		async createServer({ serveRoot, appId }) {
			state.devServer = createDevServer({
				serveRoot,
				sdkRoot: resolveSdkRoot(),
				appId,
				wsPath: '/ws',
			})
		},

		/** @returns {Promise<{ port: number, host: string }>} bound address (as today) */
		async listen(port, host) {
			if (!state.devServer) {
				throw new Error('preview adapter: createServer must run before listen')
			}
			// 真实 createDevServer.listen 签名是 (port, host) —— 对齐旧 bin dev.js
			return state.devServer.listen(port, host)
		},

		notifyBuildPublished() {
			state.devServer?.notifyBuildPublished()
		},

		notifyBuildError(message) {
			state.devServer?.notifyBuildError(message)
		},

		async close() {
			await state.devServer?.close()
			state.devServer = undefined
		},
	}
}