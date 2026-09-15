# Requirements — fe-tools-wxml-parser-dist

Status: **冻结（2026-09-15）** — D-WX-1..9 已拍板；随 Action `ready`。

## R-WX0（MUST）P0 止血：CI 恢复绿

- `fe-tests.yml` 增加 napi 构建步骤（ubuntu x64 现场 `cargo build` + 产物就位）+ cargo cache（键 = `Cargo.lock`，D-WX-5/D-WX-8：单 job，不拆 matrix、不做 artifact 缓存）。
- **build script 跨平台化**：现状 `pnpm build` 硬编码 `cp …libdimina_wxml_parser_napi.dylib`（darwin 专属）——linux 产物是 `.so`、windows `.dll`；P0 必须三态正确（迁 `@napi-rs/cli napi build --platform`，D-WX-9）。
- **P0 最小加载（F-R2-001）**：`index.js` 在 P0 即改为加载 `./index.<platform>.node`（napi-rs 平台三元组，如 `darwin-arm64`；`createRequire`）；`parseWxmlSpanView` 包装面零改动。**不**接 `binding.js` / 子包回退（完整双态 = R-WX3 / P1）。
- CI 全绿（以 push 后 GitHub Actions 运行为准；本地等价证据先行）。

## R-WX1（MUST）P0：`.node` 退 git（D-WX-7）

- `git rm --cached` 既有入库二进制（今日 `index.node`；若已有 `index.*.node` 一并撤）；包内 `.gitignore` **覆盖全部 native 产物**：`*.node`（或等价 `index.node` + `index.*.node`）；**仍追踪** `binding.js` / 手写 `index.js`。
- dev 前置成文：Rust 工具链 + `cd fe/tools/wxml-parser-napi && pnpm build`；未构建时的 `[wxml]` 延迟抛错指引保持。

## R-WX2（MUST）P1：五平台子包矩阵（D-WX-2/D-WX-6）

- `@dimina/wxml-parser-napi` 解除 `private`；npm 子包 × 5：`darwin-arm64` / `darwin-x64` / `linux-x64-gnu` / `linux-arm64-gnu` / `win32-x64-msvc`。
- 主包 `optionalDependencies` 声明五子包（安装时 npm/pnpm 自动选择，缺平台友好报错）。
- 构建流：napi-rs matrix（GitHub Actions，独立于 fe-tests 的发布工作流）；产物汇聚 + `napi prepublish`（或等价）。

## R-WX3（MUST）P1：双态解析（D-WX-3 / D-WX-9）

- `index.js` 加载序：**本地 workspace 现场 `./index.<platform>.node`（dev `pnpm build --platform` 产出）优先**；不存在 → 经 `binding.js`（CLI glue）平台检测走子包；皆无 → 现行 `[wxml]` 延迟抛错。
- bundler 侧零改动（包名 import `@dimina/wxml-parser-napi` 不变）。

## R-WX4（MUST）行为 0 与范围

- parser crate（`dimina-wxml-parser` / `-napi`）**语义零改动**；SpanView 契约零改动。
- vitest 全绿；`fe/packages` 零触碰；不发 wasm（观察项另立）。

## R-WX5（MUST）证据与回流

- CI 绿锚定（Actions run URL/commit）；双态加载实证；发布 dry-run（`npm publish --dry-run` 主包 + 子包 files/结构正确）。
- 消融：CI 拔构建步骤 → 红（回归价值锚定）；拔本地 `index.<platform>.node`（子包亦无）→ 延迟抛错文案正确。
- 回流：dev 前置（Rust + pnpm build）+ 双态解析不变量入 architecture-notes；wasm 观察项已入 TODO。