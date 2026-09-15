# Technical Design — fe-tools-wxml-parser-dist

Status: **冻结 v1（2026-09-15）** — D-WX-1..9；与 requirements / plan / acceptance 同步。

## 1. 现状锚定（全部实证）

| 事实 | 影响 |
| --- | --- |
| `index.node` = Mach-O arm64 2.7M，**git 追踪** | 单平台二进制入库；CI（ubuntu）无产物 |
| `fe-tests.yml` 无任何 Rust 构建；`WXML_PARSER` 默认 napi | CI 必红（本地模拟实证：`bundler-session` 编译视图/项目全炸 `[wxml] native module not built`） |
| `wxml-parser-napi` 的 `build` = `cargo build … && cp …/libdimina_wxml_parser_napi.dylib index.node` | **darwin 专属**：linux `.so` / win `.dll` 后缀不同——CI 上 `pnpm build` 直接 cp 失败 |
| `package.json`：`private: true`；`files: ["index.js","index.node"]`；`main: index.js` | P1 需解除 private + 子包结构 |
| `index.js` 手写薄包：`require('./index.node')` try/catch + 延迟抛错 | 无平台检测、无子包态——P0 改最小平台后缀加载；P1 再加双态 |

## 2. P0 设计（止血 + 退 git + 跨平台化）

### 2.1 build 迁 `@napi-rs/cli`（R1-F1 修正：三文件分层）

**CLI 实证（@napi-rs/cli 3.9.1 `build --help`）**：
- `--platform` = 产物名带平台后缀（`index.darwin-arm64.node`，子包模式）——**不是**"自动处理三态后缀"；
- `--js` / `--no-js` **仅 `--platform` 下有效** → 不带 `--platform` 时**必然生成 glue 文件**（默认名即 `index.js`）→ **覆盖手写薄包**（`parseWxmlSpanView` 包装/错误格式化/`_nativeForTest`）；
- `--format` 默认 `commonjs` → 包是 `type: module`，CJS glue 会炸。

**P0 命令（路线乙，P0/P1 同构）**：

```bash
napi build --platform --release --js binding.js --format esm \
           --manifest-path ../crates/Cargo.toml \
           --package dimina-wxml-parser-napi --output-dir .
```

（CLI 3.9 **无** `--no-dts`；省略。P0 实证：napi-derive 2.x 不写 `NAPI_TYPE_DEF_TMP_FOLDER` → 可能暂无 `binding.js`，见 Residual。）

**三文件分层（D-WX-9）**：

| 文件 | 生产者 | 内容 | git |
| --- | --- | --- | --- |
| `index.<platform>.node` | `napi build` | 原生产物（`.dylib`/`.so`/`.dll` → `.node` 由 CLI 处理） | **不追踪**（D-WX-7；gitignore `*.node`） |
| `binding.js` | `napi build`（`--js`，ESM） | CLI 平台检测 + 子包选择（P1 发布态正用它） | 追踪（生成物入库，见 Residual） |
| `index.js` | **手写保留** | **P0 最小**：`createRequire` 加载 `./index.<platform>.node` + `parseWxmlSpanView` 包装；**P1**：再加 `binding.js` 子包回退（完整双态） | 追踪 |

`package.json` 增 `napi` 配置块（`targets` 先单 host，P1 扩五平台）+ devDep `@napi-rs/cli`。

### 2.1a P0 最小加载（F-R2-001）

`--platform` 产出名与今日 `index.node` **不同**。P0 改 build **同 PR / 同交付**必须改 `index.js`，否则 vitest/CI 立刻 `[wxml] native module not built`。

```js
// P0（仅本地产物；无子包回退）：
// platform = 下表三元组（与 D-WX-2 / README 映射表一致）
// createRequire(import.meta.url)(`./index.${platform}.node`)
// 失败 → native=null → 现行延迟抛错文案（可微调为提及 index.<platform>.node）
```

| `process.platform` + arch | platform 后缀 |
| --- | --- |
| `darwin` + `arm64` | `darwin-arm64` |
| `darwin` + `x64` | `darwin-x64` |
| `linux` + `x64` | `linux-x64-gnu` |
| `linux` + `arm64` | `linux-arm64-gnu` |
| `win32` + `x64` | `win32-x64-msvc` |

完整双态（本地 → `binding.js` → 抛错）留 P1 / §3.2；P0 **禁止**只改 build、不改 loader。

### 2.2 `.node` 退 git（D-WX-7 / F-R2-003）

`git rm --cached` 既有 `index.node`（及误入的 `index.*.node`）；包内 `.gitignore`：

```gitignore
*.node
# binding.js / index.js 仍追踪
```

（若需更窄：`index.node` + `index.*.node`，效果等价。）dev 前置 = Rust 工具链 + `pnpm build`（README 指引已有——`[wxml]` 抛错文案保持）。

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

