# Validation — fe-tools-wxml-parser-dist

Status: **in_progress（P1 已交付 `7e43f175`）** — P-WX00/02/04 pass；P-WX03 结构 pass；P-WX06 dry-run 连通 pass；P-WX01 **blocked-on-env**（fork Actions 未启用）；P-WX05 crate 零语义 diff pass + 1 pre-existing 失败（非本门）；P-WX07 消融 pass。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WX00 | build 跨平台 | `cd fe/tools/wxml-parser-napi && pnpm build`（napi CLI `--platform` 路线乙）；产物 `index.<platform>.node` + `binding.js`（ESM）就位且手写 `index.js` 未被覆盖；**P0 验 darwin（本地）+ linux（CI）**，win32 真验归 P1 matrix（**R1-F5 限定**） | A-WX0 | pending |
| P-WX01 | CI 绿 | push 后 fe-tests Actions 全绿；首次全量 Rust 编译分钟数记录；cache 命中增量对比（第二次 push） | A-WX0 | pending |
| P-WX02 | 退 git + 最小加载 + dev 流 | `git ls-files` 无 `*.node`（含旧 `index.node` / `index.*.node`）；`.gitignore` 含 `*.node`；本地 `pnpm build` → 存在 `index.<platform>.node` 且 vitest 全绿（580）；移走该文件 → 编译测试炸（延迟抛错）→ 恢复绿 | A-WX0/A-WX1 | pending |
| P-WX03 | 子包结构 | `napi create-npm-dirs`/`prepublish` 产五子包；主包 `optionalDependencies` 声明；`private` 已除 | A-WX2 | pending |
| P-WX04 | 双态解析 | 单测三态（本地 `index.<platform>.node` 优先 / `binding.js` 子包检测路径 / 皆无抛错）——落 bundler `__tests__/wxml-parser-loader.spec.js`，经 `_resolveNative()` 可测钩（**R1-F6**）；有本地产物时子包路径不被触碰 | A-WX3 | pending |
| P-WX05 | 行为 0 | parser crates `git diff` 零语义；CI vitest 全绿（跨平台证据）；`fe/packages` 零 diff | A-WX4 | pending |
| P-WX06 | 发布面 | `npm publish --dry-run`（主包 files/结构）；`napi prepublish` 子包产物正确 | A-WX5 | pending |
| P-WX07 | 消融 | ①CI 拔构建步骤（本地模拟 `.node` 缺失）→ 编译测试全炸（已证模式）→ 恢复；②拔双态本地探测 → 单态子包路径断言失败 | A-WX5 | pending |

## Diff scope

`fe/tools/wxml-parser-napi/`（package.json / index.js / binding.js / .gitignore / npm dirs）、`.github/workflows/`（fe-tests.yml + 新 napi-release.yml）、`fe/tools/crates/`（仅构建配置，**零语义**）、Action 文档、architecture-notes；**`fe/packages` 零改动**；**parser 两 crate 源码零 diff**。

## Residual（随 R1）

- x64-linux 首跑（R1-F4）：CI 首次真跑非 arm64-darwin 的 napi ABI/序列化；应急阀 `WXML_PARSER=cheerio`。
- `napi artifacts`/`prepublish` 命令形态（R1-F7）：P1 首步 `napi --help` 校准。

## Uncovered

- 五平台真实安装全验（首版发布后逐步：有真实 x64/win 机器时补冒烟记录）
- wasm/web target（TODO 观察项，非本门）

## Actual

### P0 本地（2026-09-15 · tip 相对基线 `dd2cb451` / 授权提交 `3ff54de3`）

| ID | Result | Evidence |
| --- | --- | --- |
| P-WX00 | **pass（darwin）** | `pnpm build` → `index.darwin-arm64.node`；手写 `index.js` 未被覆盖；parse 冒烟 OK。**linux 归 CI（P-WX01）**。CLI 3.9.1 **无** `--no-dts`（已从 build 去掉）；需 `--package` + `--output-dir .` |
| P-WX01 | **pending** | 待 push 后 Actions 绿 + 首次 Rust 分钟数 |
| P-WX02 | **pass（本地）** | `git rm --cached index.node`；`.gitignore`=`*.node`；`git ls-files` 无 `*.node`；580/580；移走 `index.darwin-arm64.node` → 延迟抛错含 `expects index.darwin-arm64.node` → 恢复绿 |
| P-WX03..07 | pending | P1 |

