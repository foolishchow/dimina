# Acceptance — fe-tools-module-cache

Status: `draft`（门级状态按终态记录；证据见 validation.md）

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MC01 | R-MC1 | ModuleCache 与 EntryCache 边界明确；多个 entry 共享 module 时 module 只计算一次 | mock worker 测例 + module cache miss 计数器探针（worker 内计数，非侵入式，与 Readiness gap 2 对齐） | pending |
| A-MC02 | R-MC2 | `compileResCache` 内容寻址；或文档明确其仅限单 build 且无跨 build 承诺 | 缓存 key 测例/源码审查 | pending |
| A-MC03 | R-MC3 | 同一失败输入二次访问命中失败缓存，错误形状与诊断行为等价 | failure-cache 测例 | pending |
| A-MC04 | R-MC4 | key 覆盖文件内容、minify、esTarget.view、fileTypes、renderer；配置变化不错误命中 | 维度矩阵 + 配置切换测例 | pending |
| A-MC05 | R-MC5 | nomap 与 sourcemap 产物相对基线字节级一致 | 双模式 `diff -r` + 既有回归 | pending |
| A-MC06 | R-MC6 | mock worker 测例覆盖同内容命中、失败缓存、共享 module 单次计算 | vitest 测例 | pending |
| A-MC07 | R-MC1 | **命中路径副作用等价**：templateRenderCache 命中时 `scriptRes` 登记与未命中等价（wxs 模块登记完整，无遗漏/重复）——MC1 拆缓存结构时保护此跨路径行为 | 测例：命中/未命中两路径 scriptRes 内容一致 | pending |
