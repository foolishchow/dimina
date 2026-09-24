# Validation — fe-tools-hmr-emit-derive

Status: **ready（2026-10-09）**

## Validation Plan

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-ED1 | deriveFromGraph 接线（A-ED1） | grep orchestrator: deriveFromGraph 调用; 0 emitBuckets 读取 | done |
| P-ED2 | entry 映射实证（A-ED2） | 实证 cache 序 == emitBuckets 序 + 闭包集一致（design.draft §4） | done |
| P-ED3 | 行为 0 三件套（A-ED3） | vitest 全绿 + tsc 0 errors + 6 项目 diff=0 | done |
| P-ED4 | logic-only（A-ED4） | grep view/style emit 0 改动 | done |
| P-ED5 | emitBuckets 移除（A-ED5） | grep emitBuckets 0 src 残留 | done |
| P-ED6 | V-PC-5 | changed files 0 新 as any / 0 索引签名 | done |

## 行为 0 三件套

- **vitest**：全量 spec 全绿（84 files / 626 tests baseline）
- **tsc**：`tsc --noEmit` 0 errors
- **diff=0**：one-shot 6 项目 production 路径 diff=0 对 baseline（baseline = pre-H1 emitBuckets 路径）

## 升 ready 前实证（design.draft §4）

| 实证 | 方法 | 判据 |
| --- | --- | --- |
| cache 序 | build base → dump ModuleResultCache 插入序 vs emitBuckets.main 序 | 序一致 → 解法 B 可行 |
| 闭包集 | deriveFromGraph union（app + main pages）vs emitBuckets.main 集 | 集一致（去重后） |
| subs 映射 | 分包 root 下页 union 闭包 vs emitBuckets.subs[root] | 集一致 |
