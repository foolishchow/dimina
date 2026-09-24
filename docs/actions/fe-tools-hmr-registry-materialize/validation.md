# Validation — fe-tools-hmr-registry-materialize

Status: **ready（2026-10-09）**

## Validation Plan

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-REG1 | registry 实体化（A-REG1） | grep orchestrator: registry.get(kind); 0 emptyRegistry | pending |
| P-REG2 | compile-target 替代（A-REG2） | grep compile-target: 0 compile 段; registry 派发 | pending |
| P-REG3 | 行为 0 三件套（A-REG3） | vitest + tsc + 6 项目 diff=0 | pending |
| P-REG4 | env.ts gradual（A-REG4） | grep env.ts: load 委托 Loader | pending |
| P-REG5 | compile-target 移除（A-REG5） | grep compile-target: 0 compile 段 | pending |
| P-REG6 | V-PC-5 | changed files 0 新 as any / 0 索引签名 | pending |

## 行为 0 三件套

- **vitest**：全量 spec 全绿
- **tsc**：`tsc --noEmit` 0 errors
- **diff=0**：one-shot 6 项目 production 路径 diff=0 对 baseline

## 实证结果（design.draft §5，DONE ✓）

| 实证 | 方法 | 判据 | 结果 |
| --- | --- | --- | --- |
| Loader 包装 | parse-walk → Loader.load | 可包装 | **PARTIAL**（F-H2-1: viewParseWalk monolithic 须拆分） |
| compile-target 边界 | deriveStagePlan 段划分 | compile 段可替代 | **PASS ✓** |
| env.ts load 映射 | load 函数归 Loader | gradual 可行 | **CLARIFY**（F-H2-2: load 在 domain） |
| env.ts load 映射 | load 函数归 Loader | gradual 可行 |
