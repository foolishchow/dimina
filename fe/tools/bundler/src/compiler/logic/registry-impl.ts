/**
 * logic L/C/E 接口实现（D-REG-2: Loader registry 包装 domain parse-walk）。
 *
 * H2 Phase 2（F-H2-1）：logic 可直接包装（非 monolithic——logicParseWalk 返回 dependencies）。
 *
 *   logicLoader.load = logicParseWalk 包装：
 *     - parse + walk = 发现依赖（logicDeps）+ MagicString 路径重写（依赖解析）
 *     - 返回 LoadedModule { source: emitModule.code（重写后源码，pre-esbuild）, dependencies: logicDeps }
 *
 * 阶段原语语义（区别于 buildJSByPath 全量编排）：
 *   - extraInfoCode / packageName / usingComponents 编排参数由 buildJSByPath 全量路径处理
 *   - sourcemap 路径 deferred：pre-esbuild map 无法经 LoadedModule 流（types.ts 形状不变，
 *     D-PCS-10 metadata 仅 sourcePath）。sourcemap 由既有 buildJSByPath 全量路径覆盖。
 *   - 本 Loader 是 Phase bridge 原语——管线（graph → load → compile → emit）未来接线用。
 */

import type { Loader, LoadedModule, LoadInput, PackerContext } from '../../packer/types.ts'
import { getContentByPath } from '../core/env.ts'
import { getJSAbsolutePath, logicParseWalk } from './parse-walk.ts'

export const logicLoader: Loader = {
	async load(input: LoadInput, _ctx: PackerContext): Promise<LoadedModule> {
		const src = input.moduleId.startsWith('/') ? input.moduleId : `/${input.moduleId}`
		const modulePath = getJSAbsolutePath(src)
		if (!modulePath) {
			throw new Error(`[logic:load] 找不到模块文件: ${src}`)
		}
		const source = input.source || getContentByPath(modulePath) || ''
		if (!source) {
			throw new Error(`[logic:load] 无法读取模块文件: ${modulePath}`)
		}
		const isTypeScript = modulePath.endsWith('.ts')
		const { emitModule, logicDeps } = await logicParseWalk(
			source,
			modulePath,
			input.moduleId,
			null,      // sourceFile（sourcemap deferred）
			null,      // packageName（buildJSByPath 编排传）
			undefined, // extraInfoCode（buildJSByPath 编排传）
			{ isTypeScript, sourcemap: false },
		)
		return {
			moduleId: input.moduleId,
			kind: 'logic',
			source: emitModule.code,
			dependencies: logicDeps,
			metadata: { sourcePath: modulePath },
		}
	},
}
