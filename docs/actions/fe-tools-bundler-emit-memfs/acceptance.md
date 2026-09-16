# Acceptance — fe-tools-bundler-emit-memfs

Status: **draft（立项 · 2026-09-16）** — 实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-MM0 | R-MM0 | 产物面出口边界定义完成；漏网点收口范围拍板 | P-MM0 | pending |
| A-MM1 | R-MM1 | dev 模式产物不落盘（memfs）；dev server 从内存直读 | P-MM1 | pending |
| A-MM2 | R-MM2 | 产物面目录归置完成（emit/output/cache 落位） | P-MM2 | pending |
| A-MM3 | R-MM3 | cache 的「家」拍板（仅决策，不实现） | P-MM3 | pending |
| A-MM4 | R-MM4 | build 模式产物 diff=0（行为 0）；vitest 全量绿；emit 层零改动 | P-MM4 | pending |

## Non-acceptance

- 刀 2 失效查询（DependencyGraph.getInvalidatedModules）——独立先行。
- 刀 3 ModuleCache 实现——本 Action 只拍「家」，实现另立。
- transform 粒度统一 / tree-shaking。
