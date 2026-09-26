/**
 * Output 抽象实现（D-O2/D-O3）——统一 memfs（dev）与 disk（one-shot）产物路径。
 *
 * - BaseOutput：abstract base，持有 entries Map + lazy artifact index（复刻 BuildModel.getArtifact 语义）
 *   - add/read/getEntries 通用（MemOutput/DiskOutput 共用）
 *   - add 是 virtual（DiskOutput 加 dirty tracking override）
 * - MemOutput：dev memfs（publish no-op——dev 模式产物在内存，dev server 读 Output.read + fs fallback）
 * - DiskOutput：one-shot disk（publish 封装 materialize+publishToDist+createDist 语义）
 *
 * D-OL1：orchestrator 入口 mode-aware 创建（dev → MemOutput / one-shot → DiskOutput），
 *        listr2 ctx 注入（tasks.run({output})），config-collector 跑前 sctx.output 已存在。
 *
 * 字节等价前提：entries 形状 = BuildModelEntry（{entryId, kind, files, sourcemaps?}）= EmitEntry（同形，F-R13-2）。
 *              read 复刻 BuildModel.getArtifact lazy index（path → {code}）。
 *              publish 复刻 materialize（dirty guard + write）+ publishToDist（rename/EXDEV/sync）。
 */
import path from 'node:path'
import process from 'node:process'
import os from 'node:os'
import fs from 'node:fs'
import type { EmitEntry } from '../emit/emit.ts'
import type { Output, PublishOpts } from '../types.ts'

// ── helper（F-R18-1：从 publish.ts 迁入，DiskOutput.publish 内部用，非 export）──

function copyDir(src: string, dest: string): void {
	fs.mkdirSync(dest, { recursive: true })
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(dest, entry.name)
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath)
		}
		else {
			fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE)
		}
	}
}

/** 收集目录下全部文件的相对路径集（递归）。 */
function collectFiles(root: string, rel: string, out: Set<string>): void {
	const abs = rel ? path.join(root, rel) : root
	let entries: fs.Dirent[]
	try {
		entries = fs.readdirSync(abs, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		const childRel = rel ? `${rel}${path.sep}${entry.name}` : entry.name
		if (entry.isDirectory()) {
			collectFiles(root, childRel, out)
		}
		else if (entry.isFile()) {
			out.add(childRel)
		}
	}
}

/** 字节级比较两文件（先 size 快筛，同 size 再全量字节比对）。 */
function filesIdentical(a: string, b: string): boolean {
	const sa = fs.statSync(a)
	const sb = fs.statSync(b)
	if (sa.size !== sb.size) return false
	return fs.readFileSync(a).equals(fs.readFileSync(b))
}

/** H4 Phase 2 (F-H4-2)：增量 publish——content-diff sync（scratch → final）。 */
function syncIncremental(srcDir: string, destDir: string): void {
	const destFiles = new Set<string>()
	collectFiles(destDir, '', destFiles)
	const srcFiles = new Set<string>()
	collectFiles(srcDir, '', srcFiles)

	for (const rel of srcFiles) {
		const srcPath = path.join(srcDir, rel)
		const destPath = path.join(destDir, rel)
		if (destFiles.has(rel) && filesIdentical(srcPath, destPath)) {
			continue
		}
		fs.mkdirSync(path.dirname(destPath), { recursive: true })
		fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE)
	}
	for (const rel of destFiles) {
		if (!srcFiles.has(rel)) {
			fs.rmSync(path.join(destDir, rel), { force: true })
		}
	}
}

// ── createDist（F-R18-1：从 publish.ts 迁入，dist-preparer 用，export）──

/**
 * 准备 scratch 目录（initPhases[1]，dist-preparer 调）。
 * 删 scratch + mkdir + seed copy（if seedPath）。
 * F-R13-1：seed copy 是 incremental sync 前提。
 */
export function createDist(scratch: string, seedPath?: string | null): void {
	if (fs.existsSync(scratch)) {
		fs.rmSync(scratch, { recursive: true, force: true })
	}
	fs.mkdirSync(scratch, { recursive: true })
	if (seedPath && fs.existsSync(seedPath)) {
		copyDir(seedPath, scratch)
	}
}

// ── BaseOutput abstract base（F-R10-2 lock——read/getEntries 共用 + add virtual）──

