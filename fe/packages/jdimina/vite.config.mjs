import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
	return {
		resolve: {
			extensions: ['.js'],
			alias: {
				'@': resolve(import.meta.dirname, 'src'),
			},
		},
		build: {
			minify: mode === 'production',
			lib: {
				entry: resolve(import.meta.dirname, 'src/index.js'),
				formats: ['iife'],
				name: 'jdimina_next',
			},
			rollupOptions: {
				output: {
					entryFileNames: 'jdimina_next.js',
				},
			},
		},
	}
})
