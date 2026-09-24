/**
 * module-result-cache — Module 变换结果缓存（M2 / D-RC-1）。
 *
 * 缓存 logic CompileInfo + logicDependencies（require/import dep ID 列表）。
 * session-only（α；D-RC-2）；随 watch session 存活；进程退出丢弃。
 *
 * D-RC-3：cache snapshot 经 IPC 传入 ephemeral worker；主线程管缓存实例。
 * cache hit dep 发现用 cached.logicDependencies（非 graph，避免 stale edge）。
 */

import type { CompileInfo } from '../../compiler/logic/index.ts'

export interface CachedModuleResult {
	compileInfo: CompileInfo
	logicDependencies: string[]
}

export class ModuleResultCache {
	private map = new Map<string, CachedModuleResult>()

	get(moduleId: string): CachedModuleResult | undefined {
		return this.map.get(moduleId)
	}

	set(moduleId: string, result: CachedModuleResult): void {
		this.map.set(moduleId, result)
	}

	has(moduleId: string): boolean {
		return this.map.has(moduleId)
	}

	delete(moduleId: string): void {
		this.map.delete(moduleId)
	}

	/** 有序迭代（B2: cache 插入序——deriveFromGraph 按此序派生保字节一致）。 */
	entries(): IterableIterator<[string, CachedModuleResult]> {
		return this.map.entries()
	}

	clear(dirtyIds: Iterable<string>): void {
		for (const id of dirtyIds) {
			this.map.delete(id)
		}
	}

	get size(): number {
		return this.map.size
	}

	toJSON(): [string, CachedModuleResult][] {
		return [...this.map.entries()]
	}

	static fromJSON(entries: [string, CachedModuleResult][]): ModuleResultCache {
		const cache = new ModuleResultCache()
		for (const [id, result] of entries) {
			cache.map.set(id, result)
		}
		return cache
	}
}
