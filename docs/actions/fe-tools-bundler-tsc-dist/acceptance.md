# Acceptance — fe-tools-bundler-tsc-dist

Status: **冻结（随 Action `ready`）** — 实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-TD0 | R-TD0/R-TD0a | build 以 tsc emit 产出 dist JS；`sync-dist-from-src` 已删；postbuild 保留；typecheck CI 仍必过；**T0 前置修复落地**（TS5055 消除；npm build/test 均绿） | P-TD00/P-TD01/P-TD07/P-TD08 | pending |
| A-TD1 | R-TD1 | 类型模块为 `.ts`；权威为 `type`/`interface` | P-TD02 | pending |
| A-TD2 | R-TD2 | registry/stub/compile-target/parity 为 `.ts` | P-TD02 | pending |
| A-TD3 | R-TD3 | vitest 绿；packages 空；示例产物 diff=0 | P-TD03/P-TD04 | pending |
| A-TD4 | R-TD4 | 未迁 view/index、vue/tools；第2刀未塞入；绿场政策成文 | P-TD05 | pending |
| A-TD5 | R-TD5 | 消融有效；architecture-notes 回流 | P-TD06 | pending |

## Non-acceptance

- compiler/view 全量 `.ts`；第2刀 document/ops/load 本门 MUST；declaration 包面；应用产物语义变更。
