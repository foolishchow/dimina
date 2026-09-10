const radians = Math.PI / 180
const delta = value => ((value + 540) % 360) - 180

export function distance(a, b) {
	const dy = (b.latitude - a.latitude) * radians
	const dx = delta(b.longitude - a.longitude) * radians
	const h = Math.sin(dy / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dx / 2) ** 2
	return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

// Precompute distance once; each frame does a binary search, not a route scan.
export function markerMotion(path, { angle = 0, rotate = angle, autoRotate = false, separateRotation = false } = {}) {
	const lengths = [0]
	for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + distance(path[i - 1], path[i]))
	const total = lengths.at(-1)
	return (progress) => {
		const rotation = separateRotation ? Math.min(1, progress * 2) : progress
		const movement = separateRotation ? Math.max(0, progress * 2 - 1) : progress
		const traveled = movement * total
		let low = 1; let high = path.length - 1
		while (low < high) { const mid = (low + high) >> 1; if (lengths[mid] < traveled) low = mid + 1; else high = mid }
		const a = path[low - 1]; const b = path[low]
		const fraction = lengths[low] === lengths[low - 1] ? movement : (traveled - lengths[low - 1]) / (lengths[low] - lengths[low - 1])
		const dx = delta(b.longitude - a.longitude) * radians
		const bearing = Math.atan2(Math.sin(dx) * Math.cos(b.latitude * radians),
			Math.cos(a.latitude * radians) * Math.sin(b.latitude * radians) - Math.sin(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.cos(dx)) / radians
		return {
			longitude: movement === 1 ? b.longitude : delta(a.longitude + delta(b.longitude - a.longitude) * fraction),
			latitude: a.latitude + (b.latitude - a.latitude) * fraction,
			rotate: autoRotate && movement > 0 && total > 0 ? (bearing + 360) % 360 : angle + delta(rotate - angle) * rotation,
			distance: traveled,
		}
	}
}
