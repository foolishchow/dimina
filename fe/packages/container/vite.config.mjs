import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'vite'
import htmlMinifier from 'vite-plugin-html-minifier'

function isVConsoleEvalWarning(warning) {
	const message = warning?.message || ''
	const id = warning?.id || warning?.loc?.file || ''

	return warning?.code === 'EVAL' && (message.includes('vconsole') || id.includes('vconsole'))
}

export default defineConfig(({ command, mode }) => {
	// CI 不预构建 container-sdk；测试 mock 也需要先解析到存在的源码入口。
	const useContainerSdkSource = command === 'serve' && (mode === 'development' || mode === 'test')
	const containerSdkSource = resolve(import.meta.dirname, '../container-sdk/src')
	const containerSdkEntry = resolve(containerSdkSource, 'index.ts')
	const pageFrameEntry = resolve(containerSdkSource, 'pages/pageFrame/pageFrame.ts')

	return {
		base: process.env.GITHUB_ACTIONS ? '/dimina/' : '/',
		server: {
			strictPort: true,
			open: true, // 启动后是否自动打开浏览器
		},
		define: {
			__DEV__: mode !== 'production',
		},
		resolve: {
			extensions: ['.js', '.ts', '.scss'],
			alias: [
				...(useContainerSdkSource
					? [
						// container 的源码入口会同时导入 SDK 脚本与对应 CSS；映射到同一个
						// 源码入口可复用入口自身的 SCSS 副作用，并由 Vite 去重模块执行。
						{ find: /^@dimina\/fe-container-sdk\/pageFrame(?:\.css)?$/, replacement: pageFrameEntry },
						{ find: /^@dimina\/fe-container-sdk\/style\.css$/, replacement: containerSdkEntry },
						{ find: /^@dimina\/fe-container-sdk$/, replacement: containerSdkEntry },
					]
					: []),
				{ find: '@', replacement: resolve(import.meta.dirname, 'src') },
				{ find: '@images', replacement: '/images' },
				...(mode === 'test'
					? [{ find: '@dimina/service?url', replacement: resolve(import.meta.dirname, '__tests__/fixtures/service-worker-url.js') }]
					: []),
			],
		},
		css: {
			preprocessorOptions: {
				scss: {
					// logic() 缩放函数的唯一实现在 container-sdk（demo 与 SDK 的样式都要用它）。
					// 用绝对文件路径直接 @use，不经 Vite alias，避免 Sass 解析歧义。
					additionalData: `@use "${resolve(import.meta.dirname, '../container-sdk/src/styles/funcs.scss').replace(/\\/g, '/')}" as *;`,
				},
			},
		},
		build: {
			modulePreload: false,
			minify: mode === 'production',
			rollupOptions: {
				input: {
					index: resolve(import.meta.dirname, 'index.html'),
					pageFrame: resolve(import.meta.dirname, 'pageFrame.html'),
				},
				onwarn(warning, warn) {
					if (isVConsoleEvalWarning(warning)) {
						return
					}
					warn(warning)
				},
				output: {
					// 设置入口文件（通常为主JavaScript文件）的命名规则
					entryFileNames: 'assets/[name].js',
					// 设置非入口 chunk（如按需加载的模块）的命名规则
					chunkFileNames: 'assets/[name].js',
					// 设置静态资源（如图片、字体等）的命名规则
					assetFileNames: 'assets/[name][extname]',
				},
			},
		},
		plugins: [
			htmlMinifier({
				minify: mode === 'production',
			}),
		],
	}
})
