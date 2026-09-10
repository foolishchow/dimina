# Requirements — platform-abstraction

## R-001（MUST）platform 枚举与 compile profile 解析

编译器支持 platform 维度（`native` / `web`）和 mode 维度（`build` / `dev`）；compile profile = platform defaults × mode defaults × 用户显式配置。未知 platform 在构建前以结构化 `InvalidPlatformError`（code `DIMINA_INVALID_PLATFORM`）失败。

## R-002（MUST）CLI platform 与 minify

`dmcc build --platform <native|web>`（缺省 native）；`dmcc dev` 固定 `platform: 'web'`。`--minify` / `--no-minify` 为显式配置，覆盖 mode 缺省（build=true / dev=false）。CLI 来源不走 app.json。

## R-003（MUST）ES target 从 profile 读取

编译器内部三处硬编码（logic es2023/es2020、view es2020）全部替换为从 compile profile 的 `esTarget` 读取；首版 native/web 的 esTarget 均为 es2023（值一致，架构支持分叉）。

## R-004（MUST）minify 从 profile 读取

logic/view/style 编译的 minify 行为由 compile profile 的 `minify` 决定（mode 缺省 + 用户覆盖）；替换硬编码 `minify: true` 和 `enableSourcemap` 隐式跳过逻辑为显式 profile 驱动。

## R-005（MUST）不变层跨 platform × mode 一致

modDefine 注册调用结构、模块 ID、输出目录（`main/`/`{root}/`）、`app-config.json`、兼容性警告语义在任何 platform × mode 组合下一致（注册调用结构一致——非字节布局）。

## R-006（MUST）缺省 build 产物零变化

`dmcc build`（无任何参数）全部产物（含 `.map`）与改前基线**逐字节一致**（同绝对路径控制 diff=0）。

## R-007（MUST）dev 产物 minify 差异

`dmcc dev`（缺省）产物**不 minify**（可读堆栈、快速增量）；`dmcc dev --minify` 显式覆盖后产物与 build minified 等价。

## R-008（MUST）renderer × platform 约束

webview renderer 支持 native + web；lynx renderer（未来）仅支持 native。无效组合给出明确错误（首版预留，当前无第二 renderer）。

## R-009（MUST）既有行为无回归

compiler 既有规格、CLI、watch、dev、render/container-sdk 相邻规格保持全绿；`pnpm compile` 批量路径不变。

## R-010（SHOULD）platform 可观察

compile profile 在内部诊断/日志可标识 platform + mode + minify（不破坏既有 observer）。

## Non-scope

不实现新产物格式、不实现 Lynx、不改 renderer registry、不改 dev server/HMR/ws 协议、不做性能优化、不实现 build --platform web 部署链路。
