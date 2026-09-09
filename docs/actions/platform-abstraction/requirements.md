# Requirements — platform-abstraction

## R-001（MUST）platform 枚举与解析

编译器支持 platform 维度；合法值 `native` / `web`；缺省为 `native`（向后兼容：现状 build 即面向原生容器）；未知 platform 在构建前以结构化 `InvalidPlatformError`（code `DIMINA_INVALID_PLATFORM`）失败，不静默回退。

## R-002（MUST）CLI 显式 platform

`dmcc build --platform <native|web>`；`dmcc dev` 固定 `platform: 'web'`（不可配置，dev server 只服务 Web 宿主）。CLI 显式值与缺省产物一致时（native）零差异。

## R-003（MUST）不变层产物字节一致

跨 platform 的不变层（modDefine 格式、模块 ID、输出目录 `main/`/`{root}/`、`app-config.json` 结构、兼容性警告语义）在任何 platform 下**逐字节一致**。

## R-004（MUST）缺省产物零变化

无 `--platform` 参数（或 `--platform native`）时，全部产物（含 `.map`）与改前基线**逐字节一致**（同绝对路径控制 diff=0）。

## R-005（MUST）sourcemap 策略按 platform 区分

`sourcemapTargetPath` 的语义按 platform 分叉：

- `native`：Harmony QuickJS attach 断点路径（现状逻辑不变）
- `web`：浏览器 devtools URL 映射（如需路径差异则在此层实现，不影响 `.map` 语义等价性）

缺省（native）时 sourcemap 与现状逐字节一致。

## R-006（MUST）ES target 接线点

编译器内部的 ES target（es2023/es2020）预留按 platform 配置的接线点；首版不启用分叉（统一保守，保证 R-004），但接线点存在且可通过 platform 触达（非硬编码），分叉决策记录在案。

## R-007（MUST）renderer 与 platform 的约束

webview renderer 支持 native + web 两个 platform；lynx renderer（未来）仅支持 native。compiler 在 renderer×platform 组合不合法时给出明确错误。

## R-008（MUST）既有行为无回归

compiler 既有规格、CLI、watch、dev、render/container-sdk 相邻规格保持全绿；`pnpm compile` 批量路径不变。

## R-009（SHOULD）platform 可观察

`build:start` / stage 生命周期 payload 或诊断日志可标识当前 platform（不破坏既有 observer；字段增加需验证兼容性，或仅内部诊断）。

## Non-scope

不实现新产物格式、不实现 Lynx、不改 renderer registry、不改 dev server/HMR/ws 协议、不做性能优化。
