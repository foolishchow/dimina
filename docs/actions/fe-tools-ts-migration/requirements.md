# Requirements — fe-tools-ts-migration

## R-TM0 — .js 文件改名 .ts

MUST `bundler/src/` 下 72 个 `.js` 文件全部改名为 `.ts`（src/compiler 41 + src/根 2 + bin 3 + dev 5 + model 6 + session 4 + shared 8 + watch 3）。

## R-TM1 — import 后缀修正

MUST 所有 import 路径后缀修正：
- `.js` 文件 import 改名后的 .ts → 显式 `.ts` 后缀（Node native worker + vite 无法解析隐式映射，D-TD-20）
- `.ts` 文件 import .ts → `.js` 后缀（tsc rewriteRelativeImportExtensions rewrite）或显式 `.ts`（D-TM-1 拍板）
- `__tests__/` import src/ .ts 后缀（D-TM-2 待拍板）

## R-TM2 — 行为 0

MUST 4 组产物 diff=0（nomap/min-nomap/sm/sm-min vs baseline）+ vitest 584/584 + tsc build OK。

## R-TM3 — worker strip-types

MUST worker-entry × 3 + worker-runtime runtime/executor 在 `/src/` 时走 `--experimental-strip-types` execArgv（现状已注入，D-TD-20）；dist 全 .js 无影响。

## Non-acceptance

- 不加类型注解（checkJs 保持 false，仅改名 + 后缀）
- 不改 src/compiler 外（shared/、bin/、__tests__/ 留后续）
- 不改行为（产物字节一致）
