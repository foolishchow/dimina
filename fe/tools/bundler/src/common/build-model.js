/**
 * BuildModel — 主线程构建模型（build-model M1 / 阶段二）。
 *
 * worker 产物经流式 output 消息回传后在此持有（entries），
 * materialize() 是唯一写盘出口——替代 worker 内直接 writeFileSync。
 *
 * D-BM-1：主线程持有；D-BM-4：materialize 保持产物字节与目录结构不变；
 * D-P2：entry.files[].path 为相对发布根的最终物化路径（materialize 零转换直写）。
 */

import fs from 'node:fs'
import path from 'node:path'

export class BuildModel {
	constructor() {
		/** @type {Map<string, object>} entryId → { entryId, kind, files: [{path, code}], sourcemaps?: [{path, map}] } */
		this.entries = new Map()
	}

	/**
	 * 收编一个回传产物条目（worker 流式 output 消息）。
	 * @param {object} entry { entryId, kind, files, sourcemaps? }
	 */
	add(entry) {
		if (!entry || typeof entry.entryId !== 'string') {
			throw new TypeError('BuildModel.add: entry.entryId must be a string')
		}
		this.entries.set(`${entry.kind}:${entry.entryId}`, entry)
	}

	/** 当前持有条目数（供对账/诊断） */
	get size() {
		return this.entries.size
	}
}

/**
 * materialize — 把 BuildModel 持有的产物写入 targetPath（唯一写盘出口）。
 * 每个 entry.files 按相对发布根的 path 直写；sourcemaps 同路径写入。
 *
 * 字节等价前提：worker 回传的 code/map 与改造前 writeFileSync 的内容完全一致
 * （改造不触碰编译计算逻辑，仅改变"谁写盘"）。
 *
 * @param {BuildModel} model
 * @param {string} targetPath 构建目录（getTargetPath()）
 */
export function materialize(model, targetPath) {
	for (const entry of model.entries.values()) {
		for (const file of entry.files || []) {
			const dest = path.join(targetPath, file.path)
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.writeFileSync(dest, file.code)
		}
		for (const map of entry.sourcemaps || []) {
			const dest = path.join(targetPath, map.path)
			fs.mkdirSync(path.dirname(dest), { recursive: true })
			fs.writeFileSync(dest, map.map)
		}
	}
}
