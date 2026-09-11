# Validation — fe-tools-build-model

Status: `draft` — fill when implementing.

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`。消融记录另设段落（四要素）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-BM01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | pending |
| P-BM02 | 字节等价（M1） | 改造前 HEAD vs 改造后：base 示例 build，nomap 与 `--sourcemap` 双模式 `diff -r` 均为 0 | pending |
| P-BM03 | worker 零写盘 | `grep -rn "writeFileSync" src/core/{view,logic,style}-compiler.js` 零命中（materialize 除外注释） | pending |
| P-BM04 | 指纹单测 | mtime 预筛跳 hash / include 聚合稳定 / scan 纯函数性质 | pending |
| P-BM05 | watch 增量对拍 | 变更单文件 → 仅受影响 Entry 重编译（观察重编译日志/产物 mtime）；合并事件（快速连改）不再全量 | pending |
| P-BM06 | diff 范围 | 三不动清单（transform 内部 / env.js / 上下文协议段）零改动；worker 协议仅增产物字段 | pending |
