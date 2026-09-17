const COMPILE_STAGE_ORDER = ['view', 'logic', 'style']
const COMPILE_STAGE_SET = new Set(COMPILE_STAGE_ORDER)

function getCompileStagesForFiles(dependencyGraph: { getFileKinds: (f: string) => string[]; getAffectedEntries: (f: string) => string[] }, filePaths: string[]): { stages: string[]; unknownKinds: string[] } {
	const selected = new Set()
	const unknownKinds = new Set()
	for (const filePath of filePaths) {
		for (const kind of dependencyGraph.getFileKinds(filePath)) {
			if (COMPILE_STAGE_SET.has(kind)) {
				selected.add(kind)
			}
			else if (kind !== 'config') {
				unknownKinds.add(kind)
			}
		}
	}
	return {
		stages: COMPILE_STAGE_ORDER.filter(stage => selected.has(stage)),
		// @ts-expect-error P-TM04: type narrowing needed
		unknownKinds: [...unknownKinds].sort(),
	}
}

export { getCompileStagesForFiles }
