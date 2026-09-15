# Implementation Plan — fe-tools-bundler-typecheck

Status: **`in_progress`** — S0→S1；行为 0。

## 基线与纪律

- 实施起点 HEAD 记入 validation Actual；`fe/packages` 零触碰。
- D-TC-1..10 冻结；与 `fe-tools-incremental-target` 分 PR（Experience §8）。

## 建议顺序

1. **S0**：添加 `tsconfig.json`（§2）、`typescript` devDep（D-TC-8）、`typecheck` script；改 `.github/workflows/fe-tests.yml`（D-TC-9）；确认近空 check 下 `tsc --noEmit` 绿。
2. **S1 typedef**：集中 `Document` / `LoadedGraph` / `WxmlRenderer` / CompileTarget 相关类型（D-TC-10）；registry 脱离 `vue/index.js` 类型源。
3. **S1 开 check**：白名单七文件加 `// @ts-check`；修类型错误至绿（无行为改动）。
4. **回归**：sync-dist + 全量 vitest + 相对基线产物对拍（MUST diff=0）。
5. **消融** + architecture-notes 短回流；回填 acceptance/validation。

## 门禁

| 门 | Gate |
| --- | --- |
| S0 | typecheck 脚本 + fe-tests.yml 可跑且必过；tsconfig 符合 D-TC-1..4/7 |
| S1 | 白名单 `@ts-check`；集中 typedef；`tsc --noEmit` 0 error；行为 0 / 消融 / 回流 |