/**
 * entries Map key = `${kind}:${entryId}`（复刻 BuildModel.add key 语义，保持同形）。
 *
 * D-SI-1（fe-tools-scratch-internalize）：构造内化 mkdtemp（scratch 属性）。
 * mkdtemp 归属正位——I/O 层拥有 TEMP 生命周期（原 env-compute.computePathInfo）。
 * 内联复刻 computePathInfo 语义（TARGET_PATH env / GITHUB_WORKSPACE / os.tmpdir /
 * dimina-fe-dist- 前缀）；不调 computePathInfo（Output 层自包含，不依赖 env-compute）。
 * 不设 temporaryTargetPath flag（flag 退役 0 caller，仅 computePathInfo compat 保留）。
 * MemOutput 也 mkdtemp（dev 须 scratch 防崩——createDist/compileConfig/npm-builder；
 * dev server 读 Output.read 内存不受影响——F-R1-1 实证）。
 * scratch 用 non-enumerable（Object.defineProperty）——mkdtemp 随机路径不进
 * BuildResult.output 深对比（toEqual 忽略 non-enumerable；property access 不受影响）。
 */
export abstract class BaseOutput implements Output {
	/** D-SI-1: TEMP 构建目录（mkdtemp 内化入 Output 层）。dev/disk 共用。non-enumerable——不进 BuildResult 对比。 */
	declare readonly scratch: string
	/** entryId → EmitEntry（累积产物，stage onOutput add）。 */
	protected readonly entries: Map<string, EmitEntry> = new Map()
	/** lazy path → {code} index（read 用，add 后失效——复刻 BuildModel._artifactIndex）。 */
	private _artifactIndex: Map<string, { code: string }> | null = null

	/**
	 * D-SI-1: 内联 mkdtemp（复刻 env-compute.computePathInfo 语义）。
	 * protected——abstract class；子类 DiskOutput/MemOutput 须显式 constructor 调 super()。
	 * scratch 用 Object.defineProperty non-enumerable——mkdtemp 随机路径不进
	 * BuildResult.output 深对比（toEqual 忽略 non-enumerable；property access 不受影响）。
	 */
	protected constructor() {
		// 优先 TARGET_PATH env（非临时——permanent）；否则 mkdtemp 临时分配
		const scratch = process.env.TARGET_PATH
			? process.env.TARGET_PATH
			: fs.mkdtempSync(path.join(process.env.GITHUB_WORKSPACE || os.tmpdir(), 'dimina-fe-dist-'))
		Object.defineProperty(this, 'scratch', {
			value: scratch,
			writable: false,
			enumerable: false,
			configurable: false,
		})
	}

	/**
	 * 收编一个产物条目（stage onOutput 调，全 4 路径）。
	 * virtual——DiskOutput override 加 dirty tracking（F-R10-2）。
	 */
	add(entry: EmitEntry): void {
		if (!entry || typeof entry.entryId !== 'string') {
			throw new TypeError('Output.add: entry.entryId must be a string')
		}
		const key = `${entry.kind}:${entry.entryId}`
		this.entries.set(key, entry)
		this._artifactIndex = null  // add 后 index 失效（lazy rebuild）
	}

	/**
	 * 按相对发布根路径查产物 code（dev server 调）。
	 * F-R4-1：previewAdapter-dev 须即时内存读（stage compile 后即可，不等 publish）。
	 */
	read(relativePath: string): { code: string } | null {
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
		return this._artifactIndex.get(relativePath) ?? null
	}

	/** 返累积 EmitEntry[]（BuildResult.entries 契约，F-R4-2）。 */
	getEntries(): EmitEntry[] {
		return [...this.entries.values()]
	}

	/** DiskOutput 实现；MemOutput no-op。 */
	abstract publish(target: string, opts?: PublishOpts): void
}

// ── MemOutput——dev memfs（D-O2）──

/**
 * dev 模式（outputMode='dev'）：产物在内存（entries Map），dev server 读 Output.read + fs fallback。
 * publish no-op——dev 不写盘（D-O5：MemOutput.publish no-op 等价 skipMaterialize）。
 * D-SI-1：MemOutput 也 mkdtemp（dev 须 scratch 防崩——createDist/compileConfig/npm-builder；
 * dev 读 Output.read 内存不受影响——F-R1-1 实证）。
 */
export class MemOutput extends BaseOutput {
	/** D-SI-1: 显式 public constructor 调 super()——继承 scratch（mkdtemp 防崩）。 */
	constructor() { super() }

