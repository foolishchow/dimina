# Requirements — compiler-hook-layer

## R-001（MUST）生命周期事件按文档顺序触发

每次 `build()` 调用（全量、`stages` 过滤、小游戏）都按 [technical-design](technical-design.md) 定义的事件序列触发：init 系事件先于 stage 系，stage 系先于 publish/结束事件；`build:error` 只在失败路径出现且随后以现有错误对象 reject。

## R-002（MUST）stage 并发语义不变

view / logic / style 仍通过 worker 池并发执行；生命周期引入不得将三阶段串行化。stage 事件的完成顺序允许交错，但全部完成必须先于 `bundle:published`。

## R-003（MUST）`build()` 公开契约不变

签名 `build(targetPath, workPath, useAppIdDir, options)`、返回值结构（`appId/name/path/dependencyGraph`）、结构化错误（`name/message/stack/file/line/column/stage`）与现有行为完全一致（`build-error-contract.spec.js` 等既有规格锁定）。

## R-004（MUST）产物字节级一致

对同一输入，改造前后产物（含 `.map`——本 Action 不触碰 sourcemap 实现）逐字节一致。

## R-005（MUST）监听器错误隔离

任一监听器抛错或 reject 不得使构建失败、不得改变产物与事件流（隔离错误需可观察：收集进构建日志/结果供诊断，语义见 technical-design）。

## R-006（SHOULD）事件载荷可序列化且只读

载荷仅含可 JSON 序列化数据（字符串/数字/布尔/数组/普通对象），监听器不得通过载荷改变构建行为（为 D5「AST 不跨边界、可序列化」约束预留一致性）。

## R-007（MUST）仅内部暴露

生命周期 API 不进入 `package.json` `exports`，不构成公开承诺；消费方限：编译器内部、测试、后续 A2/A4（经内部路径引入）。

## R-008（MUST）既有规格全绿

55 个既有 spec 全部通过；新增规格覆盖事件顺序（R-001）、并发不串行（R-002）、错误隔离（R-005）。

## Non-scope

见 [README](README.md) Non-goals；非目标整体继承 RFC §1.2。
