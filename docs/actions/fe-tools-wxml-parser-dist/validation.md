# Validation — fe-tools-wxml-parser-dist

Status: **冻结（随 Action `ready`）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-WX00 | build 跨平台 | `cd fe/tools/wxml-parser-napi && pnpm build`（napi CLI `--platform` 路线乙）；产物 `index.<platform>.node` + `binding.js`（ESM）就位且手写 `index.js` 未被覆盖；**P0 验 darwin（本地）+ linux（CI）**，win32 真验归 P1 matrix（**R1-F5 限定**） | A-WX0 | pending |
| P-WX01 | CI 绿 | push 后 fe-tests Actions 全绿；首次全量 Rust 编译分钟数记录；cache 命中增量对比（第二次 push） | A-WX0 | pending |
| P-WX02 | 退 git + dev 流 | `git ls-files` 无 `index.node`；本地 `pnpm build` → vitest 全绿（580）；`mv index.node` → 编译测试炸（延迟抛错文案）→ 恢复绿 | A-WX1 | pending |
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

（实施后填写；绑定 commit SHA + Actions run）