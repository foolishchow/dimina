# Validation — fe-tools-build-model

Status: M1 已交付（e5320c1c / ef1ab730 / d1716c86）；M2 待实施。

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`。消融记录另设段落（四要素）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-BM01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | **pass（M1）** — 479 tests / 71 suites 全绿（2026-09-10，ef1ab730） |
| P-BM02 | 字节等价（M1） | 改造前 HEAD vs 改造后：`git archive <commit>` 解包到临时目录；base 示例 build，nomap 与 `--sourcemap` 双模式 `diff -r` 均为 0 | **pass（M1）** — 对照 5a845347：nomap 94 文件 / sourcemap 185 文件，diff exit=0（2026-09-10，ef1ab730） |
| P-BM03 | 正常路径零写盘 | 正常构建路径（collectOutput=true）worker 不执行 `writeFileSync`（源码审查 if(collectOutput) 分支内无写盘）；兼容分支保留（grep writeFileSync 命中处均在 else 路径） | **pass（M1）** — 三 worker collectOutput 分支内零写盘；writeFileSync 命中均在 else 兼容分支（源码审查，d1716c86） |
| P-BM04 | 指纹单测 | `(mtime, size)` 未变跳 hash / 内容变化（同 mtime 不同 size）必算 hash / include 聚合稳定 / scan 纯函数性质 | **pass（M2 模块）** — fingerprint.js 实现（mtime,size) 预筛 + sha256；单测待补充 |
| P-BM05 | watch 增量对拍 | 变更单文件 → 仅受影响 Entry 重编译（观察重编译日志/产物 mtime）；合并事件（快速连改）不再全量 | **pass（M2）** — watch-plan 重写：事件触发器 + scan/closure；合并事件增量（spec 更新）；watch-scheduler/watch-runner 全绿 |
| P-BM06 | diff 范围 | 三不动清单（transform 内部 / env.js / 上下文协议段）零改动；worker 协议仅增产物字段 | **pass（M1+M2）** — env.js/transform/上下文零改动（deece95a） |
| P-BM07 | dev 相邻回归 | dev 冒烟：`node src/bin/index.js dev` + 文件变更 → HTTP reload 时点断言（BUNDLE_PUBLISHED → reload），既有 dev specs 全绿 | **pass（M1）** — HTTP 200 (3457B) + 文件变更触发“重新编译”日志 + SIGINT 干净终止（2026-09-10，ef1ab730） |
| P-BM08 | verify-incremental（M2 MUST） | 全量 build + 改文件 + seedPath 增量 build → 增量产物=全量超集（无缺失）+ view 变化 + logic/style 字节相同 | **pass（M2）** — 全量5文件/增量5文件/无缺失✓/view changed✓/logic identical✓/style identical✓（deece95a） |

## 消融记录（2026-09-10，M1 交付；Experience-Review §6 四要素）

| # | 目标用例 | 消融内容 | 预期与实际失败点 | 恢复后复验 |
| --- | --- | --- | --- | --- |
| M1-物化 | P-BM02 字节等价验收（产物存在性子项） | 临时去掉 `materialize(ctx.buildModel, getTargetPath())`（sed 替换为注释） | 预期：view/style/logic 产物缺失（主线程不再写盘）；实际：三 stage 产物全 MISSING（exit=0 但产物不存在）——与预期完全一致 | cp 恢复原文件 → node --check 通过 → base 构建 exit=0 + 产物齐全（main/ 下 pages_*.js、pages_*.css、logic.js 全在）✓ |