	/** dev 不写盘——no-op。 */
	publish(_target: string, _opts?: PublishOpts): void {
		// no-op：dev 模式产物在内存，dev server 读 Output.read（miss → fs.readFile fallback）
	}
}

// ── DiskOutput——one-shot disk（D-O3）──

/**
 * one-shot + previewAdapter-dev + watch standalone 模式。
 *
 * publish 封装 materialize（write entries→scratch + dirty guard）+ publishToDist（scratch→final）语义。
 *
 * - scratch = opts.scratch（per-request TEMP，P-O2 过渡用 sctx.storeInfo.pathInfo.targetPath）
 * - temporary=true hardcode（F-R10-1：不读 isTemporaryTargetPath——computePathInfo 总 mkdtemp → temporary=true）
 * - appId 从 opts 传（F-R19-4：不读 ALS getAppId——publisher deps 传）
 * - incremental sync（F-R14-1：!!seedPath——content-diff，无 rm 窗口）
 *
 * 字节等价：逐行复刻 materialize（build-model.ts L104-120）+ publishToDist（publish.ts L106-140）。
 */
export class DiskOutput extends BaseOutput {
	/** D-SI-1: 显式 public constructor 调 super()——继承 scratch（mkdtemp 内化）。 */
	constructor() { super() }

	/** H4 D-PUSH-3: dirty entries set——自上次 publish 后 add/changed 的 entry keys。 */
	private _dirtyEntries: Set<string> = new Set()

	/** override：加 dirty tracking（F-R10-2）。 */
	override add(entry: EmitEntry): void {
		super.add(entry)
		const key = `${entry.kind}:${entry.entryId}`
		this._dirtyEntries.add(key)
	}

	publish(target: string, opts?: PublishOpts): void {
		const scratch = opts?.scratch ?? ''
		const useAppIdDir = opts?.useAppIdDir ?? true
		const appId = opts?.appId
		const incremental = opts?.incremental ?? false

		// ── createDist seed copy（F-R13-1：incremental sync 前提——scratch 预 seed）──
		// 现状 dist-preparer createDist 已在 initPhases[1] 跑（删 scratch + mkdir + seed），
		// 此处不重复（dist-preparer 保留）。P-O3 后 createDist 迁入此处或 DiskOutput.prepare。

		// ── materialize：write entries → scratch（dirty guard，复刻 build-model.ts materialize）──
		const dirty = [...this._dirtyEntries]
			.map(k => this.entries.get(k))
			.filter((e): e is EmitEntry => e !== undefined)
		const entriesToWrite = dirty.length > 0 ? dirty : [...this.entries.values()]
		for (const entry of entriesToWrite) {
			for (const file of entry.files || []) {
				const dest = path.join(scratch, file.path)
				fs.mkdirSync(path.dirname(dest), { recursive: true })
				fs.writeFileSync(dest, file.code)
			}
			for (const map of entry.sourcemaps || []) {
				const dest = path.join(scratch, map.path)
				fs.mkdirSync(path.dirname(dest), { recursive: true })
				fs.writeFileSync(dest, String(map.map))
			}
		}
		this._dirtyEntries.clear()  // H4 D-PUSH-3: clear after write

		// ── publishToDist：scratch → target（FINAL），复刻 publish.ts publishToDist ──
		const absolutePath = useAppIdDir
			? `${path.resolve(process.cwd(), target)}${path.sep}${appId}`
			: `${path.resolve(process.cwd(), target)}`

		if (path.resolve(scratch) === path.resolve(absolutePath)) {
			return
		}

		// H4 Phase 2 (F-H4-2): 增量路径——final 已存在时 content-diff sync（无 rm 窗口）
		if (incremental && fs.existsSync(absolutePath)) {
			syncIncremental(scratch, absolutePath)
			return
		}

		if (fs.existsSync(absolutePath)) {
			fs.rmSync(absolutePath, { recursive: true, force: true })
		}
		fs.mkdirSync(path.dirname(absolutePath), { recursive: true })

		// F-R10-1: temporary=true hardcode（computePathInfo mkdtemp → rename；EXDEV fallback copy+rm）
		try {
			fs.renameSync(scratch, absolutePath)
			return
		}
		catch (error: unknown) {
			if ((error as { code?: string }).code !== 'EXDEV') {
				throw error
			}
			fs.mkdirSync(absolutePath, { recursive: true })
			copyDir(scratch, absolutePath)
			fs.rmSync(scratch, { recursive: true, force: true })
			return
		}
	}
}
