import type { JSCore } from './jscore.js';
import type { MiniApp } from '../pages/miniApp/miniApp.js';
import type { BridgeMessage, BridgeOptions } from '../types.js';
import { WebView } from '../pages/webview/webview.js';
/**
 * 拆掉页面的两种原因。微信里 unloadPage 只有路由事件（reLaunch/redirectTo/navigateBack/
 * switchTab）会触发，退出小程序走的是 onAppEnterBackground，只派发 App.onHide，页面不收
 * onUnload。三端语义一致，Android 见 core/Bridge.kt 的 PageStateTeardown。
 */
export type PageStateTeardown = 'routing' | 'exit';
export interface BridgeStartOptions {
    visible?: boolean;
}
export declare class Bridge {
    #private;
    id: string;
    opts: BridgeOptions & {
        jscore: JSCore;
    };
    webview: WebView | null;
    jscore: JSCore;
    devCommandResultHandler?: (body: Record<string, unknown>) => void;
    parent: MiniApp | null;
    destroyed: boolean;
    serviceResource: boolean;
    renderResource: boolean;
    resourceLoadedForwarded: boolean;
    resourceLoadId: string | null;
    desiredPageVisible: boolean | null;
    sentPageVisible: boolean | null;
    domReadyResourceLoadId: string | null;
    private startupReadyWaiter;
    private unsubscribeServiceInvoke;
    private unsubscribeServicePublish;
    constructor(opts: BridgeOptions & {
        jscore: JSCore;
    });
    init(signal?: AbortSignal): Promise<void>;
    /**
     * dev-only（A3 HMR）：宿主页向渲染层转发 dev 指令（如 hmr/enableDevHmr）。
     * 仅在 dmcc dev 场景由宿主页 ws 分发调用；不进入原生/生产调用图。
     * @param {string} type render message.on 监听的消息类型
     * @param {Record<string, unknown>} body 指令体
     * @returns {boolean} 是否送达（无 webview 或已销毁时 false）
     */
    sendDevCommand(type: string, body?: Record<string, unknown>, onResult?: (body: Record<string, unknown>) => void): boolean;
    /**
     * 消息中转
     * @param {*} msg
     */
    messagePublish(msg: BridgeMessage | string): void;
    /**
     * 消息处理
     * @param {*} source
     * @param {*} msg
     */
    messageInvoke(source: 'service' | 'render', msg: BridgeMessage | string): void;
    /**
     * 启动资源加载
     */
    start(options?: BridgeStartOptions): void;
    /**
     * 启动事务门：service、render 资源与首屏 DOM 必须都属于本次 resourceLoadId。
     * Worker 失败、渲染资源失败、销毁或超时都会 reject，启动遮罩不能提前消失，
     * 也不能永久挂住。
     */
    startAndWait(options?: BridgeStartOptions): Promise<void>;
    resetStatus(): void;
    /**
     * 被 abort 时 resolve(null) 而非 reject，调用方据此静默放弃；挂载后才 abort 的
     * 会摘除已插入的 el，不留孤儿 iframe。非 abort 的真实初始化失败照常 reject。
     */
    createWebview(signal?: AbortSignal): Promise<WebView | null>;
    /**
     * 双线程资源是否已经初始化完成
     */
    isResourceLoaded(): boolean;
    isStartupReady(): boolean;
    pageShow(): void;
    pageHide(): void;
    /**
     * @param reason 默认按路由处理：直接销毁一个 Bridge 的调用点全都是路由卸载页面。
     * 退出小程序或整体换 runtime 由关闭方显式传 'exit'，那时只静默回收资源。
     */
    destroy(reason?: PageStateTeardown): void;
}
