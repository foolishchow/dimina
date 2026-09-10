# Platform Abstraction（编译产物平台维度 + 编译策略）

- Action: `platform-abstraction`
- Status: `draft`
- Updated: 2026-09-08
- Status authority: [Action Status](../STATUS.md)
- 设计权威：[Compiler Architecture RFC](../../Compiler-Architecture-RFC.md) §3 D6（修订为 D6:B，见本 Action 推动的变更）、§4.1 边界；A4 归档 [render-target-abstraction](../_archive/complete/render-target-abstraction/README.md)（renderer 抽象，与 platform 正交/约束关系）

## Background

当前 `dmcc build` 和 `dmcc dev` 隐含了两个不同的运行时平台和构建意图，但没有显式表达：

- `dmcc build` → 产物被 **Dimina 原生四端容器**消费（Harmony QuickJS、iOS JSCore、Android native WebView），资源以 file:// / 原生沙盒加载；意图是**产物优化**（minify、语法降级）
- `dmcc dev` → 产物被 **Web 浏览器**消费（V8 + iframe + container-sdk Web 宿主页），资源以 HTTP no-cache 加载；意图是**开发体验**（可读堆栈、快速增量）

编译器内部多处按最保守运行时（QuickJS / 老 WebView）硬编码了 ES target 和 minify：

- `logic-compiler.js:122` — `target: ['es2023'], minify: true`（QuickJS 兼容）
- `logic-compiler.js:443` — `target: 'es2020'`
- `view-compiler.js:330` — `target: ['es2020'], minify: true`
- sourcemap 模式已隐式跳过 minify（`enableSourcemap` 分支）——minify 开关已有雏形但非显式配置

产物字节上 build/dev 完全一致（D6 冻结 + A1/A4 diff=0 验证），但这个一致性是**统一保守**的结果，不是架构有意为之。dev 场景下做了不必要的 minify（堆栈不可读、增量慢）；一旦 Web 平台需要更高 ES target 就没有表达手段。

### 编译策略模型（定稿）

ES target 和 minify 不是单一硬编码值，而是 **platform × mode** 的函数：

```text
compile profile = platform defaults × mode defaults × 用户显式配置

                    build（产物优化）         dev（开发体验）
native            es2023 + minify            —（dev 固定 web）
web               es2023 + minify            es2023 + 不 minify
```

- **platform** 决定 ES target（运行时能力约束：QuickJS es2023 / V8 esnext）
- **mode** 决定 minify 缺省（build=true / dev=false）
- **用户显式配置**可覆盖 minify（`--minify` / `--no-minify`）

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

### D6 修订（D6:B 定稿）

原 D6：产物一个字节不变（统一保守）。

修订为 **D6:B（compile profile 产物策略）**：

| 层 | 跨 platform × mode 行为 | 内容 |
| --- | --- | --- |
| **不变层** | 字节一致 | modDefine 格式（注册调用结构，非字节布局）、模块 ID、输出目录结构（`main/`、`{root}/`、`app-config.json`）、兼容性警告语义 |
| **可变层** | 由 compile profile 决定 | ES target（platform 决定）、minify（mode 缺省 + 用户覆盖）、sourcemap 策略（platform 决定） |

**向后兼容保证**：`dmcc build`（无任何参数）→ es2023 + minify + native = 与现状逐字节一致。

**首版行为**：
- build（缺省/native）→ es2023 + minify（与现状一致）
- build --platform web → es2023 + minify（首版 ES 值与 native 一致，仅语义标注）
- dev → es2023 + **不 minify**（mode 缺省覆盖——**dev 产物首版即与 build 不同**）

## Goal

引入显式 platform 维度 + 编译策略（compile profile），让编译器按运行时宿主环境（native / web）和构建意图（build / dev）声明和区分编译行为。首版落地 native/web 枚举、CLI `--platform`、minify 显式配置、dev 不 minify。

## Non-goals

