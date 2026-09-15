# Technical Design — fe-tools-bundler-typecheck

Status: **冻结 v1（2026-09-15）** — D-TC-1..10；与 requirements / plan / acceptance 同步。

## 1. 分层

```text
S0  tsconfig + typecheck 脚本 + CI（fe-tests.yml）
S1  契约核 @ts-check（本门 MUST）
S2  管线壳（另立）
S3  view/index.js / vue-tools / style|logic|npm（另立）
```

## 2. tsconfig（权威）

路径：`fe/tools/bundler/tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "strict": true,
    "skipLibCheck": true,
    "maxNodeModuleJsDepth": 0
  },
  "include": [
    "src/compiler/**/*.js",
    "src/compiler/**/*.d.ts"
  ],
  "exclude": [
    "dist",
    "node_modules",
    "**/__tests__/**"
  ]
}
```

- 未带 `// @ts-check` 的 `.js` 可被解析为模块形状，但**不**因类型错误挡 CI。
- 域外 import（如 `shared/`）可解析；**不保证**对其 check（见 Residual）。

## 3. S1 白名单与契约

| 文件 | 类型重点 |
| --- | --- |
| `common/document.js` | 已有 `@typedef`（Span/Attr/Document…）→ 校对完整性 |
| `common/document-ops.js` | 操作面入参/返回与 Document 对齐 |
| `common/parity.js` | 语义比较签名 |
| `load/index.js` | `loadTemplates` / LoadedGraph 入参与 `tools` 袋形状 |
| `renderer/registry.js` | `WxmlRenderer` 注册/查询 API |
| `renderer/stub.js` | stub 实现满足 `WxmlRenderer` |
| `pipeline/compile-target.js` | CompileTarget / createCompileTarget 公开形状 |

### 3.1 集中 typedef（D-TC-10）

- 在白名单内（优先 `view/wxml/common/` 或 `view/wxml/renderer/` 旁路）维护 **`LoadedGraph`、`WxmlRenderer`**（及 S1 必需的 ctx/tools 形状）。
- `registry.js` / `stub.js` / `load/index.js` **引用集中 typedef**，**不得**再以 `import('./vue/index.js').WxmlRenderer` 作为权威类型源。
- **不**为本门给 `vue/index.js` 开 `@ts-check`。
- 跨白名单边界（如 load → parse）：JSDoc 导入 typedef 或最小 `.d.ts`；**不**强制给 parse 引擎开 `@ts-check`。

## 4. 包与 CI

- `package.json`：`"typecheck": "tsc --noEmit"`；`devDependencies.typescript` 与 `fe/package.json` 同 major/range（D-TC-8）。
- CI：`.github/workflows/fe-tests.yml` 增加一步，例如 `pnpm --filter @dimina/bundler typecheck`（失败阻断；D-TC-9）。

## 5. 行为 0 纪律

- 禁止改函数体控制流/产物字段语义来「讨好」类型。
- 允许：`@param` / `@typedef` / `@returns`、`/** @type {…} */`、必要的 `typeof` 收窄、极少 `@ts-expect-error`（须单行理由）。
- `meta.backend` 等产物字段名不因类型重命名。
- 相对实施基线产物+sourcemap **MUST** diff=0。

## Residual

- 类型门禁只证明白名单契约可被 `tsc` 检查；不等于全 compiler 类型安全。
- 域外模块（`shared/` 等）被解析时不保证 check。
