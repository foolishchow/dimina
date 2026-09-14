import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pageFramePath = fileURLToPath(new URL('../packages/container-sdk/dist/pageFrame.js', import.meta.url))

export function onVConsoleBuildWarning(warning, warn) {
	const id = warning.id || warning.loc?.file || ''
	if (warning.code === 'EVAL') {
		// vConsole 自带的命令补全使用 eval；保留上游行为，仅过滤已知依赖警告。
		if (/\/node_modules\/vconsole\/dist\/vconsole(?:\.min)?\.js$/.test(id.replace(/\\/g, '/'))) return
		// 容器二次打包时来源已变为 SDK 产物。按告警位置核对两处补全表达式，
		// 不屏蔽整个 pageFrame 的 EVAL，以免隐藏框架自身新增的问题。
		if (id === pageFramePath && Number.isInteger(warning.pos)) {
			try {
				const expression = readFileSync(id, 'utf8').slice(warning.pos)
				if (/^eval\(\s*["']\(["']\s*\+\s*objName\s*\+\s*["']\)["']\s*\)/.test(expression)
					|| /^eval\(\s*["']typeof ["']\s*\+\s*item\.value\s*\)/.test(expression)) return
			}
			catch {
				// 无法确认来源时保留告警。
			}
		}
	}
	warn(warning)
}
