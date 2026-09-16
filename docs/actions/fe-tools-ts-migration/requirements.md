# Requirements — fe-tools-ts-migration

## R-TM0 — .js 文件改名 .ts

MUST `bundler/src/` 下 72 个 `.js` 文件全部改名为 `.ts`（src/compiler 41 + src/根 2 + bin 3 + dev 5 + model 6 + session 4 + shared 8 + watch 3）。

## R-TM1 — import 后缀修正

MUST 所有 import 路径后缀修正：
- `.js` 文件 import 改名后的 .ts → 显式 `.ts` 后缀（Node native worker + vite 无法解析隐式映射，D-TD-20）
- `.ts` 文件 import .ts → `.js` 后缀（tsc rewriteRelativeImportExtensions rewrite）或显式 `.ts`（D-TM-1 拍板）
- `__tests__/` import src/ .ts 后缀（D-TM-2 scope 内）

## R-TM2 — 行为 0

MUST 4 组产物 diff=0（nomap/min-nomap/sm/sm-min vs baseline）+ vitest 584/584 + tsc build OK。

## R-TM3 — worker strip-types

MUST worker-entry × 3 + worker-runtime runtime/executor 在 `/src/` 时走 `--experimental-strip-types` execArgv（现状已注入，D-TD-20）；dist 全 .js 无影响。

## R-TM4 — JSDoc → TS type 类型完善（D-TM-4 = 选项 B）

MUST 类型完善（R1 POC 证伪纯改名）：
- 9 个 `@typedef` → TS `type`/`interface`（4 文件：document/document-ops/emit/napi-parse）
- 361 个 `@param/@returns` → TS 函数签名注解（参数 :type + 返回 :returnType）
- 隐式 any → 推断或显式类型
- MUST NOT 用 `any` 类型（显式 any 禁止）
- MUST NOT 用 `noImplicitAny:false` 放宽（保持严格类型检查）
- MUST NOT 用 `// @ts-nocheck`

## Non-acceptance

- 不改 scripts/、crates/ 等 src 外
- 不改行为（产物字节一致）
- 不用 any（类型体系完善）
