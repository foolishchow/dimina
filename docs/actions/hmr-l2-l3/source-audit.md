# Source Audit — hmr-l2-l3

审计日期：2026-09-08。范围限定为 Web 容器 dev-only HMR，不推断原生容器能力。

## render 数据流

- `fe/packages/render/src/core/runtime.js:632`：`setupData` 为 `Map`，按 `pageId` 保存页面响应式数据。
- `runtime.js:730-750`：`firstRender` 在已有 app 时调用 `this.app.unmount()`，随后 `createApp(options.app)`、注册模板组件并 mount `document.body`；现状是整 app remount。
- `runtime.js:956-976`：`applyInitialData` 将 initial data 写入页面 data，并回放 `preInitUpdates`。
- `runtime.js:1400-1438`：`updateModule` 将 `u/ub` 消息中的完整 data 或 changes 路径写入 `setupData`，随后触发页面重渲染。
- `runtime.js:1408-1412`：未初始化 module 的更新暂存于 `preInitUpdates`。

## view module loader

- `fe/packages/render/src/core/loader.js:9-45`：`loadResource` 并行加载 CSS 与 view script，随后 `window.modRequire(pagePath)`。
- `loader.js:111-131`：`createModule` 对已有 `staticModules[path]` 直接 return；当前没有 replace API。
- `loader.js:152-154`：`getModuleByPath` 只返回缓存 module。

## CSS

- `loader.js:16-24`：页面 CSS URL 与 view script 一起加载。
- `loader.js:77-91`：CSS 通过动态 `<link rel="stylesheet">` 添加到 document head，当前没有 dev-only 替换/失效机制。

## Container boundary

- `fe/packages/container-sdk/package.json` 描述为「Web 端小程序容器运行时 SDK」。
- RFC §4.1 已定稿：编译/编排容器无关；预览宿主与 HMR 生效端 Web 容器专属。
- RFC §1.2 明确允许在 `fe/packages/render` + `fe/packages/container-sdk` 增加 dev-only L2/L3 能力，同时不改变四端原生容器行为。

## Existing protocol

- A2 RFC §4.5 冻结 ws reload 载荷与 `reloadLevel`；A3 只消费，不修改消息形状、buildId 或 dev server 合成逻辑。
- L3 假设 1 已条件通过：setupData 作为快照源可行；module replacement 与页面级 remount 是待验证新增能力。

## Audit conclusion

L2 的 CSS 替换具备清晰的 `<link>` 资源切换落点；L3 的数据快照具备现成 render-side 状态源，但 module cache replacement 和 page-scoped remount 均不存在，必须先以原型验证事务边界和生命周期清理。任何原型失败都应落到 A2 L1，而不是修改原生容器或 service 协议。
