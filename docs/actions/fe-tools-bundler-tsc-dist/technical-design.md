# Technical Design — fe-tools-bundler-tsc-dist

Status: **冻结 v1（2026-09-15）** — D-TD-1..16；与 requirements / plan / acceptance 同步。

## 1. 门划分

```text
T0  tsconfig.build.json + build 改道 tsc emit；删除 sync-dist；保留 postbuild；typecheck include=src/**
T1  第0刀 *.types.ts + 第1刀 registry/stub/compile-target/parity.ts
T2  回归行为0 + 消融 + architecture-notes
```

## 2. Build 模型（B2）

```text
今日:   src/**/*.js  --sync-dist-->  dist/**/*.js
        postbuild: copy-sdk-assets + check-exports
目标:   src/**/*.{js,ts}  --tsc emit-->  dist/**/*.js
        postbuild: 不变（D-TD-13）
        sync-dist-from-src: 删除
```

（实锚：`src/` 当前无非 `.js` 文件；SDK 资源本就不经 sync，而经 `copy-sdk-assets`。）

建议 `tsconfig.build.json`（权威）：

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "allowJs": true,
    "checkJs": false,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*.js", "src/**/*.ts"],
  "exclude": ["**/__tests__/**", "dist", "node_modules"]
}
```

- `package.json`：`build` 调用 `tsc -p tsconfig.build.json`（随后跑既有 `postbuild`）。
- **删除** `scripts/sync-dist-from-src.js`（或等价停用，不再作为 build 步骤）（D-TD-13）。
- **不**第一刀上 `tsc -b`（D-TD-10）；**不** emit `scripts/`（D-TD-14）。

## 3. 与 typecheck 的关系

| 配置 | 用途 |
| --- | --- |
| `tsconfig.json` | `noEmit` + CI typecheck；`include` = 全 `src/**`（D-TD-15）；`checkJs: false` |
| `tsconfig.build.json` | emit 至 dist；`include` 同构 |

typecheck 的 S1 `@ts-check` 白名单在文件改 `.ts` 后改为普通 TS 检查（不再依赖 `// @ts-check`）。

## 4. 迁徙映射（MUST）

| 现状 | 目标 |
| --- | --- |
| `wxml/common/wxml-ir.types.js` | `wxml-ir.types.ts`（`export type` / `interface`） |
| `pipeline/compile-target.types.js` | `compile-target.types.ts` |
| `wxml/renderer/registry.js` | `registry.ts` |
| `wxml/renderer/stub.js` | `stub.ts` |
| `pipeline/compile-target.js` | `compile-target.ts` |
| `wxml/common/parity.js` | `parity.ts` |

**Type-only 模块（D-TD-16）**：仅含 `export type` / `interface` 的 `.ts` 经 emit 可产生 **空或极薄 `.js`**——**可接受**；消费方须用 `import type`（或等价擦除），保证无运行时依赖。不必为「类型文件」强行塞 `export {}` 以外的运行时值。

Import：NodeNext，书写 `from './x.js'`（D-TD-11）。更新 `view/index.js` 等消费方扩展名路径至 emit 后的 `.js`。

## 5. 行为 0

- 锚定 `examples/miniprogram/base` 的 nomap + sourcemap `diff -rq` = 0。
- dist 文本差异：记录但不阻断（除非导致加载失败）。

## Residual

- emit 全 `src` 时，未开 check 的 `.js` 仍可能被 emit「原样/近原样」；类型安全仍只覆盖迁徙面 + 既有 check 白名单。
- Type-only 模块空/极薄 emit 文件可接受（D-TD-16）。
