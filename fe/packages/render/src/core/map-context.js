// The DOM contract avoids sharing a singleton across independently bundled render/components.
export async function invokeMapContext({ bridgeId, params }, send) {
	const { command, mapId, moduleId, success, fail, complete } = params
	let result
	let callbackId
	try {
		const matches = [...document.querySelectorAll('.dd-map')].filter((node) => {
			const owner = node.__diminaMap
			return node.id === mapId && owner?.moduleId === moduleId && owner.bridgeId === bridgeId
		})
		if (matches.length !== 1) throw new Error(matches.length ? 'map id is ambiguous' : 'map not found')
		const data = await matches[0].__diminaMap.invoke(command, params)
		result = { ...data, errMsg: `${command}:ok` }
		callbackId = success
	}
	catch (error) {
		result = { errMsg: `${command}:fail ${error.message || 'map operation failed'}` }
		callbackId = fail
	}
	for (const id of [callbackId, complete]) {
		if (id) send({ type: 'triggerCallback', target: 'service', body: { bridgeId, id, args: result } })
	}
}
