# Implementation Plan — fe-tools-bundler-tsc-dist

Status: **ready（实施未授权）** — T0→T1→T2；行为 0。

## 基线与纪律

- 建议待 `fe-tools-bundler-typecheck` 交付合入后再授 `in_progress`；授权时记录 HEAD。
- `fe/packages` 零触碰；与 `fe-tools-incremental-target` 分 PR。
- D-TD-1..16 冻结。

## 建议顺序

1. **T0**：`tsconfig.json` include 扩至全 `src/`（D-TD-15）；新增 `tsconfig.build.json`；`build`→tsc；**删除 sync-dist**；保留 postbuild；验证 dist 入口可 `import`；typecheck 仍绿。
2. **T1a**：`*.types.js` → `*.types.ts`；更新引用。
3. **T1b**：registry / stub / compile-target / parity → `.ts`；修 import。
4. **T2**：vitest + 产物对拍 + 消融 + architecture-notes；回填 A/P。

## 门禁

| 门 | Gate |
| --- | --- |
| T0 | build 经 tsc emit 全 `src/`；sync-dist 已删；postbuild 保留；typecheck include=src 且绿 |
| T1 | 第0/1刀路径为 `.ts`；typecheck 绿 |
| T2 | 580+ vitest；产物 diff=0；消融；回流 |
