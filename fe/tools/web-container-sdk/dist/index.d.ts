import type { ContainerInstance, CreateContainerOptions } from './types.js';
import { QueryRouter } from './utils/queryRouter.js';
export { QueryRouter };
export type { RetentionPolicy } from './core/retention.js';
export { createDefaultShell } from './defaultShell.js';
export type { DefaultShell, DefaultShellOptions } from './defaultShell.js';
/**
 * 创建一个小程序容器运行时实例。
 * 配置与返回值契约见 {@link CreateContainerOptions} / {@link ContainerInstance}。
 */
export declare function createContainer(options?: CreateContainerOptions | Record<string, never>): ContainerInstance;
export type { AppInfoMeta, BridgeMessage, ContainerInstance, ContainerView, CreateContainerOptions, ExtModuleHandler, GetAppInfo, MiniAppApiHandler, OpenAppOptions, PageStackEntry, ResolvedShell, ShellAdapter, StatusBarRect, StorageAdapter, UrlSyncAdapter, } from './types.js';
