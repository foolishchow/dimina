import { afterEach, describe, expect, it, vi } from 'vitest'
import printArt from '../src/shared/art.js'

describe('compiler header', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('prints the DIMINA character-art header with space for tasks below it', () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {})

		printArt()

		expect(log).toHaveBeenCalledOnce()
		const [output] = log.mock.calls[0]
		const lines = output.trim().split('\n')
		expect(lines).toEqual([
			'██████╗ ██╗███╗   ███╗██╗███╗   ██╗ █████╗',
			'██╔══██╗██║████╗ ████║██║████╗  ██║██╔══██╗',
			'██║  ██║██║██╔████╔██║██║██╔██╗ ██║███████║',
			'██║  ██║██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║',
			'██████╔╝██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║',
			'╚═════╝ ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝',
		])
		expect(output.endsWith('\n')).toBe(true)
	})
})
