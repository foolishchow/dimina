# Acceptance — fe-tools-bundler-typecheck

Status: **冻结（随 Action `ready`）** — 实施后回填 Actual。

| ID | Req | Criterion | Evidence | Status |
| --- | --- | --- | --- | --- |
| A-TC0 | R-TC0 | tsconfig + `typecheck` 存在；`fe-tests.yml` 跑 bundler `tsc --noEmit` 且失败阻断；`strict: true`；typescript 在 bundler devDep | P-TC00/P-TC01 | pending |
| A-TC1 | R-TC1 | S1 白名单七路径均有 `// @ts-check`；集中 typedef（D-TC-10）；`tsc --noEmit` 0 error | P-TC02/P-TC03 | pending |
| A-TC2 | R-TC2 | vitest 全绿；packages 零 diff；相对基线产物+sourcemap **diff=0** | P-TC04/P-TC05 | pending |
| A-TC3 | R-TC3 | include 不含 session/model/watch/dev；S3 重灾区未被迫本门全绿；registry 不以 vue/index 为类型源 | P-TC06 | pending |
| A-TC4 | R-TC4 | 消融有效；architecture-notes 短回流 | P-TC07 | pending |

## Non-acceptance

- 整仓 `.ts` 迁移；sync-dist → tsc emit；S2/S3 全量 check 绿；语义/产物变更。
