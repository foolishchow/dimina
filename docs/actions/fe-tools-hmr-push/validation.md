# Validation — fe-tools-hmr-push

Status: **draft（2026-10-09）**

## Validation Plan

| ID | 验证项 | 命令/方法 | 状态 |
| --- | --- | --- | --- |
| P-PUSH1 | L_HMR level（A-PUSH1） | grep dev-reload: L_HMR | pending |
| P-PUSH2 | 增量 payload（A-PUSH2） | grep dev-server: 增量 payload broadcast | pending |
| P-PUSH3 | materialize 增量（A-PUSH3） | grep publish: 增量; build-model: dirty | pending |
| P-PUSH4 | fallback L1（A-PUSH4） | grep dev-reload: fallback | pending |
| P-PUSH5 | 行为 0 三件套（A-PUSH5） | vitest + tsc + 6 项目 diff=0 | pending |
| P-PUSH6 | V-PC-5 | changed files 0 新 as any / 0 索引签名 | pending |

## 行为 0 三件套

- **vitest**：全量 spec 全绿
- **tsc**：`tsc --noEmit` 0 errors
- **diff=0**：one-shot 6 项目（H4 仅 watch，one-shot 不受影响）

## 实证结果（design.draft §5，DONE ✓）

| 实证 | 方法 | 判据 | 结果 |
| --- | --- | --- | --- |
| payload 格式 | L_HMR payload 定义 | 格式明确 | **design def** |
| BuildModel dirty | track 变更 entries | 可行 | **F-H4-1**: 须加 dirtyEntries |
| publish 增量边界 | 增量发布可行性 | 可行 | **F-H4-2**: atomic move 须重构 |
| runtime fallback | 选项 ② runtime-side downgrade | 运行时侧 | **out of scope** |
| publish 增量 | 增量发布边界 | 可行 |
| runtime fallback | 选项 ② runtime-side downgrade | 运行时侧确认 |
