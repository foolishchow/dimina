type CallbackId = unknown;
type SocketEventName = 'open' | 'message' | 'error' | 'close';
type ApiParams = Record<string, unknown> & {
    socketId?: unknown;
    success?: CallbackId;
    fail?: CallbackId;
    complete?: CallbackId;
    callback?: CallbackId;
};
export interface WebSocketManagerOptions {
    emitCallback: (callbackId: CallbackId, payload?: unknown) => void;
    getAppConnectTimeout?: () => number | undefined;
    webSocketFactory?: (url: string, protocols: string[]) => WebSocket;
}
/** Web 容器的 wx.connectSocket / SocketTask 传输与生命周期管理器。 */
export declare class WebSocketManager {
    private readonly emitCallback;
    private readonly getAppConnectTimeout;
    private readonly webSocketFactory;
    private readonly sockets;
    private readonly terminalReplay;
    private readonly legacyListeners;
    private legacyBoundSocketId;
    private backgrounded;
    private backgroundTimer;
    private destroyed;
    constructor(options: WebSocketManagerOptions);
    connectSocket(params?: ApiParams): void;
    sendSocketMessage(params?: ApiParams): void;
    closeSocket(params?: ApiParams): void;
    onSocketEvent(event: SocketEventName, params?: ApiParams): void;
    offSocketEvent(event: SocketEventName, params?: ApiParams): void;
    onAppHide(): void;
    onAppShow(): void;
    destroy(): void;
    private startDialing;
    private handleOpen;
    private handleMessage;
    private handleError;
    private handleClose;
    private handleConnectTimeout;
    private terminateHandshakeWithError;
    private terminateOpenedEntry;
    private resolveEntry;
    private dispatchEvent;
    private replayMissedEvent;
    private emitEventOnce;
    private recordTerminalEvent;
    private forgetDeliveredCallback;
    private clearTerminalReplay;
    private replayKey;
    private isCurrent;
    private detachEntry;
    private clearConnectTimer;
    private closeTransport;
    private succeed;
    private fail;
    private emit;
}
export type { ApiParams, SocketEventName };
