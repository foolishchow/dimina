# Validation — fe-tools-bundler-tsc-dist

Status: **complete（2026-09-15）** — P-TD00..08 全 pass；证据见 Actual。

权威参考：[Experience-Review.md](../../../../Experience-Review.md)

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-TD00 | build + load | `pnpm --filter @dimina/bundler build`（tsc emit + postbuild）；node 可 import `dist/index.js` / 关键迁徙模块；**`node dist/bin/index.js --version` exit 0**（R1-F4：shebang + emit 后可执行）；`sync-dist-from-src` 脚本不存在或不再被 build 调用 | A-TD0 | ✓（见 Actual）|
| P-TD01 | typecheck | `pnpm --filter @dimina/bundler typecheck` exit 0；`tsconfig.json` include 覆盖全 `src/` 且 `checkJs` false；fe-tests.yml 仍含 typecheck | A-TD0 | ✓（见 Actual）|
| P-TD02 | 迁徙树 | 第0/1刀目标路径存在为 `.ts`；对应旧 `.js` 权威源码不在 `src`；`rg` 无误引用 | A-TD1/A-TD2 | ✓（见 Actual）|
| P-TD03 | packages | `git diff --stat -- fe/packages` 空 | A-TD3 | ✓（见 Actual）|
| P-TD04 | 行为 0 | **tsc build** 后 vitest 全量；相对基线 `examples/miniprogram/base` nomap+sm `diff -rq` = 0 | A-TD3 | ✓（见 Actual）|
| P-TD05 | 范围 | `view/index.js`、`vue/tools.js` 仍为 `.js`；无本门强制整文件迁 ts | A-TD4 | ✓（见 Actual）|
| P-TD06 | ablation | 去掉 build 中 tsc emit → dist 缺产物或入口失败；恢复后通过；**拔 D-TD-17 包名 import（回 6 级相对路径）→ dry emit 重现 TS5055** | A-TD5 | ✓（见 Actual）|
| P-TD07 | TS5055 前置（R1-F1） | T0a 后 `tsc -p tsconfig.build.json` **无 TS5055**、emit 文件数 = src 输入数（69 级）；`@dimina/wxml-parser-napi` 在 `dependencies` | A-TD0 | ✓（见 Actual）|
| P-TD08 | exports/compat 修复（R1-F2/F3） | `npm run build` exit 0（postbuild check-package-exports 过）；`npm test` pretest compat check 过（D-TD-19 热修后）；exports 子路径与 dist 实际结构一致或已删 | A-TD0 | ✓（见 Actual）|

## Diff scope

`fe/tools/bundler` 的 tsconfig/build 脚本、第0/1刀源码、消费方 import（含 `napi/parse.js` 包名化）、package.json（exports/deps）、`scripts/check-package-exports.js`、CI（若需）、Action 文档、`architecture-notes.md`；**`fe/packages` 零改动**。

## Uncovered

第2刀 document/ops/load；view/vue-tools 迁 ts；declaration 发布；预览/真机。

## Actual

- **基线**：`33bda111`（授权时 HEAD；D-TD-19 已先行合入）
- **交付链**：T0a `dd8d4698`（D-TD-17 包名化 + D-TD-18 exports 重映射）→ T0b `990a8b33`（build=tsc emit + sync-dist 删除）→ T1 `3774fd83`（types + 第 1 刀迁 .ts + **D-TD-20 后缀路线**）
- **P-TD00**：`npm run build` exit 0（tsc emit 68/68 与 src 精确同构；dist 72 = 68 + 4 postbuild sdk 资产）；`dist/index.js` / `dist napi/parse.js`（包名经 node_modules）加载 ✓；`node dist/bin/index.js --version` = 1.2.1；`sync-dist-from-src.js` 已删
- **P-TD01**：typecheck exit 0（include=全 `src/**`，checkJs:false）；fe-tests.yml typecheck 步骤保留
- **P-TD02**：六目标路径均为 `.ts`（registry/stub/compile-target/parity/wxml-ir.types/compile-target.types）；旧 `.js` 不在 src；无误引用
- **P-TD03**：`fe/packages` 零 diff
- **P-TD04**：npm test 整链 580/580（79 files）；基线 `33bda111`（sync 模型）vs HEAD（tsc emit）：nomap `diff -rq` **= 0**、sourcemap `diff -rq` **= 0**——行为 0
- **P-TD05**：`view/index.js`、`renderer/vue/tools.js`、`vue/index.js` 仍 `.js`；无整文件强迁
- **P-TD06 消融 ×2**：①build 去掉 tsc emit（noop）→ dist 缺产物 + 入口 `ERR_MODULE_NOT_FOUND`（目标断言失败 ✓）→ 恢复绿；②拔 D-TD-17（回 6 级相对 import）→ **TS5055 原样重现**（`Cannot write file .../wxml-parser-napi/index.js`）→ 恢复绿。补丁均未留存
- **P-TD07**：TS5055 消除（T0a 后 build 无 TS5055；emit 数 = 输入数 68）；`@dimina/wxml-parser-napi` 在 `dependencies`（workspace:*）
- **P-TD08**：`npm run build` exit 0（postbuild "Validated 6 ESM exports and the dimina-cli CLI"）；`npm test` pretest In sync ✓；exports 三子路径重映射至 layering 后路径（保守保留，未删）
- **实施期新决策 D-TD-20**（T1 撞墙催生，详见 README 修订记录）：显式 `.ts` 后缀 + `rewriteRelativeImportExtensions` + worker `--experimental-strip-types`（src 链注入）
- **dist 文本差异记录（D-TD-9 允许）**：emit 重排版（补分号等）非逐字节；验收锚定应用产物 diff=0（P-TD04 已证）