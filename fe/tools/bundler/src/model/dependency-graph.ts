import path from 'node:path'

function normalizeFilePath(filePath: string): string {
	return path.resolve(filePath)
}

function normalizeKinds(kinds: string | string[] | null | undefined): Set<string> | null {
	if (!kinds) return null
	return new Set(Array.isArray(kinds) ? kinds : [kinds])
}

interface GraphNode { id: string; type: string; entry: boolean; packageRoot: string | null; files: Set<string> }
export interface GraphSnapshot { nodes?: Array<GraphNode & { files?: string[] }>; edges?: Array<{ from: string; to: string; kinds?: string[] }>; fileEdges?: Array<{ file: string; owner: string; kinds?: string[] }> }

class DependencyGraph {
	nodes: Map<string, GraphNode>
	dependencies: Map<string, Map<string, Set<string>>>
	dependents: Map<string, Map<string, Set<string>>>
	fileOwners: Map<string, Set<string>>
	fileKinds: Map<string, Map<string, Set<string>>>

	constructor(snapshot?: GraphSnapshot | DependencyGraph | null) {
		this.nodes = new Map()
		this.dependencies = new Map()
		this.dependents = new Map()
		this.fileOwners = new Map()
		this.fileKinds = new Map()
		if (snapshot) {
			this.merge(snapshot)
		}
	}

	addNode(id: string, metadata: { type?: string; entry?: boolean; packageRoot?: string | null; files?: string[] } = {}): GraphNode | null {
		if (!id) return null
		const current: GraphNode = this.nodes.get(id) || {
			id,
			type: 'module',
			entry: false,
			packageRoot: null,
			files: new Set(),
		}
		if (metadata.type) current.type = metadata.type
		if (metadata.entry === true) current.entry = true
		if (metadata.packageRoot !== undefined) current.packageRoot = metadata.packageRoot
		this.nodes.set(id, current)
		for (const filePath of metadata.files || []) {
			this.addFile(id, filePath)
		}
		return current
	}

	addFile(id: string, filePath: string, kind: string = 'module'): void {
		if (!id || !filePath) return
		const node = this.addNode(id)
		if (!node) return
		const normalizedPath = normalizeFilePath(filePath)
		node.files.add(normalizedPath)
		const owners = this.fileOwners.get(normalizedPath) || new Set()
		owners.add(id)
		this.fileOwners.set(normalizedPath, owners)
		const ownerKinds = this.fileKinds.get(normalizedPath) || new Map()
		const kinds = ownerKinds.get(id) || new Set()
		kinds.add(kind)
		ownerKinds.set(id, kinds)
		this.fileKinds.set(normalizedPath, ownerKinds)
	}

	addDependency(from: string, to: string, kind: string = 'module'): void {
		if (!from || !to) return
		this.addNode(from)
		this.addNode(to)
		const outgoing = this.dependencies.get(from) || new Map()
		const kinds = outgoing.get(to) || new Set()
		kinds.add(kind)
		outgoing.set(to, kinds)
		this.dependencies.set(from, outgoing)

		const incoming = this.dependents.get(to) || new Map()
		const reverseKinds = incoming.get(from) || new Set()
		reverseKinds.add(kind)
		incoming.set(from, reverseKinds)
		this.dependents.set(to, incoming)
	}

	getDirectDependencies(id: string, kinds?: string | string[] | null): string[] {
		return this.#filterEdges(this.dependencies.get(id), kinds)
	}

	getDirectDependents(id: string, kinds?: string | string[] | null): string[] {
		return this.#filterEdges(this.dependents.get(id), kinds)
	}

	getAffectedEntries(filePath: string): string[] {
		const owners = this.fileOwners.get(normalizeFilePath(filePath)) || new Set()
		const pending = [...owners]
		const visited = new Set()
		const entries = new Set<string>()
		while (pending.length > 0) {
			const id = pending.pop()!
			if (visited.has(id)) continue
			visited.add(id)
			const node = this.nodes.get(id)
			if (node?.entry) entries.add(id)
			for (const dependent of this.getDirectDependents(id)) {
				pending.push(dependent)
			}
		}
		return [...entries].sort()
	}

	getInvalidatedModules(filePath: string): string[] {
		const normalizedPath = normalizeFilePath(filePath)
		const ownerKinds = this.fileKinds.get(normalizedPath)
		if (!ownerKinds) return []
		const pending: string[] = []
		for (const [owner, kinds] of ownerKinds) {
			if (kinds.has('logic')) pending.push(owner)
		}
		const visited = new Set<string>()
		while (pending.length > 0) {
			const id = pending.pop()!
			if (visited.has(id)) continue
			visited.add(id)
			for (const dependent of this.getDirectDependents(id, 'logic')) {
				pending.push(dependent)
			}
		}
		return [...visited].sort()
	}

