# Validation — fe-tools-bundler-tsc-dist

Status: **冻结（随 Action `ready`）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-TD00 | build + load | `pnpm --filter @dimina/bundler build`（tsc emit + postbuild）；node 可 import `dist/index.js` / 关键迁徙模块；**`node dist/bin/index.js --version` exit 0**（R1-F4：shebang + emit 后可执行）；`sync-dist-from-src` 脚本不存在或不再被 build 调用 | A-TD0 | pending |
| P-TD01 | typecheck | `pnpm --filter @dimina/bundler typecheck` exit 0；`tsconfig.json` include 覆盖全 `src/` 且 `checkJs` false；fe-tests.yml 仍含 typecheck | A-TD0 | pending |
| P-TD02 | 迁徙树 | 第0/1刀目标路径存在为 `.ts`；对应旧 `.js` 权威源码不在 `src`；`rg` 无误引用 | A-TD1/A-TD2 | pending |
| P-TD03 | packages | `git diff --stat -- fe/packages` 空 | A-TD3 | pending |
| P-TD04 | 行为 0 | **tsc build** 后 vitest 全量；相对基线 `examples/miniprogram/base` nomap+sm `diff -rq` = 0 | A-TD3 | pending |
| P-TD05 | 范围 | `view/index.js`、`vue/tools.js` 仍为 `.js`；无本门强制整文件迁 ts | A-TD4 | pending |
| P-TD06 | ablation | 去掉 build 中 tsc emit → dist 缺产物或入口失败；恢复后通过；**拔 D-TD-17 包名 import（回 6 级相对路径）→ dry emit 重现 TS5055** | A-TD5 | pending |
| P-TD07 | TS5055 前置（R1-F1） | T0a 后 `tsc -p tsconfig.build.json` **无 TS5055**、emit 文件数 = src 输入数（69 级）；`@dimina/wxml-parser-napi` 在 `dependencies` | A-TD0 | pending |
| P-TD08 | exports/compat 修复（R1-F2/F3） | `npm run build` exit 0（postbuild check-package-exports 过）；`npm test` pretest compat check 过（D-TD-19 热修后）；exports 子路径与 dist 实际结构一致或已删 | A-TD0 | pending |

## Diff scope

`fe/tools/bundler` 的 tsconfig/build 脚本、第0/1刀源码、消费方 import（含 `napi/parse.js` 包名化）、package.json（exports/deps）、`scripts/check-package-exports.js`、CI（若需）、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

第2刀 document/ops/load；view/vue-tools 迁 ts；declaration 发布；预览/真机。

## Actual

（实施后填写；绑定 commit SHA）