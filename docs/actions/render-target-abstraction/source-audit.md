# Source Audit — render-target-abstraction

审计日期：2026-09-08。

## Compiler stages

- `fe/packages/compiler/src/index.js` 当前以 view/logic/style 三个 worker 阶段编排；A4 只需在 view/style 边界引入 target resolver。
- view 编译实现位于 `src/core/view-compiler.js`，style 编译位于 `src/core/style-compiler.js`；logic 独立，不应受 target 影响。
- 当前没有通用 target resolver 或 target adapter 注册表。

## Product contract

- RFC D6 锁定 modDefine、模块 ID、输出目录、app-config 与 compatibility warning；A4 必须以默认 webview 与显式 webview 产物 diff 验证。
- A1 lifecycle 与 A2 dev/HMR 已完成并归档；A4 不应修改 dev server/ws/HMR 消息形状。

## Runtime boundary

- Architecture-Diagram §5：Web、Android、iOS、Harmony 共享 service/render 核心语义，但容器与资源加载不同。
- RFC §4.1 已定稿：当前 dev/HMR 生效端是 Web 容器；A4 的 target seam 服务未来 adapter，不把 A3 Web HMR 扩展到原生端。

## Non-goals verified

- RFC D3 明确 rspack 至多存在 Lynx adapter 内部；A4 不实现 Lynx/C1。
- A4 不以性能为目标，不做 Rust host 或 compiler bundler 重构。

## Audit conclusion

事实支持一个窄范围 Action：在 view/style 编译边界增加 `webview` adapter 与 resolver，默认及显式路径必须保持产品契约不变；第二个 target 和运行时 target 分叉留待后续独立 RFC/Action。
