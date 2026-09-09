# Technical Design — render-target-abstraction

## 1. Boundary

```text
build options / CLI: target = 'webview' (default)
              │
              ▼
       target resolver
              │
       ┌──────┴──────┐
       ▼             ▼
 view adapter     style adapter
   webview          webview
       │             │
       └──────┬──────┘
              ▼
 existing modDefine/output/publish contract (unchanged)

logic/service/bridge/runtime/HMR protocol: target-neutral
future Lynx adapter: reserved only, outside A4
```

## 2. Target contract

**参数来源（F-A4-001 修订，方案 A：对齐微信 `renderer`）**：target 由**项目声明优先、显式覆盖其次**确定。

1. 若 `options.target` / CLI `--target` 显式提供，以显式值为准；
2. 否则读取项目声明 `app.json.renderer`（对齐微信 app.json `renderer` 字段语义）；
3. 两者皆缺省时使用 `webview`。

- `readAppRenderer(workPath)` 在 build 入口、lifecycle 前轻量读取 app.json，不经 storeInfo/env；
- 小游戏（game.json）无 renderer 概念，缺省 `webview`；
- 页面级 `page.json` `renderer` 覆盖**首版不支持**（编译期产物分叉不允许同包混合 target，留待后续）；
- watch 增量沿用初始解析结果；`dmcc dev` 不再强制 webview，而是尊重项目声明（若项目声明未来 target，则明确失败而非静默覆盖）。

A4 首版最小接口是**阶段级薄适配器**（F-A4-002 定案），匹配当前副作用型 worker API，而非虚构单模块 `{ code, map }` 接口：

```js
{
  name: 'webview',
  runViewStage: (ctx, progress) => Promise<void>,
  runStyleStage: (ctx, progress) => Promise<void>,
}
```

其中 `webview` adapter 只包装现有 `view-compiler` / `style-compiler` worker 调用，保留 `pages/root/progress/sourcemap` 等阶段输入、现有 worker payload、目标目录写入和错误语义；adapter 返回 Promise，不接管发布。

- resolver 只接受已注册 target；缺省为 `webview`；未知值抛结构化错误；
- adapter 接收完整阶段输入，不进行逐模块跨层回调；
- adapter 不拥有 logic/service/bridge 状态；
- 现有 view/style 编译函数作为 webview adapter 的唯一实现，先做薄适配而非重写。

## 3. Compatibility strategy

- 首次实现不改变 worker 消息形状：target 在 worker 初始化/阶段上下文内部传递；
- `webview` adapter 默认路径与显式路径使用同一实现和同一选项；
- 不把 target 写入 modDefine、模块 ID、文件命名或 app-config；
- target 选择不改变 A2/A3 reloadLevel、ws、HMR 执行协议；
- A4 首版不增加 target 到既有 lifecycle payload；target 仅在 resolver/adapter 内部诊断中记录（F-A4-005 定案）。

## 4. Failure and safety

**非法 target 顺序（F-A4-003 定案）**：

```text
读取 options.target
→ resolveTarget()
→ 非法 target 立即 reject（不触发 build:start）
→ 不 resetAssetCache、不创建/清空/发布目标目录、不启动 worker
→ 合法后才进入 lifecycle/build phases
```

错误形状固定为：

```js
{
  name: 'InvalidTargetError',
  code: 'DIMINA_INVALID_TARGET',
  target,
  message,
}
```

- resolver 失败：在 worker 启动前拒绝，目标目录与既有内容不变；
- adapter 抛错：沿现有 stage:error/build:error 错误契约传播；
- adapter 输出非法：拒绝发布并提供 target/stage 诊断；
- future adapter 不应通过 fallback 冒充 webview 成功；
- 不引入 target 级全局单例，构建上下文按 build 隔离。

## 5. Verification design

1. target resolver unit：缺省/显式 webview/未知值；
2. adapter contract：输入输出形状、错误传播；
3. ablation：移除 target resolver 或绕过 adapter，规格必须失败；
4. artifact matrix：默认 vs `target:'webview'`，nomap/sourcemap，全部示例；
5. adjacent regression：compiler CLI/watch/dev、render/container-sdk suites；
6. source audit：确认无 Lynx/rspack/compiler-core bundler 代码进入。

## 6. Acceptance mapping

| Requirement | Design point |
| --- | --- |
| R-001/R-007 | §2/§4 |
| R-002 | §2/§3 |
| R-003/R-006 | §1/§3 |
| R-004/R-005 | §3/§5 |
| R-008/R-009 | §3/§5 |
