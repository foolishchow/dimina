# Validation — fe-tools-bundler-tsc-dist

Status: **冻结（随 Action `ready`）** — 实施后回填 Result。

权威参考：[Experience-Review.md](../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-TD00 | build + load | `pnpm --filter @dimina/bundler build`（tsc emit + postbuild）；node 可 import `dist/index.js` / 关键迁徙模块；`sync-dist-from-src` 脚本不存在或不再被 build 调用 | A-TD0 | pending |
| P-TD01 | typecheck | `pnpm --filter @dimina/bundler typecheck` exit 0；`tsconfig.json` include 覆盖全 `src/` 且 `checkJs` false；fe-tests.yml 仍含 typecheck | A-TD0 | pending |
| P-TD02 | 迁徙树 | 第0/1刀目标路径存在为 `.ts`；对应旧 `.js` 权威源码不在 `src`；`rg` 无误引用 | A-TD1/A-TD2 | pending |
| P-TD03 | packages | `git diff --stat -- fe/packages` 空 | A-TD3 | pending |
| P-TD04 | 行为 0 | **tsc build** 后 vitest 全量；相对基线 `examples/miniprogram/base` nomap+sm `diff -rq` = 0 | A-TD3 | pending |
| P-TD05 | 范围 | `view/index.js`、`vue/tools.js` 仍为 `.js`；无本门强制整文件迁 ts | A-TD4 | pending |
| P-TD06 | ablation | 去掉 build 中 tsc emit → dist 缺产物或入口失败；恢复后通过 | A-TD5 | pending |

## Diff scope

`fe/tools/bundler` 的 tsconfig/build 脚本、第0/1刀源码、消费方 import、CI（若需）、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

第2刀 document/ops/load；view/vue-tools 迁 ts；declaration 发布；预览/真机。

## Actual

（实施后填写；绑定 commit SHA）