- 不实现新的产物格式（modDefine 注册调用结构不变）
- 不实现 Lynx（C1 deferred 不变）
- 不改变 renderer 抽象（A4 已闭合，platform 是新增维度）
- 不做性能优化（dev 不 minify 的收益是调试体验，非性能目标）
- 不修改 service / bridge / HMR / ws 协议
- 不修改 `dmcc dev` 的 Web 容器行为（dev server/HMR 不变）
- 不实现 `dmcc build --platform web` 的部署链路（产品语义保留，本 Action 仅架构支持）

## Scope

- `fe/packages/compiler/src/common/platforms.js`（新增：platform 枚举、compile profile 解析、minify 覆盖逻辑）
- `fe/packages/compiler/src/index.js`（platform + profile 进入编译上下文，传给 stage）
- `fe/packages/compiler/src/core/logic-compiler.js`（ES target/minify 从 profile 读取，替换硬编码）
- `fe/packages/compiler/src/core/view-compiler.js`（同上）
- `fe/packages/compiler/src/core/style-compiler.js`（如涉及 minify 则同上）
- `fe/packages/compiler/src/bin/index.js`（`dmcc build --platform <name> [--minify|--no-minify]`）
- `fe/packages/compiler/src/bin/dev.js`（`dmcc dev [--minify]`，固定 platform=web）
- `fe/packages/compiler/__tests__/`（platform/profile 解析、缺省一致性、dev minify 行为规格）

明确不改：
- `fe/packages/render` / `fe/packages/container-sdk`（运行时行为）
- 原生容器
- A2/A3 dev server / HMR / ws 协议
- A4 renderer registry（platform 与 renderer 分开管理）

## Design inputs

- [RFC D6](../../Compiler-Architecture-RFC.md)（本 Action 推动修订为 D6:B）
- [A4 renderer 归档](../_archive/complete/render-target-abstraction/README.md)：registry/adapter 模式参考
- 编译器硬编码事实：logic es2023/es2020、view es2020、sourcemap 模式隐式跳过 minify
- 用户决策记录（2026-09-08）：
  - platform 来源 = CLI `--platform`（不走 app.json）
  - sourcemap web 策略 = 仅语义标注（不改变实际行为）
  - ES target 首版值 = es2023（native/web 一致，架构支持分叉能力）
  - dev/build target 可不同 = 接受（dev 产物首版即不 minify）
  - minify = 显式配置（mode 提供缺省，CLI 可覆盖）
  - `build --platform web` 部署语义 = 保留，不做具体实现

## Deliverables

- platform 枚举（`native` / `web`）与 compile profile 解析
- CLI `--platform`（build）+ `--minify` / `--no-minify`（build + dev）
- 三处硬编码替换为 profile 读取（esTarget/minify 从 platform×mode 派生）
- dev 默认不 minify（mode 覆盖；`--minify` 可覆盖回）
- 缺省 build 产物逐字节一致性验证
- dev 产物与 build 产物的差异验证（minify 层差异、不变层一致）
- RFC D6:B 回写 + platform/mode/compile profile 概念定义

## Readiness gaps

- 当前为 `draft`，尚未完成 Readiness Review
- 已冻结（2026-09-08 讨论定稿）：
  - **platform 来源**：CLI `--platform`（不走 app.json）
  - **sourcemap web 策略**：仅语义标注，不改变实际行为
  - **ES target 首版值**：es2023（native/web 一致；架构支持分叉，值后续可调）
  - **dev 产物**：首版即不 minify（mode 覆盖）；用户显式 `--minify` 可覆盖回
  - **minify**：显式配置（`--minify` / `--no-minify`），mode 提供缺省（build=true/dev=false）
  - **build --platform web 部署语义**：保留，不做具体实现
  - **D6:B 不变层**：modDefine **注册调用结构**（非字节布局——不 minify 时多行拼接与 minified 单行都是合法 modDefine 格式）
- 待 Readiness Review 确认：设计/验收/计划文档完整性

## Closure conditions

- 所有 MUST Acceptance 通过并有可复现证据；
- 缺省 build 产物逐字节一致（无参数时与改前 diff=0）；
- dev 产物 minify 差异有验证；
- RFC D6:B + compile profile 概念回写；
- STATUS、导航、归档一致。
