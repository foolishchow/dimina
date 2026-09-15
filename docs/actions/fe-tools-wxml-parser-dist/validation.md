# Validation — fe-tools-wxml-parser-dist

Status: **in_progress（P0 已交付 `c2d792de`）** — P-WX00/02 本地 pass；P-WX01 待 push 后 CI；P-WX03..07 P1。

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

### P0 独立复验（2026-09-15 · 交付 `c2d792de` 提交前）

- `pnpm build` 幂等（增量 2.33s）；产物 `index.darwin-arm64.node` + 空 `index.d.ts`（已 gitignore）；`binding.js` 确未生成（与上根因一致）。
- parse 冒烟 + `_nativeForTest()` 加载 ✓；全量 **580/580**（79 files）。
- 消融：`mv index.darwin-arm64.node` → bundler-session 编译视图/项目全炸（`expects index.darwin-arm64.node` 新文案）→ 恢复 27/27 ✓。
- `git ls-files` 终态 = `index.js` + `package.json`（无任何 `.node`）✓。
