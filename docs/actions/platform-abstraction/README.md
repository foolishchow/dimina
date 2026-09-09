# Platform Abstraction（编译产物平台维度）

- Action: `platform-abstraction`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 设计权威：[Compiler Architecture RFC](../../Compiler-Architecture-RFC.md) §3 D6（修订为 D6:B，见本 Action 推动的变更）、§4.1 边界；A4 归档 [render-target-abstraction](../_archive/complete/render-target-abstraction/README.md)（renderer 抽象，与 platform 正交/约束关系）

## Background

当前 `dmcc build` 和 `dmcc dev` 隐含了两个不同的运行时平台，但没有显式表达：

- `dmcc build` → 产物被 **Dimina 原生四端容器**消费（Harmony QuickJS、iOS JSCore、Android native WebView），资源以 file:// / 原生沙盒加载
- `dmcc dev` → 产物被 **Web 浏览器**消费（V8 + iframe + container-sdk Web 宿主页），资源以 HTTP no-cache 加载

编译器内部多处按最保守运行时（QuickJS / 老 WebView）硬编码了 ES target 和 sourcemap 策略：

- `logic-compiler.js:122` — `target: ['es2023']`（QuickJS 兼容）
- `view-compiler.js:330` — `target: ['es2020']`
- `sourcemapTargetPath` — 原设计服务 Harmony QuickJS attach 断点，dev 场景下被浏览器 devtools 共用（语义混淆）

产物字节上 build/dev 完全一致（D6 冻结 + A1/A4 diff=0 验证），但这个一致性是**统一保守**的结果，不是架构有意为之——一旦 Web 平台需要更高 ES target 或 Harmony 需要特有 sourcemap 路径，就没有表达手段。

### renderer 与 platform 的关系（定稿）

```text
renderer（编译层渲染后端） × platform（运行时宿主环境）

              native（QuickJS/JSCore + native WebView）    web（V8 + iframe）
webview       ✅ dmcc build（现状）                        ✅ dmcc dev（现状）
lynx          future C1                                    —（.lyx 产物仅给 Lynx native）
```

- **不是完全正交**：lynx renderer 只产出 native 平台产物
- webview renderer 的产物同时被两个 platform 消费（同一份 modDefine）
- platform 与 renderer 是**有约束关系的两个维度**，而非独立笛卡尔积

### D6 修订立场（D6:B）

原 D6：产物一个字节不变（统一保守）。

修订为 **D6:B（platform-aware 产物策略）**：

- **modDefine 格式、模块 ID、输出目录结构（`main/`、`{root}/`、`app-config.json`）、兼容性警告语义**——跨 platform **字节不变**（不变层）
- **ES target、sourcemap 策略**——允许按 platform 分叉（可变层），由 platform 显式声明决定
- 分叉必须通过 platform 参数显式触发；缺省 platform 下产物与现状**逐字节一致**（向后兼容）

## Goal

引入显式 platform 维度，让编译器能按运行时宿主环境（native / web）声明和区分编译策略，同时保持缺省产物零变化。首版仅落地 native / web 两个 platform 枚举与 sourcemap 策略区分，不引入第二个产物格式。

## Non-goals

- 不实现新的产物格式（modDefine 不变）
- 不实现 Lynx（C1 deferred 不变）
- 不改变 renderer 抽象（A4 已闭合，platform 是新增维度）
- 不做性能优化
- 不修改 service / bridge / HMR / ws 协议
- 不修改 `dmcc dev` 的 Web 容器行为（dev 已锁定 web platform）

## Scope

- `fe/packages/compiler/src/common/platforms.js`（新增：platform 枚举、解析、sourcemap 策略）
- `fe/packages/compiler/src/index.js`（platform 进入编译上下文，传给 stage）
- `fe/packages/compiler/src/core/logic-compiler.js`（sourcemap target 按 platform 区分）
- `fe/packages/compiler/src/core/view-compiler.js`（ES target 按 platform 预留接线点）
- `fe/packages/compiler/src/bin/index.js`（`dmcc build --platform <name>`）
- `fe/packages/compiler/src/bin/dev.js`（`dmcc dev` 固定 platform=web）
- `fe/packages/compiler/__tests__/`（platform 解析、缺省一致性、分叉行为规格）

明确不改：
- `fe/packages/render` / `fe/packages/container-sdk`（运行时行为）
- 原生容器
- A2/A3 dev server / HMR / ws 协议
- A4 renderer registry（platform 与 renderer 分开管理）

## Design inputs

- [RFC D6](../../Compiler-Architecture-RFC.md)（本 Action 推动修订为 D6:B）
- [A4 renderer 归档](../_archive/complete/render-target-abstraction/README.md)：renderer 抽象的 registry/adapter 模式可参考
- 编译器硬编码事实：`logic-compiler.js` es2023/es2020、`sourcemapTargetPath` QuickJS 断点语义
- 微信小程序 `renderer` 配置模型（app.json 全局声明——platform 是否也走配置待评审）

## Deliverables

- platform 枚举（`native` / `web`）与解析（缺省 `native`）
- CLI `--platform <name>`（build）；dev 固定 web
- sourcemap 策略按 platform 区分（native：QuickJS attach 路径；web：浏览器 devtools URL）
- ES target 按 platform 预留接线点（首版不启用分叉，统一保守；分叉决策记录）
- 缺省产物逐字节一致性验证（同 A4 P-005 方法）
- RFC D6:B 回写 + platform 概念定义

## Readiness gaps

- 当前为 `draft`，尚未完成 Readiness Review
- 待评审冻结：
  - platform 来源：CLI `--platform` / `app.json` 字段 / 两者（用户此前决策 renderer 走 app.json，platform 是否同源？）
  - sourcemap 策略的具体分叉行为（native 路径格式 vs web URL 格式，差异到底在哪）
  - ES target 分叉是否在首版启用（建议不启用，仅预留接线点，记录决策）
  - `dmcc build --platform web` 的产品语义（构建给 Web 部署的产物？与 dev 的关系？）

## Closure conditions

- 所有 MUST Acceptance 通过并有可复现证据；
- 缺省产物逐字节一致（无 platform 参数时与改前 diff=0）；
- RFC D6:B + platform 概念回写；
- STATUS、导航、归档一致。
