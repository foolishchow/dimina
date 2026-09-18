declare module 'less' {
	const less: {
		render: (input: string, options?: Record<string, unknown>) => Promise<{
			css: string
			map?: string
			imports?: string[]
		}>
		[x: string]: unknown
	}
	export default less
}
