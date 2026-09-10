import type { MiniApp } from '../miniApp/miniApp.js';
import type { ContainerView, GetAppInfo, OnAppLaunchError, ResolvedShell, ShellAdapter, StorageAdapter, UrlSyncAdapter } from '../../types.js';
import { AppManager } from '../../core/appManager.js';
import './application.scss';
export interface ApplicationOptions {
    /** 宿主 shell 适配器（状态栏几何/颜色），缺省安全降级 */
    shell?: ShellAdapter;
    /** 小程序资源基路径，缺省 '/' */
    resourceBaseUrl?: string;
    /** 渲染层 iframe URL，缺省基于 resourceBaseUrl 拼接 */
    pageFrameUrl?: string;
    /** 小程序虚拟文件协议前缀，缺省 `difile://` */
    virtualFilePrefix?: string;
    /** resourceBaseUrl/pageFrameUrl 最终解析出的 origin 白名单；不传则不限制来源 */
    allowedOrigins?: readonly string[];
    /** 额外 API 命名空间，缺省空数组 */
    apiNamespaces?: string[];
    /** 地址栏路由同步；缺省 true 沿用内置 QueryRouter，传 false 关闭，传适配器接管 */
    urlSync?: boolean | UrlSyncAdapter;
    /** 多容器场景下给内置 QueryRouter 的地址栏 query key 命名空间化的稳定身份 key；不传行为不变 */
    instanceKey?: string;
    /** wx 存储 API 落地位置；缺省 true 沿用内置 window.localStorage，传 false 关闭，传适配器接管 */
    storageSync?: boolean | StorageAdapter;
    /** 小程序元信息提供者，缺省返回 {} */
    getAppInfo?: GetAppInfo;
    /** 小程序启动失败通知；缺省不通知（仅内部 console.error） */
    onAppLaunchError?: OnAppLaunchError;
    /** 该容器私有的应用管理器；缺省新建一个（自带隔离，不共享任何模块级状态） */
    appManager?: AppManager;
}
export interface DismissViewOptions {
    /** 关闭时是否销毁小程序容器 */
    destroy?: boolean;
}
export declare class Application {
    el: HTMLElement;
    window: HTMLElement;
    root: ContainerView | null;
    views: MiniApp[];
    rootView: ContainerView | null;
    /** 目前始终为 null：Application 是容器视图树的根，没有更上层的宿主对象需要回指。 */
    parent: unknown;
    done: boolean;
    isSleeping: boolean;
    _queue: Promise<void>;
    shell: ResolvedShell;
    resourceBaseUrl: string;
    pageFrameUrl: string;
    virtualFilePrefix: string;
    /** resourceBaseUrl/pageFrameUrl 的 origin 白名单；openApp() 逐 app 覆盖 resourceBaseUrl 时复用同一份校验。 */
    allowedOrigins?: readonly string[];
    apiNamespaces: string[];
    urlSync: UrlSyncAdapter;
    storageAdapter: StorageAdapter;
    getAppInfo: GetAppInfo;
    /** 小程序启动失败通知（可选）；MiniApp 经 this.parent 访问并在 initApp 失败时调用。 */
    onAppLaunchError?: OnAppLaunchError;
    appManager: AppManager;
    constructor(opts?: ApplicationOptions);
    _enqueue(fn: () => Promise<void>): Promise<void>;
    /**
     * 地址栏路由同步的唯一权威调用点：只读当前展示栈栈顶实例的页面栈来回写地址栏，
     * 栈空则清空。MiniApp 自身导航、Application 呈现/摘除展示栈都改为调用这里
     * （而不是各自直接碰 urlSync），保证地址栏任何时刻都精确反映"当前可见的是谁"，
     * 不会被非栈顶实例的内部状态变化覆盖。
     */
    syncUrl(): void;
    /**
     * 地址栏同步是尽力而为的旁路通知：宿主的 urlSync 适配器抛错，不能冒充"这次
     * 呈现/摘除本身失败了"，也不能中断已经完成的转场——因此统一收窄异常。
     */
    private safeSyncUrl;
    /**
     * 配色恢复同理：宿主 shell.updateStatusBarColor 抛错不能挡住呈现流程的
     * 其余提交工作，与 `safeSyncUrl()` 对 urlSync 适配器的处理保持同一契约——
     * 完全吸收，不向调用方传播。
     */
    private safeRestoreColorStyle;
    init(): void;
    initRootView(view: ContainerView): void;
    presentView(view: MiniApp, useCache: boolean): Promise<void>;
    _presentView(view: MiniApp, useCache: boolean): Promise<void>;
    dismissView(view: MiniApp, opts?: DismissViewOptions): Promise<void>;
    /**
     * 冷重启时原位替换栈顶小程序：底下的 opener 始终保持隐藏，避免先 dismiss
     * 再 present 造成一次假的 onShow/onHide。新实例会重新创建 Worker/Bridge/页面栈。
     */
    replaceView(currentView: MiniApp, replacement: MiniApp, beforeCommit?: () => void | Promise<void>): Promise<void>;
    _dismissView(view: MiniApp, opts?: DismissViewOptions): Promise<void>;
    destroyRootView(view: MiniApp): Promise<void>;
    /**
     * 启动失败（MiniApp.initApp() 中途 reject）时的专用摘除：这个实例从未真正呈现
     * 成功过，没有退出动画可播，直接按引用从展示栈里摘掉并清理 DOM。经同一条
     * _enqueue 队列串行化，保证不会跟正在进行的 presentView/dismissView 并发碰撞
     * this.views/DOM。
     */
    removeFailedView(view: MiniApp): Promise<void>;
    getActiveView(): MiniApp | ContainerView | null;
    sleepActiveView(): void;
    wakeActiveView(): void;
    updateStatusBarColor(color: string): void;
}
