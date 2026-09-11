# Acceptance — fe-tools-module-cache

Status: `draft`（门级状态按终态记录；证据见 validation.md）

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MC01 | R-MC1 | ModuleCache 与 EntryCache 边界明确；多个 entry 共享 module 时 module 只计算一次 | mock worker 测例 + key/调用计数审查 | pending |
| A-MC02 | R-MC2 | `compileResCache` 内容寻址；或文档明确其仅限单 build 且无跨 build 承诺 | 缓存 key 测例/源码审查 | pending |
| A-MC03 | R-MC3 | 同一失败输入二次访问命中失败缓存，错误形状与诊断行为等价 | failure-cache 测例 | pending |
| A-MC04 | R-MC4 | key 覆盖文件内容、minify、esTarget.view、fileTypes、renderer；配置变化不错误命中 | 维度矩阵 + 配置切换测例 | pending |
| A-MC05 | R-MC5 | nomap 与 sourcemap 产物相对基线字节级一致 | 双模式 `diff -r` + 既有回归 | pending |
| A-MC06 | R-MC6 | mock worker 测例覆盖同内容命中、失败缓存、共享 module 单次计算 | vitest 测例 | pending |
