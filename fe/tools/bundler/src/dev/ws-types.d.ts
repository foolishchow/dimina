declare module 'ws' {
	export interface WebSocket {
		readonly readyState: number
		on(event: 'message', listener: (data: Buffer) => void): this
		on(event: 'close', listener: () => void): this
		on(event: 'error', listener: (error: Error) => void): this
		send(data: string): void
		close(): void
	}
	export class WebSocket {
		static readonly OPEN: number
		static readonly CLOSED: number
	}
	export interface WebSocketServer {
		on(event: 'connection', listener: (socket: WebSocket) => void): this
		on(event: 'error', listener: (error: Error) => void): this
		close(callback?: (error: Error | null) => void): void
	}
	export class WebSocketServer {
		constructor(options: { server: import('node:http').Server; path: string })
	}
}
