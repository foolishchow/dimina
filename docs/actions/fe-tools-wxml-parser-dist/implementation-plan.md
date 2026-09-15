# Implementation Plan — fe-tools-wxml-parser-dist

Status: **ready 候选（2026-09-15）** — P0→P1 顺序；P0 独立可交付（止血不等 P1）。

## 基线与纪律

- 授权时记录 HEAD；`fe/packages` 零触碰；parser 两 crate 零语义改动。
- D-WX-1..8 冻结；P0 交付后 CI 绿即止血完成，P1 另行推进（同 Action 内两门）。

## P0 触达序（止血 + 退 git + 跨平台 build）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `wxml-parser-napi/package.json` | devDep `@napi-rs/cli`；`build` → `napi build --platform --release --js binding.js --format esm --no-dts --manifest-path ../crates/Cargo.toml`（**R1-F1 路线乙**：三文件分层，CLI glue 写 `binding.js` 不碰手写 `index.js`）；`napi` 配置块（host target 先行）；pnpm install |
| 2 | 本地验证 | `pnpm build` 产 `.node`；vitest 冒烟（bundler-session）；`node -e "import('@dimina/wxml-parser-napi')"` + parse 冒烟 |
| 3 | `.node` 退 git | `git rm --cached index.node`；包内 `.gitignore`；再跑 step2 证 dev 流成立 |
| 4 | `.github/workflows/fe-tests.yml` | **显式 `dtolnay/rust-toolchain@stable`（R1-F2）** + rust cache（`~/.cargo/registry` + `crates/target`，键=Cargo.lock）+ `Build wxml-parser-napi` 步骤（单 job，D-WX-8） |
| 5 | 验证 | push 后 Actions 全绿（commit 锚定）；首次全量编译分钟数记录 |
| 6 | 消融 | 本地拔 `.node`（模拟 CI 前）→ vitest 编译视图全炸（已证模式）；恢复 → 绿 |

## P1 触达序（矩阵 + 子包 + 双态 + 发版流）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `wxml-parser-napi/package.json` | `napi.targets` = 五平台；解除 `private`；`files` 面定稿 |
| 2 | `.github/workflows/napi-release.yml`（新） | tag（`wxml-parser-napi-v*`）触发 5 平台 matrix 构建 + artifacts 汇聚 + `napi prepublish`。**R1-F3**：`darwin-x64` = `macos-latest(arm64) + --target x86_64-apple-darwin`（不依赖退役中的 Intel runner）；`linux-arm64` = `ubuntu-24.04-arm` 或 `--use-napi-cross`。**R1-F7**：首步以 `napi --help` 校准 `artifacts`/`prepublish` 命令形态 |
| 3 | `index.js` | 双态（R1-F1）：本地 `./index.<platform>.node` 优先 → `require('./binding.js')`（CLI 平台检测子包）→ 延迟抛错；`_resolveNative()` 可测钩；单测三态落 bundler `__tests__/wxml-parser-loader.spec.js`（**R1-F6**） |
| 4 | 本地验证 | 双态实证：有本地 `.node` 用本地；改名后走子包路径（本地无子包时按检测逻辑断言）；皆无 → 抛错文案 |
| 5 | dry-run | `npm publish --dry-run` 主包 + `napi prepublish --dry-run` 子包结构/files 正确 |
| 6 | 验证 | 首次真实 tag 发布（或标注推迟，记录原因）；发布后 `WXML_PARSER=napi` 跨平台安装冒烟 |

## 门禁

| 门 | Gate |
| --- | --- |
| P0 | CI Actions 全绿（run 锚定）；`.node` 不在 git；build 三态正确；本地 dev 流（pnpm build → vitest 全绿） |
| P1 | 五子包结构 + optionalDependencies + 双态解析实证 + dry-run 通过；parser crates 零 diff |

## 不做（本 Action）

- wasm/web target（TODO 观察项）；musl/长尾平台；parser 语义/性能；`fe/packages`；fe-tests 之外改测试协议