# Requirements — es-target-unification（切片：仅 logic）

> 本门 Readiness 冻结切片为 **仅 logic 车道收敛**。不含 `esTarget.view` 抬升；无 WebView/Harmony 矩阵前置。

## R-001（MUST）logic 车道统一读 `esTarget.logic`

`logic-compiler` 内所有会设定 JS transform/`esbuild` `target` 的路径（含 **单模块 CJS** 与 **bundle minify**）一律读取 `compileConfig.esTarget.logic`（或等价的 `activeCompileConfig.esTarget.logic`）。禁止残留字面量 `'es2020'` / `'es2023'` 作为 logic 变换 target（注释与测试除外）。

## R-002（MUST）缺省配置值不变

不改 CF-1 缺省：`esTarget.logic = 'es2023'`，`esTarget.view = 'es2020'`。不引入顶层标量 `esTarget`。

## R-003（MUST）不改 view 车道

本门不修改 `view-compiler` 的 target 接线；不改变 `esTarget.view` 缺省或语义。logic 与 view 允许不同值。

## R-004（MUST）不改配置框架形状

不改 CF-1 `resolveCompileConfig` 的字段集合与合并优先级（除为规格服务的非行为注释外）。不改 CF-2 platform / `sourcemapStrategy` 行为。

## R-005（MUST）产物边界

- **view / style 产物**：相对本门实施前基线，缺省 build **逐字节一致**（本门零触达）。
- **logic 产物**：允许因 CJS 路径从硬编码 `es2020` 改为读 `esTarget.logic`（缺省 `es2023`）产生差异；须在 validation 记录是否 diff=0 及差异范围。
- 覆盖 `options.esTarget.logic = 'es2020'` 时，CJS 路径须使用 `es2020`（可观测：规格或相对「硬编码时代」的对照）。

## R-006（MUST）`build()` 公开契约不变

签名、返回值、结构化错误契约不变；`options.esTarget` 行为与 CF-1 一致（本门只消除 logic 内硬编码漂移）。

## R-007（MUST）规格全绿 + 可消融

全量 compiler 测试全绿；至少一条规格锁定「CJS 路径读 `esTarget.logic`」。消融（Experience-Review §6）：恢复 CJS 硬编码 `es2020`（或去掉对 `esTarget.logic` 的读取）→ 该规格预期失败；补丁不入库。

## R-008（MUST）RFC / 文档回写

闭合时回写 RFC：明确 logic 车道已无硬编码漂移；重申双字段与「不强制 logic===view」；标注 view 抬升不在本切片。

## Non-scope

- 抬高 `esTarget.view` / WebView 兼容性矩阵（另切片或后续 Action）
- platform 语义（CF-2 complete）
- 配置文件、性能优化、改 `build()` 签名
- 强制 `esTarget.view === esTarget.logic`
