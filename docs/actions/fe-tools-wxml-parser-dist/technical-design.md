# Technical Design — fe-tools-wxml-parser-dist

Status: **冻结 v1（2026-09-15）** — D-WX-1..8；与 requirements / plan / acceptance 同步。

## 1. 现状锚定（全部实证）

| 事实 | 影响 |
| --- | --- |
| `index.node` = Mach-O arm64 2.7M，**git 追踪** | 单平台二进制入库；CI（ubuntu）无产物 |
| `fe-tests.yml` 无任何 Rust 构建；`WXML_PARSER` 默认 napi | CI 必红（本地模拟实证：`bundler-session` 编译视图/项目全炸 `[wxml] native module not built`） |
| `wxml-parser-napi` 的 `build` = `cargo build … && cp …/libdimina_wxml_parser_napi.dylib index.node` | **darwin 专属**：linux `.so` / win `.dll` 后缀不同——CI 上 `pnpm build` 直接 cp 失败 |
| `package.json`：`private: true`；`files: ["index.js","index.node"]`；`main: index.js` | P1 需解除 private + 子包结构 |
| `index.js` 手写薄包：`require('./index.node')` try/catch + 延迟抛错 | 无平台检测、无子包态——P1 重写为双态 |

## 2. P0 设计（止血 + 退 git + 跨平台化）

### 2.1 build 迁 `@napi-rs/cli`

`wxml-parser-napi` devDep 加 `@napi-rs/cli`；`build` 改 `napi build --platform --release`（自动处理产物命名/后缀/target 三态，免手写 cp；亦为 P1 铺路——`napi build` 产物命名与 `napi artifacts`/`prepublish` 对齐）。

`package.json` 增 `napi` 配置块（`targets` 先单 host，P1 扩五平台）。

### 2.2 `.node` 退 git（D-WX-7）

`git rm --cached index.node`；包内 `.gitignore` 加 `index.node`。dev 前置 = Rust 工具链 + `pnpm build`（README 指引已有——`[wxml]` 抛错文案保持）。

### 2.3 CI 步骤（单 job 内，D-WX-8）

```yaml
# fe-tests.yml，Install dependencies 之后：
- name: Setup Rust cache
  uses: actions/cache@v6
  with:
    path: |
      ~/.cargo/registry
      fe/tools/crates/target
    key: rust-${{ runner.os }}-${{ hashFiles('fe/tools/crates/Cargo.lock') }}
- name: Build wxml-parser-napi
  working-directory: fe/tools/wxml-parser-napi
  run: pnpm build
```

（ubuntu-latest 预装 Rust 工具链；首次全量分钟数记入 validation，无预算约束。）

## 3. P1 设计（矩阵 + 子包 + 双态）

### 3.1 napi-rs 标准流（D-WX-2/D-WX-6）

- **独立发布工作流** `.github/workflows/napi-release.yml`（不混 fe-tests）：tag 触发（`wxml-parser-napi-v*`）→ 5 平台 matrix（`napi-rs/build-action` 或手写 `cargo build --target` + `napi build`）→ artifacts 汇聚 → `napi prepublish -t npm` 产子包目录 → 发布。
- 子包：`@dimina/wxml-parser-napi-{darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu, win32-x64-msvc}`（CLI 生成的 npm dirs）；主包 `optionalDependencies` 五子包（版本随主包）。
- 主包解除 `private`；`files` 增子包声明产物面不变（`index.js` + 平台检测）。

### 3.2 双态 index.js（D-WX-3）

```js
// 加载序（双态）：
// ① 本地 dev：./index.node（pnpm build 产出，git 不追踪）存在 → 用之
// ② 发布态：@napi-rs/cli 平台检测 → optionalDependencies 子包
// ③ 皆无 → 延迟抛错（现行文案，含 pnpm build 指引）
```

CLI 生成的 `index.js` 含平台检测；本仓库在其上叠「本地优先」探测（保 workspace dev 不需 npm install 子包）。`parseWxmlSpanView` 面零改动。

### 3.3 bundler 集成面

零改动：包名 import、`workspace:*` 依赖在仓库内解析（pnpm link）；npm 发布态 bundler 的 dependencies 引主包 + optional 子包随装。

## 4. 行为 0

- parser 两 crate 零 diff（本门纯分发面）；SpanView 契约零改动。
- vitest 全绿（P0 后 CI 上真跑 = 行为 0 的跨平台证据）。

## Residual

- CI 绿以 push 后 Actions 运行为准（本地等价证据先行：build script 三态正确性 + `.node` 模拟）。
- 首次发布流程走真实 tag 才全验（dry-run 先行；首版发布记录入 Actual）。
- musl/长尾平台后补（有需求再开）。