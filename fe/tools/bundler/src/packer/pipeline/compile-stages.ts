import { COMPILE_STAGE_ORDER } from './stage-order.ts'

const COMPILE_STAGE_SET = new Set(COMPILE_STAGE_ORDER)

function getCompileStagesForFiles(dependencyGraph: { getFileKinds: (f: string) => string[]; getAffectedEntries: (f: string) => string[] }, filePaths: string[]): { stages: string[]; unknownKinds: string[] } {
	const selected = new Set<string>()
	const unknownKinds = new Set<string>()
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
		unknownKinds: [...unknownKinds].sort(),
	}
}

export { getCompileStagesForFiles }
