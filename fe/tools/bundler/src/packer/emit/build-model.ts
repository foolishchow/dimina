/**
 * BuildModel — 主线程构建模型（build-model M1 / 阶段二）。
 *
 * worker 产物经流式 output 消息回传后在此持有（entries），
 * materialize() 是唯一写盘出口——替代 worker 内直接 writeFileSync。
 *
 * D-BM-1：主线程持有；D-BM-4：materialize 保持产物字节与目录结构不变；
 * D-P2：entry.files[].path 为相对发布根的最终物化路径（materialize 零转换直写）。
 *
 * H4 D-PUSH-3：dirtyEntries set——track 自上次 materialize 后变更的 entries。
 * materialize 增量 guard：dirty 非空 → 只写 dirty；空 → 全量（one-shot / 首次 build）。
 */

import fs from 'node:fs'
import path from 'node:path'
import type { EmitEntry } from './emit.ts'

/** D-NS-3 (F-S1-1 + F-AF1-1)：BuildModel entry shape——kind 窄化为 EmitEntry['kind']
 * （源头窄化，runtime 已约束仅 view/logic/style，消 orchestrator return cast）。 */
export type BuildModelEntry = {
	entryId: string
	kind: EmitEntry['kind']
	files: { path: string; code: string }[]
	sourcemaps?: { path: string; map: unknown }[]
}

export class BuildModel {
	entries: Map<string, BuildModelEntry> = new Map()
	private _artifactIndex: Map<string, { code: string }> | null = null
	/** H4 D-PUSH-3: dirty entries set——自上次 materialize 后 add/changed 的 entry keys */
	private _dirtyEntries: Set<string> = new Set()

	constructor() {
		/** @type {Map<string, object>} entryId → { entryId, kind, files: [{path, code}], sourcemaps?: [{path, map}] } */
		this.entries = new Map()
	}

	/**
	 * 收编一个回传产物条目（worker 流式 output 消息）。
	 * @param {object} entry { entryId, kind, files, sourcemaps? }
	 */
	add(entry: BuildModelEntry): void {
		if (!entry || typeof entry.entryId !== 'string') {
			throw new TypeError('BuildModel.add: entry.entryId must be a string')
		}
		const key = `${entry.kind}:${entry.entryId}`
		this.entries.set(key, entry)
		this._artifactIndex = null
		this._dirtyEntries.add(key)  // H4 D-PUSH-3: track dirty
	}

	/** 当前持有条目数（供对账/诊断） */
	get size() {
		return this.entries.size
	}

	/** H4 D-PUSH-3: dirty entries 数（自上次 materialize） */
	get dirtyCount() {
		return this._dirtyEntries.size
	}

	/** 按相对发布根路径查产物 code。仅 dev 路径调；compile 路径不调。 */
	getArtifact(relativePath: string): { code: string } | undefined {
		if (!this._artifactIndex) {
			this._artifactIndex = new Map()
			for (const entry of this.entries.values()) {
				for (const file of entry.files ?? []) {
					this._artifactIndex.set(file.path, { code: file.code })
				}
				for (const sm of entry.sourcemaps ?? []) {
					this._artifactIndex.set(sm.path, { code: String(sm.map) })
				}
			}
		}
		return this._artifactIndex.get(relativePath)
	}

	/** H4 D-PUSH-3: 清除 dirty set（materialize 后调） */
	clearDirty(): void {
		this._dirtyEntries.clear()
	}

	/** H4 D-PUSH-3: 获取 dirty entries（供 L_HMR payload 提取变更 module） */
	getDirtyEntries(): BuildModelEntry[] {
		return [...this._dirtyEntries]
			.map(key => this.entries.get(key))
			.filter((e): e is BuildModelEntry => e !== undefined)
	}
}

/**
 * materialize — 把 BuildModel 持有的产物写入 targetPath（唯一写盘出口）。
 * 每个 entry.files 按相对发布根的 path 直写；sourcemaps 同路径写入。
 *
 * H4 D-PUSH-3: 增量 materialize——dirty set 非空时只写 dirty entries；
 * 空（one-shot / 首次 build）时全量写。materialize 后清 dirty。
 *
 * 字节等价前提：worker 回传的 code/map 与改造前 writeFileSync 的内容完全一致
 * （改造不触碰编译计算逻辑，仅改变"谁写盘"）。
 *
 * @param {BuildModel} model
 * @param {string} targetPath 构建目录（getTargetPath()）
 */
export function materialize(model: BuildModel, targetPath: string): void {
	const dirty = model.getDirtyEntries()
	const entriesToWrite = dirty.length > 0 ? dirty : [...model.entries.values()]

	for (const entry of entriesToWrite) {
		for (const file of entry.files || []) {
			const dest = path.join(targetPath, file.path)
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.writeFileSync(dest, file.code)
		}
		for (const map of entry.sourcemaps || []) {
			const dest = path.join(targetPath, map.path)
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.writeFileSync(dest, String(map.map))
		}
	}
	model.clearDirty()  // H4 D-PUSH-3: clear after write
}
