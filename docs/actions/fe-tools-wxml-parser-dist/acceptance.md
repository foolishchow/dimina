# Acceptance — fe-tools-wxml-parser-dist

Status: **冻结（随 Action `ready`）** — 实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-WX0 | R-WX0 | build 三态正确（napi CLI）；CI 构建步骤 + cache 在档；**Actions 全绿**（run 锚定） | P-WX00/P-WX01 | pending |
| A-WX1 | R-WX1 | `.node` 不在 git；`.gitignore` 生效；dev 前置成文（Rust + pnpm build）且本地流全绿 | P-WX02 | pending |
| A-WX2 | R-WX2 | 五平台子包 + 主包 `optionalDependencies` + 解除 private；发布工作流在档 | P-WX03 | pending |
| A-WX3 | R-WX3 | 双态解析（本地优先→子包→抛错）实证；bundler 零改动 | P-WX04 | pending |
| A-WX4 | R-WX4 | parser 两 crate 零 diff；vitest 全绿（CI 上跨平台真跑）；packages 零触碰 | P-WX05 | pending |
| A-WX5 | R-WX5 | 消融有效；dry-run/首版发布证据；回流（dev 前置 + 双态不变量） | P-WX06/P-WX07 | pending |

## Non-acceptance

- wasm/web 端 target（观察项）；musl 等长尾平台；parser 语义变更；真实多平台安装矩阵全验（首版发布后逐步）。