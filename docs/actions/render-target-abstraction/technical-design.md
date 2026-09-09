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

最小内部接口（名称可在实现中调整，但语义固定）：

```js
{
  name: 'webview',
  compileView(input, context) -> { code, map?, warnings? },
  compileStyle(input, context) -> { code, map?, warnings? },
}
```

- resolver 只接受已注册 target；缺省为 `webview`；未知值抛结构化错误；
- adapter 接收完整阶段输入，不进行逐模块跨层回调；
- adapter 不拥有 logic/service/bridge 状态；
- 现有 view/style 编译函数作为 webview adapter 的唯一实现，先做薄适配而非重写。

## 3. Compatibility strategy

- 首次实现不改变 worker 消息形状：target 在 worker 初始化/阶段上下文内部传递；
- `webview` adapter 默认路径与显式路径使用同一实现和同一选项；
- 不把 target 写入 modDefine、模块 ID、文件命名或 app-config；
- target 选择不改变 A2/A3 reloadLevel、ws、HMR 执行协议；
- `stage` 生命周期 target 字段如需加入，只作为内部/可选诊断字段，并先验证既有观察者兼容性。

## 4. Failure and safety

- resolver 失败：在 worker 启动前拒绝，目标目录不发布；
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
