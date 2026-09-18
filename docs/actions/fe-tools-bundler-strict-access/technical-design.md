# Technical Design — fe-tools-bundler-strict-access

## 1. tsconfig.json 变更

在 `fe/tools/bundler/tsconfig.json` 的 `compilerOptions` 中新增：

```json
"noUncheckedIndexedAccess": true,
"forceConsistentCasingInFileNames": true,
"allowUnusedLabels": false,
```

`tsconfig.build.json` extends `tsconfig.json`，自动继承。

## 2. 错误分类与修复策略

63 处 `noUncheckedIndexedAccess` 错误，5 种 TS 错误码：

| 错误码 | 数量 | 含义 | 修复策略 |
|--------|------|------|---------|
| TS2532 | 19 | Object is possibly 'undefined' | `!` / `if (x !== undefined)` / `?.` |
| TS18048 | 18 | Value is possibly 'undefined' | `!` / typeof 守卫 / `?.` |
| TS2345 | 15 | Argument `string\|undefined` → `string` | `!` / `?? ''` / `String()` |
| TS2322 | 7 | Type assignment `string\|undefined` → `string` | `!` / `?? ''` |
| TS2339 | 4 | Property access on union with undefined | typeof 守卫 / `?.` |

### 修复原则

1. **值确定存在** → `!` 非空断言（最小改动，语义清晰）
2. **值可能不存在但有默认** → `?? defaultValue`（运行时安全）
3. **值可能不存在需分支** → `if (x !== undefined)` 守卫
4. **属性链访问** → `?.` 可选链
5. **数组越界** → 边界检查（真实 bug 修复）

### 行为 0 保证

- `!` 编译后擦除，运行时不变
- `?.` 编译后等价于 `x == null ? undefined : x.prop`，对非 null/undefined 输入等价
- `?? default` 只在 null/undefined 时触发，对有值输入不变
- `if (x !== undefined)` 对有值输入走 then 分支，等价
- `String(x)` 对 string 输入返回原值

## 3. 文件分布（18 文件）

| 文件 | 错误数 |
|------|--------|
| `view/wxml/napi/parse.ts` | 11 |
| `compiler/logic/index.ts` | 8 |
| `view/wxml/common/parity.ts` | 7 |
| `watch/watch-plan.ts` | 6 |
| `view/index.ts` | 6 |
| `model/compile-cache.ts` | 4 |
| `view/wxml/renderer/vue/tools.ts` | 4 |
| `view/wxml/common/document-ops.ts` | 3 |
| `pipeline/build-pipeline.ts` | 3 |
| `dev/dev-proxy.ts` | 2 |
| `bin/compile.ts` | 2 |
| 其他 7 文件各 1 | 7 |

## 4. 验证

- `tsc -p tsconfig.build.json` 0 错（含全部 strict lint + noUncheckedIndexedAccess）
- `tsc --noEmit --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch --noImplicitReturns --noImplicitOverride --noUncheckedIndexedAccess -p tsconfig.build.json` 0 错
- vitest 584/584
- 4 组产物 diff=0

## 待定

无。
