import type { GetAppInfo, ResolvedShell, ShellAdapter, StorageAdapter, UrlSyncAdapter } from './types.js';
export declare const DEFAULT_VIRTUAL_FILE_PREFIX = "difile://";
/**
 * Normalize the host-selected virtual file scheme once per container instance.
 * Keeping this value on Application avoids one container changing another through
 * a process-wide global. The global remains a backwards-compatible fallback.
 */
export declare function resolveVirtualFilePrefix(virtualFilePrefix?: string): string;
/**
 * 归一化 shell 适配器：按字段单独兜底。宿主方法可能依赖自身实例状态，
 * 必须 bind 回原对象，不能拷裸函数引用。
 */
export declare function resolveShell(shell?: ShellAdapter): ResolvedShell;
/**
 * 归一化为带结尾斜杠的绝对 URL（相对路径按 window.location.origin 解析），
 * 供下游直接拼接；畸形输入在此同步抛错，不往下游传。
 */
export declare function resolveResourceBaseUrl(resourceBaseUrl: string | undefined, allowedOrigins?: readonly string[]): string;
/**
 * 渲染层 iframe 的 URL，缺省基于已归一化的 resourceBaseUrl 解析出 pageFrame.html。
 * 显式传入的跨域 pageFrameUrl 需单独命中 allowedOrigins。
 */
export declare function resolvePageFrameUrl(pageFrameUrl: string | undefined, resourceBaseUrl: string, allowedOrigins?: readonly string[]): string;
export declare function resolveApiNamespaces(apiNamespaces?: string[]): string[];
export declare function resolveGetAppInfo(getAppInfo?: GetAppInfo): GetAppInfo;
/**
 * urlSync 缺省 true → 内置 QueryRouter（history.replaceState 改写地址栏 query）；
 * false → 完全关闭；自定义适配器原样透传，由宿主自行接管同步逻辑（含是否提供
 * buildShareUrl——不提供时"复制链接"功能在 MiniApp 侧隐藏）。
 * instanceKey 只用于内置 QueryRouter 分支的 query key 命名空间化，对自定义适配器
 * 无约束力（由宿主自行决定是否/如何使用）。
 */
export declare function resolveUrlSync(urlSync?: boolean | UrlSyncAdapter, instanceKey?: string): UrlSyncAdapter;
/**
 * storageSync 缺省 true → 包装内置 window.localStorage（向后兼容）；
 * false → 每次调用即抛错的适配器；自定义适配器原样透传，由宿主自行接管存储逻辑。
 */
export declare function resolveStorageAdapter(storageSync?: boolean | StorageAdapter): StorageAdapter;
