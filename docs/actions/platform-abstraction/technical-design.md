# Technical Design — platform-abstraction

## 1. 概念边界

```text
源码（WXML/WXSS/JS）
        │
   renderer adapter          ← A4（编译层渲染后端：webview/lynx）
        │
   编译管道（modDefine）
        │
   platform strategy         ← 本 Action（运行时宿主：native/web）
        │
        ├─ ES target（es2023 native / 可提升 web）
        ├─ sourcemap 策略（QuickJS attach / devtools URL）
        └─ 产物路径约定（不变层，跨 platform 字节一致）
```

renderer 与 platform 的约束关系：

```text
webview + native  = dmcc build（现状）✅
webview + web     = dmcc dev（现状）✅
lynx  + native    = future C1
lynx  + web       = 无效（.lyx 仅给 native runtime）
```

## 2. Platform contract

```js
// src/common/platforms.js
const PLATFORMS = {
  native: {
    name: 'native',
    // QuickJS/JSCore + native WebView 运行时
    esTarget: 'es2023',           // 保守兼容（现状）
    sourcemapStrategy: 'quickjs-attach',  // Harmony 断点路径
  },
  web: {
    name: 'web',
    // V8 + iframe + container-sdk Web 宿主
    esTarget: 'es2023',           // 首版不提升（保证缺省一致），接线点存在
    sourcemapStrategy: 'devtools-url',    // 浏览器 devtools
  },
}
```

- `resolvePlatform(value)` → 缺省 `native`；未知值抛 `InvalidPlatformError`
- platform 进入 `runBuild` 编译上下文，传给 stage / worker
- 与 renderer registry 分开管理（两个维度各自独立注入）

## 3. D6:B 产物分层

| 层 | 跨 platform 行为 | 示例 |
| --- | --- | --- |
| **不变层** | **逐字节一致** | modDefine 格式、模块 ID、目录结构、app-config.json、兼容性警告 |
| **可变层** | 允许按 platform 分叉 | ES target、sourcemap 策略 |

首版实际分叉**仅 sourcemap 策略**；ES target 接线点存在但不分叉（`web` 也用 es2023，记录决策与再分叉条件）。

## 4. CLI 语义

```bash
dmcc build                     # 缺省 --platform native（向后兼容）
dmcc build --platform native   # 显式（等价缺省）
dmcc build --platform web      # Web 平台产物（sourcemap 策略切 devtools）
dmcc dev                       # 固定 platform=web，不可配置
```

## 5. sourcemap 策略分叉

### native（现状）

`logic-compiler` 的 `sourcemapTargetPath` 继续作为 QuickJS attach 断点路径传入。逻辑不变。

### web

dev 场景下 `sourcemapTargetPath` 当前也传了值，但浏览器 devtools 实际按 `sourceMappingURL` 注释解析——已有的 `.map` 文件 URL 即可。分叉体现在：

- `web` platform 下 `sourcemapTargetPath` 语义切换为"生成的 HTTP URL 基准"（或维持现状——需评审确认是否实际有差异）
- 评审点：如果 dev/build 的 `.map` 文件已经一致（A1 P-005 验证），`web` 策略可能不需要改变行为，仅语义标注

## 6. renderer×platform 约束校验

`runBuild` 在 resolve renderer 和 platform 后校验组合：

```js
if (renderer === 'lynx' && platform === 'web') {
  throw new InvalidPlatformError(...)
}
```

当前仅 webview renderer 已注册，此校验首版为预留（无第二 renderer 时不会触发）。

## 7. 失败语义

- 未知 platform：在 lifecycle 前、任何副作用前失败（对齐 F-A4-003 模式）
- `InvalidPlatformError`：code `DIMINA_INVALID_PLATFORM`、platform 字段、context
- 无效 renderer×platform 组合：同前置校验时机

## 8. 验证设计

1. platform resolver spec：缺省/显式/未知值
2. CLI integration：`--platform native` 等价缺省；`--platform web` sourcemap 策略切换
3. 缺省产物矩阵：改前 vs 改后，无 platform 参数，nomap/sourcemap，全示例 diff=0
4. `--platform web` 产物矩阵：与 `--platform native` 产物对比（可变层差异允许；不变层必须 diff=0）
5. 消融：移除 platform 前置校验后未知 platform 目标 spec 失败
6. 相邻回归：compiler/render/sdk 全量、CLI/watch/dev/compile 入口

## 9. Acceptance mapping

| Requirement | Design point |
| --- | --- |
| R-001/R-002/R-007 | §2/§4/§6 |
| R-003/R-004 | §3/§8 |
| R-005 | §5 |
| R-006 | §3（首版不分叉决策） |
| R-008 | §8 |
| R-009 | §2（内部诊断优先） |
