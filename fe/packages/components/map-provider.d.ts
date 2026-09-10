/** Provider coordinates are GCJ-02. Convert inside the adapter when the SDK uses another CRS. */
export interface MapCoordinate { longitude: number; latitude: number }
export interface MapProperties extends MapCoordinate {
	id: string
	scale: number
	/** Omitted IDs are anonymous: append on addMarkers, replace on a new markers snapshot. */
	markers: Array<MapCoordinate & { id?: number; [key: string]: unknown }>
	[key: string]: unknown
}
export interface MapAdapter {
	/** Apply a complete property snapshot; unchanged fields must preserve imperative state. */
	update(props: MapProperties): void | Promise<void>
	/** Return serializable data, or throw/reject for failure and unsupported commands.
	 * Marker animation promises settle on completion; replacement/removal must reject
	 * the previous animation. Other commands may run while that promise is pending.
	 */
	invoke(command: string, params: Record<string, unknown>): unknown | Promise<unknown>
	/** Release all SDK objects/listeners. Must be safe after abort and when called again. */
	destroy(): void
}
export interface MapProviderContext {
	element: HTMLElement
	bridgeId?: string
	props: MapProperties
	options: Record<string, unknown>
	emit(type: string, detail?: Record<string, unknown>): void
	signal: AbortSignal
	/** Must handle OS permission and return GCJ-02 coordinates; no browser fallback is implied. */
	getLocation?: (options: { type: 'gcj02'; signal: AbortSignal }) => Promise<MapCoordinate>
}
export interface MapProvider {
	/** Resolve when the map is ready for commands. Clean up partially created resources on failure. */
	create(context: MapProviderContext): MapAdapter | Promise<MapAdapter>
}
export interface MapConfig {
	provider: string
	/** Host registration, e.g. { tencent: tencentProvider }; built-in provider names: amap (Web), native (mobile transport). */
	providers?: Record<string, MapProvider>
	/** SDK-specific keys/settings are visible only to the selected provider. */
	providerOptions?: Record<string, Record<string, unknown>>
	/** Called before loading any third-party script or creating a provider. */
	authorize(): boolean | Promise<boolean>
	getLocation?: MapProviderContext['getLocation']
	/** Initialization/operation deadline in milliseconds; default 15000. Marker animation duration is added to its deadline. */
	timeout?: number
}
