import type { Bridge } from '../../core/bridge.js';
import type { PageStackEntry } from '../../types.js';
/**
 * MiniApp 页面栈 / tab 池记账的唯一权威：谁在栈里、顺序如何、哪个 tab 路径
 * 对应哪个常驻 bridge，全部收在这一个对象里，不再由 MiniApp 的各个导航方法
 * 各自直接操作数组/Map。栈顶 = 当前可见页，与 Bridge 是否已挂载/是否播放
 * 动画无关——Navigator 只管身份和顺序，不碰 DOM/动画/生命周期。
 */
export declare class Navigator {
    private stack;
    private tabPool;
    private _activeTabPath;
    get top(): Bridge | undefined;
    get size(): number;
    getStack(): Bridge[];
    pushPage(bridge: Bridge): void;
    popPage(): Bridge | undefined;
    /** 按引用从栈中任意位置摘除（不一定是栈顶），保留其余元素相对顺序。 */
    removeFromStack(bridge: Bridge): boolean;
    /** 整体重置（对齐 reLaunch 语义）：清空栈、tab 池与当前 tab，只留新入口页。 */
    resetTo(bridge: Bridge): void;
    /** 整体清空：栈、tab 池与当前 tab 全部清空，不留任何替代页——供失败路径收敛成诚实空栈使用。 */
    clear(): void;
    getTabBridge(pagePath: string): Bridge | undefined;
    setTabBridge(pagePath: string, bridge: Bridge): void;
    deleteTabBridge(pagePath: string): void;
    /** 枚举 tab 池当前持有的全部 bridge，不含主栈。 */
    getTabBridges(): Bridge[];
    get activeTabPath(): string | null;
    setActiveTabPath(path: string | null): void;
    /**
     * 纯派生：把当前主栈（不含 tab 池）映射成页面栈最小形状，供地址栏路由同步、
     * 刷新后恢复使用。pagePath 统一去掉前导 /，与 app-config.json modules key 保持一致。
     */
    getPageStack(): PageStackEntry[];
}
