# Implementation Plan — fe-tools-module-invalidation

Status: **ready（2026-09-20）** — 未授权改 `src`（`in_progress` 另授）。

## 纪律

- 遵守伞 D-MF-1 与本 TD D-IV-1..9；不改 emit/runtime id。
- `in_progress` 另授。

## 步骤

| Step | 动作 | 状态 |
| --- | --- | --- |
| 1 | 立项 `draft`；写入继承条款 + 伪代码骨架 + 待定表 | **done** |
| 2 | 讨论冻结 T1–T7 → D-IV-1..9 | **done**（2026-09-19） |
| 3 | review findings：Goal=`string[]`；requirements / A-IV0 对齐 | **done** |
| 4 | 升 `ready`（用户授权） | **done**（2026-09-20） |
| 5 | `in_progress`：实现 API + 单测（另授）。IV1 内序：① `getInvalidatedModules` 方法 → ② `computeInvalidatedModules` 函数 → ③ 5 案测例（对齐 TD §2.2 + D-IV-3） | pending |
| 6 | validation Actual；回流 architecture-notes；close | pending |

## 依赖

```text
fe-tools-module-centric (ready, D-MF-1)
        │
        ▼
本 Action IV0 讨论冻结 → ready → IV1 实现
        │
        ▼
fe-tools-module-result-cache (M2，未立)
```
