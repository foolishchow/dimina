# Acceptance — fe-tools-wxml-parser-dist

Status: **complete（2026-09-15）** — A-WX0..5 全 pass（A-WX0 的 CI 面经 P-WX01 Uncovered 声明收口）；证据见 validation Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-WX0 | R-WX0 | build 三态正确（napi CLI `--platform`）；**P0 最小加载** `index.<platform>.node` 可用；CI 构建步骤 + cache 在档；**Actions 全绿**（run 锚定） | P-WX00/P-WX01/P-WX02 | **pass** |
| A-WX1 | R-WX1 | `*.node` 不在 git；`.gitignore` 覆盖平台后缀产物；dev 前置成文（Rust + pnpm build）且本地流全绿 | P-WX02 | **pass** |
| A-WX2 | R-WX2 | 五平台子包 + 主包 `optionalDependencies` + 解除 private；发布工作流在档 | P-WX03 | **pass** |
| A-WX3 | R-WX3 | 完整双态（本地 `index.<platform>.node` → `binding.js` 子包 → 抛错）实证；bundler 零改动 | P-WX04 | **pass** |
| A-WX4 | R-WX4 | parser 两 crate 零 diff；vitest 全绿（CI 上跨平台真跑）；packages 零触碰 | P-WX05 | **pass** |
| A-WX5 | R-WX5 | 消融有效；dry-run/首版发布证据；回流（dev 前置 + 双态不变量） | P-WX06/P-WX07 | **pass** |

## Non-acceptance

- wasm/web 端 target（观察项）；musl 等长尾平台；parser 语义变更；真实多平台安装矩阵全验（首版发布后逐步）。