**R1-F2**：不依赖 ubuntu-latest 镜像"现状预装" Rust（镜像内容可漂移、无契约）——显式 `dtolnay/rust-toolchain@stable`（幂等，预装时秒过、自文档）：

```yaml
- name: Setup Rust
  uses: dtolnay/rust-toolchain@stable
```

（首次全量分钟数记入 validation，无预算约束。）

**R1-F4（首跑 residual）**：此步骤后 CI 将**首次在 x64-linux 真跑 Rust parser + napi 序列化**（含 `wxml-parser-switch` 语义对拍 CI 首跑；crate 483 tests 平台无关，但 napi ABI/序列化层从未在 x64 验证过）。若暴露平台 bug → CI 红；**应急阀 = `WXML_PARSER=cheerio`**（合法回退引擎，D-WR-2 的另一半）。

## 3. P1 设计（矩阵 + 子包 + 双态）

### 3.1 napi-rs 标准流（D-WX-2/D-WX-6）

- **独立发布工作流** `.github/workflows/napi-release.yml`（不混 fe-tests）：tag 触发（`wxml-parser-napi-v*`）→ 5 平台 matrix → artifacts 汇聚 → `napi prepublish` 产子包目录 → 发布。
- **R1-F3（darwin-x64 runner）**：GitHub 逐步退役 Intel macOS runner（macos-13）——`darwin-x64` **不依赖 Intel runner**，走 `macos-latest（arm64）+ napi build --target x86_64-apple-darwin`（Apple silicon 交叉编译零额外工具链）；`linux-arm64` 用 `ubuntu-24.04-arm`（native）或 x64 + `--use-napi-cross`。
- **R1-F7（命令形态校准）**：`napi artifacts` / `napi prepublish` 在 CLI 3.x 的具体形态（flags/子包产出路径）未在本轮实测——**P1 首步以 `napi --help` 校准**后固化进 workflow。
- 子包：`@dimina/wxml-parser-napi-{darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu, win32-x64-msvc}`（CLI 生成的 npm dirs）；主包 `optionalDependencies` 五子包（版本随主包）。
- 主包解除 `private`；`files` 增子包声明产物面不变（`index.js` + 平台检测）。

### 3.2 双态 index.js（D-WX-3；P1 在 P0 最小加载上扩展）

```js
// 加载序（完整双态 — P1）：
// ① 本地 dev：./index.<platform>.node（P0 已具备）
// ② 发布态：经 binding.js（CLI ESM glue → optionalDependencies 子包）
// ③ 皆无 → 延迟抛错
```

（**R1-F1 / F-R2-001**：文件名带平台后缀；P0 只做 ①+③，P1 补 ②。）`parseWxmlSpanView` / 错误格式化 / `_nativeForTest` 面零改动（全在手写 `index.js`）。双态选择逻辑以可测钩暴露（`_resolveNative()`，**R1-F6 落点：bundler `__tests__/wxml-parser-loader.spec.js`**，供 P-WX04 单测）。

### 3.3 bundler 集成面

零改动：包名 import、`workspace:*` 依赖在仓库内解析（pnpm link）；npm 发布态 bundler 的 dependencies 引主包 + optional 子包随装。

## 4. 行为 0

- parser 两 crate 零 diff（本门纯分发面）；SpanView 契约零改动。
- vitest 全绿（P0 后 CI 上真跑 = 行为 0 的跨平台证据）。

## Residual

- CI 绿以 push 后 Actions 运行为准（本地等价证据先行：build 三态正确性 + `.node` 模拟）。
- **x64-linux 首跑风险（R1-F4）**：napi ABI/序列化层从未在非 arm64-darwin 真跑；CI 首跑暴露平台 bug 时应急阀 = `WXML_PARSER=cheerio`（cheerio 是 D-WR-2 保留的合法回退引擎，非降级 hack）。
- **`binding.js` 为生成物入库**（可再生成；保留追踪以保 `pnpm install` 后无需构建即可 require——如需可后补 CI 校验其与再生成一致）。
- **P0 实证（2026-09-15）**：CLI 3.9 × **napi-derive 2.16** typedef 环境变量不一致（`NAPI_TYPE_DEF_TMP_FOLDER` vs `TYPE_DEF_TMP_PATH`）→ 当前 **不生成 `binding.js`**；P0 最小加载不依赖。P1 前对齐（升 derive/napi 或兼容路径）。
- 首次发布流程走真实 tag 才全验（dry-run 先行；首版发布记录入 Actual）。
- musl/长尾平台后补（有需求再开）。
- CLI 校准：无 `--no-dts`；build 须 `--package dimina-wxml-parser-napi --output-dir .`。