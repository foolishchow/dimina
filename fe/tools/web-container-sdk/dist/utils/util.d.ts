export declare function uuid(): string;
export declare function sleep(time: number): Promise<void>;
export declare function waitForTransitionEnd(element: Element): Promise<void>;
export interface QueryPathResult {
    pagePath: string;
    query: Record<string, string>;
}
export declare function queryPath(path: string): QueryPathResult;
export declare function closest(node: Node | null, className: string): Element | null;
export declare function readFile(filePath: string): Promise<string | null>;
/** 页面配置合并结果：小程序页面私有配置覆盖 app.window 全局配置后的最终形态。 */
export interface MergedPageConfig {
    navigationBarTitleText: string;
    navigationBarBackgroundColor: string;
    navigationBarTextStyle: string;
    backgroundColor: string;
    navigationStyle: string;
    homeButton: boolean;
    usingComponents: Record<string, unknown>;
}
export interface AppWindowConfig {
    navigationBarTitleText?: string;
    navigationBarBackgroundColor?: string;
    navigationBarTextStyle?: string;
    backgroundColor?: string;
    navigationStyle?: string;
    homeButton?: boolean;
}
export interface PageConfig extends AppWindowConfig {
    usingComponents?: Record<string, unknown>;
    root?: string;
}
export declare function mergePageConfig(appConfig: {
    window?: AppWindowConfig;
}, pageConfig?: PageConfig | null): MergedPageConfig;
