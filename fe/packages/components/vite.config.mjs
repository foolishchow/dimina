import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import ViteAutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
	return {
		resolve: {
			extensions: ['.js', '.scss'],
			alias: {
				'@': resolve(import.meta.dirname, 'src'),
				'@component': resolve(import.meta.dirname, 'src/component'),
			},
		},
		build: {
			minify: mode === 'production',
			lib: {
				entry: resolve(import.meta.dirname, 'index.js'),
				formats: ['es'],
				fileName: 'components',
			},
			rollupOptions: {
				external: ['vue'],
				output: {
					globals: {
						vue: 'vue',
					},
				},
			},
		},
		plugins: [
			vue(),
			ViteAutoImport({
				eslintrc: {
					enabled: false,
				},
				imports: [
					'vue',
					{ vue: ['cloneVNode'] },
				],
				dts: false,
			}),
		],
	}
})
