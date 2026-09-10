import type { StatusBarRect } from './types.js';
import './defaultShell.scss';
export interface DefaultShellOptions {
    /** 提供则自动把状态栏元素 prepend 到该元素内；不传则宿主自行插入 el */
    mount?: HTMLElement;
    /** 状态栏高度 px，默认 44 */
    height?: number;
    /** 是否显示当前时间（HH:MM），默认 true */
    showTime?: boolean;
}
export interface DefaultShell {
    /** 状态栏根元素 */
    el: HTMLElement;
    getStatusBarRect: () => StatusBarRect;
    updateStatusBarColor: (color: string) => void;
    /** 从 DOM 移除 el 并停止内部计时器；幂等 */
    destroy: () => void;
}
/**
 * SDK 自带的默认宿主壳：极简无品牌状态栏（时间 + 深浅色联动）的 ShellAdapter 实现。
 * 闭包实现，方法不依赖 this，解构成裸函数引用传递也安全。
 */
export declare function createDefaultShell(options?: DefaultShellOptions): DefaultShell;
