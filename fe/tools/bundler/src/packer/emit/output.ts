/**
 * Output 抽象实现（D-O2/D-O3）——统一 memfs（dev）与 disk（one-shot）产物路径。
 *
 * - BaseOutput：abstract base，持有 entries Map + lazy artifact index（复刻 BuildModel.getArtifact 语义）
 *   - add/read/getEntries 通用（MemOutput/DiskOutput 共用）
 *   - add 是 virtual（DiskOutput 加 dirty tracking override）
 * - MemOutput：dev memfs（publish no-op——dev 模式产物在内存，dev server 读 Output.read + fs fallback）
 * - DiskOutput（P-O2）：one-shot disk（publish 封装 materialize+publishToDist+createDist 语义）
 *
 * D-OL1：orchestrator 入口 mode-aware 创建（dev → MemOutput / one-shot → DiskOutput），
 *        listr2 ctx 注入（tasks.run({output})），config-collector 跑前 sctx.output 已存在。
 *
 * 字节等价前提：entries 形状 = BuildModelEntry（{entryId, kind, files, sourcemaps?}）= EmitEntry（同形，F-R13-2）。
 *              read 复刻 BuildModel.getArtifact lazy index（path → {code}）。
 */
import type { EmitEntry } from '../emit/emit.ts'
import type { Output, PublishOpts } from '../types.ts'

/**
 * BaseOutput abstract base（F-R10-2 lock——read/getEntries 共用 + add virtual）。
 *
 * entries Map key = `${kind}:${entryId}`（复刻 BuildModel.add key 语义，保持同形）。
 */
export abstract class BaseOutput implements Output {
	/** entryId → EmitEntry（累积产物，stage onOutput add）。 */
	protected readonly entries: Map<string, EmitEntry> = new Map()
	/** lazy path → {code} index（read 用，add 后失效——复刻 BuildModel._artifactIndex）。 */
	private _artifactIndex: Map<string, { code: string }> | null = null

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
	 * lazy index——首次 read 构建，add 后失效重建（复刻 BuildModel.getArtifact）。
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

	/** DiskOutput 实现（P-O2）；MemOutput no-op。 */
	abstract publish(target: string, opts?: PublishOpts): void
}

/**
 * MemOutput——dev memfs（D-O2）。
 *
 * dev 模式（skipMaterialize=true）：产物在内存（entries Map），dev server 读 Output.read + fs fallback。
 * publish no-op——dev 不写盘（MemOutput.publish 等价 skipMaterialize=true，D-O5）。
 */
export class MemOutput extends BaseOutput {
	/** dev 不写盘——no-op（D-O5：MemOutput.publish no-op 等价 skipMaterialize）。 */
	publish(_target: string, _opts?: PublishOpts): void {
		// no-op：dev 模式产物在内存，dev server 读 Output.read（miss → fs.readFile fallback）
	}
}
