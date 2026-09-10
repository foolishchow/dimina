import type { Application } from '../pages/application/application.js';
import type { ExtModuleHandler, MiniAppApiHandler, MiniProgramReferrerInfo, OpenAppOptions } from '../types.js';
import { RetentionManager, type RetentionPolicy } from './retention.js';
import { MiniApp } from '../pages/miniApp/miniApp.js';
export interface NavigateToMiniProgramRequest {
    appId?: string;
    path?: string;
    extraData?: unknown;
    envVersion?: 'develop' | 'trial' | 'release';
    noRelaunchIfPathUnchanged?: boolean;
    shortLink?: string;
}
interface InternalOpenAppOptions extends OpenAppOptions {
    allowDefaultPath?: boolean;
    referrerInfo?: MiniProgramReferrerInfo;
    opener?: MiniApp | null;
}
type BeforeDestructiveCommit = () => void | Promise<void>;
/**
 * 单个 createContainer() 实例私有的应用管理器：应用登记表与扩展模块表不跨容器共享。
 * 不能做成模块级单例——同一页面可能并存多个容器实例。
 */
export declare class AppManager {
    /**
     * 已打开小程序实例的权威登记表，按 appId 键控、无序——谁当前可见由
     * Application.views（呈现顺序栈）唯一决定，这里的 Map 插入顺序不代表
     * 任何呈现语义，只用于 getAppById 缓存复用和批量操作（registerApi 广播、
     * destroy:true 时筛选要销毁的旧实例）。
     */
    apps: Map<string, MiniApp>;
    _extModules: Record<string, ExtModuleHandler>;
    _containerApis: Record<string, MiniAppApiHandler>;
    _openQueue: Promise<unknown>;
    private application?;
    private retentionQueued;
    readonly retention: RetentionManager<MiniApp>;
    configureRetention(policy: RetentionPolicy, application: Application): void;
    private scheduleRetention;
    constructor();
    registerExtModule(moduleName: string, handler: ExtModuleHandler): void;
    /**
     * 容器级注册/覆盖 API（对齐 Native 侧 Android MiniApp.registerApi / iOS
     * pending 注入模式）：立即写入所有已打开实例的注册表，并记入容器级表
     * 供之后新建的实例在 worker 启动前注入——只有此时注入的名字才能进
     * registeredApis 被 Object.keys(wx) 枚举。
     */
    registerApi(name: string, handler: MiniAppApiHandler): void;
    getExtModule(moduleName: string): ExtModuleHandler | undefined;
    getExtModules(): Record<string, ExtModuleHandler>;
    /** 打开/前置小程序，经 _openQueue 串行排队执行。 */
    openApp(opts: OpenAppOptions, dimina: Application): Promise<MiniApp>;
    _enqueue<T>(operation: () => Promise<T>): Promise<T>;
    _openApp(opts: InternalOpenAppOptions, dimina: Application): Promise<MiniApp>;
    _navigateContext(source: MiniApp): Application;
    _referrerInfo(source: MiniApp, extraData: unknown): MiniProgramReferrerInfo;
    _sameQuery(left: Record<string, string>, right: Record<string, string>): boolean;
    _validateExtraData(api: string, extraData: unknown): void;
    /** 打开另一个小程序；默认重建目标运行时，显式 noRelaunch 时才复用同路径实例。 */
    navigateToMiniProgram(opts: NavigateToMiniProgramRequest, source: MiniApp): Promise<MiniApp>;
    navigateBackMiniProgram(source: MiniApp, extraData: unknown, beforeCommit: BeforeDestructiveCommit): Promise<void>;
    exitMiniProgram(source: MiniApp, beforeCommit: BeforeDestructiveCommit): Promise<void>;
    restartMiniProgram(source: MiniApp, path: string, beforeCommit: BeforeDestructiveCommit): Promise<MiniApp>;
    getAppById(appId: string): MiniApp | null;
    /**
     * 按对象引用而不是单纯按 appId 移除：只有当前登记的仍是这一个实例
     * 才删除，防止迟到的 destroy() 误删同 appId 下更新的实例
     * （MiniApp.destroy() 的触发时机与该实例是否仍是当前登记项无关）。
     */
    removeApp(miniApp: MiniApp): void;
    closeApp(miniApp: MiniApp): void;
}
export {};
