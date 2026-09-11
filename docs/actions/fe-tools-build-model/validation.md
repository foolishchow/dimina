# Validation — fe-tools-build-model

Status: `draft` — fill when implementing.

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`。消融记录另设段落（四要素）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-BM01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | pending |
| P-BM02 | 字节等价（M1） | 改造前 HEAD vs 改造后：`git worktree add /tmp/bm-baseline <改造前 commit>`（或 `git archive <commit>` 解包到临时目录）提取旧版 bundler；base 示例 build，nomap 与 `--sourcemap` 双模式 `diff -r` 均为 0 | pending |
| P-BM03 | 正常路径零写盘 | 正常构建路径（collectOutput=true）worker 不执行 `writeFileSync`（源码审查 if(collectOutput) 分支内无写盘）；兼容分支保留（grep writeFileSync 命中处均在 else 路径） | pending |
| P-BM04 | 指纹单测 | `(mtime, size)` 未变跳 hash / 内容变化（同 mtime 不同 size）必算 hash / include 聚合稳定 / scan 纯函数性质 | pending |
| P-BM05 | watch 增量对拍 | 变更单文件 → 仅受影响 Entry 重编译（观察重编译日志/产物 mtime）；合并事件（快速连改）不再全量 | pending |
| P-BM06 | diff 范围 | 三不动清单（transform 内部 / env.js / 上下文协议段）零改动；worker 协议仅增产物字段 | pending |
| P-BM07 | dev 相邻回归 | dev 冒烟：`node src/bin/index.js dev` + 文件变更 → HTTP reload 时点断言（BUNDLE_PUBLISHED → reload），既有 dev specs 全绿 | pending |
