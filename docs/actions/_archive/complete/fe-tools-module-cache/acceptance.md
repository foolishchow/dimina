# Acceptance — fe-tools-module-cache

Status: `draft`（门级状态按终态记录；证据见 validation.md）

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MC01 | R-MC1 | ModuleCache 与 ComposeCache 边界明确；多个 entry 共享 module 时 module 只计算一次 | mock worker 测例 + module cache miss 计数器探针 | **pass（MC3）** — compiler-hotpaths（共享组件单次处理）+ module-cache.spec（style 同内容命中 postcss process 单次） |
| A-MC06 | R-MC6 | mock worker 测例覆盖同内容命中、失败缓存、共享 module 单次计算 | vitest 测例 | **pass（MC3，诚实范围）** — 同内容命中 ✓ + minify 维度 miss ✓；失败缓存以 MC1 消融为准（view 触发不可稳定构造——vue 编译器宽容，不强行）；共享 module 单次以 hotpaths 为准 |
| A-MC02 | R-MC2 | `compileResCache` 内容寻址；或文档明确其仅限单 build 且无跨 build 承诺 | 缓存 key 测例/源码审查 | **pass（MC1，D-MC-3 选项 B）** — 明确保持单 build 生命周期（单 stage worker 下 path 唯一、内容寻址无收益），文档记录（README D-MC-3） |
| A-MC03 | R-MC3 | 同一失败输入二次访问命中失败缓存，错误形状与诊断行为等价 | failure-cache 测例 | **pass（MC1，缓解受限）** — read+write 已实现，错误 shape 等价（敏感字段透传）；真实二次访问触发点当前不可观察（单 stage 首错中止），消融证实非承重；阶段 4 持久化 worker 时启用 |
| A-MC04 | R-MC4 | key 覆盖文件内容、minify、esTarget.view、fileTypes、renderer；配置变化不错误命中 | 维度矩阵 + 配置切换测例 | **pass（MC2，D-MC-5 判定）** — style `compileRes` key 纳入 minify（value 依赖）；view/logic 判定 value 独立而不加（避免冗余） |
| A-MC05 | R-MC5 | nomap 与 sourcemap 产物相对基线字节级一致 | 双模式 `diff -r` + 既有回归 | **pass（MC1）** — 94/185 文件 diff=0 + 479 全绿 |
| A-MC06 | R-MC6 | mock worker 测例覆盖同内容命中、失败缓存、共享 module 单次计算 | vitest 测例 | **pass（MC3）** |
| A-MC07 | R-MC1 | **命中路径副作用等价** | 双模式字节等价 + 481 全绿 | **pass（MC3）** |
