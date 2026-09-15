# Requirements — fe-tools-bundler-typecheck

Status: **冻结（2026-09-15）** — D-TC-1..10 已拍板；随 Action `ready`。

## R-TC0（MUST）S0 脚手架

- 在 `fe/tools/bundler` 提供 `tsconfig`：`allowJs: true`、`noEmit: true`、`checkJs: false`、`strict: true`（D-TC-7）。
- `include` 覆盖 `src/compiler/**/*.js`（及本门为契约引入的 `*.d.ts` / `*.types.js`，若有）。
- `package.json` 提供 `typecheck` → `tsc --noEmit`；`typescript` 为 bundler **devDependency**，range 与 `fe/package.json` 对齐（D-TC-8）。
- **CI 必跑且失败即失败**：`.github/workflows/fe-tests.yml`（D-TC-9）。

## R-TC1（MUST）S1 白名单 check

以下文件（路径相对 `src/compiler/`）必须带 `// @ts-check`，且在 `tsc --noEmit` 下无 error：

| 路径 |
| --- |
| `view/wxml/common/document.js` |
| `view/wxml/common/document-ops.js` |
| `view/wxml/common/parity.js` |
| `view/wxml/load/index.js` |
| `view/wxml/renderer/registry.js` |
| `view/wxml/renderer/stub.js` |
| `pipeline/compile-target.js` |

允许新增集中 typedef 文件（如 `view/wxml/common/*.types.js` 或旁路 `.d.ts`），不改变运行时导出语义。  
`WxmlRenderer` / `LoadedGraph` 等契约类型以白名单内集中 typedef 为权威（D-TC-10）；禁止依赖未 check 的 `vue/index.js` 作为类型源。

## R-TC2（MUST）行为 0 与污染

- 不改编译产物语义；本门**不**改 build 为 tsc emit、**不**强制 rename `.ts`（build/迁 ts → [`fe-tools-bundler-tsc-dist`](../fe-tools-bundler-tsc-dist/README.md)）。
- 全量 vitest 通过；`fe/packages` 零改动。
- 相对实施基线：产物 code+sourcemap **MUST** diff=0（D-TC-6）。

## R-TC3（MUST）范围纪律

- 本门 **不**要求 `view/index.js`、`renderer/vue/tools.js`、`style/`、`logic/`、`npm-*` 等通过 check。
- `session` / `model` / `watch` / `dev` **不**进本门 `include`。
- 禁止借 typecheck 做算法重构或 API 语义变更；仅允许类型注解、JSDoc、必要的断言收窄、无行为改动的微小拆分。

## R-TC4（MUST）证据与回流

- 消融：去掉某白名单文件的 `// @ts-check` **不**作为失败判据；应以「故意破坏一处 typedef / 参数类型使 `tsc` 报错 → 恢复通过」证明门禁有效（Experience §6）。
- 短回流 `fe-tools-sidecar/architecture-notes.md`：bundler 类型门禁不变量（allowJs、CI typecheck、S1 白名单边界、集中 typedef）。
