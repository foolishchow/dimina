# Validation — fe-tools-bundler-typecheck

Status: **complete（2026-09-15）** — P-TC00..07 全 pass；A-TC0..4 全 pass；证据见 Actual。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-TC00 | typecheck 本地 | `cd fe/tools/bundler && pnpm typecheck`（`tsc --noEmit`）exit 0 | A-TC0/A-TC1 | **pass**（`./node_modules/.bin/tsc --noEmit` exit 0） |
| P-TC01 | CI 接线 | `.github/workflows/fe-tests.yml` 含 bundler typecheck 步骤；故意破坏类型 → 本地 `tsc` 非 0（CI 步骤可对照） | A-TC0 | **pass**（workflow 已加 `pnpm --filter @dimina/bundler typecheck`） |
| P-TC02 | 白名单标记 | `rg -l "// @ts-check"` 覆盖 R-TC1 七路径；存在集中 typedef（LoadedGraph/WxmlRenderer）；registry **无** `import('./vue/index.js').WxmlRenderer` 类型权威引用 | A-TC1/A-TC3 | **pass** |
| P-TC03 | 无全量 checkJs | tsconfig `checkJs` 为 false；`strict` 为 true | A-TC0/A-TC1 | **pass** |
| P-TC04 | packages | `git diff --stat -- fe/packages` 空 | A-TC2 | **pass** |
| P-TC05 | 回归 + 行为 0 | sync-dist + 全量 vitest；相对基线 nomap+sm `diff -rq` = 0（`examples/miniprogram/base`） | A-TC2 | **pass**（见 Actual） |
| P-TC06 | 范围 | `tsconfig` include 无 session/model/watch/dev；`view/index.js` / `vue/index.js` 无本门强制 `@ts-check` | A-TC3 | **pass** |
| P-TC07 | ablation | 白名单文件故意破坏一处已声明类型 → `tsc --noEmit` 非 0；恢复后 0 | A-TC4 | **pass**（见 Actual） |

## Diff scope

`fe/tools/bundler/tsconfig.json`、`package.json`（script/devDep）、S1 白名单及集中 typedef、`.github/workflows/fe-tests.yml`、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

S2/S3 check、编辑器以外的全量 JS 推理、跨平台 napi、预览/真机。

## Actual

- **实施起点 HEAD**：`8b024b78`（`docs(actions): archive fe-tools-wxml-layout as complete`；授权 `in_progress` 经 `332d769f`）
- **P-TC00**：`fe/tools/bundler` 本地 `tsc --noEmit` exit **0**（typescript ^7.0.2 devDep）
- **P-TC01**：`.github/workflows/fe-tests.yml` 增加 Typecheck bundler 步骤
- **P-TC02/03/06**：七文件 `@ts-check`；`wxml-ir.types.js` + `compile-target.types.js`；registry 类型源 = `wxml-ir.types.js`；`checkJs: false` / `strict: true`；未 check `view/index.js` / `vue/index.js`
- **P-TC04**：`fe/packages` 零 diff
- **P-TC05**：580/580；相对 `8b024b78` nomap 94/94 + sm 185/185 `diff -rq` exit **0**
- **P-TC07**：`registry` `Map<string, WxmlRenderer>`→`Map<string, number>` → tsc 非 0（TS2345/TS2322）；恢复后 tsc 0；补丁未留存
- **L2**：`architecture-notes` 已短回流类型门禁不变量
- **交付 commit SHA**：`eb3b2bc4`（S0–S1 实现；基线 `8b024b78`）
- **Close 复验（2026-09-15）**：typecheck exit 0（tsc 7.0.2）；vitest 580/580（79 files）；nomap 94/94 + sourcemap 185/185 `diff -rq` vs `8b024b78` exit 0——行为 0 复验通过
