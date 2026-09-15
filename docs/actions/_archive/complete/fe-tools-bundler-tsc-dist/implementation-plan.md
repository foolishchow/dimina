# Implementation Plan — fe-tools-bundler-tsc-dist

Status: **ready（实施未授权）** — T0→T1→T2；行为 0；T0 含前置修复（R1 F1/F2）。

## 基线与纪律

- ✅ 前置 `fe-tools-bundler-typecheck` 已合入归档（`eb3b2bc4`）。
- ⛔ **热修先行（D-TD-19）**：`sync-compatibility-reference.js` outputPath → `core/`（`npm test` pretest 当前必炸；本门授权前先合入）。
- 授权时记录 HEAD；`fe/packages` 零触碰；与 `fe-tools-incremental-target` 分 PR。
- D-TD-1..19 冻结。

## 建议顺序

1. **T0a 前置修复**（R1-F1/F2，不做完 tsc emit 无法完成）：
   - D-TD-17：`napi/parse.js` 改包名 import `@dimina/wxml-parser-napi` + `dependencies` 声明（修 TS5055 + 发布隐疾）；dist 镜像与 CLI 冒烟复验。
   - D-TD-18：exports 三子路径重映射或删除（**处置与用户确认**）+ `check-package-exports.js` 同步（修 postbuild 必炸）。
   - 验证：`npm run build` exit 0（sync 模型下先恢复绿）。
2. **T0b build 改道**：`tsconfig.json` include 扩至全 `src/`（D-TD-15）；新增 `tsconfig.build.json`（exclude 显式含 `scripts/`）；`build`→tsc；**删除 sync-dist**；保留 postbuild；验证 dist 入口可 `import` + **CLI `dist/bin/index.js --version` 可执行**；typecheck 仍绿。
3. **T1a**：`*.types.js` → `*.types.ts`；更新引用。
4. **T1b**：registry / stub / compile-target / parity → `.ts`；修 import（去掉 `// @ts-check`——`.ts` 天然检查）。
5. **T2**：vitest + 产物对拍 + 消融 + architecture-notes；回填 A/P。

## 门禁

| 门 | Gate |
| --- | --- |
| T0a | TS5055 消除（dry emit 无 error）；`npm run build`（sync）exit 0 |
| T0b | build 经 tsc emit 全 `src/`；sync-dist 已删；postbuild 保留且 exit 0；CLI --version 可执行；typecheck include=src 且绿 |
| T1 | 第0/1刀路径为 `.ts`；typecheck 绿 |
| T2 | 580+ vitest；产物 diff=0；消融；回流 |

## 消融（P-TD06 扩展）

- 去掉 build 中 tsc emit（无 sync 可回退）→ dist 缺产物或入口加载失败 → 恢复通过。
- 拔回 D-TD-17 包名 import（恢复相对路径）→ T0 dry emit 重现 TS5055 → 证明前置修复必要性。