import type { Application } from '../application/application.js';
import type { BridgeOptions, MiniProgramReferrerInfo, PageStackEntry, StorageAdapter } from '../../types.js';
import type { ApiParams } from '../../core/webSocketManager.js';
import type { AppWindowConfig, MergedPageConfig, PageConfig } from '../../utils/util.js';
import { Bridge } from '../../core/bridge.js';
import { JSCore } from '../../core/jscore.js';
import { WebSocketManager } from '../../core/webSocketManager.js';
import { Navigator } from './navigator.js';
import './miniApp.scss';
/**
 * 逻辑线程 invokeAPI 传入的回调标识（success/fail/complete）：形状由 service 侧
 * 决定，这里只做 truthy 判断后经 triggerCallback 原样带回。
 */
type CallbackId = unknown;
type ApiCallback = (args?: unknown) => void;
interface StorageValueRecord {
    version: 2;
    kind: 'value' | 'deleted';
    dataType?: 'json' | 'undefined';
    data?: unknown;
}
interface ApiCallbackOptions {
    success?: CallbackId;
    fail?: CallbackId;
    complete?: CallbackId;
}
export interface MiniAppOptions {
    appId: string;
    scene?: number;
    referrerInfo?: MiniProgramReferrerInfo;
    /** 打开当前小程序的直接来源；仅容器内部用于 navigateBackMiniProgram。 */
    opener?: MiniApp | null;
    name?: string;
    logo?: string;
    pagePath: string;
    query?: Record<string, string>;
    /** 完整页面栈，用于刷新后静默恢复 */
    restoreStack?: Array<{
        pagePath: string;
        query?: Record<string, string>;
    }>;
    /** 逐 app 覆盖容器默认 resourceBaseUrl；已由 AppManager 解析并校验过 allowedOrigins。 */
    resourceBaseUrl?: string;
    /** 当前容器已经归一化的虚拟文件协议前缀。 */
    virtualFilePrefix?: string;
}
interface TabBarItemConfig {
    pagePath: string;
    text?: string;
    iconPath?: string;
    selectedIconPath?: string;
}
interface TabBarConfig {
    color?: string;
    selectedColor?: string;
    backgroundColor?: string;
    borderStyle?: 'black' | 'white';
    custom?: boolean;
    list: TabBarItemConfig[];
}
interface AppConfigApp {
    entryPagePath: string;
    pages: string[];
    runtimeType?: 'miniProgram' | 'game';
    window?: AppWindowConfig;
    tabBar?: TabBarConfig;
    networkTimeout?: {
        connectSocket?: number;
    };
}
export interface MiniAppConfig {
    app: AppConfigApp;
    modules: Record<string, PageConfig>;
}
interface ToastInfo {
    dom: HTMLElement | null;
    timer: ReturnType<typeof setTimeout> | null;
    maskEl?: HTMLElement | null;
}
interface ModalCloseResult {
    cancel: boolean;
    confirm: boolean;
    errMsg: string;
}
interface ModalEntry {
    mask: HTMLElement;
    dialog: HTMLElement;
    close: ((result?: ModalCloseResult) => void) | null;
}
interface ShowToastOptions extends ApiCallbackOptions {
    title?: string;
    duration?: number;
    icon?: string;
    mask?: boolean;
}
interface ShowModalOptions extends ApiCallbackOptions {
    title?: string;
    content?: string;
    showCancel?: boolean;
    cancelText?: string;
    cancelColor?: string;
    confirmText?: string;
    confirmColor?: string;
}
interface ShowActionSheetOptions {
    itemList?: string[];
    itemColor?: string;
    success?: CallbackId;
    fail?: CallbackId;
    complete?: CallbackId;
}
interface NavigateOptions extends ApiCallbackOptions {
    url: string;
}
interface SetNavigationBarTitleOptions extends ApiCallbackOptions {
    title?: string;
}
interface SetNavigationBarColorOptions extends ApiCallbackOptions {
    frontColor?: string;
    backgroundColor?: string;
}
interface PageScrollToOptions extends ApiCallbackOptions {
    scrollTop?: number;
    duration?: number;
}
interface SetClipboardDataOptions extends ApiCallbackOptions {
    data: string;
}
interface StorageKeyOptions extends ApiCallbackOptions {
    key: string;
}
interface SetStorageOptions extends StorageKeyOptions {
    data: unknown;
}
interface SaveFileOptions extends ApiCallbackOptions {
    tempFilePath?: string;
    filePath?: string;
}
interface WakeLockSentinelLike {
    released?: boolean;
    release: () => Promise<void>;
    addEventListener?: (type: 'release', listener: () => void, options?: AddEventListenerOptions) => void;
}
interface SetTabBarStyleOptions extends ApiCallbackOptions {
    color?: string;
    selectedColor?: string;
    backgroundColor?: string;
    borderStyle?: string;
}
interface SetTabBarItemOptions extends ApiCallbackOptions {
    index?: number | string;
    text?: string;
    iconPath?: string;
    selectedIconPath?: string;
}
interface TabBarIndexOptions extends ApiCallbackOptions {
    index?: number | string;
}
interface TabBarBadgeOptions extends TabBarIndexOptions {
    text?: string;
}
interface NavigateToMiniProgramOptions extends ApiCallbackOptions {
    appId?: string;
    path?: string;
    extraData?: unknown;
    envVersion?: 'develop' | 'trial' | 'release';
    noRelaunchIfPathUnchanged?: boolean;
    shortLink?: string;
}
interface NavigateBackMiniProgramOptions extends ApiCallbackOptions {
    extraData?: unknown;
}
interface RestartMiniProgramOptions extends ApiCallbackOptions {
    path?: string;
}
interface ExtCallParams {
    module?: string;
    data?: unknown;
    success?: CallbackId;
    fail?: CallbackId;
    complete?: CallbackId;
    evtId?: unknown;
}
export declare class MiniApp {
    appInfo: MiniAppOptions & {
        virtualFilePrefix: string;
    };
    id: string;
    parent: Application | null;
    appId: string;
    opener: MiniApp | null;
    appConfig: MiniAppConfig | null;
    runtimeType: 'miniProgram' | 'game';
    navigator: Navigator;
    jscore: JSCore;
    webviewsContainer: HTMLElement | null;
    webviewAnimaEnd: boolean;
    el: HTMLElement;
    toastInfo: ToastInfo;
    color: string | null;
    apiRegistry: Record<string, (this: MiniApp, params?: unknown, callerBridge?: Bridge) => void>;
    webSocketManager: WebSocketManager;
    /** 维护第三方扩展的持续订阅，key: `${module}_${event}`，value: unsubscribe 函数 */
    _extSubscriptions: Map<string, (() => void) | null>;
    _windowResizeHandlers: Set<() => void>;
    _networkStatusHandlers: Map<CallbackId, () => void>;
    _wakeLockSentinel: WakeLockSentinelLike | null;
    _wakeLockRequest: Promise<void> | null;
    _keepScreenOnRequested: boolean;
    _wakeLockVisibilityHandler: (() => void) | null;
    _mediaPreviewEl: HTMLElement | null;
    _tempObjectUrls: Set<string>;
    /** app.tabBar 配置 */
    tabBarConfig: TabBarConfig | null;
    /** 与 list 等长，pagePath 数组（已规范化、无前导 /） */
    tabBarPaths: string[];
    /** .dimina-mini-app__tabbar 根节点 */
    tabBarEl: HTMLElement | null;
    /** TabBar 实际高度，用于给 tab 页 webview 单独预留底部空间 */
    tabBarHeight: number;
    /** 每个 tab item 的 badge 文本 */
    tabBarBadges: string[];
    /** 每个 tab item 的红点显示状态 */
    tabBarRedDots: boolean[];
    /** wx.showTabBar/hideTabBar 控制的显隐开关 */
    tabBarApiVisible: boolean;
    /**
     * showModal 用 LIFO stack：后来的 modal 压在前一个之上（z-index 递增），
     * 关闭顶上 modal 露出下方；前后 modal 互不干扰，各自 success/complete 独立。
     */
    _modalStack: ModalEntry[];
    _modalPendingTimers: Set<ReturnType<typeof setTimeout>>;
    /** showModal 期间锁定的、承载当前页面内容的渲染 iframe window；未锁定时为 null。 */
    _modalPageTouchTarget: Window | null;
    _destroyed: boolean;
    /** Whether every live page has already queued its terminal Page.onUnload. */
    _destructionLifecycleQueued: boolean;
    /** destroy() 时 abort，用于打断在途的 bridge.init()（见 frameLoaded 的 AbortSignal 用法）。 */
    _destroyAbortController: AbortController;
    customTabBar: boolean;
    _themeMediaQuery: MediaQueryList | null;
    _themeChangeHandler: ((event: MediaQueryListEvent) => void) | null;
    _tabBarResizeObserver: ResizeObserver | null;
    constructor(opts: MiniAppOptions);
    /** 入口页路径（无前导 /）：openApp 解析后的结果，宿主可读。 */
    get pagePath(): string;
    /** 入口页 query：openApp 解析后的结果，宿主可读。 */
    get query(): Record<string, string>;
    /**
     * 规范化 pagePath：去除前导 /，与 app.tabBar.list 中声明的格式对齐。
     */
    _normalizePagePath(path?: string | null): string;
    /**
     * 判断给定路径是否为 tabBar 页面。
     */
    _isTabBarPage(pagePath?: string | null): boolean;
    getCurrentPagePath(): string;
    getCurrentPageQuery(): Record<string, string>;
    getEntryPagePath(): string;
    /**
     * 应用首页——返回首页按钮的跳转目标与其显示判据的比较对象。
     * 取配置声明的 entryPagePath（缺省 pages[0]），不受 deep-link 启动页影响。
     */
    getHomePagePath(): string;
    /**
     * 返回首页按钮显示判据（微信真机实测语义）：默认导航栏 + 当前页非应用首页 +
     * 非 tabBar 页（这两条排除 homeButton: true 也不能突破），且满足其一：
     * 栈底页面（自动规则），或页面配置 homeButton: true（此时与返回箭头并存）。
     * wx.hideHomeButton 的隐藏作用在 webview 上（setHomeButtonVisible），不在这里
     */
    shouldShowHomeButton({ pagePath, configInfo, isRoot }: {
        pagePath?: string | null;
        configInfo?: MergedPageConfig;
        isRoot?: boolean;
    }): boolean;
    /**
     * 返回首页（导航栏 home 按钮的唯一路由入口），终态都是只剩首页：
     * 首页是 tab 页走 switchTab（保留其它 tab 状态并露出 tabBar，自带清非 tab 栈）；
     * 首页非 tab 且当前是栈底，redirectTo 原地替换；非栈底（homeButton: true 的
     * 内页）redirect 只会替换栈顶、栈底仍在，须 reLaunch 清整栈
     */
    navigateHome(): void;
    /**
     * wx.hideHomeButton：隐藏调用页自己的返回首页按钮。经 bridge 归属调用方，
     * 后台页的迟到调用不会隐藏当前可见页面的按钮
     */
    hideHomeButton(opts?: ApiCallbackOptions, callerBridge?: Bridge): void;
    copyText(text: string, successText?: string): Promise<void>;
    closeMiniProgram(): void;
    renderMiniAppMenu(): void;
    openMiniAppMenu(): void;
    closeMiniAppMenu(): void;
    registerApi(name: string, handler: (this: MiniApp, params?: unknown) => void): void;
    getApiNamespaces(): string[];
    getResourceBaseUrl(): string;
    getPageFrameUrl(): string;
    _getStatusBarRect(): import("../../types.js").StatusBarRect;
    /**
     * wx 存储 API（setStorage/getStorage/removeStorage/clearStorage/getStorageInfo）
     * 落地的适配器：parent（Application）持有 createContainer({ storageSync }) 已 resolve
     * 好的实例；未挂载 parent 时兜底走内置 window.localStorage，与 resolveStorageAdapter(true) 一致。
     */
    _getStorageAdapter(): StorageAdapter;
    /** Length-prefixed appId makes the (appId, key) mapping unambiguous. */
    _storageKey(key: string): string;
    _storageKeyPrefix(): string;
    _legacyStorageKey(key: string): string;
    _legacyStorageDisabledKey(): string;
    _serializeStorageValue(data: unknown): string;
    _serializeStorageTombstone(): string;
    _decodeStorageRecord(raw: string): StorageValueRecord;
    _decodeLegacyStorageValue(raw: string): unknown;
    _readStorageValue(storageAdapter: StorageAdapter, key: string): {
        found: boolean;
        data?: unknown;
    };
    /**
     * 唯一判据：这个 MiniApp 此刻是否真的呈现在展示栈最前面。后台实例上任何让 bridge
     * 变为可见、或把配色推给宿主 shell 的操作都必须先过这道闸。未挂载 parent（尚未接入
     * 任何 Application 展示栈，如独立单测）时不存在"被别的实例挤到后台"的可能，视为
     * 呈现在最前——fail-open，不是 fail-closed。
     */
    private isPresentedTop;
    /**
     * 地址栏同步是尽力而为的旁路通知：宿主的 urlSync 适配器抛错，不能冒充"这次
     * 导航/呈现本身失败了"，也不能中断已经完成的页面切换——因此统一收窄异常。
     */
    private safeSyncUrl;
    /**
     * 按名称调用 API：自定义注册 → 内置方法 → 第三方扩展路由。
     * callerBridge 为发起调用的页面 bridge，供 hideHomeButton 这类作用于
     * 「调用页自身」的 API 定位页面。
     */
    invokeApi(name: string, params?: Record<string, unknown>, callerBridge?: Bridge): void;
    _handleUnsupportedApi(name: string, params?: Record<string, unknown>): void;
    _prepareViewForLoad(): void;
    viewDidLoad(): void;
    /**
     * restartMiniProgram 的替换实例要把初始化结果作为事务提交点：
     * 新 Worker/Bridge 未真正就绪前保留旧 runtime，失败则由 Application 原位回滚。
     */
    viewDidLoadForReplacement(): Promise<void>;
    initApp(removeFailedViewOnError?: boolean, waitForInitialResources?: boolean): Promise<void>;
    /**
     * 静默恢复页面栈中根页之后的页面。
     * 这些页面的 bridge 会被初始化并推入 navigator 的主栈，但不播放入场动画，
     * 当前页显示在最顶层，之前的页面以 slide-out 状态保留在 DOM 中，
     * 使后退按钮可以正常工作。
     * @param {Array<{pagePath: string, query: object}>} pages
     */
    restorePageStack(pages: Array<{
        pagePath: string;
        query?: Record<string, string>;
    }>): Promise<void>;
    /**
     * 把当前主栈转成页面栈的最小形状（pagePath + query），供地址栏路由同步、
     * 刷新后恢复使用。纯派生，不产生副作用——是否/何时真正回写地址栏由 Application
     * 统一决定（只有当前栈顶实例的页面栈才应该出现在地址栏上）。
     * pagePath 统一去掉前导 /，与 app-config.json modules key 保持一致。
     */
    getPageStack(): PageStackEntry[];
    createBridge(opts: BridgeOptions & {
        jscore: JSCore;
    }): Promise<Bridge>;
    queueAppShowOptions(options: Record<string, unknown>): void;
    onPresentIn(): void;
    onPresentOut(): void;
    /**
     * 回收整个小程序的 Bridge 资源，排在调用方的 FIFO 回调 barrier 之前。这条链路只由退出
     * 小程序和整体换 runtime 走，不是路由，所以按 'exit' 静默回收，不派发 Page.onUnload——
     * 关掉整个小程序在微信里走的是切后台那条路。Bridge 销毁不摘 iframe DOM，退出动画照常播完。
     */
    queueDestructionLifecycle(): void;
    initPageFrame(): void;
    updateTargetPageColorStyle(mergeConfig: {
        navigationBarTextStyle: string;
    }): void;
    showLaunchScreen(): void;
    hideLaunchScreen(): void;
    updateActionColorStyle(color: string | null): void;
    restoreColorStyle(): void;
    createCallbackFunction(funcId?: CallbackId): ApiCallback | undefined;
    _createApiCallbacks({ success, fail, complete }?: ApiCallbackOptions): {
        onSuccess: ApiCallback | undefined;
        onFail: ApiCallback | undefined;
        onComplete: ApiCallback | undefined;
    };
    navigateTo(opts: NavigateOptions): Promise<void>;
    reLaunch(opts: NavigateOptions): void;
    applyUpdate(): void;
    redirectTo(opts: NavigateOptions): void;
    navigateBack(opts?: ApiCallbackOptions): Promise<void>;
    /**
     * 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面。
     * 参考鸿蒙 DMPNavigator.switchTab + DMPTabBarContainerView 的“按需创建 + 持久缓存”模型：
     *   1. 弹出并销毁所有非 tab 页面
     *   2. 隐藏旧 tab 的 iframe（保留在 pool 中）
     *   3. 目标 tab 已在 pool → 复用；否则懒加载新建并入池
     *   4. 切换生命周期：旧 pageHide / 新 pageShow
     *   5. 更新 TabBar 选中态、状态栏颜色、URL hash
     */
    switchTab(opts: NavigateOptions): Promise<void>;
    /**
     * 解析并缓存 tabBar 配置；首次渲染 TabBar DOM（默认隐藏）。
     * 后续切换仅通过 _setTabBarVisible / _updateTabBarSelection 调整，不重渲染。
     */
    _initTabBar(): void;
    /**
     * 一次性渲染 TabBar DOM，使用事件委托处理点击。
     */
    _renderTabBar(): void;
    /**
     * 创建一张 tabBar 图标 <img>，带加载失败兜底（隐藏，避免破图占位）。
     */
    _createTabBarIcon(src: string, modifierClass: string): HTMLImageElement;
    /**
     * 简单 CSS 颜色白名单：#hex / rgb(a)/hsl(a)/常见关键字。
     * 拒绝包含尖括号、引号、分号、url() 等可能逃逸 style 上下文的字符；
     * 不命中白名单时返回空串，让调用方走默认色。
     */
    _sanitizeCssColor(value?: string | null): string;
    _getTabBarBorderColor(borderStyle?: string): string;
    /**
     * 获取 TabBar 实际高度。隐藏状态下临时不可见测量一次，避免首次 switchTab
     * 到 tab 页时缺少底部留白。
     */
    _getTabBarHeight(): number;
    /**
     * 把 TabBar 当前实际高度同步到 CSS 变量和 tab 页 webview。
     * webviews 容器保持全屏，只有 tab 页自身预留底部空间；这样隐藏
     * tabbar 跳转到非 tab 页时，不会触发所有页面整体重排。
     */
    _syncTabBarHeightVar(): void;
    _setBridgeTabBarInset(bridge: Bridge | undefined | null, enabled: boolean): void;
    _syncTabBarBridgeInsets(): void;
    _joinBaseUrl(...segments: unknown[]): string;
    /**
     * 解析 tabBar 图标路径。
     * 编译期 collectAssets 会输出 appId/main/static/...，本地源路径则按小程序
     * 根目录兜底到 appId/main/...，两类路径都统一挂到 resourceBaseUrl 下。
     */
    _resolveTabBarIcon(iconPath?: string | null): string | null;
    /**
     * 控制 TabBar 容器的显示/隐藏。底部留白只作用在 tab 页 webview 上，
     * 避免非 tab 跳转过程中改变 webviews 容器高度。
     */
    _setTabBarVisible(visible: boolean): void;
    /**
     * 仅更新 TabBar 选中态（颜色 / 图标 / class），不重渲染。
     */
    _updateTabBarSelection(currentPath: string | null): void;
    _getTabBarItemEl(index: number): HTMLElement | null;
    _validateTabBarIndex(apiName: string, index: number | string | undefined, onFail: ApiCallback | undefined, onComplete: ApiCallback | undefined): boolean;
    _replaceTabBarItemIcons(itemEl: HTMLElement, item: TabBarItemConfig): void;
    /**
     * wx.setTabBarStyle：原地更新 tabBarConfig 与已渲染 DOM，不重建 tabbar，
     * 保留事件绑定 / 图标 / 选中态。
     * https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarStyle.html
     */
    setTabBarStyle(opts?: SetTabBarStyleOptions): void;
    setTabBarItem(opts?: SetTabBarItemOptions): void;
    showTabBar(opts?: ApiCallbackOptions): void;
    hideTabBar(opts?: ApiCallbackOptions): void;
    setTabBarBadge(opts?: TabBarBadgeOptions): void;
    removeTabBarBadge(opts?: TabBarIndexOptions): void;
    showTabBarRedDot(opts?: TabBarIndexOptions): void;
    hideTabBarRedDot(opts?: TabBarIndexOptions): void;
    navigateToMiniProgram(opts?: NavigateToMiniProgramOptions): Promise<void>;
    navigateBackMiniProgram(opts?: NavigateBackMiniProgramOptions): Promise<void>;
    exitMiniProgram(opts?: ApiCallbackOptions): Promise<void>;
    restartMiniProgram(opts?: RestartMiniProgramOptions): Promise<void>;
    bindMoreEvent(): void;
    bindCloseEvent(): void;
    destroy(): void;
    connectSocket(opts?: ApiParams): void;
    sendSocketMessage(opts?: ApiParams): void;
    closeSocket(opts?: ApiParams): void;
    onSocketOpen(opts?: ApiParams): void;
    onSocketMessage(opts?: ApiParams): void;
    onSocketError(opts?: ApiParams): void;
    onSocketClose(opts?: ApiParams): void;
    offSocketOpen(opts?: ApiParams): void;
    offSocketMessage(opts?: ApiParams): void;
    offSocketError(opts?: ApiParams): void;
    offSocketClose(opts?: ApiParams): void;
    private onSocketEvent;
    private offSocketEvent;
    /**
     * 获取网络类型
     * https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.getNetworkType.html
     */
    getNetworkType(opts: ApiCallbackOptions): void;
    onNetworkStatusChange(opts: ApiCallbackOptions & {
        callbackId?: CallbackId;
    }): void;
    offNetworkStatusChange(opts?: {
        callbackId?: CallbackId;
    }): void;
    private _networkConnection;
    private _currentNetworkType;
    getSystemInfoAsync(opts: ApiCallbackOptions): void;
    getSystemInfo(opts?: ApiCallbackOptions): void;
    onWindowResize(opts?: {
        success?: CallbackId;
    }): void;
    getMenuButtonBoundingClientRect(): {
        top: number;
        right: number;
        bottom: number;
        left: number;
        width: number;
        height: number;
        x: number;
        y: number;
    };
    getHostEnvSnapshot(): {
        menuRect: {
            top: number;
            right: number;
            bottom: number;
            left: number;
            width: number;
            height: number;
            x: number;
            y: number;
        };
        systemInfo: {
            brand: string;
            model: string;
            platform: string;
            system: string;
            SDKVersion: string;
            pixelRatio: number;
            screenWidth: number;
            screenHeight: number;
            windowWidth: number;
            windowHeight: number;
            statusBarHeight: number;
            safeArea: {
                left: number;
                right: number;
                top: number;
                bottom: number;
                width: number;
                height: number;
            };
            enableDebug: boolean;
            host: {
                appId: string;
            };
            language: string;
            version: string;
            theme: string;
            fontSizeScaleFactor: number;
            fontSizeSetting: number;
            deviceOrientation: "portrait";
        };
    };
    _bindThemeChange(): void;
    getSystemInfoSync(): {
        brand: string;
        model: string;
        platform: string;
        system: string;
        SDKVersion: string;
        pixelRatio: number;
        screenWidth: number;
        screenHeight: number;
        windowWidth: number;
        windowHeight: number;
        statusBarHeight: number;
        safeArea: {
            left: number;
            right: number;
            top: number;
            bottom: number;
            width: number;
            height: number;
        };
        enableDebug: boolean;
        host: {
            appId: string;
        };
        language: string;
        version: string;
        theme: string;
        fontSizeScaleFactor: number;
        fontSizeSetting: number;
        deviceOrientation: "portrait";
    };
    showToast(opts?: ShowToastOptions): void;
    hideToast(opts?: ApiCallbackOptions): void;
    showLoading(opts?: Omit<ShowToastOptions, 'icon'>): void;
    hideLoading(opts?: ApiCallbackOptions): void;
    /** 把当前顶层页面 iframe 的 touchmove 吞掉：modal 打开期间不让底层页面跟手滚动/手势穿透。 */
    _lockModalPageTouch(): void;
    _unlockModalPageTouch(): void;
    showModal(opts: ShowModalOptions): void;
    /** 仅栈顶 modal 可见，其余隐藏；任何 push/pop 之后都该调一次。 */
    _updateModalView(): void;
    _mountModal(opts: ShowModalOptions): ModalEntry;
    showActionSheet(opts: ShowActionSheetOptions): void;
    setNavigationBarTitle(opts: SetNavigationBarTitleOptions): void;
    setNavigationBarColor(opts: SetNavigationBarColorOptions): void;
    /**
     * 页面滚动到指定位置
     */
    pageScrollTo(opts: PageScrollToOptions): void;
    /**
     * 设置剪贴板数据
     */
    setClipboardData(opts: SetClipboardDataOptions): void;
    /**
     * 获取剪贴板数据
     */
    getClipboardData(opts: ApiCallbackOptions): void;
    chooseVideo(opts?: ApiCallbackOptions & {
        sourceType?: string[];
        camera?: 'front' | 'back';
        maxDuration?: number;
    }): void;
    getImageInfo(opts: ApiCallbackOptions & {
        src?: string;
    }): void;
    getVideoInfo(opts: ApiCallbackOptions & {
        src?: string;
    }): void;
    previewMedia(opts: ApiCallbackOptions & {
        sources?: Array<{
            url?: string;
            type?: 'image' | 'video';
            poster?: string;
        }>;
        current?: number;
    }): void;
    setKeepScreenOn(opts: ApiCallbackOptions & {
        keepScreenOn?: boolean;
    }): void;
    private _installWakeLockVisibilityHandler;
    private _requestWakeLock;
    private _releaseWakeLock;
    getSetting(opts?: ApiCallbackOptions): Promise<void>;
    authorize(opts: ApiCallbackOptions & {
        scope?: string;
    }): void;
    private _resolveMediaUrl;
    private _resolveMediaObjectUrl;
    /**
     * Persist a temporary Web resource in this mini program's private file area.
     * The quoted method name lets invokeApi dispatch the FileSystemManager bridge name directly.
     */
    'FileSystemManager.saveFile'(opts?: SaveFileOptions): void;
    setStorage(opts: SetStorageOptions): void;
    getStorage(opts: StorageKeyOptions): void;
    removeStorage(opts: StorageKeyOptions): void;
    clearStorage(opts?: ApiCallbackOptions): void;
    getStorageInfo(opts?: ApiCallbackOptions): void;
    /**
     * 从 `${module}_${event}` 格式的 key 中还原 module 与 event。
     * 用已注册模块名做前缀匹配，支持模块名本身含下划线；失败时均为 null。
     */
    _parseExtEventKey(eventKey: string): {
        module: string | null;
        event: string | null;
    };
    /**
     * 第三方扩展调用的统一入口
     *
     * service 侧 extBridge/extOnBridge/extOffBridge 的 invokeAPI 名称规则：
     *   extBridge   → name = event,              params = { module, data, success, fail, complete }
     *   extOnBridge → name = `${module}_${event}`, params = { success(callBack), evtId }
     *   extOffBridge→ name = `${module}_${event}`, params = { success(undefined), evtId }
     *
     * 区分方式：
     *   - extBridge：params 中携带 module 字段
     *   - extOnBridge vs extOffBridge：success 有值 → on；否则 → off
     */
    _handleExtCall(name: string, params?: ExtCallParams): void;
    /**
     * 对应 service 侧 extBridge：
     * invokeAPI(event, { module, data, success, fail, complete, keep })
     * → container: name=event, params={ module, data, success, fail, complete }
     */
    _extBridgeCall(event: string, params: ExtCallParams): void;
    /**
     * 对应 service 侧 extOnBridge：
     * invokeAPI(`${module}_${event}`, { evtId, keep:true, success:callBack })
     * → container: name=`${module}_${event}`, params={ success, evtId }
     */
    _extOnBridgeCall(eventKey: string, params: ExtCallParams): void;
    /**
     * 对应 service 侧 extOffBridge：
     * invokeAPI(`${module}_${event}`, { success:undefined })
     * → container: name=`${module}_${event}`, params={ success:undefined }
     */
    _extOffBridgeCall(eventKey: string): void;
}
export {};
