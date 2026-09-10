import type { Emitter } from 'mitt';
import type { Bridge } from '../../core/bridge.js';
import type { BridgeMessage } from '../../types.js';
import type { MergedPageConfig } from '../../utils/util.js';
import './webview.scss';
export interface WebViewOptions {
    configInfo: MergedPageConfig;
    isRoot: boolean;
    pageFrameUrl?: string;
    /** 逐 app 覆盖的资源基路径；页面相对路径资源需要相对它而不是容器自身部署路径解析时才传。 */
    resourceBaseUrl?: string;
    showHomeButton?: boolean;
}
type WebViewEvents = {
    invoke: BridgeMessage;
    publish: BridgeMessage;
};
export declare class WebView {
    opts: WebViewOptions;
    id: string;
    el: HTMLElement;
    iframe: HTMLIFrameElement;
    event: Emitter<WebViewEvents>;
    /** createWebview() 里赋值为发起创建的 Bridge 实例。 */
    parent: Bridge;
    constructor(opts: WebViewOptions);
    init(callback?: () => void, signal?: AbortSignal): Promise<void>;
    /**
     * 逐 app 覆盖 resourceBaseUrl 时，靠 <base href> 让渲染 iframe 里的相对路径资源跟着走。
     * doc.head 理论上总是存在（任何 Document 隐式都有），这里仍判空——测试环境里桩出来的
     * iframe 文档不走完整 HTML 解析，可能没有 head。
     */
    applyResourceBaseUrl(doc: Document): void;
    invoke(handler: (msg: BridgeMessage) => void): void;
    publish(handler: (msg: BridgeMessage) => void): void;
    /**
     * 容器层向渲染线程发送消息
     * @param {*} msg
     */
    postMessage(msg: BridgeMessage): void;
    bindBackEvent(): void;
    bindHomeEvent(): void;
    /**
     * 返回首页按钮的显隐。显示判据由 MiniApp.shouldShowHomeButton 统一给出，
     * wx.hideHomeButton 也经这里隐藏调用页自己的按钮
     */
    setHomeButtonVisible(visible: boolean): void;
    /**
     * 等待渲染层 iframe 加载完成。signal 被 abort 时 reject AbortError——
     * iframe 已经/即将被拆掉，onload 不会再触发，不能让调用方无限期挂起。
     */
    frameLoaded(signal?: AbortSignal): Promise<void>;
    /**
     * 应用页面级导航栏/背景样式。幂等：redirectTo 复用当前 webview 时会以新页面配置重新调用。
     */
    applyPageStyle(config: MergedPageConfig, { isRoot, showHomeButton }: {
        isRoot: boolean;
        showHomeButton: boolean;
    }): void;
}
export {};