**发现（P0 residual · binding.js）**：`@napi-rs/cli@3.9` 写 `NAPI_TYPE_DEF_TMP_FOLDER`，而 crate 仍用 **napi-derive 2.16**（读 `TYPE_DEF_TMP_PATH`）→ typedef 目录空 → **`binding.js` 未生成**（CLI 在 `idents.length===0` 时跳过）。P0 最小加载不依赖 glue；**P1 完整双态前**须升 napi-derive/napi 至与 CLI 3 对齐，或另开兼容路径。空 `index.d.ts` 已 gitignore。

**vitest**：`pnpm --filter @dimina/bundler test` → **580/580** passed（2026-09-15 本地 darwin-arm64）。

### P1 交付（2026-09-15 · `7e43f175`）

- **napi/napi-derive 2.16 → 3/3.6.5**：binding 根因修复（derive 3 读 `NAPI_TYPE_DEF_TMP_FOLDER`）；napi 面薄（单 `#[napi]` fn）编译零改动。
- **glue = `binding.cjs`（CJS）**：ESM glue 会 import 即执行、破坏延迟抛错契约（cheerio 路径 vitest 会被炸 import 链）；CJS 可经 createRequire 延迟 require。CLI 内建完整回退序（本地 `index.<platform>.node` → 子包 → WASI）。
- **三态实证**：本地态 parse ✓；拔本地（无子包）→ import 不炸 + `_resolveNative()` null + `[wxml]` 延迟文案 ✓；恢复 ✓。
- **P-WX04**：`wxml-parser-loader.spec.js` 4 测（本地 e2e / 注入路径"皆无"态 / import 链安全）；**584/584（80 files）**。
- **P-WX03**：`napi.targets` 五平台；`private` 解除；`files=[index.js,binding.cjs]`；`napi create-npm-dirs` 五子包模板（cpu/os 约束 ✓，入库；`npm/*/index.*.node` gitignore）。
- **P-WX06（dry-run 连通）**：`napi prepublish --tag-style npm --dry-run` 校验逻辑实证——缺平台报错按平台序推进（拷入 darwin-arm64 后报 darwin-x64 missing）；全绿需 CI 产物汇聚。
- **napi-release.yml**：tag（`wxml-parser-napi-v*`）→ 五平台 matrix（R1-F3：darwin-x64 = macos-arm64 + `--target x86_64-apple-darwin`；linux-arm64 = `ubuntu-24.04-arm`）→ artifacts → prepublish → 子包→主包 publish（需 `NPM_TOKEN` secret）。
- **P-WX05**：parser 两 crate 语义零 diff（仅 napi 版本号 + Cargo.lock）；`fe/packages` 零 diff。

### 环境级发现：P-WX01 blocked-on-env（2026-09-15）

**fork（foolishchow/dimina）的 GitHub Actions 未启用**（fork 默认禁用）：
- `gh run list -R foolishchow/dimina` **零 runs**（含 main——历史上从未运行过）；
- 显式 dispatch → 403（PAT 亦无 Actions 写权限）；
- push 到 feature 分支从未触发（此前 `gh run list` 看到的历史全是 upstream didi/dimina 的——gh 多 remote 默认解析到 upstream）。
**解锁路径**：用户在网页 `Settings → Actions → General → Allow all actions`（一次性）；或声明 CI 绿以 didi 侧回流 PR 运行为准（Uncovered）。P0/P1 的 CI 改动正确性由本地等价验证背书（darwin 全链 + linux 侧 build script 三态经 napi CLI 机制保证）。

### Pre-existing（非本门，2026-09-15 发现）

`dimina-wxml-parser` crate：`wxml_parses_template_name_before_is` 失败（`<template name is>` 双属性 → `UnclosedTag`）——**基线 `3ff54de3` 上同样失败**（stash + worktree 双证），与 napi3 升级无关；属 parser 语义 bug，另行处理（TODO）。

### P0 独立复验（2026-09-15 · 交付 `c2d792de` 提交前）

- `pnpm build` 幂等（增量 2.33s）；产物 `index.darwin-arm64.node` + 空 `index.d.ts`（已 gitignore）；`binding.js` 确未生成（与上根因一致）。
- parse 冒烟 + `_nativeForTest()` 加载 ✓；全量 **580/580**（79 files）。
- 消融：`mv index.darwin-arm64.node` → bundler-session 编译视图/项目全炸（`expects index.darwin-arm64.node` 新文案）→ 恢复 27/27 ✓。
- `git ls-files` 终态 = `index.js` + `package.json`（无任何 `.node`）✓。
