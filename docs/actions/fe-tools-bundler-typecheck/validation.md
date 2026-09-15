# Validation — fe-tools-bundler-typecheck

Status: **冻结（随 Action `ready`）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-TC00 | typecheck 本地 | `cd fe/tools/bundler && pnpm typecheck`（`tsc --noEmit`）exit 0 | A-TC0/A-TC1 | pending |
| P-TC01 | CI 接线 | `.github/workflows/fe-tests.yml` 含 bundler typecheck 步骤；故意破坏类型 → 本地 `tsc` 非 0（CI 步骤可对照） | A-TC0 | pending |
| P-TC02 | 白名单标记 | `rg -l "// @ts-check"` 覆盖 R-TC1 七路径；存在集中 typedef（LoadedGraph/WxmlRenderer）；registry **无** `import('./vue/index.js').WxmlRenderer` 类型权威引用 | A-TC1/A-TC3 | pending |
| P-TC03 | 无全量 checkJs | tsconfig `checkJs` 为 false；`strict` 为 true | A-TC0/A-TC1 | pending |
| P-TC04 | packages | `git diff --stat -- fe/packages` 空 | A-TC2 | pending |
| P-TC05 | 回归 + 行为 0 | sync-dist + 全量 vitest；相对基线 nomap+sm `diff -rq` = 0（`examples/miniprogram/base`） | A-TC2 | pending |
| P-TC06 | 范围 | `tsconfig` include 无 session/model/watch/dev；`view/index.js` / `vue/index.js` 无本门强制 `@ts-check` | A-TC3 | pending |
| P-TC07 | ablation | 白名单文件故意破坏一处已声明类型 → `tsc --noEmit` 非 0；恢复后 0 | A-TC4 | pending |

## Diff scope

`fe/tools/bundler/tsconfig.json`、`package.json`（script/devDep）、S1 白名单及集中 typedef、`.github/workflows/fe-tests.yml`、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

S2/S3 check、编辑器以外的全量 JS 推理、跨平台 napi、预览/真机。

## Actual

- **实施起点 HEAD**：`8b024b78`（`docs(actions): archive fe-tools-wxml-layout as complete`；授权 `in_progress` 2026-09-15）
- 证据回填：（S0–S1 完成后填写；绑定交付 commit SHA）
