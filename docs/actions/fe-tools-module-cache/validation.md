# Validation — fe-tools-module-cache

Status: `draft` — fill when implementing.

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`；不得填 planned 命令或推断成功。

消融记录另设段落（四要素，对齐 Experience-Review §6）：目标用例 / 消融内容 / 预期与实际失败点 / 恢复后复验（对应 Closure ② 的 MC1/MC2 消融）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-MC01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | pending |
| P-MC02 | 字节等价 | 改造前 HEAD vs 改造后，base 工程 nomap + sourcemap `diff -r` | pending |
| P-MC03 | 内容寻址 | mock worker：相同输入二次执行计数为 1；内容/配置任一变化必须 miss | pending |
| P-MC04 | 失败缓存 | mock failure：同 key 二次访问不重复执行，错误 shape 等价 | pending |
| P-MC05 | 颗粒度 | 两个 entry 引用同一 module，module 计算计数为 1 | pending |
| P-MC06 | diff 范围 | 无 main thread BuildModel、IR、env.js、worker service、publish/materialize 变更 | pending |
| P-MC07 | 副作用等价 | mock worker：命中/未命中两路径的 scriptRes 内容一致（wxs 模块登记完整，无遗漏/重复） | pending |
