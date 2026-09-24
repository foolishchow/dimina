/**
 * L/C/E registry 实体（D-REG-2, D-HR-1：阶段函数注册基座）。
 *
 * 拆分自 registry.ts（fe-tools-packer-directory-convergence D-DC-1 packer/registry/ 收敛）。
 * 本文件含 LoaderRegistryImpl / CompileRegistryImpl / EmitRegistryImpl（types.ts
 * LoaderRegistry/CompileRegistry/EmitRegistry 的实体实现）。
 * dispatch registry + stage 计算移入 dispatch.ts。
 */

import type { Loader, LoaderRegistry, CompileRegistry, EmitRegistry, Compiler, Emitter, ModuleKind } from '../types.ts'

// ── L/C/E registry 实体化（D-REG-2, H2 Phase 2）──

/**
 * Loader registry 实体（H2 Phase 2a：logic Loader 已注册；view/style F-H2-1 拆分后注册）。
 *
 * 不同于 PackerDispatchRegistry（stage 级派发），此处是 types.ts LoaderRegistry
 * 的实体实现——管线（graph → load → compile → emit）未来接线用。
 */
export class LoaderRegistryImpl implements LoaderRegistry {
	private loaders = new Map<ModuleKind, Loader>()

	register(kind: ModuleKind, loader: Loader): void {
		this.loaders.set(kind, loader)
	}

	get(kind: ModuleKind): Loader {
		const loader = this.loaders.get(kind)
		if (!loader) {
			throw new Error(`[registry] no Loader registered for kind: ${kind}`)
		}
		return loader
	}

	kinds(): ModuleKind[] {
		return [...this.loaders.keys()]
	}
}

// ── CompileRegistry / EmitRegistry 实体化（D-HR-1：阶段函数注册基座）──
// 阶段函数（compileModuleRender / styleCompile / viewEmit / styleEmit）签名需
// page/继承上下文，不直接 fit Compiler/Emitter 单 module 接口——形状适配
// 是后续门（types.ts 接口演进）。本 registry 实体化满足"非空"档位，
// dispatch 未接线（compile/emit 维持 worker 路径，D-HR-1 locked B）。

export class CompileRegistryImpl implements CompileRegistry {
	private compilers = new Map<ModuleKind, Compiler>()

	register(kind: ModuleKind, compiler: Compiler): void {
		this.compilers.set(kind, compiler)
	}

	get(kind: ModuleKind): Compiler {
		const c = this.compilers.get(kind)
		if (!c) throw new Error(`[registry] no Compiler registered for kind: ${kind}`)
		return c
	}
}

export class EmitRegistryImpl implements EmitRegistry {
	private emitters = new Map<ModuleKind, Emitter>()

	register(kind: ModuleKind, emitter: Emitter): void {
		this.emitters.set(kind, emitter)
	}

	get(kind: ModuleKind): Emitter {
		const e = this.emitters.get(kind)
		if (!e) throw new Error(`[registry] no Emitter registered for kind: ${kind}`)
		return e
	}
}

