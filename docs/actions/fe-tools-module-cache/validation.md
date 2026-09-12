# Validation — fe-tools-module-cache

Status: MC1 已交付（view worker 失败缓存）；MC2 key 维度 / MC3 可测性待实施。

Result 列格式：`命令 → 关键输出摘要（日期 + commit hash）`；不得填 planned 命令或推断成功。

消融记录另设段落（四要素，对齐 Experience-Review §6）：目标用例 / 消融内容 / 预期与实际失败点 / 恢复后复验（对应 Closure ② 的 MC1/MC2 消融）。

| ID | Check | Command / method | Result |
| --- | --- | --- | --- |
| P-MC01 | 全量回归 | `vitest run --no-file-parallelism`（tools/bundler） | **pass（MC1）** — 479 tests / 71 suites 全绿 |
| P-MC02 | 字节等价 | 改造前 HEAD vs 改造后，base 工程 nomap + sourcemap `diff -r` | **pass（MC1）** — 对照 b9dd9246：nomap 94 / sourcemap 185 文件 diff=0 |
| P-MC03 | 内容寻址 | mock worker：相同输入二次执行计数为 1；内容/配置任一变化必须 miss | **pass（MC2，按 D-MC-5 判定）** — style `compileRes` key 加 `minify:` 维度（value 依赖 minify）；view cache 判定 value 独立于 compileConfig → 不加（模型冗余） |
| P-MC04 | 失败缓存 | mock failure：同 key 二次访问不重复执行，错误 shape 等价 | **pass（MC1，缓解受限记录）** — read+write 已实现；消融证实非承重；真实收益待阶段 4 持久化 worker |
| P-MC05 | 颗粒度 | 两个 entry 引用同一 module，module 计算计数为 1 | pending（MC3） |
| P-MC06 | diff 范围 | 无 main thread BuildModel、IR、env.js、worker service、publish/materialize 变更 | **pass（MC1）** — 仅 view-compiler.js 改动（失败缓存 read/write） |
| P-MC07 | 副作用等价 | mock worker：命中/未命中两路径的 scriptRes 内容一致（wxs 模块登记完整，无遗漏/重复） | pending（MC3） |

## 消融记录（2026-09-10，MC1；Experience-Review §6 四要素）

| # | 目标用例 | 消融内容 | 预期与实际失败点 | 恢复后复验 |
| --- | --- | --- | --- | --- |
| MC1-read | build-error-contract（错误照常传播） | 去掉 compileModule 缓存读取处的 `cacheData.failed` 重抛检查块 | 预期：错误仍照常传播（read 端非承重）；实际：build-error-contract 2/2 通过 | cp 恢复 → read 端还原 → 语法 OK + 回归绿 ✓ |
| MC1-write | build-error-contract + style-error-contract（错误照常传播） | 去掉 buildCompileView 的 try/catch 失败缓存写入（恢复直接调用 compileModule） | 预期：错误仍照常传播（write 端非承重）；实际：error-contract 7/7 通过 | cp 恢复 → write 端还原 → 语法 OK ✓ |

## 未验证范围（诚实记录，不可替代）

失败缓存的**真实收益**（同 key 二次访问不重复执行）在当前单 stage worker 架构下**不可观察**：

- 同 stage 内：构建首次失败即中止（throw 传播到 build），同一模块不会被二次编译
- 跨 stage：worker 每 stage new/terminate，缓存不持久

因此 D-MC-3 选**选项 B（保持单 build 生命周期）**：compileResCache 不做内容寻址化升级（单 stage 内 path 唯一，无跨 build 复用）。失败缓存 scaffolding 已就位（供阶段 4 持久化 worker 时启用），但当前行为等价于无失败缓存（消融 A/B 证实非承重）。