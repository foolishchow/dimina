# Validation — fe-tools-bundler-layout

Status: `complete`（2026-09-12）

基线：`85ebb05a`（layout ready；实施前 HEAD）

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-BL01 | 全量回归 | `npm test` in `fe/tools/bundler`（vitest `--no-file-parallelism`） | **pass** — 72 files / **481** tests passed（2026-09-12） |
| P-BL02 | 字节等价 | 基线 `85ebb05a` `git archive` vs 工作树；`examples/miniprogram/base`；`diff -rq` | **pass MUST** — nomap **94** 文件 diff exit=0；**SHOULD** sourcemap **185** 文件 diff exit=0 |
| P-BL03 | exports | `npm run build` → postbuild `check-package-exports` | **pass** — Validated 6 ESM exports + dimina-cli；`./view|logic|style-compiler` → `dist/compiler/*` |
| P-BL04 | CLI 冒烟 | `node dist/bin/index.js build|dev` on `examples/miniprogram/base` | **pass** — build exit 0（94 files）；dev `preview at http://127.0.0.1:41891`，HTTP GET `/` **200**（3457B），SIGINT 退出 |
| P-BL05 | 目录口诀 | listing | **pass** — `dev/dev-server.js` 存在；`session/` 无 `dev-server`；`model/build-model.js`；无 `common/` / `core/`；`compiler/env.js` |
| P-BL06 | diff 范围 | 搬家 + import + exports 路径；无算法大改 | **pass** — 仅路径/目录/注释/exports；compilers 逻辑未改 |

消融：纯搬家可不做机制消融；L2 删垫片后 P-BL01 仍绿。
