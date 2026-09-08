// 把 container-sdk 预构建 dist 复制到 compiler 的 dist/sdk/（A2.0 定案：
// 预构建产物随 @dimina/compiler 包分发，files:['dist'] 发布形态下 sdk 资产随包）。
//
// 在 postbuild 中执行（vite build 先 emptyOutDir 清空 dist，随后复制）。
// 只复制宿主页运行需要的 5 个产物文件；d.ts 等开发期类型不随包。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const compilerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sdkSourceDir = path.resolve(compilerRoot, '../container-sdk/dist')
const sdkOutDir = path.join(compilerRoot, 'dist', 'sdk')

// 与 dev-host.js SDK_ASSET_PATHS 保持一致（index/pageFrame 的 js/css + service worker）
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
		+ 'Run `pnpm --filter fe-container-sdk build` before building the compiler package.',
	)
	process.exit(1)
}

fs.mkdirSync(sdkOutDir, { recursive: true })
for (const name of SDK_RUNTIME_ASSETS) {
	fs.copyFileSync(path.join(sdkSourceDir, name), path.join(sdkOutDir, name))
}
console.log(`[copy-sdk-assets] copied ${SDK_RUNTIME_ASSETS.length} container-sdk assets to dist/sdk/`)
