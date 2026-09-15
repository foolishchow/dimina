# Implementation Plan — fe-tools-wxml-parser-dist

Status: **ready（2026-09-15）** — P0→P1 顺序；P0 独立可交付（止血 + 最小加载不等 P1）。

## 基线与纪律

- 授权时记录 HEAD；`fe/packages` 零触碰；parser 两 crate 零语义改动。
- D-WX-1..9 冻结；P0 交付后 CI 绿即止血完成，P1 另行推进（同 Action 内两门）。

## P0 触达序（止血 + 退 git + 跨平台 build + 最小加载）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `wxml-parser-napi/package.json` | devDep `@napi-rs/cli`；`build` → `napi build --platform --release --js binding.js --format esm --manifest-path ../crates/Cargo.toml --package dimina-wxml-parser-napi --output-dir .`（**无 `--no-dts`**）；`napi` 配置块（host target 先行）；pnpm install |
| 2 | `wxml-parser-napi/index.js` | **P0 最小加载（F-R2-001，与 step1 同交付）**：`createRequire` 加载 `./index.<platform>.node`（napi-rs 三元组映射）；包装面零改；**不**接 `binding.js` 子包回退。生成的 `binding.js` 可先入库（P1 再用） |
| 3 | 本地验证 | `pnpm build` 产 `index.<platform>.node` + `binding.js`；手写 `index.js` 未被覆盖；vitest 冒烟（bundler-session）；`import('@dimina/wxml-parser-napi')` + parse 冒烟 |
| 4 | `.node` 退 git | `git rm --cached index.node`（及误入的 `index.*.node`）；`.gitignore` 加 `*.node`（**F-R2-003**；`binding.js`/`index.js` 仍追踪）；再跑 step3 证 dev 流成立 |
| 5 | `.github/workflows/fe-tests.yml` | **显式 `dtolnay/rust-toolchain@stable`（R1-F2）** + rust cache（`~/.cargo/registry` + `crates/target`，键=Cargo.lock）+ `Build wxml-parser-napi` 步骤（单 job，D-WX-8） |
| 6 | 验证 | push 后 Actions 全绿（commit 锚定）；首次全量编译分钟数记录 |
| 7 | 消融 | 本地移走 `index.<platform>.node`（模拟 CI 前）→ vitest 编译视图全炸（已证模式）；恢复 → 绿 |

## P1 触达序（矩阵 + 子包 + 双态 + 发版流）

| Step | 文件 | 动作 |
| --- | --- | --- |
| 1 | `wxml-parser-napi/package.json` | `napi.targets` = 五平台；解除 `private`；`files` 面定稿 |
| 2 | `.github/workflows/napi-release.yml`（新） | tag（`wxml-parser-napi-v*`）触发 5 平台 matrix 构建 + artifacts 汇聚 + `napi prepublish`。**R1-F3**：`darwin-x64` = `macos-latest(arm64) + --target x86_64-apple-darwin`（不依赖退役中的 Intel runner）；`linux-arm64` = `ubuntu-24.04-arm` 或 `--use-napi-cross`。**R1-F7**：首步以 `napi --help` 校准 `artifacts`/`prepublish` 命令形态 |
| 3 | `index.js` | **扩展为完整双态**（P0 已有本地平台后缀加载）：本地 `./index.<platform>.node` 优先 → `binding.js`（CLI 平台检测子包）→ 延迟抛错；`_resolveNative()` 可测钩；单测三态落 bundler `__tests__/wxml-parser-loader.spec.js`（**R1-F6**） |
| 4 | 本地验证 | 双态实证：有本地平台后缀 `.node` 用本地；移走后走子包路径（本地无子包时按检测逻辑断言）；皆无 → 抛错文案 |
| 5 | dry-run | `npm publish --dry-run` 主包 + `napi prepublish --dry-run` 子包结构/files 正确 |
| 6 | 验证 | 首次真实 tag 发布（或标注推迟，记录原因）；发布后 `WXML_PARSER=napi` 跨平台安装冒烟 |

## 门禁

| 门 | Gate |
| --- | --- |
| P0 | CI Actions 全绿（run 锚定）；`*.node` 不在 git；build 产平台后缀产物；**最小加载**可用；本地 `pnpm build` → vitest 全绿 |
| P1 | 五子包结构 + optionalDependencies + 双态解析实证 + dry-run 通过；parser crates 零 diff |

## 不做（本 Action）

- wasm/web target（TODO 观察项）；musl/长尾平台；parser 语义/性能；`fe/packages`；fe-tests 之外改测试协议