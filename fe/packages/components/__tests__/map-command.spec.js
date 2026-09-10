import { arcPoints, validateMapCommand } from '../src/component/map/map-command'
import { markerMotion } from '../src/component/map/marker-motion'

const start = { longitude: -1, latitude: 0 }
const end = { longitude: 1, latitude: 0 }
it('creates a circular arc through the supplied point and keeps exact endpoints', () => {
	const path = arcPoints({ id: 0, start, end, pass: { longitude: 0, latitude: 1 } })
	expect(path[0]).toEqual(start); expect(path.at(-1)).toEqual(end)
	expect(Math.max(...path.map(point => point.latitude))).toBeCloseTo(1, 3)
	expect(path.length).toBeLessThanOrEqual(181)
})
it('gives angle precedence over pass and preserves the direction of a signed angle', () => {
	const args = { id: 1, start, end, angle: 90 }
	expect(arcPoints({ ...args, pass: {} })).toEqual(arcPoints(args))
	expect(Math.min(...arcPoints(args).map(point => point.latitude))).toBeLessThan(-0.99)
	expect(Math.max(...arcPoints({ ...args, angle: -90 }).map(point => point.latitude))).toBeGreaterThan(0.99)
})
it('rejects degenerate and invalid arc data before rendering', () => {
	expect(() => arcPoints({ id: 0, start, end, pass: { longitude: 0, latitude: 0 } })).toThrow('collinear')
	expect(() => arcPoints({ id: 0, start, end: start, angle: 30 })).toThrow('endpoints')
	expect(() => arcPoints({ id: 0, start, end, angle: Number.NaN })).toThrow('angle')
})
it.each([Number.NaN, Infinity, -1])('rejects invalid animation duration %s', (duration) => {
	expect(() => validateMapCommand('translateMarker', { markerId: 0, destination: end, duration })).toThrow('duration')
})
it('weights route segments by distance and follows the shortest dateline crossing', () => {
	const sample = markerMotion([{ longitude: 179, latitude: 0 }, { longitude: -179, latitude: 0 }], { autoRotate: true })
	expect(Math.abs(sample(0.5).longitude)).toBe(180)
	expect(sample(0.5).rotate).toBeCloseTo(90)
	expect(sample(1).longitude).toBe(-179)
})
it('separates rotation and movement and handles coincident points without NaN', () => {
	const sample = markerMotion([start, end], { rotate: 90, separateRotation: true })
	expect(sample(0.25)).toMatchObject({ longitude: -1, rotate: 45 })
	expect(sample(0.75)).toMatchObject({ longitude: 0, rotate: 90 })
	const stationary = markerMotion([start, start], { rotate: 90, autoRotate: true })(1)
	expect(stationary).toMatchObject({ longitude: -1, latitude: 0, rotate: 90, distance: 0 })
})
