# Acceptance — fe-tools-build-model

Status: `draft`（M1/M2 分门验收；门级部分通过记门交付说明，不提前回写本表）

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-BM01 | R-BM1 | worker 产物经 postMessage 回传并被 BuildModel 持有；编译过程零 `writeFileSync`（worker 内） | 源码审查（grep worker 内 writeFileSync 零命中）+ 测例 | pending |
| A-BM02 | R-BM2 | materialize 为唯一写盘出口；产物与目录结构**字节级一致**（nomap + `--sourcemap` 双模式 diff=0，对照改造前 HEAD） | 双模式产物 diff + 完整回归套件通过（当时数量记入实施证据） | pending |
| A-BM03 | R-BM3 | 文件两层指纹（mtime 预筛 + hash）；Entry inputHash 聚合排序稳定 | 单测（mtime 未变跳 hash；include 链聚合） | pending |
| A-BM04 | R-BM4 | scan+closure 单实现服务 watch；**合并事件不再退全量**（行为改进，用例更新并记录）；未变 Entry 命中持有产物 | watch 集成测例（变更→仅受影响 Entry 重算）+ watch-plan.spec 更新记录 | pending |
| A-BM05 | R-BM5 | transform 内部 / env.js / 上下文协议段零改动 | diff 审查（三不动清单逐项） | pending |
| A-BM06 | R-BM6 | `--verify-incremental`（或等价）对拍：**M2 MUST 子项**，增量结果与全量 diff=0 | 对拍命令输出（M2 验收含此子项） | pending |
| A-BM07 | R-BM3 | **dev 链路相邻回归**：D1a 时序不回归（watcher.start → createServer → BUNDLE_PUBLISHED → reload 时点），发布时机可观察 | dev 冒烟：HTTP reload 时点断言 + 既有 dev specs（dev-server/dev-proxy/dev-host） | pending |
