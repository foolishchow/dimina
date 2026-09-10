// 把 container-sdk 预构建 dist 复制到 bundler 的 dist/sdk/（A2.0 定案：
// 预构建产物随 @dimina/bundler 包分发，files:['dist'] 发布形态下 sdk 资产随包）。
//
// 在 postbuild 中执行：sync-dist-from-src 会清空并镜像 src→dist，随后本脚本
// 写入 dist/sdk，再由 check-package-exports 校验（D-UV-2 顺序）。
// container-sdk 将 mitt external（宿主侧解析）；dmcc 浏览器宿主无 bundler，
// 须把 mitt ESM 一并放入 dist/sdk，并由宿主页 import map 映射 "mitt"。
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const compilerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sdkPackageJson = path.resolve(compilerRoot, '../web-container-sdk/package.json')
const sdkSourceDir = path.resolve(compilerRoot, '../web-container-sdk/dist')
const sdkOutDir = path.join(compilerRoot, 'dist', 'sdk')

// 与 dev-host.js SDK_ASSET_PATHS 保持一致（index/pageFrame 的 js/css + service + mitt）
const SDK_RUNTIME_ASSETS = [
	'index.js',
	'index.css',
	'pageFrame.js',
	'pageFrame.css',
	'service.js',
]

if (!fs.existsSync(sdkSourceDir)) {
	console.error(
		`[copy-sdk-assets] container-sdk dist not found at ${sdkSourceDir}. `
		+ 'Run `pnpm --filter @dimina/web-container-sdk build` before building the bundler package.',
	)
	process.exit(1)
}

fs.mkdirSync(sdkOutDir, { recursive: true })
for (const name of SDK_RUNTIME_ASSETS) {
	fs.copyFileSync(path.join(sdkSourceDir, name), path.join(sdkOutDir, name))
}

const requireFromSdk = createRequire(sdkPackageJson)
const mittResolved = requireFromSdk.resolve('mitt')
const mittMjs = path.join(path.dirname(mittResolved), 'mitt.mjs')
const mittSource = fs.existsSync(mittMjs) ? mittMjs : mittResolved
fs.copyFileSync(mittSource, path.join(sdkOutDir, 'mitt.js'))

console.log(
	`[copy-sdk-assets] copied ${SDK_RUNTIME_ASSETS.length} container-sdk assets + mitt`
	+ ` to dist/sdk/`,
)
