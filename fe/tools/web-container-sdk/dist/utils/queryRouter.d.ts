import type { PageStackEntry } from '../types.js';
/**
 * 管理容器 URL 路由，记录入口页与当前页以支持刷新后恢复。
 *
 * 当前格式：?appId={appId}&entry={rootPagePath}&page={currentPagePath}
 * 兼容旧格式：#{appId}|{page1Path}|{page2Path}?{query}|...
 */
export declare class QueryRouter {
    static ROUTE_QUERY_KEYS: string[];
    /**
     * 多容器场景下按 instanceKey 命名空间化基础 query key，如 'appId' + 'hostA' ->
     * 'appId__hostA'。不传 instanceKey 时原样返回基础 key，保证省略参数的调用方
     * 逐字节沿用命名空间化之前的行为。
     */
    static _namespacedKey(baseKey: string, instanceKey?: string): string;
    /**
     * 将单个页面（pagePath + query 对象）序列化为栈中的一项
     */
    static _encodePage(pagePath: string, query: Record<string, string>): string;
    /**
     * 将栈中的一项反序列化为 { pagePath, query }
     */
    static _decodePage(item: string): PageStackEntry;
    /**
     * URLSearchParams 会将路径中的 / 编码为 %2F，这里保留路径可读性。
     */
    static _encodeSearchValue(value: string): string;
    static _normalizeSearch(search?: string | null): string;
    static _stringifySearchParams(params: URLSearchParams): string;
    /**
     * 构建新的 query 路由，保留非路由 query 参数。instanceKey 存在时只清理/写入
     * 该 instanceKey 命名空间下的 key，不触碰其它命名空间（含无命名空间的默认）的 key。
     */
    static buildRouteSearch(appId: string | null | undefined, stack: PageStackEntry[] | null | undefined, currentSearch?: string, instanceKey?: string): string;
    static buildRouteURL(appId: string | null | undefined, stack: PageStackEntry[] | null | undefined, baseURL?: string, instanceKey?: string): string;
    /**
     * 同步入口页与当前页到 query 路由。
     */
    static syncStack(appId: string, stack: PageStackEntry[], instanceKey?: string): void;
    /**
     * 清空地址栏路由 key。instanceKey 存在时只删除该 instanceKey 自己命名空间下的
     * key，绝不触碰其它容器（不同 instanceKey，或无 instanceKey 的默认）的 key——
     * 这是多容器场景下 clear() 不再互相误伤对方路由的关键。
     */
    static clear(instanceKey?: string): void;
    /**
     * 解析 query 路由，返回 { appId, stack } 或 null。instanceKey 存在时只读该
     * instanceKey 命名空间下的 key。
     */
    static parseSearch(search: string, instanceKey?: string): {
        appId: string;
        stack: PageStackEntry[];
    } | null;
    /**
     * 解析旧 hash，返回 { appId, stack } 或 null
     * stack 为 Array<{pagePath, query}>，index 0 为根页面
     */
    static parseHash(hash: string | null | undefined): {
        appId: string;
        stack: PageStackEntry[];
    } | null;
    /**
     * 优先解析 query 路由，并兼容旧 hash 路由。instanceKey 只影响 query 路由解析；
     * 旧 hash 格式没有 instanceKey 概念，命中该分支时忽略 instanceKey。
     */
    static parse(hash: string | null | undefined, search?: string, instanceKey?: string): {
        appId: string;
        stack: PageStackEntry[];
    } | null;
}
