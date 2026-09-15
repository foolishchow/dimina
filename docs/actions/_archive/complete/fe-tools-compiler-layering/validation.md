# Validation — fe-tools-compiler-layering

Status: **in_progress（2026-09-15）** — P-CL00..06；**基线 = `5c4ce74f`**；Result 届时回填

| ID | Check | Command / method | Maps to | Result |
| --- | --- | --- | --- | --- |
| P-CL00 | dist 镜像同步前置 | `node scripts/sync-dist-from-src.js`（对拍 / CLI 前必须） | 前置 | ✓（见 Actual）|
| P-CL01 | 目录结构 | `ls -R src/compiler/` 对照 README 结构图（view/logic/style/core/pipeline 全部存在；原平铺文件消失） | A-CL0 | ✓（见 Actual）|
| P-CL02 | 函数穷举 | 新位置 `grep -c '^function\|^async function'` 合计 = **61**；原 view-compiler.js 不存在；抽样 3 函数 diff 逐字一致 | A-CL1 | ✓（见 Actual）|
| P-CL03 | worker spawn | `grep WORKER_ENTRY pipeline/stage-channel.js` 存在映射；`grep -rln 'view-compiler\|logic-compiler\|style-compiler' __tests__/` 零命中 | A-CL2 | ✓（见 Actual）|
| P-CL04 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | A-CL3 | ✓（见 Actual）|
| P-CL05 | 行为 0 | 基线 vs HEAD（base 工程），`diff -rq --exclude='*.map'` + `diff -rq`（sourcemap）均 = 0 | A-CL3 | ✓（见 Actual）|
| P-CL06 | diff 范围 | `git diff --stat`：仅 rename + import 行 + stage-channel WORKER_ENTRY；无函数体变更 | A-CL4 | ✓（见 Actual）|

## 验证纪律

- 纯移动 Action 无消融——归属表穷举（P-CL02）+ diff=0（P-CL05）+ 全量绿（P-CL04）为完整证据链
- dist 同步前置照搬（P-CL00）
- `fe/packages` 零触碰由 P-CL06 的 diff 范围隐含

## Uncovered（闭合时声明）

- 真机 / 预览冒烟——非 MUST（纯移动不改行为，vitest + 产物对拍充分）
- worker 并发压测——非本门（协议未动）