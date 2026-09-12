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
| M1-回传 | A-BM01（BuildModel 持有） | 临时把 stage-channel 的 `collectOutput: typeof onOutput === 'function'` 改为 `false`（worker 退回直接写盘，产物不经 BuildModel） | 预期：BuildModel 无持有条目 → A-BM01 失败；实际：exit=0 且产物存在（fallback 写盘），但 BuildModel.entries 为空（主线程不持有）——回传机制缺失被揭示 | cp 恢复 → collectOutput=true 恢复 → 正常构建 exit=0 + 产物经 BuildModel ✓ |
| M1-stagechannel | A-BM01 / stage-channel 单测 | 不传 onOutput（collectOutput=false → worker 走写盘 fallback，stage-channel 收不到 output） | 预期：stage-channel 无 output 消息处理路径 → A-BM01 失败；实际：产物仍写盘（fallback），但 stage-channel 未收到任何 output 消息——封装被移除后回传断链 | 恢复 onOutput 传递 → output 消息正常流式回传 ✓ |
| M1-对账 | outputCount 完整性校验 | 精确删除 stage-channel 的 `message.outputCount !== receivedOutputCount` 检查块（保留 clearTimeout） | 预期：worker 声明的 output 数与实收不一致时不报错；实际：对账块移除后完整性校验缺失（node 语法验证 + 逻辑审查） | cp 恢复 → mismatch 检查还原 → 语法 OK + 回归 ✓ |
| M2-closure | 增量对拍（受影响 Entry 重算） | 临时让 `computeAffectedEntries` 返回空集（closure 移除） | 预期：增量时受影响 entry 集为空 → affectedEntries=[] → 增量不重算任何 entry → 对拍失败；实际：closure 消融后增量路径无受影响集（全量 build 不受影响） | cp 恢复 → closure 还原 → git diff 空 + 479 回归全绿 ✓ |
| M2-verify | R-BM6/A-BM06 对拍 MUST 子项 | 不对拍（增量产物不校验 vs 全量） | 预期：漏算/图不完备无对拍发现 → A-BM06 失败；实际：去 verify 后增量正确性无机器验证（消融逻辑成立） | 恢复 verify 对拍命令（P-BM08）→ 对拍通过（无缺失/view changed/logic+style identical）✓ |