	clearOutgoingEdges(id: string, kind?: string): void {
		const outgoing = this.dependencies.get(id)
		if (!outgoing) return
		for (const [to, kinds] of [...outgoing]) {
			if (kind) {
				kinds.delete(kind)
				if (kinds.size === 0) {
					outgoing.delete(to)
				}
			} else {
				outgoing.delete(to)
			}
			const incoming = this.dependents.get(to)
			if (incoming) {
				const reverseKinds = incoming.get(id)
				if (reverseKinds) {
					if (kind) {
						reverseKinds.delete(kind)
						if (reverseKinds.size === 0) incoming.delete(id)
					} else {
						incoming.delete(id)
					}
				}
				if (incoming.size === 0) this.dependents.delete(to)
			}
		}
		if (outgoing.size === 0) this.dependencies.delete(id)
	}

	removeNode(id: string): void {
		const node = this.nodes.get(id)
		if (!node) return
		for (const filePath of node.files) {
			const owners = this.fileOwners.get(filePath)
			if (owners) {
				owners.delete(id)
				if (owners.size === 0) this.fileOwners.delete(filePath)
			}
			const ownerKinds = this.fileKinds.get(filePath)
			if (ownerKinds) {
				ownerKinds.delete(id)
				if (ownerKinds.size === 0) this.fileKinds.delete(filePath)
			}
		}
		this.clearOutgoingEdges(id)
		const incoming = this.dependents.get(id)
		if (incoming) {
			for (const from of [...incoming.keys()]) {
				const fromOutgoing = this.dependencies.get(from)
				if (fromOutgoing) {
					fromOutgoing.delete(id)
					if (fromOutgoing.size === 0) this.dependencies.delete(from)
				}
			}
			this.dependents.delete(id)
		}
		this.nodes.delete(id)
	}

	getDependencyClosure(entryId: string): string[] {
		if (!this.nodes.has(entryId)) return []
		const visited = new Set<string>()
		const pending: string[] = [entryId]
		while (pending.length > 0) {
			const id = pending.pop()!
			if (visited.has(id)) continue
			visited.add(id)
			for (const dep of this.getDirectDependencies(id)) {
				if (!visited.has(dep)) pending.push(dep)
			}
		}
		return [...visited].sort()
	}

	hasFile(filePath: string): boolean {
		return this.fileOwners.has(normalizeFilePath(filePath))
	}

	getFileKinds(filePath: string): string[] {
		const ownerKinds = this.fileKinds.get(normalizeFilePath(filePath))
		if (!ownerKinds) return []
		return [...new Set(
			[...ownerKinds.values()].flatMap(kinds => [...kinds]),
		)].sort()
	}

	merge(snapshotOrGraph: GraphSnapshot | DependencyGraph): this {
		const snapshot: GraphSnapshot = snapshotOrGraph instanceof DependencyGraph
			? (snapshotOrGraph.toJSON() as GraphSnapshot)
			: (snapshotOrGraph as GraphSnapshot)
		const fileEdges = snapshot?.fileEdges || []
		for (const node of snapshot?.nodes || []) {
			this.addNode(node.id, { ...node, files: [] })
			if (fileEdges.length === 0) {
				for (const filePath of node.files || []) {
					this.addFile(node.id, filePath)
				}
			}
		}
		for (const fileEdge of fileEdges) {
			for (const kind of fileEdge.kinds || ['module']) {
				this.addFile(fileEdge.owner, fileEdge.file, kind)
			}
		}
		for (const edge of snapshot?.edges || []) {
			for (const kind of edge.kinds || ['module']) {
				this.addDependency(edge.from, edge.to, kind)
			}
		}
		return this
	}

	toJSON(): { nodes: Array<{ id: string; type: string; entry: boolean; packageRoot: string | null; files: string[] }>; edges: Array<{ from: string; to: string; kinds: string[] }>; fileEdges: Array<{ file: string; owner: string; kinds: string[] }> } {
		return {
			nodes: [...this.nodes.values()]
				.map(node => ({
					id: node.id,
					type: node.type,
					entry: node.entry,
					packageRoot: node.packageRoot,
					files: [...node.files].sort(),
				}))
				.sort((a, b) => a.id.localeCompare(b.id)),
			edges: [...this.dependencies.entries()]
				.flatMap(([from, targets]) => [...targets.entries()].map(([to, kinds]) => ({
					from,
					to,
					kinds: [...kinds].sort(),
				})))
				.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
			fileEdges: [...this.fileKinds.entries()]
				.flatMap(([file, owners]) => [...owners.entries()].map(([owner, kinds]) => ({
					file,
					owner,
					kinds: [...kinds].sort(),
				})))
				.sort((a, b) => a.file.localeCompare(b.file) || a.owner.localeCompare(b.owner)),
		}
	}

	#filterEdges(edges: Map<string, Set<string>> | undefined, kinds: string | string[] | null | undefined): string[] {
		if (!edges) return []
		const acceptedKinds = normalizeKinds(kinds)
		return [...edges.entries()]
			.filter(([, edgeKinds]) => !acceptedKinds || [...edgeKinds].some(kind => acceptedKinds.has(kind)))
			.map(([id]) => id)
	}
}

export { DependencyGraph }
