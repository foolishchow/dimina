/**
 * view parse+walk：预 walk 组件树（toCompileTemplate only）→ 收集全部 wxs → 一次编译 → EmitModule[]
 * 编排接管原 buildCompileView 的 activePaths / inheritedTemplatePaths / MC1 error caching。
 *
 * 实现阶段：viewParseWalk / compileViewTree / compileModule / helpers 留在 index.ts
 * （避免循环依赖），本文件 re-export 供外部消费者按 parse+walk 语义调用。
 */
export { viewParseWalk } from './index.ts'
